/**
 * Level 1 — Village Square (hidden objects + MCQ).
 * Correct answers are NOT stored here; the server checks them (villageSquareAnswer).
 */

import diyaImg from "./stage1/diya.png";
import garlandImg from "./stage1/flower_garland.png";
import coconutImg from "./stage1/coconut.png";
import sweetBoxImg from "./stage1/sweet_box.png";
import rangoliImg from "./stage1/rangoli_colors.png";
import leavesImg from "./stage1/mango_leaf_toran.png";
import bellImg from "./stage1/brass_bell.png";
import lanternImg from "./stage1/paper_lantern.png";

export const VILLAGE_SQUARE_PUZZLE_ID = "village_square";

/** Points written to DB `stage1` when all items are collected. */
export const VILLAGE_SQUARE_POINTS = 100;

/** Journey completion shown after this checkpoint (1 of 5). */
export const VILLAGE_SQUARE_COMPLETION_PERCENT = 20;

/** Scene art (served from /public: SVGR cannot parse the embedded PNGs). */
export const VILLAGE_SQUARE_DESK_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/stage1/S1.svg`;
export const VILLAGE_SQUARE_MOB_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/stage1/S1_mobile.svg`;

/**
 * SVG element ids per layout. The two files name layers differently:
 * desktop scene objects are `obN` (tray icon `obN-2`); mobile is the reverse.
 * Re-map an item by editing its `scene` / `tray` ids here.
 * `image` is the real item art that replaces the tray icon once found.
 */
export const VILLAGE_SQUARE_ITEMS = [
  {
    id: "diya",
    name: "Earthen Lamp (Diya)",
    emoji: "🪔",
    image: diyaImg,
    scene: { desk: "ob5", mob: "ob5-2" },
    tray: { desk: "ob5-2", mob: "ob5" },
    question: "Why are lamps commonly lit during celebrations?",
    options: [
      "To symbolize hope and positivity",
      "To make the celebration brighter",
      "To keep insects away",
      "To decorate the entrance only",
    ],
    learning: {
      heading: "Lighting the Way",
      text: "Lighting a lamp symbolizes hope, positivity, and the beginning of joyful moments shared with others.",
    },
  },
  {
    id: "garland",
    name: "Flower Garland",
    emoji: "🌸",
    image: garlandImg,
    scene: { desk: "ob6", mob: "ob6-2" },
    tray: { desk: "ob6-2", mob: "ob6" },
    question: "Why are flower garlands used during celebrations?",
    options: [
      "To welcome guests and create a festive atmosphere",
      "To cover empty spaces",
      "To make places smell pleasant",
      "To indicate the end of a celebration",
    ],
    learning: {
      heading: "A Warm Welcome",
      text: "Flowers are often used to welcome people and create an atmosphere of joy, celebration, and togetherness.",
    },
  },
  {
    id: "coconut",
    name: "Coconut",
    emoji: "🥥",
    image: coconutImg,
    scene: { desk: "ob4", mob: "ob4-2" },
    tray: { desk: "ob4-2", mob: "ob4" },
    question: "What does offering a coconut traditionally represent?",
    options: [
      "A fresh beginning and sincerity",
      "Good weather",
      "Prosperity through trade",
      "A festive decoration",
    ],
    learning: {
      heading: "A Symbol of New Beginnings",
      text: "The coconut is often associated with fresh starts, sincerity, and beginning an occasion with positive intentions.",
    },
  },
  {
    id: "sweet_box",
    name: "Sweet Box",
    emoji: "🎁",
    image: sweetBoxImg,
    scene: { desk: "ob8", mob: "ob8-2" },
    tray: { desk: "ob8-2", mob: "ob8" },
    question: "Why are sweets shared during celebrations?",
    options: [
      "To spread happiness and celebrate together",
      "To end a meal",
      "To decorate the table",
      "To welcome performers",
    ],
    learning: {
      heading: "Sharing Joy",
      text: "Exchanging sweets is a simple tradition that reflects happiness, generosity, and togetherness.",
    },
  },
  {
    id: "rangoli",
    name: "Rangoli Colours",
    emoji: "🎨",
    image: rangoliImg,
    scene: { desk: "ob7", mob: "ob7-2" },
    tray: { desk: "ob7-2", mob: "ob7" },
    question: "Why is rangoli created during celebrations?",
    options: [
      "To welcome guests and add colour to the occasion",
      "To mark parking spaces",
      "To identify homes",
      "To entertain children",
    ],
    learning: {
      heading: "A Colourful Welcome",
      text: "Rangoli represents creativity, warmth, and hospitality, making every visitor feel welcomed.",
    },
  },
  {
    id: "leaves",
    name: "Decorative Leaves",
    emoji: "🌿",
    image: leavesImg,
    scene: { desk: "ob2", mob: "ob2-2" },
    tray: { desk: "ob2-2", mob: "ob2" },
    question: "Why are natural leaves often used as festive decorations?",
    options: [
      "They represent freshness and prosperity",
      "They provide shade",
      "They keep decorations in place",
      "They are easy to find",
    ],
    learning: {
      heading: "Inspired by Nature",
      text: "Natural decorations remind us of our connection with nature and the importance of welcoming new beginnings with freshness and positivity.",
    },
  },
  {
    id: "bell",
    name: "Celebration Bell",
    emoji: "🔔",
    image: bellImg,
    scene: { desk: "ob1", mob: "ob1-2" },
    tray: { desk: "ob1-2", mob: "ob1" },
    question: "Why is a bell often rung during celebrations?",
    options: [
      "To gather everyone's attention and mark an important moment",
      "To signal the end of the event",
      "To begin a performance only",
      "To decorate the venue",
    ],
    learning: {
      heading: "A Moment to Gather",
      text: "The sound of a bell brings people together and marks the beginning of meaningful moments during a celebration.",
    },
  },
  {
    id: "lantern",
    name: "Lantern",
    emoji: "🏮",
    image: lanternImg,
    scene: { desk: "ob3", mob: "ob3-2" },
    tray: { desk: "ob3-2", mob: "ob3" },
    question: "Lanterns are commonly displayed during celebrations because they...",
    options: [
      "Create a warm and welcoming atmosphere",
      "Keep birds away",
      "Show the time of day",
      "Replace streetlights",
    ],
    learning: {
      heading: "A Warm Glow",
      text: "Lanterns brighten the surroundings and symbolize warmth, hope, and joyful celebrations shared with others.",
    },
  },
];

export const OPTION_LETTERS = ["A", "B", "C", "D"];

export const VILLAGE_SQUARE_STORY = {
  heading: "Every Celebration Begins with Preparation",
  quote:
    "“The best celebrations are built on thoughtful traditions and shared moments.”",
  paragraphs: [
    "Welcome to the Village Square, where festive preparations are in full swing.",
    "As you explore, you'll discover everyday celebration items hidden throughout the village. Find each one and answer the question that follows to learn why these traditions continue to be an important part of celebrations across generations.",
    "Complete this checkpoint to earn the Key of Traditions and unlock the next stage of your journey.",
  ],
  objective:
    "Find all the hidden festive items and answer every question correctly.",
  button: "Start Exploring",
};

export const VILLAGE_SQUARE_RETRY = {
  heading: "Let's Try That Again",
  text: "Every festive tradition has a purpose. Take another look and choose the answer that best reflects the significance of the item.",
  button: "Try Again",
};

export const VILLAGE_SQUARE_SUCCESS = {
  heading: "You've Discovered the Traditions!",
  text: "Every celebration begins with thoughtful preparations and meaningful traditions. By discovering the stories behind these festive items, you've taken the first step on your Journey of New Beginnings.",
  reward: "You have earned the Key of Traditions.",
  button: "Continue Journey",
};

const FOUND_CACHE_KEY = "village_square_found";
const VALID_IDS = new Set(VILLAGE_SQUARE_ITEMS.map((i) => i.id));

function cleanFoundList(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => VALID_IDS.has(id)))];
}

/** Found item ids from a stages row (`stage1_ans`), or [] if none / other puzzle. */
export function readFoundFromStage(stage) {
  let ans = stage?.stage1_ans;
  if (typeof ans === "string") {
    try {
      ans = JSON.parse(ans);
    } catch {
      return [];
    }
  }
  if (!ans || ans.puzzle !== VILLAGE_SQUARE_PUZZLE_ID) return [];
  return cleanFoundList(ans.found);
}

/** Session cache so demo / offline play also survives a refresh. */
export function readCachedFound() {
  try {
    return cleanFoundList(JSON.parse(sessionStorage.getItem(FOUND_CACHE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function writeCachedFound(found) {
  try {
    sessionStorage.setItem(FOUND_CACHE_KEY, JSON.stringify(cleanFoundList(found)));
  } catch {
    /* storage unavailable: DB remains the source of truth */
  }
}

/** Popup toggles from theme settings; both default to on. */
export function readPopupSettings(themeData) {
  const settings = themeData?.settings || themeData || {};
  const flag = (value) => value !== false && value !== "false" && value !== 0 && value !== "0";
  return {
    storyPopupEnabled: flag(settings.storyPopupEnabled),
    learningPopupEnabled: flag(settings.learningPopupEnabled),
  };
}

/** Server-side answer check; returns { correct, found }. Throws on network / server error. */
export async function submitVillageSquareAnswer({
  backendBase,
  adminToken,
  storedUser,
  stageId,
  itemId,
  option,
}) {
  if (!backendBase || !adminToken) {
    throw new Error("Answer service unavailable");
  }
  const res = await fetch(`${backendBase}/villageSquareAnswer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: storedUser?.userId || storedUser?.userid || storedUser?.id,
      stageId: stageId || undefined,
      itemId,
      option,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Answer check failed (${res.status})`);
  }
  return { correct: Boolean(data.correct), found: cleanFoundList(data.found) };
}
