/**
 * Level 3 — Festival Market (memory match: 8 festive items + 8 meanings).
 * Item art reuses the Village Square images, plus gift and streamer art.
 */
import diyaImg from "./stage1/diya.png";
import flowersImg from "./stage1/flower_garland.png";
import rangoliImg from "./stage1/rangoli_colors.png";
import sweetsImg from "./stage1/sweet_box.png";
import lanternImg from "./stage1/paper_lantern.png";
import toranImg from "./stage1/mango_leaf_toran.png";
import giftImg from "./stage1/gify.png";
import streamersImg from "./stage1/streamer.png";
import deskBg from "./stage3/stage3_desk.png";
import mobBg from "./stage3/stage3_mob.png";
import cardFront from "./stage3/front.png";
import cardBack from "./stage3/back.png";

export { deskBg as FESTIVAL_MARKET_DESK_BG, mobBg as FESTIVAL_MARKET_MOB_BG };
export { cardFront as CARD_FRONT_IMG, cardBack as CARD_BACK_IMG };

export const FESTIVAL_MARKET_PUZZLE_ID = "festival_market";

/** Points written to DB `stage3` when all pairs are matched. */
export const FESTIVAL_MARKET_POINTS = 100;

/** Journey completion after this checkpoint (3 of 5). */
export const FESTIVAL_MARKET_COMPLETION_PERCENT = 60;

/** How long a wrong pair stays face up before flipping back. */
export const MISMATCH_DELAY_MS = 900;

export const FESTIVAL_MARKET_PAIRS = [
  {
    id: "lamp",
    item: "Lamp",
    emoji: "🪔",
    image: diyaImg,
    meaning: "Hope & Positivity",
    learning: {
      heading: "A Light That Brings Hope",
      text: "Lighting a lamp symbolizes optimism, warmth, and the beginning of joyful moments.",
    },
  },
  {
    id: "flowers",
    item: "Flowers",
    emoji: "🌸",
    image: flowersImg,
    meaning: "Welcome & Celebration",
    learning: {
      heading: "A Warm Welcome",
      text: "Flowers create an inviting atmosphere and express appreciation for those who gather to celebrate.",
    },
  },
  {
    id: "rangoli",
    item: "Rangoli",
    emoji: "🎨",
    image: rangoliImg,
    meaning: "Hospitality & Creativity",
    learning: {
      heading: "A Creative Welcome",
      text: "Rangoli adds colour and creativity while making every guest feel welcome.",
    },
  },
  {
    id: "gift",
    item: "Gift",
    emoji: "🎁",
    image: giftImg,
    // The art sits inside wide transparent margins; enlarge to match the others.
    artScale: 1.3,
    meaning: "Appreciation & Sharing",
    learning: {
      heading: "The Joy of Giving",
      text: "Exchanging gifts is a thoughtful way of expressing gratitude and strengthening relationships.",
    },
  },
  {
    id: "sweets",
    item: "Sweets",
    emoji: "🍬",
    image: sweetsImg,
    meaning: "Joy & Togetherness",
    learning: {
      heading: "Celebrate Together",
      text: "Sharing sweets reflects joy, generosity, and the happiness of celebrating together.",
    },
  },
  {
    id: "lantern",
    item: "Lantern",
    emoji: "🏮",
    image: lanternImg,
    meaning: "Warmth & Unity",
    learning: {
      heading: "Lighting the Celebration",
      text: "Lanterns brighten festive spaces and create a warm atmosphere that brings people together.",
    },
  },
  {
    id: "streamers",
    item: "Streamers",
    emoji: "🎊",
    image: streamersImg,
    artScale: 1.15,
    meaning: "Celebration & Happiness",
    learning: {
      heading: "Adding Colour to the Moment",
      text: "Festive decorations create excitement and make every celebration feel special.",
    },
  },
  {
    id: "toran",
    item: "Toran",
    emoji: "🌿",
    image: toranImg,
    meaning: "Welcome & Good Fortune",
    learning: {
      heading: "Welcoming New Beginnings",
      text: "Decorative door hangings are traditionally used to welcome guests and mark the beginning of joyful occasions.",
    },
  },
];

export const FESTIVAL_MARKET_STORY = {
  heading: "Every Symbol Has a Meaning",
  quote: "“Behind every festive symbol is a story waiting to be discovered.”",
  paragraphs: [
    "Welcome to the Festival Market, where traditions come to life through colours, decorations, and celebrations.",
    "Your challenge is to match each festive item with the meaning it represents. Every correct match brings you closer to understanding the spirit behind celebrations.",
    "Complete every match to earn the Key of Symbolism.",
  ],
  objective: "Match every festive item with its correct meaning.",
  button: "Start Matching",
};

export const FESTIVAL_MARKET_RETRY = {
  heading: "Try Another Match",
  text: "Take your time and remember the meaning behind each festive symbol. Every correct match brings you closer to the Grand Celebration.",
};

export const FESTIVAL_MARKET_SUCCESS = {
  heading: "You've Uncovered the Symbols!",
  text: "Every festive symbol tells a story, and you've discovered the meaning behind each one.",
  reward: "By understanding these traditions, you've earned the Key of Symbolism.",
  next: "Return to the Journey Map and continue toward the Celebration Steps.",
  button: "Continue Journey",
};

const PAIR_IDS = new Set(FESTIVAL_MARKET_PAIRS.map((p) => p.id));
const CACHE_KEY = "festival_market_progress";

/** Small deterministic PRNG (mulberry32) so a seed always gives the same board. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newBoardSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

/** The 16 cards in board order for `seed`: { id: "item:lamp" | "meaning:lamp", kind, pair }. */
export function buildBoard(seed) {
  const cards = FESTIVAL_MARKET_PAIRS.flatMap((p) => [
    { id: `item:${p.id}`, kind: "item", pair: p },
    { id: `meaning:${p.id}`, kind: "meaning", pair: p },
  ]);
  const rand = mulberry32(seed);
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Normalise { seed, matched } from the server, DB or cache. */
export function cleanProgress(value) {
  const matched = Array.isArray(value?.matched)
    ? [...new Set(value.matched.filter((id) => PAIR_IDS.has(id)))]
    : [];
  const seed = Number.isInteger(value?.seed) && value.seed >= 0 ? value.seed : null;
  return { seed, matched };
}

/** Progress from a stages row (`stage3_ans`); empty if none / other puzzle. */
export function readProgressFromStage(stage) {
  let ans = stage?.stage3_ans;
  if (typeof ans === "string") {
    try {
      ans = JSON.parse(ans);
    } catch {
      ans = null;
    }
  }
  if (!ans || ans.puzzle !== FESTIVAL_MARKET_PUZZLE_ID) return { seed: null, matched: [] };
  return cleanProgress(ans);
}

/** Session cache: keeps the board seed (and demo progress) across a refresh. */
export function readCachedProgress() {
  try {
    return cleanProgress(JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return { seed: null, matched: [] };
  }
}

export function writeCachedProgress(progress) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cleanProgress(progress)));
  } catch {
    /* storage unavailable: DB remains the source of truth */
  }
}

/** Server check of a flipped pair → { match }. Throws on network / server error. */
export async function submitFestivalMatch({
  backendBase,
  adminToken,
  storedUser,
  stageId,
  first,
  second,
  seed,
}) {
  if (!backendBase || !adminToken) throw new Error("Match service unavailable");
  const res = await fetch(`${backendBase}/festivalMarketMatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: storedUser?.userId || storedUser?.userid || storedUser?.id,
      stageId: stageId || undefined,
      first,
      second,
      seed,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Match check failed (${res.status})`);
  }
  return { match: Boolean(data.match) };
}

/**
 * Sound-effect hook. Stage 8 wires audio by listening for `jnb:sfx`
 * (detail = "card-flip" | "match" | "mismatch").
 */
export function playSfx(name) {
  try {
    window.dispatchEvent(new CustomEvent("jnb:sfx", { detail: name }));
  } catch {
    /* no-op outside the browser */
  }
}
