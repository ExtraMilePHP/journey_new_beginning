import iccCup from "./stage6/icccup.png";
import thomasCup from "./stage6/thomuscup.png";
import sultanCup from "./stage6/sultancup.png";
import uberCup from "./stage6/ubercup.png";
import chessCup from "./stage6/ChessOlympiadTrophy.png";

/** Points written to DB `stage6` on successful restore. */
export const TROPHY_VAULT_POINTS = 100;

/** Session flag: Hall of Champions finished. */
export const HALL1_COMPLETE_KEY = "hall1_complete";

export const TROPHIES = [
  {
    id: "icc",
    nameplateId: "icc",
    image: iccCup,
    label: "ICC Cricket World Cup Trophy",
  },
  {
    id: "thomas",
    nameplateId: "thomas",
    image: thomasCup,
    label: "Thomas Cup",
  },
  {
    id: "sultan",
    nameplateId: "sultan",
    image: sultanCup,
    label: "Sultan Azlan Shah Cup",
  },
  {
    id: "uber",
    nameplateId: "uber",
    image: uberCup,
    label: "Uber Cup",
  },
  {
    id: "chess",
    nameplateId: "chess",
    image: chessCup,
    label: "Chess Olympiad Trophy",
  },
];

export const NAMEPLATES = [
  { id: "icc", label: "ICC Cricket World Cup" },
  { id: "thomas", label: "Thomas Cup" },
  { id: "sultan", label: "Sultan Azlan Shah Cup" },
  { id: "uber", label: "Uber Cup" },
  { id: "chess", label: "Chess Olympiad" },
];

export function shuffleArray(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/**
 * @param {Record<string, string|null>} placements trophyId → nameplateId
 */
export function validateTrophyPlacements(placements, trophies = TROPHIES) {
  const wrongTrophyIds = [];
  const missingTrophyIds = [];
  let correctCount = 0;

  trophies.forEach((trophy) => {
    const placed = placements[trophy.id];
    if (placed == null || placed === "") {
      missingTrophyIds.push(trophy.id);
      return;
    }
    if (placed === trophy.nameplateId) {
      correctCount += 1;
    } else {
      wrongTrophyIds.push(trophy.id);
    }
  });

  return {
    ok: wrongTrophyIds.length === 0 && missingTrophyIds.length === 0,
    wrongTrophyIds,
    missingTrophyIds,
    correctCount,
  };
}

/** Assign nameplate to trophy; swap with origin when dropping onto an occupied slot. */
export function assignNameplate(
  placements,
  trophyId,
  nameplateId,
  originTrophy = null
) {
  const next = { ...placements };
  const displaced =
    next[trophyId] != null && next[trophyId] !== nameplateId
      ? next[trophyId]
      : null;

  Object.keys(next).forEach((id) => {
    if (next[id] === nameplateId) next[id] = null;
  });

  if (displaced && originTrophy && originTrophy !== trophyId) {
    next[originTrophy] = displaced;
  }

  next[trophyId] = nameplateId;
  return next;
}

export function clearTrophySlot(placements, trophyId) {
  return { ...placements, [trophyId]: null };
}

export function unassignedNameplateIds(placements, nameplates = NAMEPLATES) {
  const used = new Set(
    Object.values(placements).filter((id) => id != null && id !== "")
  );
  return nameplates.filter((n) => !used.has(n.id)).map((n) => n.id);
}

export function markHallOfChampionsComplete() {
  sessionStorage.setItem(HALL1_COMPLETE_KEY, "1");
}

export function isHallOfChampionsComplete() {
  return sessionStorage.getItem(HALL1_COMPLETE_KEY) === "1";
}
