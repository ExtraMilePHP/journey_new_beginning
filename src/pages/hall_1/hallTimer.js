import {
  STAGE_ROW_KEY,
  ensureStageRowId,
  ensureStageSessionForUser,
  fetchGameStageRecord,
  saveGameStageAndReport,
} from "../../functions/stageReportSync";

export function parseClockToSeconds(clock) {
  const parts = String(clock ?? "00:00")
    .trim()
    .split(":")
    .map((p) => parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length >= 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function formatSecondsToClock(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${String(min).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/** Live HUD progress for the current stage: round((correct/total) * stagePoints). */
export function liveProgressPoints(correctCount, totalCount, stagePoints) {
  const total = Number(totalCount) || 0;
  if (total <= 0) return 0;
  const n = Math.max(0, Math.min(Number(correctCount) || 0, total));
  return Math.round((n / total) * (Number(stagePoints) || 0));
}

/** Read cumulative `total_score` from a stages row (fallback: sum stage1…stage10). */
export function readTotalScoreFromStage(stage) {
  if (!stage) return 0;
  if (stage.total_score != null && stage.total_score !== "") {
    const n = Number(stage.total_score);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  let sum = 0;
  for (let i = 1; i <= 10; i += 1) {
    const v = Number(stage[`stage${i}`]);
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  return sum;
}

/**
 * Load stages.time from DB (creates row if needed). Returns { stageId, elapsedSec, stage }.
 */
export async function loadHallElapsedFromDb({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
}) {
  if (isDemoBypass || !backendBase || !adminToken) {
    return { stageId: "", elapsedSec: 0, stage: null };
  }

  ensureStageSessionForUser(storedUser);
  const stageId = await ensureStageRowId({
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
  });
  if (!stageId) return { stageId: "", elapsedSec: 0, stage: null };

  const stage = await fetchGameStageRecord({
    backendBase,
    adminToken,
    storedUser,
    stageId,
  });

  return {
    stageId: String(stageId),
    elapsedSec: parseClockToSeconds(stage?.time),
    stage,
  };
}

/** Persist only the shared timer (no stage score change). */
export async function persistHallElapsedTime({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  stageId,
  elapsedSec,
}) {
  const id = stageId || sessionStorage.getItem(STAGE_ROW_KEY);
  if (!id) return { ok: false };

  return saveGameStageAndReport({
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
    stageId: id,
    time: formatSecondsToClock(elapsedSec),
  });
}
