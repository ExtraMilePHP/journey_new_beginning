import championsSealImg from "../hall_1/stage6/final_vault.png";
import {
  HALL1_UNLOCKED_KEY,
  HALL1_COMPLETED_KEY,
} from "../hall_1/medalDisplayData";
import { HALL1_COMPLETE_KEY } from "../hall_1/trophyVaultData";
import { clearGameProgressSession } from "../../functions/stageReportSync";

export const LEADERBOARD_SUBMITTED_KEY = "final_leaderboard_submitted";

export const COMPLETION_ASSETS = {
  championsSeal: championsSealImg,
};

export const RESTORE_COPY = {
  title: "LEGACY RESTORED!",
  quote: "Legends are remembered. Legacies live forever.",
  praise: [
    "Outstanding work, Conservator!",
    "You've restored the gallery just in time for Independence Day.",
    "The Museum of India is ready to welcome its visitors once again.",
  ],
};

/** Summary-only lines (restore screen already carries the praise copy). */
export const CEREMONY_MESSAGES = [
  "The Hall of Champions once again celebrates India's sporting legends.",
  "Happy Independence Day!",
];

/** Post-game satisfaction options (stored in `stages.feedback`). */
export const FEEDBACK_OPTIONS = [
  { value: "Meh", emoji: "😴", label: "Meh", sub: "Not great" },
  { value: "Okay", emoji: "😐", label: "Okay", sub: "It was fine" },
  { value: "Fun", emoji: "😊", label: "Fun", sub: "I enjoyed it" },
  { value: "Loved it", emoji: "🤩", label: "Loved it", sub: "Really loved it!" },
  { value: "Epic!", emoji: "🚀", label: "Epic!", sub: "Absolutely epic!" },
];

/** Sum of per-stage scores stored on the stage row (stage1…stage6). */
export function sumStagePoints(stage, maxStage = 6) {
  if (!stage) return 0;
  let sum = 0;
  for (let i = 1; i <= maxStage; i += 1) {
    const v = Number(stage[`stage${i}`]);
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  return sum;
}

/**
 * Final score = sum of stage points (base 100 each).
 * No time bonus or mistake penalties — stage 4 may store less after hint use.
 */
export function computeFinalScore({
  stagesCompleted = 6,
  stage = null,
}) {
  const fromStages = sumStagePoints(stage);
  if (fromStages > 0) return fromStages;
  return Math.min(6, Math.max(0, stagesCompleted)) * 100;
}

/** 1–3 stars from final score (max ~600 with flat 100/stage). */
export function scoreToStars(score) {
  if (score >= 600) return 3;
  if (score >= 450) return 2;
  return 1;
}

export function countCompletedStages(stage) {
  if (!stage) return 6;
  let n = 0;
  for (let i = 1; i <= 6; i += 1) {
    const v = stage[`stage${i}`];
    if (v != null && v !== "" && Number(v) > 0) n += 1;
  }
  return n || 6;
}

export function hasSubmittedLeaderboard() {
  return sessionStorage.getItem(LEADERBOARD_SUBMITTED_KEY) === "1";
}

export function markLeaderboardSubmitted() {
  sessionStorage.setItem(LEADERBOARD_SUBMITTED_KEY, "1");
}

/** Wipe hall progress so Play Again starts clean. */
export function resetGameProgressForReplay() {
  clearGameProgressSession();
  sessionStorage.removeItem(HALL1_UNLOCKED_KEY);
  sessionStorage.removeItem(HALL1_COMPLETED_KEY);
  sessionStorage.removeItem(HALL1_COMPLETE_KEY);
  sessionStorage.removeItem("end_game_data");
  sessionStorage.removeItem(LEADERBOARD_SUBMITTED_KEY);
}

export function getCompletionSnapshot({ nav = {}, stage = null }) {
  const elapsedSec = typeof nav.elapsedSec === "number" ? nav.elapsedSec : 0;
  const stagesCompleted = countCompletedStages(stage);
  const score =
    typeof nav.finalScore === "number"
      ? nav.finalScore
      : computeFinalScore({ stagesCompleted, stage });

  return {
    elapsedSec,
    stagesCompleted,
    score,
    restorationStatus: 100,
    stars: scoreToStars(score),
  };
}
