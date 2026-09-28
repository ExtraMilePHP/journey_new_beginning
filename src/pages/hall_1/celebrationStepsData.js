/**
 * Level 4 — Celebration Steps (arrange 12 activities in order).
 * The correct order is NOT stored here (activities are listed alphabetically);
 * the server checks it (celebrationSteps).
 */
import deskBg from "./stage4/stage4_desk.png";
import mobBg from "./stage4/stage4_mob.png";

export { deskBg as CELEBRATION_STEPS_DESK_BG, mobBg as CELEBRATION_STEPS_MOB_BG };

export const CELEBRATION_STEPS_PUZZLE_ID = "celebration_steps";

/** Points written to DB `stage4` when all activities are locked. */
export const CELEBRATION_STEPS_POINTS = 100;

/** Journey completion after this checkpoint (4 of 5). */
export const CELEBRATION_STEPS_COMPLETION_PERCENT = 80;

export const SLOT_COUNT = 12;

export const CELEBRATION_ACTIVITIES = [
  {
    id: "activities",
    label: "Participate in fun activities together",
    learning: {
      heading: "Participate in Fun Activities Together",
      text: "The best celebrations include everyone. Games and activities encourage connection and laughter.",
    },
  },
  {
    id: "entrance",
    label: "Decorate the entrance",
    learning: {
      heading: "Decorate the Entrance",
      text: "First impressions create lasting memories. Decorations set the tone for a joyful celebration.",
    },
  },
  {
    id: "gratitude",
    label: "Express gratitude to everyone",
    learning: {
      heading: "Express Gratitude to Everyone",
      text: "Every celebration is made special by the people around us. Taking a moment to thank others strengthens relationships.",
    },
  },
  {
    id: "guests",
    label: "Welcome the guests",
    learning: {
      heading: "Welcome the Guests",
      text: "Every guest should feel valued. Warm hospitality is one of the most meaningful traditions across cultures.",
    },
  },
  {
    id: "lights",
    label: "Arrange lights and lanterns",
    learning: {
      heading: "Arrange Lights and Lanterns",
      text: "Light creates warmth and togetherness. Lighting transforms ordinary spaces into places of celebration.",
    },
  },
  {
    id: "music",
    label: "Enjoy music and cultural performances",
    learning: {
      heading: "Enjoy Music and Cultural Performances",
      text: "Celebrations come alive through music and creativity. Shared experiences create lasting memories.",
    },
  },
  {
    id: "photos",
    label: "Capture memories with photos",
    learning: {
      heading: "Capture Memories with Photos",
      text: "Moments become memories when we share them. Photographs help preserve joyful experiences for years to come.",
    },
  },
  {
    id: "rangoli",
    label: "Create a colourful rangoli",
    learning: {
      heading: "Create a Colourful Rangoli",
      text: "Creativity brings celebrations to life. Colourful designs make every gathering more vibrant and welcoming.",
    },
  },
  {
    id: "space",
    label: "Set up the celebration space",
    learning: {
      heading: "Set Up the Celebration Space",
      text: "Good planning makes every event memorable. Organized spaces help everyone enjoy the celebration comfortably.",
    },
  },
  {
    id: "sweets",
    label: "Share festive sweets and refreshments",
    learning: {
      heading: "Share Festive Sweets and Refreshments",
      text: "Sharing brings people closer together. Food has always been a way of celebrating joy with others.",
    },
  },
  {
    id: "venue",
    label: "Prepare the celebration venue",
    learning: {
      heading: "Prepare the Celebration Venue",
      text: "Every celebration begins with thoughtful preparation. Creating a welcoming space ensures everyone feels included from the very beginning.",
    },
  },
  {
    id: "wishes",
    label: "End the celebration with good wishes",
    learning: {
      heading: "End the Celebration with Good Wishes",
      text: "Every ending is the beginning of another joyful journey. Leaving with positivity and good wishes keeps the spirit of the celebration alive.",
    },
  },
];

export const ACTIVITY_BY_ID = Object.fromEntries(CELEBRATION_ACTIVITIES.map((a) => [a.id, a]));

/**
 * Staircase medallions, bottom step first, in background-image pixels
 * (`w`/`h` = image size). One lights up per locked activity.
 */
export const STEP_LADDER = {
  desk: {
    w: 1920,
    h: 1080,
    steps: Array.from({ length: SLOT_COUNT }, (_, i) => ({
      x: 960,
      y: 792 - i * 36,
      r: 17 - i * 0.7,
    })),
  },
  mob: {
    w: 414,
    h: 896,
    steps: Array.from({ length: SLOT_COUNT }, (_, i) => ({
      x: 207,
      y: 580 - i * 22,
      r: 8 - i * 0.3,
    })),
  },
};

export const CELEBRATION_STEPS_STORY = {
  heading: "Every Great Celebration Has a Flow",
  quote:
    "“The most memorable celebrations don't happen by chance, they come together one thoughtful step at a time.”",
  paragraphs: [
    "You've reached the Celebration Steps, where the final preparations are about to begin.",
    "Arrange each celebration activity in the correct sequence to complete the event plan. Every correct placement lights up another step, guiding you toward the Grand Celebration.",
  ],
  objective: "Arrange all the celebration activities in the correct order.",
  button: "Start Planning",
};

export const CELEBRATION_STEPS_RETRY = {
  heading: "Almost There!",
  text: "Think about how a celebration naturally comes together. Rearrange the activities until the sequence feels complete.",
  button: "Try Again",
};

export const CELEBRATION_STEPS_SUCCESS = {
  heading: "Everything Is Ready!",
  text: "You've successfully planned the celebration and discovered the values that make every gathering meaningful. Thoughtful preparation, warm hospitality, sharing, gratitude, and togetherness are what truly bring a celebration to life.",
  reward: "You have earned the Key of Values.",
  next: "Only one final challenge remains before the Grand Celebration begins.",
  button: "Continue Journey",
};

const CACHE_KEY = "celebration_steps_locked";

/** Normalise a locked map { slotIndex: activityId } from server, DB or cache. */
export function cleanLocked(value) {
  const locked = {};
  const seen = new Set();
  Object.entries(value || {}).forEach(([slot, id]) => {
    const i = Number(slot);
    if (!Number.isInteger(i) || i < 0 || i >= SLOT_COUNT || !ACTIVITY_BY_ID[id] || seen.has(id)) {
      return;
    }
    seen.add(id);
    locked[i] = id;
  });
  return locked;
}

/** Locked cards from a stages row (`stage4_ans`); empty if none / other puzzle. */
export function readLockedFromStage(stage) {
  let ans = stage?.stage4_ans;
  if (typeof ans === "string") {
    try {
      ans = JSON.parse(ans);
    } catch {
      ans = null;
    }
  }
  if (!ans || ans.puzzle !== CELEBRATION_STEPS_PUZZLE_ID) return {};
  return cleanLocked(ans.locked);
}

/** Session cache so demo / offline play also survives a refresh. */
export function readCachedLocked() {
  try {
    return cleanLocked(JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return {};
  }
}

export function writeCachedLocked(locked) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cleanLocked(locked)));
  } catch {
    /* storage unavailable: DB remains the source of truth */
  }
}

export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Server check of the placed cards → { results: [{ slot, correct }], locked }. */
export async function submitCelebrationOrder({
  backendBase,
  adminToken,
  storedUser,
  stageId,
  placements,
}) {
  if (!backendBase || !adminToken) throw new Error("Order service unavailable");
  const res = await fetch(`${backendBase}/celebrationStepsSubmit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: storedUser?.userId || storedUser?.userid || storedUser?.id,
      stageId: stageId || undefined,
      placements,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Order check failed (${res.status})`);
  }
  return {
    results: Array.isArray(data.results) ? data.results : [],
    locked: cleanLocked(data.locked),
  };
}
