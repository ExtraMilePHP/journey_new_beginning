import {
  sendReport,
  extractReportIdFromResponse,
} from "./sendReport";

export const TOTAL_GAME_STAGES = 1;
export const TOTAL_GAME_LEVELS = 6;

/** Last level number that completes each adventure route. */
export const LAST_LEVEL_BY_ADVENTURE = {
  1: 3,
};

export const LEVELS_BY_ADVENTURE = {
  1: [1, 2, 3],
};

export const STAGE_ROW_KEY = "travel_india_stage_row_id";
const REPORT_ID_CACHE_KEY = "travel_india_report_id";
export const STAGES_COMPLETED_KEY = "travel_india_stages_completed";
const STAGE_SESSION_USER_KEY = "travel_india_stage_session_user";
const CROSSWORD_TIMER_KEY = "crossword_stage1_timer";

function stageActiveKey(stageNumber) {
  return `travel_india_active_stage_${stageNumber}`;
}

export function getStageSessionUserId(storedUser) {
  if (!storedUser) return "";
  return String(
    storedUser.userId || storedUser.userid || storedUser.id || ""
  ).trim();
}

/** Drop cached stage progress when switching players in the same browser tab. */
export function clearGameProgressSession() {
  sessionStorage.removeItem(STAGE_ROW_KEY);
  sessionStorage.removeItem(STAGES_COMPLETED_KEY);
  sessionStorage.removeItem(REPORT_ID_CACHE_KEY);
  sessionStorage.removeItem(STAGE_SESSION_USER_KEY);
  sessionStorage.removeItem(CROSSWORD_TIMER_KEY);
  for (let n = 1; n <= TOTAL_GAME_STAGES; n++) {
    sessionStorage.removeItem(stageActiveKey(n));
  }
}

export function setStageActive(stageNumber, storedUser) {
  if (!Number.isFinite(stageNumber) || stageNumber < 1 || stageNumber > TOTAL_GAME_STAGES) {
    return;
  }
  if (storedUser) ensureStageSessionForUser(storedUser);
  sessionStorage.setItem(stageActiveKey(stageNumber), "1");
}

export function clearStageActive(stageNumber) {
  if (!Number.isFinite(stageNumber) || stageNumber < 1 || stageNumber > TOTAL_GAME_STAGES) {
    return;
  }
  sessionStorage.removeItem(stageActiveKey(stageNumber));
}

export function isStageActiveInSession(stageNumber) {
  return sessionStorage.getItem(stageActiveKey(stageNumber)) === "1";
}

/**
 * If sessionStorage still holds another user's stage keys, clear them before continuing.
 */
export function ensureStageSessionForUser(storedUser) {
  const uid = getStageSessionUserId(storedUser);
  if (!uid) return false;

  const boundUser = sessionStorage.getItem(STAGE_SESSION_USER_KEY);
  if (boundUser && boundUser !== uid) {
    clearGameProgressSession();
  }
  sessionStorage.setItem(STAGE_SESSION_USER_KEY, uid);
  return true;
}

export const STAGE_ROUTE_BY_NUMBER = {
  1: "/hall-1",
};

export function isLevelScoreRecorded(stage, levelNumber) {
  if (!stage || levelNumber < 1 || levelNumber > TOTAL_GAME_LEVELS) return false;
  const value = stage[`stage${levelNumber}`];
  return value != null && value !== "";
}

export function sumLevelScores(stage, levelNumbers) {
  if (!stage) return 0;
  return levelNumbers.reduce(
    (sum, levelNumber) => sum + (Number(stage[`stage${levelNumber}`]) || 0),
    0
  );
}

/** Adventure stage complete when its final level score is saved. */
export function isStageScoreRecorded(stage, stageNumber) {
  if (!stage || stageNumber < 1 || stageNumber > TOTAL_GAME_STAGES) return false;
  const lastLevel = LAST_LEVEL_BY_ADVENTURE[stageNumber];
  if (!lastLevel) return false;
  return isLevelScoreRecorded(stage, lastLevel);
}

export function markStageCompleted(stageNumber, storedUser) {
  if (!Number.isFinite(stageNumber) || stageNumber < 1 || stageNumber > TOTAL_GAME_STAGES) {
    return;
  }
  if (storedUser) ensureStageSessionForUser(storedUser);
  try {
    const raw = sessionStorage.getItem(STAGES_COMPLETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(parsed) ? parsed : []);
    set.add(stageNumber);
    sessionStorage.setItem(STAGES_COMPLETED_KEY, JSON.stringify([...set]));
  } catch {
    sessionStorage.setItem(STAGES_COMPLETED_KEY, JSON.stringify([stageNumber]));
  }
}

export function isStageCompletedInSession(stageNumber) {
  try {
    const raw = sessionStorage.getItem(STAGES_COMPLETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.includes(stageNumber);
  } catch {
    return false;
  }
}

export function isGameOver(stage) {
  return (
    stage?.gameover === 1 ||
    stage?.gameover === "1" ||
    stage?.gameover === true
  );
}

function hasStartedLaterStage(stage, stageNumber) {
  if (stageNumber === 1) {
    return isLevelScoreRecorded(stage, 4);
  }
  return false;
}

/**
 * Whether the player must not re-enter this stage (finished or advanced past it).
 */
export function isStageAlreadyPlayed(stage, stageNumber, options = {}) {
  if (!stage) return false;
  if (isGameOver(stage)) return true;
  if (isStageCompletedInSession(stageNumber)) return true;
  if (hasStartedLaterStage(stage, stageNumber)) return true;

  // DB score saved and player is not mid-session on this stage (e.g. after login or browser back).
  if (
    isStageScoreRecorded(stage, stageNumber) &&
    !isStageActiveInSession(stageNumber)
  ) {
    return true;
  }

  return false;
}

/** Sync session completion flags from DB (later-stage scores, quiz progress, gameover). */
export function hydrateCompletedStagesFromRecord(stage, options = {}) {
  if (!stage) return;

  if (isGameOver(stage)) {
    for (let n = 1; n <= TOTAL_GAME_STAGES; n++) markStageCompleted(n);
    return;
  }

  for (let n = 1; n <= TOTAL_GAME_STAGES; n++) {
    if (hasStartedLaterStage(stage, n) || isStageScoreRecorded(stage, n)) {
      markStageCompleted(n);
    }
  }
}

/** Route to resume play, or null if the current stage may be played. */
export function getRedirectForPlayedStage(stage, currentStageNumber, options = {}) {
  if (!isStageAlreadyPlayed(stage, currentStageNumber, options)) return null;

  if (isGameOver(stage)) return "/complete";

  for (let n = currentStageNumber + 1; n <= TOTAL_GAME_STAGES; n++) {
    if (!isStageAlreadyPlayed(stage, n, options)) {
      return STAGE_ROUTE_BY_NUMBER[n];
    }
  }

  return "/complete";
}

export async function fetchGameStageRecord({
  backendBase,
  adminToken,
  storedUser,
  stageId,
}) {
  ensureStageSessionForUser(storedUser);

  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  if (
    !backendBase ||
    !adminToken ||
    !uid ||
    !sessionId ||
    !organizationId ||
    !stageId
  ) {
    return null;
  }

  try {
    const res = await fetch(`${backendBase}/getGameStage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userId: uid,
        sessionId,
        organizationId,
        stageId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.stage) return data.stage;
    if (res.status === 404) {
      sessionStorage.removeItem(STAGE_ROW_KEY);
    }
  } catch (err) {
    console.error("fetchGameStageRecord:", err);
  }
  return null;
}

/** Resolve or create the player's stages row id in sessionStorage. */
export async function ensureStageRowId({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  onStageRowId,
}) {
  if (isDemoBypass || !backendBase || !adminToken) return null;

  ensureStageSessionForUser(storedUser);

  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  if (!uid || !sessionId || !organizationId) return null;

  const cached = sessionStorage.getItem(STAGE_ROW_KEY);
  if (cached) {
    onStageRowId?.(cached);
    return cached;
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  try {
    const reportRes = await fetch(`${backendBase}/fetchReport`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ userId: uid, sessionId, organizationId }),
    });
    const reportPayload = await reportRes.json().catch(() => ({}));

    if (reportRes.ok && reportPayload.success && reportPayload.report?.id != null) {
      const id = String(reportPayload.report.id);
      sessionStorage.setItem(STAGE_ROW_KEY, id);
      sessionStorage.setItem(STAGE_SESSION_USER_KEY, String(uid));
      onStageRowId?.(id);
      return id;
    }

    const playerName = normalizePlayerName(storedUser);
    const startRes = await fetch(`${backendBase}/welcomeStageStart`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        userId: uid,
        sessionId,
        organizationId,
        email: storedUser.email || "",
        emp_id: storedUser.employeeId || storedUser.emp_id || "",
        name: playerName,
        user_type:
          storedUser.user_type ||
          storedUser.userType ||
          storedUser.role ||
          "",
      }),
    });
    const startData = await startRes.json().catch(() => ({}));
    if (startRes.ok && startData.success && startData.id != null) {
      const id = String(startData.id);
      sessionStorage.setItem(STAGE_ROW_KEY, id);
      sessionStorage.setItem(STAGE_SESSION_USER_KEY, String(uid));
      onStageRowId?.(id);
      return id;
    }
  } catch (err) {
    console.error("ensureStageRowId:", err);
  }

  return null;
}

/** First stage the player may enter, based on DB progress. */
export async function resolveGameEntryRoute({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  options = {},
}) {
  if (isDemoBypass) return STAGE_ROUTE_BY_NUMBER[1];

  const stageId = await ensureStageRowId({
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
  });
  if (!stageId) return STAGE_ROUTE_BY_NUMBER[1];

  const stage = await fetchGameStageRecord({
    backendBase,
    adminToken,
    storedUser,
    stageId,
  });
  if (!stage) return STAGE_ROUTE_BY_NUMBER[1];

  hydrateCompletedStagesFromRecord(stage, options);
  if (isGameOver(stage)) return "/complete";

  for (let n = 1; n <= TOTAL_GAME_STAGES; n++) {
    if (!isStageAlreadyPlayed(stage, n, options)) {
      return STAGE_ROUTE_BY_NUMBER[n];
    }
  }

  return "/complete";
}

/** Load stages row and navigate away if this stage was already completed. */
export async function redirectIfStageAlreadyPlayed({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  stageNumber,
  navigate,
  options = {},
}) {
  if (isDemoBypass || !backendBase || !adminToken) return false;

  ensureStageSessionForUser(storedUser);

  const stageId =
    sessionStorage.getItem(STAGE_ROW_KEY) ||
    (await ensureStageRowId({
      backendBase,
      adminToken,
      storedUser,
      isDemoBypass,
    }));
  if (!stageId) return false;

  const stage = await fetchGameStageRecord({
    backendBase,
    adminToken,
    storedUser,
    stageId,
  });
  if (!stage) return false;

  hydrateCompletedStagesFromRecord(stage, options);
  const route = getRedirectForPlayedStage(stage, stageNumber, options);
  if (route) {
    navigate(route, { replace: true });
    return true;
  }
  return false;
}

export function getReportRole(user, isDemoBypass) {
  if (isDemoBypass) return "demobypass";
  const r = String(
    user?.role || user?.user_type || user?.userType || ""
  ).trim();
  if (r.toUpperCase() === "GUEST_USER") return "GUEST_USER";
  return r || "ORG_USER";
}

export function normalizePlayerName(user) {
  if (!user || typeof user !== "object") return "";
  const raw = user.name;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t && !/^null(\s+null)*$/i.test(t)) return t;
  }
  const fn = user.firstName ?? user.first_name ?? "";
  const ln = user.lastName ?? user.last_name ?? "";
  const parts = [fn, ln].filter(
    (p) =>
      p != null &&
      String(p).trim() !== "" &&
      String(p).trim().toLowerCase() !== "null"
  );
  return parts.map((p) => String(p).trim()).join(" ").trim();
}

export function cacheReportId(reportId, reportIdRef) {
  if (reportId == null || String(reportId).trim() === "") return;
  const id = String(reportId).trim();
  sessionStorage.setItem(REPORT_ID_CACHE_KEY, id);
  if (reportIdRef) reportIdRef.current = id;
}

export async function fetchReportIdFromDb(backendBase, adminToken, userId) {
  if (!backendBase || !adminToken || !userId) return null;
  try {
    const res = await fetch(`${backendBase}/fetchReport`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ userId }),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok && payload.success && payload.report?.reportId) {
      return String(payload.report.reportId).trim();
    }
  } catch (err) {
    console.error("fetchReport:", err);
  }
  return null;
}

async function linkReportToStage({
  backendBase,
  adminToken,
  storedUser,
  stageId,
  reportId,
  reportIdRef,
}) {
  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  const linkRes = await fetch(`${backendBase}/welcomeStageLinkReport`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: uid,
      sessionId,
      organizationId,
      stageId,
      reportId: String(reportId),
    }),
  });
  const linkData = await linkRes.json().catch(() => ({}));
  if (!linkRes.ok || !linkData.success) {
    console.error(
      "welcomeStageLinkReport:",
      linkData.message || linkRes.status
    );
    return { ok: false };
  }
  cacheReportId(reportId, reportIdRef);
  const resolvedStageId =
    linkData.stageId != null ? String(linkData.stageId) : String(stageId);
  if (resolvedStageId) {
    sessionStorage.setItem(STAGE_ROW_KEY, resolvedStageId);
  }
  return { ok: true, stageId: resolvedStageId };
}

async function createExternalReport({
  storedUser,
  isDemoBypass,
  reportIdRef,
}) {
  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  const reportRole = getReportRole(storedUser, isDemoBypass);
  const playerName = normalizePlayerName(storedUser);

  const seedRes = await sendReport({
    sessionId,
    organizationId,
    role: reportRole,
    token: storedUser.token || "",
    points: 0,
    time: "00:00",
    gameId: storedUser.gameId,
    name: playerName,
    userId: uid,
  });

  const newReportId = extractReportIdFromResponse(seedRes);
  if (!newReportId) {
    console.error("sendReport: no report id in response", seedRes);
    return null;
  }
  cacheReportId(newReportId, reportIdRef);
  return newReportId;
}

/** Resolve external report id (cache → DB → create + link). */
export async function resolveOrCreateReportId({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  stageId,
  reportIdRef,
}) {
  if (isDemoBypass) return null;

  if (reportIdRef?.current) return reportIdRef.current;

  const cached = sessionStorage.getItem(REPORT_ID_CACHE_KEY);
  if (cached) {
    cacheReportId(cached, reportIdRef);
    return cached;
  }

  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const fromDb = await fetchReportIdFromDb(backendBase, adminToken, uid);
  if (fromDb) {
    cacheReportId(fromDb, reportIdRef);
    return fromDb;
  }

  const newId = await createExternalReport({
    storedUser,
    isDemoBypass,
    reportIdRef,
  });
  if (!newId) return null;

  const sid =
    stageId || sessionStorage.getItem(STAGE_ROW_KEY);
  if (sid && backendBase && adminToken) {
    await linkReportToStage({
      backendBase,
      adminToken,
      storedUser,
      stageId: sid,
      reportId: newId,
      reportIdRef,
    });
  }

  return newId;
}

/** Push cumulative score and elapsed time to the external report API. */
export async function updateExternalReport({
  storedUser,
  isDemoBypass,
  points,
  time,
  reportId,
  reportIdRef,
  backendBase,
  adminToken,
  stageId,
}) {
  if (isDemoBypass) return { ok: true };

  let rid = reportId;
  if (!rid && backendBase && adminToken) {
    rid = await resolveOrCreateReportId({
      backendBase,
      adminToken,
      storedUser,
      isDemoBypass,
      stageId,
      reportIdRef,
    });
  }
  if (!rid) return { ok: false };

  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  const reportRole = getReportRole(storedUser, isDemoBypass);
  const playerName = normalizePlayerName(storedUser);

  try {
    await sendReport({
      sessionId,
      organizationId,
      role: reportRole,
      token: storedUser.token || "",
      points: Number(points) || 0,
      time: String(time ?? "00:00"),
      reportId: rid,
      gameId: storedUser.gameId,
      name: playerName,
      userId: uid,
    });
    cacheReportId(rid, reportIdRef);
    return { ok: true };
  } catch (err) {
    console.error("updateExternalReport:", err);
    return { ok: false };
  }
}

/**
 * Save mini-game progress to `stages` and mirror score/time to the external report.
 */
export async function saveGameStageAndReport({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  stageId,
  stageNumber,
  score,
  answers,
  time,
  total_score,
  currentQues,
  reportIdRef,
  gameover,
}) {
  if (isDemoBypass || !backendBase || !adminToken) {
    return { ok: false, total_score: total_score ?? 0 };
  }

  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  if (!uid || !sessionId || !organizationId || !stageId) {
    return { ok: false, total_score: total_score ?? 0 };
  }

  const body = {
    userId: uid,
    sessionId,
    organizationId,
    stageId,
    time,
    total_score,
  };
  if (stageNumber != null) {
    body.stageNumber = stageNumber;
    body.score = score;
  }
  if (answers != null) body.answers = answers;
  if (currentQues != null) body.currentQues = currentQues;
  // Final level: the server marks the run as finished (stages.gameover / end_time).
  if (gameover) body.gameover = 1;

  let resolvedTotal = total_score;
  let dbOk = false;

  try {
    const saveRes = await fetch(`${backendBase}/gameStageSave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(body),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    dbOk = saveRes.ok && saveData.success !== false;
    if (saveData.total_score != null) {
      resolvedTotal = Number(saveData.total_score) || total_score;
    }
  } catch (err) {
    console.error("gameStageSave:", err);
    return { ok: false, total_score: resolvedTotal };
  }

  await updateExternalReport({
    storedUser,
    isDemoBypass,
    points: resolvedTotal,
    time,
    reportIdRef,
    backendBase,
    adminToken,
    stageId,
  });

  return { ok: dbOk, total_score: resolvedTotal };
}

/** Initial stage row + external report bootstrap (Stage 1 entry). */
export async function bootstrapStageAndReport({
  backendBase,
  adminToken,
  storedUser,
  isDemoBypass,
  reportIdRef,
  onStageRowId,
}) {
  if (!backendBase || !adminToken || isDemoBypass) return;

  ensureStageSessionForUser(storedUser);

  const uid = storedUser.userId || storedUser.userid || storedUser.id;
  const sessionId = storedUser.sessionId;
  const organizationId = storedUser.organizationId;
  if (!uid || !sessionId || !organizationId) return;

  const playerName = normalizePlayerName(storedUser);
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  try {
    const reportRes = await fetch(`${backendBase}/fetchReport`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ userId: uid, sessionId, organizationId }),
    });
    const reportPayload = await reportRes.json().catch(() => ({}));

    if (reportRes.ok && reportPayload.success && reportPayload.report) {
      const row = reportPayload.report;
      if (row.reportId != null && String(row.reportId).trim() !== "") {
        if (row.id != null) {
          const id = String(row.id);
          sessionStorage.setItem(STAGE_ROW_KEY, id);
          sessionStorage.setItem(STAGE_SESSION_USER_KEY, String(uid));
          onStageRowId?.(id);
        }
        cacheReportId(row.reportId, reportIdRef);
        return;
      }
    } else {
      sessionStorage.removeItem(STAGE_ROW_KEY);
    }

    const startRes = await fetch(`${backendBase}/welcomeStageStart`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        userId: uid,
        sessionId,
        organizationId,
        email: storedUser.email || "",
        emp_id: storedUser.employeeId || storedUser.emp_id || "",
        name: playerName,
        user_type:
          storedUser.user_type ||
          storedUser.userType ||
          storedUser.role ||
          "",
      }),
    });
    const startData = await startRes.json().catch(() => ({}));

    if (!startRes.ok || !startData.success || startData.id == null) {
      console.error(
        "welcomeStageStart failed:",
        startData.message || startRes.status
      );
      return;
    }

    const stageId = String(startData.id);
    sessionStorage.setItem(STAGE_ROW_KEY, stageId);
    sessionStorage.setItem(STAGE_SESSION_USER_KEY, String(uid));
    onStageRowId?.(stageId);

    const newReportId = await createExternalReport({
      storedUser,
      isDemoBypass,
      reportIdRef,
    });
    if (!newReportId) return;

    await linkReportToStage({
      backendBase,
      adminToken,
      storedUser,
      stageId,
      reportId: newReportId,
      reportIdRef,
    });
  } catch (err) {
    console.error("bootstrapStageAndReport:", err);
  }
}
