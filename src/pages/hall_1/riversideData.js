/**
 * Level 2 — Riverside Crossing (Myth or Fact + bridge assembly).
 * Correct answers are NOT stored here; the server checks them (riversideCrossing).
 */
import mythImg from "./stage2/myth.png";
import factImg from "./stage2/fact.png";

export const RIVERSIDE_PUZZLE_ID = "riverside_crossing";

/** Points written to DB `stage2` once the bridge is crossed. */
/* 5 points per correct statement answered (8 × 5); the live counter adds them one by one. */
export const RIVERSIDE_POINTS = 40;

/** Journey completion after this checkpoint (2 of 5). */
export const RIVERSIDE_COMPLETION_PERCENT = 40;

/** Scene art (served from /public: SVGR cannot parse the embedded PNGs). */
export const RIVERSIDE_DESK_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/stage2/stage2_desk.svg`;
export const RIVERSIDE_MOB_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/stage2/stage2_mob.svg`;

export const ANSWER_BUTTONS = [
  { answer: "myth", label: "Myth", image: mythImg },
  { answer: "fact", label: "Fact", image: factImg },
];

/**
 * SVG ids per layout. `slots` are the planks drawn in the bridge gap (hidden
 * until placed); `tray` are the planks in the bottom tray. Index i = plank i+1.
 * `complete` is the finished-bridge art shown once all planks are laid.
 */
export const RIVERSIDE_SVG_IDS = {
  desk: {
    complete: "Complete",
    slots: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
    tray: ["P1U", "P2U", "P3U", "P4U", "P5U", "P6U", "P7U", "P8U"],
  },
  mob: {
    complete: "Complete",
    slots: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
    tray: ["P1-2", "P2-2", "P3-2", "P4-2", "P5-2", "P6-2", "P7-2", "P8-2"],
  },
};

export const RIVERSIDE_STATEMENTS = [
  {
    id: "s1",
    text: "Celebrations are only about decorations and entertainment.",
    learning: {
      heading: "More Than Decorations",
      text: "Celebrations are opportunities to strengthen relationships, preserve traditions, and create meaningful memories together.",
    },
  },
  {
    id: "s2",
    text: "Sharing food and sweets is a way of expressing joy and togetherness.",
    learning: {
      heading: "The Joy of Sharing",
      text: "Sharing food is one of the simplest ways to spread happiness and make everyone feel included in the celebration.",
    },
  },
  {
    id: "s3",
    text: "Traditional decorations often have symbolic meanings beyond their appearance.",
    learning: {
      heading: "Every Decoration Has a Story",
      text: "Many decorations represent warmth, prosperity, welcome, or new beginnings, making them more than just visual elements.",
    },
  },
  {
    id: "s4",
    text: "Festivals should always be celebrated in only one specific way.",
    learning: {
      heading: "Every Celebration is Unique",
      text: "Communities and families celebrate in different ways, while preserving the same spirit of togetherness and joy.",
    },
  },
  {
    id: "s5",
    text: "Choosing sustainable decorations helps protect the environment during celebrations.",
    learning: {
      heading: "Celebrate Responsibly",
      text: "Simple choices like reusable decorations and eco-friendly materials make celebrations more sustainable.",
    },
  },
  {
    id: "s6",
    text: "Only adults play an important role in celebrations.",
    learning: {
      heading: "Everyone Has a Role",
      text: "Celebrations become memorable because people of all ages contribute in their own special ways.",
    },
  },
  {
    id: "s7",
    text: "Festivals help bring communities closer together.",
    learning: {
      heading: "Stronger Together",
      text: "Celebrations create opportunities to connect, share experiences, and build lasting memories with others.",
    },
  },
  {
    id: "s8",
    text: "Learning about traditions helps us appreciate them even more.",
    learning: {
      heading: "Understanding Builds Appreciation",
      text: "Knowing the meaning behind traditions makes every celebration more meaningful and memorable.",
    },
  },
];

export const RIVERSIDE_STORY = {
  heading: "Separate Myth from Fact",
  quote:
    "“The more we understand our traditions, the more meaningful our celebrations become.”",
  paragraphs: [
    "You've arrived at the Riverside Crossing, but the bridge ahead is incomplete.",
    "Before crossing, test your knowledge by identifying common myths and facts about festive traditions and celebrations.",
    "Every correct answer earns you a bridge plank. Collect them all, build the bridge, and continue your journey.",
  ],
  objective:
    "Identify all the myths and facts correctly to collect every bridge plank.",
  button: "Start",
};

export const RIVERSIDE_RETRY = {
  heading: "Take Another Look",
  text: "Some traditions are widely understood, while others are often misunderstood. Read each statement carefully and decide whether it is a myth or a fact.",
  button: "Try Again",
};

export const RIVERSIDE_SUCCESS = {
  heading: "You've Built the Bridge!",
  text: "You've separated myth from fact and uncovered the stories behind meaningful celebrations. Your knowledge has helped you gather every bridge plank needed to continue the journey.",
  reward: "You have earned the Key of Beliefs.",
  next: "Build the bridge to continue toward the Festival Market.",
  button: "Continue Journey",
};

const TOTAL = RIVERSIDE_STATEMENTS.length;
const VALID_IDS = new Set(RIVERSIDE_STATEMENTS.map((s) => s.id));
const CACHE_KEY = "riverside_crossing_progress";

/** Normalise { correct, placed } from the server, DB or cache. */
export function cleanProgress(value) {
  const correct = Array.isArray(value?.correct)
    ? [...new Set(value.correct.filter((id) => VALID_IDS.has(id)))]
    : [];
  const placed =
    correct.length === TOTAL
      ? Math.max(0, Math.min(TOTAL, Math.floor(Number(value?.placed) || 0)))
      : 0;
  return { correct, placed };
}

/** Progress from a stages row (`stage2_ans`); empty if none / other puzzle. */
export function readProgressFromStage(stage) {
  let ans = stage?.stage2_ans;
  if (typeof ans === "string") {
    try {
      ans = JSON.parse(ans);
    } catch {
      ans = null;
    }
  }
  if (!ans || ans.puzzle !== RIVERSIDE_PUZZLE_ID) return { correct: [], placed: 0 };
  return cleanProgress(ans);
}

/** Session cache so demo / offline play also survives a refresh. */
export function readCachedProgress() {
  try {
    return cleanProgress(JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return { correct: [], placed: 0 };
  }
}

export function writeCachedProgress(progress) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cleanProgress(progress)));
  } catch {
    /* storage unavailable: DB remains the source of truth */
  }
}

async function postJson(backendBase, adminToken, path, body) {
  if (!backendBase || !adminToken) throw new Error("Service unavailable");
  const res = await fetch(`${backendBase}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `${path} failed (${res.status})`);
  }
  return data;
}

function userIdOf(storedUser) {
  return storedUser?.userId || storedUser?.userid || storedUser?.id;
}

/** Server-side Myth/Fact check → { correct }. Throws on network / server error. */
export async function submitRiversideAnswer({
  backendBase,
  adminToken,
  storedUser,
  stageId,
  statementId,
  answer,
}) {
  const data = await postJson(backendBase, adminToken, "riversideAnswer", {
    userId: userIdOf(storedUser),
    stageId: stageId || undefined,
    statementId,
    answer,
  });
  return { correct: Boolean(data.correct) };
}

/** Persist how many planks are laid on the bridge (best effort). */
export async function saveRiversidePlanks({ backendBase, adminToken, storedUser, stageId, placed }) {
  if (!stageId) return;
  await postJson(backendBase, adminToken, "riversidePlanks", {
    userId: userIdOf(storedUser),
    stageId,
    placed,
  });
}
