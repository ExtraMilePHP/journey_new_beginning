/**
 * Level 5 — Grand Celebration (unscramble the missing word) + the finale.
 * Answers are NOT stored here; the server checks them (grandCelebration).
 * `scrambled` is the PRD's letter hint shown as tiles.
 */
import deskBg from "./stage5/stage5_desk.png";
import mobBg from "./stage5/stage5_mob.png";

export { deskBg as GRAND_CELEBRATION_DESK_BG, mobBg as GRAND_CELEBRATION_MOB_BG };

export const GRAND_CELEBRATION_PUZZLE_ID = "grand_celebration";

/** Points written to DB `stage5` when every word is solved. */
/* 5 points per correct word solved (8 × 5); the live counter adds them one by one. */
export const GRAND_CELEBRATION_POINTS = 40;

/** Journey completion after the final checkpoint. */
export const GRAND_CELEBRATION_COMPLETION_PERCENT = 100;

export const GRAND_CELEBRATION_QUESTIONS = [
  {
    id: "q1",
    before: "Every celebration is an opportunity to create lasting",
    after: ".",
    scrambled: "SMMROEIE",
    learning: "Every celebration becomes a cherished memory shared with others.",
  },
  {
    id: "q2",
    before: "Sharing happiness helps strengthen our sense of",
    after: ".",
    // PRD hint "HOETRGTNESE" is one S short of TOGETHERNESS (12 letters).
    scrambled: "HOETRGTNESSE",
    learning: "Celebrations become more meaningful when everyone feels included.",
  },
  {
    id: "q3",
    before: "The best celebrations begin with positive",
    after: ".",
    scrambled: "GINNNSEBGI",
    learning: "Every new beginning is an opportunity to grow, learn, and celebrate.",
  },
  {
    id: "q4",
    before: "Simple acts of kindness show genuine",
    after: ".",
    scrambled: "PSRTEEC",
    learning: "Respect creates stronger relationships and more meaningful celebrations.",
  },
  {
    id: "q5",
    before: "Expressing",
    after: "makes every celebration more meaningful.",
    scrambled: "DGTIATUER",
    learning: "Taking time to appreciate others creates lasting connections.",
  },
  {
    id: "q6",
    before: "Working together creates greater",
    after: ".",
    scrambled: "AHRYMON",
    learning: "Harmony allows communities to celebrate together with understanding and joy.",
  },
  {
    id: "q7",
    before: "Every celebration is brighter when shared with",
    after: ".",
    scrambled: "KNSDNIES",
    learning: "Kindness is one of the simplest ways to make every gathering memorable.",
  },
  {
    id: "q8",
    before: "The greatest celebrations are built on shared",
    after: ".",
    scrambled: "VLAUES",
    learning:
      "Values such as kindness, gratitude, respect, and togetherness make every celebration truly special.",
  },
];

export const GRAND_CELEBRATION_STORY = {
  heading: "The Final Step Awaits",
  quote:
    "“Every celebration leaves us with memories, but the greatest takeaway is the wisdom we gain along the way.”",
  paragraphs: [
    "You've completed every checkpoint and uncovered the traditions, beliefs, symbols, and values that make celebrations meaningful.",
    "One final challenge remains.",
    "Complete the missing words and unlock the Grand Celebration.",
  ],
  objective: "Unscramble the highlighted word to complete each sentence.",
  button: "Begin",
};

export const GRAND_CELEBRATION_RETRY = {
  heading: "Not Quite Yet",
  text: "Look closely at the letters and the sentence around the blank. Rearrange the tiles and try again.",
  button: "Try Again",
};

export const GRAND_CELEBRATION_SUCCESS = {
  heading: "You've Earned the Final Key!",
  text: "Congratulations! You've completed every checkpoint and discovered the traditions, stories, symbols, and values that make celebrations meaningful.",
  reward: "You have earned the Key of Wisdom.",
  next: "It's time to unlock the Grand Celebration!",
  button: "Celebrate",
};

export const FINAL_SCREEN = {
  heading: "The Celebration Begins!",
  paragraphs: [
    "Congratulations on completing your Journey of New Beginnings.",
    "Along the way, you've explored the traditions, symbols, and values that bring people together and make every celebration memorable.",
    "May every new beginning inspire joy, gratitude, harmony, and meaningful connections.",
    "Thank you for being part of the journey. Happy Celebrations!",
  ],
};

/** The five Keys of Knowledge, one per checkpoint. */
export const JOURNEY_KEYS = [
  { id: "traditions", label: "Key of Traditions", checkpoint: "Village Square" },
  { id: "beliefs", label: "Key of Beliefs", checkpoint: "Riverside Crossing" },
  { id: "symbolism", label: "Key of Symbolism", checkpoint: "Festival Market" },
  { id: "values", label: "Key of Values", checkpoint: "Celebration Steps" },
  { id: "wisdom", label: "Key of Wisdom", checkpoint: "Grand Celebration" },
];

const VALID_IDS = new Set(GRAND_CELEBRATION_QUESTIONS.map((q) => q.id));
const CACHE_KEY = "grand_celebration_solved";

export function cleanSolved(list) {
  return Array.isArray(list) ? [...new Set(list.filter((id) => VALID_IDS.has(id)))] : [];
}

/** Solved words from a stages row (`stage5_ans`); empty if none / other puzzle. */
export function readSolvedFromStage(stage) {
  let ans = stage?.stage5_ans;
  if (typeof ans === "string") {
    try {
      ans = JSON.parse(ans);
    } catch {
      ans = null;
    }
  }
  if (!ans || ans.puzzle !== GRAND_CELEBRATION_PUZZLE_ID) return [];
  return cleanSolved(ans.solved);
}

export function readCachedSolved() {
  try {
    return cleanSolved(JSON.parse(sessionStorage.getItem(CACHE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function writeCachedSolved(solved) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cleanSolved(solved)));
  } catch {
    /* storage unavailable: DB remains the source of truth */
  }
}

/** Leaderboard is shown unless the theme turns it off. */
export function readLeaderboardEnabled(themeData) {
  const s = themeData?.settings || themeData || {};
  const v = s.leaderboardEnabled ?? s.leaderboard;
  return v !== false && v !== "false" && v !== 0 && v !== "0";
}

/**
 * Leaderboard submit hook. Stage 8 wires the real submission by listening for
 * `jnb:leaderboard-submit` (detail: { points, time, userId }).
 */
export function requestLeaderboardSubmit(detail) {
  try {
    window.dispatchEvent(new CustomEvent("jnb:leaderboard-submit", { detail }));
  } catch {
    /* no-op outside the browser */
  }
}

async function postJson(backendBase, adminToken, path, body) {
  if (!backendBase || !adminToken) throw new Error("Service unavailable");
  const res = await fetch(`${backendBase}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || `${path} failed (${res.status})`);
  return data;
}

/** Server check of an arranged word → { correct }. */
export async function submitGrandCelebrationAnswer({
  backendBase,
  adminToken,
  storedUser,
  stageId,
  questionId,
  answer,
}) {
  const data = await postJson(backendBase, adminToken, "grandCelebrationAnswer", {
    userId: storedUser?.userId || storedUser?.userid || storedUser?.id,
    stageId: stageId || undefined,
    questionId,
    answer,
  });
  return { correct: Boolean(data.correct) };
}

/** Save the post-game feedback label on the player's stages row. */
export async function submitGameFeedback({ backendBase, adminToken, storedUser, feedback }) {
  await postJson(backendBase, adminToken, "welcomeStageFeedback", {
    userId: storedUser?.userId || storedUser?.userid || storedUser?.id,
    feedback,
  });
}

/** One correct letter at `position` → { position, letter }. */
export async function requestGrandCelebrationHint({ backendBase, adminToken, questionId, position }) {
  const data = await postJson(backendBase, adminToken, "grandCelebrationHint", {
    questionId,
    position,
  });
  return { position: data.position, letter: String(data.letter || "") };
}
