/** Session key: unlocked hall hotspot ids after puzzles. */
export const HALL1_UNLOCKED_KEY = "hall1_unlocked_hotspots";
export const HALL1_COMPLETED_KEY = "hall1_completed_hotspots";

/** Puzzle 2 hotspot unlocked after Medal Display success. */
export const MEDAL_DISPLAY_UNLOCKS = "commentary_booth";

/** Hall hotspot order ↔ DB columns stage1 … stage5 */
export const HALL1_HOTSPOT_ORDER = [
  "medal_display",
  "commentary_booth",
  "museum_archive",
  "newspaper",
  "trophy_vault",
];

/** True when stages.stageN has a saved score (not null / empty). */
export function isHallStageScorePresent(stage, stageNumber) {
  if (!stage || stageNumber < 1) return false;
  const value = stage[`stage${stageNumber}`];
  return value != null && value !== "";
}

/** Routes for Hall of Champions stages 1–6. */
export const HALL1_STAGE_ROUTES = {
  1: "/hall-1/stage1",
  2: "/hall-1/stage2",
  3: "/hall-1/stage3",
  4: "/hall-1/stage4",
  5: "/hall-1/stage5",
  6: "/hall-1/stage6",
};

/** Last checkpoint (Grand Celebration); its page also hosts the Final Screen. */
export const FINAL_STAGE_NUMBER = 5;
export const FINAL_STAGE_ROUTE = "/hall-1/stage5";

/**
 * If this stage already has a DB score, skip to the next incomplete stage
 * (or the Grand Celebration final screen when the journey is done). Returns null to stay.
 */
export function getRedirectIfHall1StageDone(stage, stageNumber) {
  if (!isHallStageScorePresent(stage, stageNumber)) return null;
  for (let n = stageNumber + 1; n <= FINAL_STAGE_NUMBER; n += 1) {
    if (!isHallStageScorePresent(stage, n)) {
      return HALL1_STAGE_ROUTES[n] || "/hall-1";
    }
  }
  return FINAL_STAGE_ROUTE;
}

/** Hub redirect once the journey is complete (to the final screen). */
export function getHall1HubRedirect(stage) {
  if (!stage) return null;
  if (isHallStageScorePresent(stage, FINAL_STAGE_NUMBER)) return FINAL_STAGE_ROUTE;
  return null;
}

/**
 * Only one hotspot is clickable: the first puzzle whose DB score is still empty.
 * Stages 1–5 map to the five SVG hotspots.
 */
export function resolveActiveHall1Hotspot(stage) {
  for (let i = 0; i < HALL1_HOTSPOT_ORDER.length; i += 1) {
    if (!isHallStageScorePresent(stage, i + 1)) {
      return HALL1_HOTSPOT_ORDER[i];
    }
  }
  return null;
}

/** trophy_vault opens the Grand Celebration (stage5). */
export function resolveTrophyVaultRoute() {
  return FINAL_STAGE_ROUTE;
}

export function readHall1Unlocked() {
  try {
    const raw = sessionStorage.getItem(HALL1_UNLOCKED_KEY);
    const parsed = raw ? JSON.parse(raw) : ["medal_display"];
    return Array.isArray(parsed) ? parsed : ["medal_display"];
  } catch {
    return ["medal_display"];
  }
}

export function unlockHall1Hotspot(id) {
  const set = new Set(readHall1Unlocked());
  set.add(id);
  sessionStorage.setItem(HALL1_UNLOCKED_KEY, JSON.stringify([...set]));
}

export function readHall1Completed() {
  try {
    const raw = sessionStorage.getItem(HALL1_COMPLETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markHall1HotspotCompleted(id) {
  const set = new Set(readHall1Completed());
  set.add(id);
  sessionStorage.setItem(HALL1_COMPLETED_KEY, JSON.stringify([...set]));
}

/** Mirror DB progress into sessionStorage (optional cache). */
export function hydrateHall1ProgressFromStage(stage) {
  if (!stage) return;

  const unlocked = new Set(["medal_display"]);
  const completed = new Set();

  HALL1_HOTSPOT_ORDER.forEach((id, index) => {
    const stageNumber = index + 1;
    if (isHallStageScorePresent(stage, stageNumber)) {
      completed.add(id);
      const next = HALL1_HOTSPOT_ORDER[index + 1];
      if (next) unlocked.add(next);
    }
  });

  sessionStorage.setItem(HALL1_UNLOCKED_KEY, JSON.stringify([...unlocked]));
  sessionStorage.setItem(HALL1_COMPLETED_KEY, JSON.stringify([...completed]));

  if (isHallStageScorePresent(stage, FINAL_STAGE_NUMBER)) {
    sessionStorage.setItem("hall1_complete", "1");
  }
}
