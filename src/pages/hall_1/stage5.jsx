import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { selectAdminToken } from "../../admin/sessionSlice";
import { setBackButtonUrl } from "../uiSlice";
import {
  STAGE_ROW_KEY,
  ensureStageRowId,
  ensureStageSessionForUser,
  saveGameStageAndReport,
} from "../../functions/stageReportSync";
import StageTimer from "../game/StageTimer";
import { markHall1HotspotCompleted, isHallStageScorePresent } from "./medalDisplayData";
import { readPopupSettings } from "./villageSquareData";
import {
  GRAND_CELEBRATION_DESK_BG,
  GRAND_CELEBRATION_MOB_BG,
  GRAND_CELEBRATION_PUZZLE_ID,
  GRAND_CELEBRATION_POINTS,
  GRAND_CELEBRATION_COMPLETION_PERCENT,
  GRAND_CELEBRATION_QUESTIONS,
  GRAND_CELEBRATION_STORY,
  GRAND_CELEBRATION_RETRY,
  GRAND_CELEBRATION_SUCCESS,
  readSolvedFromStage,
  readCachedSolved,
  writeCachedSolved,
  readLeaderboardEnabled,
  requestLeaderboardSubmit,
  submitGrandCelebrationAnswer,
  requestGrandCelebrationHint,
  submitGameFeedback,
} from "./grandCelebrationData";
import {
  formatSecondsToClock,
  loadHallElapsedFromDb,
  persistHallElapsedTime,
  readTotalScoreFromStage,
  liveProgressPoints,
} from "./hallTimer";
import {
  getStoredUser,
  isDemoUser,
  getBackendBase,
  useLayoutSvgUrl,
  useLevelPage,
  SceneBox,
  Popup,
  CheckIcon,
  RetryIcon,
  GoldButton,
  JourneyProgress,
} from "./levelScene";
import { KEY_IMAGES } from "./keyImages";
import FinalCelebration, { Lantern } from "./FinalCelebration";
import "../fonts/breuer-headline.css";
import "./stage5.css";

/** Hall hub hotspot for the final checkpoint (stage5). */
const HUB_HOTSPOT_ID = "trophy_vault";

const TOTAL = GRAND_CELEBRATION_QUESTIONS.length;
const FULL_BOX = { left: 0, top: 0, width: "100%", height: "100%" };
/** Seconds added to the timer for every hint used. */
const HINT_PENALTY_SEC = 5;
const DRAG_THRESHOLD = 6;

/** Fresh tile state for a question: tiles start in the tray, slots empty. */
function initialTiles(question) {
  const letters = question ? question.scrambled.split("") : [];
  return {
    tiles: letters.map((letter, id) => ({ id, letter })),
    /** Slot index → tile id (or null). */
    slots: letters.map(() => null),
    /** Slot indexes filled by a hint (locked). */
    hinted: [],
  };
}

/** Hall Stage 5 — Level 5: Grand Celebration (unscramble) + finale. */
export default function HallStage5() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const themeData = useSelector((s) => s.theme?.data);
  const { storyPopupEnabled, learningPopupEnabled } = useMemo(
    () => readPopupSettings(themeData),
    [themeData]
  );
  const leaderboardEnabled = useMemo(() => readLeaderboardEnabled(themeData), [themeData]);

  const storedUser = useMemo(() => user || getStoredUser(), [user]);
  const isDemoBypass = useMemo(() => isDemoUser(storedUser), [storedUser]);
  const backendBase = getBackendBase();

  const bgUrl = useLayoutSvgUrl(GRAND_CELEBRATION_DESK_BG, GRAND_CELEBRATION_MOB_BG);
  const stageRef = useRef(null);
  useLevelPage(stageRef, bgUrl);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || ""
  );
  /** loading → story → playing → saving → success → finale */
  const [phase, setPhase] = useState("loading");
  const [finaleAtEnd, setFinaleAtEnd] = useState(false);
  const [solved, setSolved] = useState([]);
  const [board, setBoard] = useState(() => initialTiles(null));
  const [drag, setDrag] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  /** null | { type: "retry" } | { type: "learning", questionId } */
  const [popup, setPopup] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [newLantern, setNewLantern] = useState(-1);

  const elapsedRef = useRef(0);
  const solvedRef = useRef([]);
  const completingRef = useRef(false);
  const demoRedirectTriggeredRef = useRef(false);
  const pressRef = useRef(null);

  const question = GRAND_CELEBRATION_QUESTIONS.find((q) => !solved.includes(q.id)) || null;
  const questionId = question?.id;

  useEffect(() => {
    dispatch(setBackButtonUrl("/hall-1"));
  }, [dispatch]);

  /* New question → fresh tiles. */
  useEffect(() => {
    setBoard(initialTiles(GRAND_CELEBRATION_QUESTIONS.find((q) => q.id === questionId)));
    setNote("");
  }, [questionId]);

  /* Load timer, score and solved words; a finished journey opens on the Final Screen. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      ensureStageSessionForUser(storedUser);
      const { stageId, elapsedSec: sec, stage } = await loadHallElapsedFromDb({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
      });
      if (cancelled) return;

      if (stageId) setStageRowId(String(stageId));
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTotalScore(readTotalScoreFromStage(stage));
      setTimerReady(true);

      if (isHallStageScorePresent(stage, 5)) {
        solvedRef.current = GRAND_CELEBRATION_QUESTIONS.map((q) => q.id);
        setSolved(solvedRef.current);
        setFinaleAtEnd(true);
        setPhase("finale");
        return;
      }

      const restored = stage ? readSolvedFromStage(stage) : readCachedSolved();
      solvedRef.current = restored;
      setSolved(restored);
      writeCachedSolved(restored);
      setPhase(restored.length === 0 && storyPopupEnabled ? "story" : "playing");
    })();
    return () => {
      cancelled = true;
    };
    // storyPopupEnabled is read once at load; toggling mid-level should not reopen the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendBase, adminToken, storedUser, isDemoBypass]);

  useEffect(() => {
    if (!timerReady || phase === "success" || phase === "finale") return undefined;
    const tick = window.setInterval(() => {
      setElapsedSec((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [timerReady, phase]);

  useEffect(() => {
    if (!timerReady) return undefined;
    const save = () => {
      persistHallElapsedTime({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
        stageId: stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
        elapsedSec: elapsedRef.current,
      });
    };
    const id = window.setInterval(save, 15000);
    return () => {
      clearInterval(id);
      if (phase === "playing" || phase === "story") save();
    };
  }, [timerReady, backendBase, adminToken, storedUser, isDemoBypass, stageRowId, phase]);

  const levelDone = phase === "success" || phase === "finale";
  const displayPoints = levelDone
    ? totalScore
    : totalScore + liveProgressPoints(solved.length, TOTAL, GRAND_CELEBRATION_POINTS);

  /* ---------- tiles ---------- */

  const canInteract = phase === "playing" && !submitting && !popup;
  const slotOfTile = (id) => board.slots.indexOf(id);

  /** Put tile `tileId` in slot `index` (occupant goes back to the tray / swaps). */
  const placeTile = useCallback(
    (tileId, index) => {
      setBoard((b) => {
        if (b.hinted.includes(index)) return b;
        const from = b.slots.indexOf(tileId);
        if (from !== -1 && b.hinted.includes(from)) return b;
        const slots = [...b.slots];
        const occupant = slots[index];
        if (from !== -1) slots[from] = occupant ?? null;
        slots[index] = tileId;
        return { ...b, slots };
      });
      setNote("");
    },
    []
  );

  const returnTile = useCallback((tileId) => {
    setBoard((b) => {
      const at = b.slots.indexOf(tileId);
      if (at === -1 || b.hinted.includes(at)) return b;
      const slots = [...b.slots];
      slots[at] = null;
      return { ...b, slots };
    });
  }, []);

  /** Tap a tray tile: into the first free slot. Tap a placed tile: back to the tray. */
  const tapTile = (tileId) => {
    if (!canInteract) return;
    const at = slotOfTile(tileId);
    if (at !== -1) {
      returnTile(tileId);
      return;
    }
    const free = board.slots.findIndex((s, i) => s == null && !board.hinted.includes(i));
    if (free !== -1) placeTile(tileId, free);
  };

  /** Tap a slot: send its letter back to the tray. */
  const tapSlot = (index) => {
    if (!canInteract || board.hinted.includes(index)) return;
    const tileId = board.slots[index];
    if (tileId != null) returnTile(tileId);
  };

  const clearTiles = () => {
    if (!canInteract) return;
    setBoard((b) => ({
      ...b,
      slots: b.slots.map((t, i) => (b.hinted.includes(i) ? t : null)),
    }));
    setNote("");
  };

  /* Pointer drag of a tile onto a slot (or back to the tray). */
  const onTilePointerDown = (e, tileId) => {
    if (!canInteract || e.button > 0) return;
    const at = slotOfTile(tileId);
    if (at !== -1 && board.hinted.includes(at)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pressRef.current = { tileId, startX: e.clientX, startY: e.clientY, rect, dragging: false, pointerId: e.pointerId };
  };

  useEffect(() => {
    const targetAt = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest?.("[data-gc-drop]");
      if (!el) return null;
      const v = el.getAttribute("data-gc-drop");
      return v === "tray" ? "tray" : Number(v);
    };
    const onMove = (e) => {
      const p = pressRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) return;
        p.dragging = true;
        document.body.classList.add("gc-dragging");
      }
      e.preventDefault();
      setDrag({
        tileId: p.tileId,
        x: e.clientX - (p.startX - p.rect.left),
        y: e.clientY - (p.startY - p.rect.top),
        w: p.rect.width,
        h: p.rect.height,
        over: targetAt(e.clientX, e.clientY),
      });
    };
    const onUp = (e) => {
      const p = pressRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      pressRef.current = null;
      if (!p.dragging) return; // plain tap: onClick handles it
      document.body.classList.remove("gc-dragging");
      setDrag(null);
      pressRef.lastDragEnd = performance.now();
      const target = e.type === "pointercancel" ? null : targetAt(e.clientX, e.clientY);
      if (target === "tray") returnTile(p.tileId);
      else if (typeof target === "number") placeTile(p.tileId, target);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("gc-dragging");
    };
  }, [placeTile, returnTile]);

  const justDragged = () => performance.now() - (pressRef.lastDragEnd || 0) < 250;

  /* ---------- hint ---------- */

  /** First free (not locked) space, or -1 when no hint can be given. */
  const hintPosition = () => {
    const position = board.slots.findIndex((_, i) => !board.hinted.includes(i));
    return position === -1 || board.hinted.length >= board.slots.length - 1 ? -1 : position;
  };

  /** Hint button: ask first, since every hint costs HINT_PENALTY_SEC on the timer. */
  const askHint = () => {
    if (!canInteract || !question) return;
    if (hintPosition() === -1) {
      setNote("No more hints for this word — you can do it!");
      return;
    }
    setPopup({ type: "hint" });
  };

  const requestHint = useCallback(async () => {
    setPopup(null);
    if (phase !== "playing" || submitting || !question) return;
    const position = hintPosition();
    if (position === -1) return;
    setSubmitting(true);
    try {
      const { letter } = await requestGrandCelebrationHint({
        backendBase,
        adminToken,
        questionId: question.id,
        position,
      });
      setBoard((b) => {
        // Prefer a matching tile still in the tray, else one placed elsewhere.
        const free = b.tiles.filter((t) => t.letter === letter && !b.hinted.includes(b.slots.indexOf(t.id)));
        const tile = free.find((t) => b.slots.indexOf(t.id) === -1) || free[0];
        if (!tile) return b;
        const slots = [...b.slots];
        const from = slots.indexOf(tile.id);
        if (from !== -1) slots[from] = null;
        slots[position] = tile.id;
        return { ...b, slots, hinted: [...b.hinted, position] };
      });
      // Time penalty for using a hint.
      elapsedRef.current += HINT_PENALTY_SEC;
      setElapsedSec(elapsedRef.current);
      setNote(`Hint used: +${HINT_PENALTY_SEC} seconds added to your time.`);
    } catch (err) {
      console.error("Grand Celebration hint:", err);
      setNote("Could not load a hint. Please try again.");
    } finally {
      setSubmitting(false);
    }
    // hintPosition reads `board`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitting, question, board, backendBase, adminToken]);

  /* ---------- lock correct letters ---------- */

  /** Correct letter per position, per question (asked from the server once). */
  const lettersRef = useRef({});
  const pendingRef = useRef(new Set());

  /* A letter dropped on its correct space locks there (same state as a hint)
     and can no longer be moved or cleared. */
  useEffect(() => {
    if (phase !== "playing" || !question || !backendBase || !adminToken) return;
    const qid = question.id;
    const tiles = board.tiles;
    const known = (lettersRef.current[qid] = lettersRef.current[qid] || {});
    const lockIfCorrect = (i) =>
      setBoard((b) => {
        const cur = b.slots[i];
        if (b.tiles !== tiles || cur == null || b.hinted.includes(i)) return b;
        if (b.tiles[cur].letter !== known[i]) return b;
        return { ...b, hinted: [...b.hinted, i] };
      });

    board.slots.forEach((tileId, i) => {
      if (tileId == null || board.hinted.includes(i)) return;
      if (known[i] !== undefined) {
        if (tiles[tileId].letter === known[i]) lockIfCorrect(i);
        return;
      }
      const key = `${qid}:${i}`;
      if (pendingRef.current.has(key)) return;
      pendingRef.current.add(key);
      requestGrandCelebrationHint({ backendBase, adminToken, questionId: qid, position: i })
        .then(({ letter }) => {
          known[i] = letter;
          lockIfCorrect(i);
        })
        .catch(() => {})
        .finally(() => pendingRef.current.delete(key));
    });
  }, [board, question, phase, backendBase, adminToken]);

  /* ---------- submit ---------- */

  const commitSolved = useCallback((id) => {
    if (solvedRef.current.includes(id)) return;
    const next = [...solvedRef.current, id];
    solvedRef.current = next;
    setSolved(next);
    setNewLantern(next.length - 1);
    writeCachedSolved(next);
  }, []);

  const submitWord = useCallback(async () => {
    if (!canInteract || !question) return;
    if (board.slots.some((s) => s == null)) {
      setNote("Place every letter before submitting.");
      return;
    }
    const word = board.slots.map((id) => board.tiles[id].letter).join("");
    setSubmitting(true);
    setNote("");
    try {
      const { correct } = await submitGrandCelebrationAnswer({
        backendBase,
        adminToken,
        storedUser,
        stageId: isDemoBypass ? "" : stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
        questionId: question.id,
        answer: word,
      });
      if (!correct) setPopup({ type: "retry" });
      else if (learningPopupEnabled) setPopup({ type: "learning", questionId: question.id, word });
      else commitSolved(question.id);
    } catch (err) {
      console.error("Grand Celebration answer:", err);
      setNote("Could not check your word. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    canInteract,
    question,
    board,
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
    stageRowId,
    learningPopupEnabled,
    commitSolved,
  ]);

  const closeLearning = () => {
    if (popup?.type !== "learning") return;
    const id = popup.questionId;
    setPopup(null);
    commitSolved(id);
  };

  /* ---------- completion ---------- */

  const completeLevel = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setSaveError("");
    setPhase("saving");
    try {
      let stageId = stageRowId || sessionStorage.getItem(STAGE_ROW_KEY);
      if (!stageId && !isDemoBypass && backendBase && adminToken) {
        stageId = await ensureStageRowId({ backendBase, adminToken, storedUser, isDemoBypass });
        if (stageId) setStageRowId(String(stageId));
      }
      if (!isDemoBypass && backendBase && adminToken && stageId) {
        const result = await saveGameStageAndReport({
          backendBase,
          adminToken,
          storedUser,
          isDemoBypass,
          stageId,
          stageNumber: 5,
          score: GRAND_CELEBRATION_POINTS,
          answers: {
            puzzle: GRAND_CELEBRATION_PUZZLE_ID,
            solved: solvedRef.current,
            reward: "key_of_wisdom",
          },
          time: formatSecondsToClock(elapsedRef.current),
          gameover: true,
        });
        if (!result?.ok) throw new Error("Stage save failed");
        setTotalScore(
          result.total_score != null
            ? Number(result.total_score) || 0
            : (prev) => prev + GRAND_CELEBRATION_POINTS
        );
      } else {
        setTotalScore((prev) => prev + GRAND_CELEBRATION_POINTS);
      }
      markHall1HotspotCompleted(HUB_HOTSPOT_ID);
      sessionStorage.setItem("hall1_complete", "1");
      setPhase("success");
    } catch (err) {
      console.error("Grand Celebration save:", err);
      completingRef.current = false;
      setPhase("playing");
      setSaveError("Could not save your progress.");
    }
  }, [stageRowId, isDemoBypass, backendBase, adminToken, storedUser]);

  /* 8/8 solved: save once the last learning popup closes (and the lantern has lit). */
  useEffect(() => {
    if (phase !== "playing" || solved.length < TOTAL || popup || saveError) return undefined;
    const id = window.setTimeout(completeLevel, 900);
    return () => clearTimeout(id);
  }, [phase, solved, popup, saveError, completeLevel]);

  /* Demo players solve one word, then see the plans page (as in the other stages). */
  useEffect(() => {
    if (!isDemoBypass || solved.length === 0 || demoRedirectTriggeredRef.current) return;
    if (phase !== "playing" || popup) return;
    demoRedirectTriggeredRef.current = true;
    void Swal.fire({
      icon: "info",
      text: "Thank you for playing. Subscribe to any PLAN to play with your peers.",
      confirmButtonText: "OK",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(() => {
      window.location.assign("https://extramileplay.com/plans");
    });
  }, [isDemoBypass, solved, phase, popup]);

  /* ---------- finale ---------- */

  const onFinalShown = useCallback(() => {
    requestLeaderboardSubmit({
      points: totalScore,
      time: formatSecondsToClock(elapsedRef.current),
      userId: storedUser?.userId || storedUser?.userid || storedUser?.id,
    });
  }, [totalScore, storedUser]);

  /** Demo players have no stages row, so their feedback is not stored. */
  const submitFeedback = useCallback(
    async (feedback) => {
      if (isDemoBypass) return;
      await submitGameFeedback({ backendBase, adminToken, storedUser, feedback });
    },
    [isDemoBypass, backendBase, adminToken, storedUser]
  );

  const goHome = () => {
    const home = storedUser?.backButtonRedirect || process.env.REACT_APP_BASE_URL;
    if (home) window.location.assign(home);
    else navigate("/", { replace: true });
  };

  /* ---------- render ---------- */

  const learningQuestion =
    popup?.type === "learning"
      ? GRAND_CELEBRATION_QUESTIONS.find((q) => q.id === popup.questionId)
      : null;
  const filled = board.slots.every((s) => s != null);
  const n = board.tiles.length;

  const renderTile = (tile, extra = "") => (
    <span className={`gc-tile${extra}`}>{tile.letter}</span>
  );

  return (
    <div
      className="vs-stage gc-stage"
      ref={stageRef}
      style={{
        "--gc-bg-desk": `url("${GRAND_CELEBRATION_DESK_BG}")`,
        "--gc-bg-mob": `url("${GRAND_CELEBRATION_MOB_BG}")`,
      }}
    >
      <div className="stage-escape-hud">
        <StageTimer timeLabel={formatSecondsToClock(elapsedSec)} points={displayPoints} />
      </div>

      <div className="vs-scene-wrap gc-scene">
        {phase === "loading" ? (
          <p className="vs-status" aria-live="polite">
            Loading the Grand Celebration…
          </p>
        ) : null}

        <SceneBox box={FULL_BOX}>
          <header className="vs-plaque">
            <h1 className="vs-plaque__title">Grand Celebration</h1>
            <p className="vs-plaque__sub">Complete the missing word</p>
          </header>

          {phase !== "loading" ? (
            <p className="vs-counter gc-counter" role="status" aria-label={`${solved.length} of ${TOTAL} words solved`}>
              <span className="vs-counter__num">
                {solved.length} / {TOTAL}
              </span>{" "}
              Words
              <span className="gc-counter__bar" aria-hidden="true">
                <span style={{ width: `${(solved.length / TOTAL) * 100}%` }} />
              </span>
            </p>
          ) : null}

          {question && (phase === "playing" || phase === "story" || phase === "saving") ? (
            <div className="gc-puzzle" style={{ "--gc-n": n }}>
              <div className="gc-sentence">
                <p key={question.id}>
                  {question.before} <span className="gc-blank" aria-label="missing word">________</span>
                  {question.after === "." ? "." : ` ${question.after}`}
                </p>
                <p className="gc-sentence__label">Unscramble the word</p>
              </div>

              <div className="gc-row gc-tray" data-gc-drop="tray" aria-label="Scrambled letters">
                {board.tiles.map((tile) => {
                  const placed = slotOfTile(tile.id) !== -1;
                  return (
                    <span key={tile.id} className="gc-cell">
                      {!placed ? (
                        <button
                          type="button"
                          className={`gc-tile-btn${drag?.tileId === tile.id ? " is-lifted" : ""}`}
                          onPointerDown={(e) => onTilePointerDown(e, tile.id)}
                          onClick={() => !justDragged() && tapTile(tile.id)}
                          aria-label={`Letter ${tile.letter}. Press to place in the next space.`}
                        >
                          {renderTile(tile)}
                        </button>
                      ) : (
                        <span className="gc-cell__empty" aria-hidden="true" />
                      )}
                    </span>
                  );
                })}
              </div>

              <div className="gc-row gc-slots" aria-label="Your answer">
                {board.slots.map((tileId, i) => {
                  const hinted = board.hinted.includes(i);
                  const tile = tileId != null ? board.tiles[tileId] : null;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`gc-slot${hinted ? " is-hinted" : ""}${
                        drag?.over === i && !hinted ? " is-over" : ""
                      }`}
                      data-gc-drop={hinted ? undefined : String(i)}
                      onPointerDown={(e) => tile && onTilePointerDown(e, tileId)}
                      onClick={() => !justDragged() && tapSlot(i)}
                      aria-label={`Space ${i + 1}: ${tile ? tile.letter : "empty"}${hinted ? " (locked)" : ""}`}
                    >
                      {tile ? renderTile(tile, drag?.tileId === tileId ? " is-lifted" : "") : null}
                    </button>
                  );
                })}
              </div>

              <div className="gc-tools">
                <button type="button" className="gc-tool" onClick={askHint} disabled={!canInteract}>
                  <span aria-hidden="true">💡</span> Hint
                </button>
                <button type="button" className="gc-tool" onClick={clearTiles} disabled={!canInteract}>
                  <span aria-hidden="true">↻</span> Clear
                </button>
              </div>

              <GoldButton className="gc-submit" onClick={submitWord} disabled={!canInteract || !filled}>
                {submitting ? "Checking…" : "Submit Word"}
              </GoldButton>

              <p className={`gc-note${note ? " is-alert" : ""}`} aria-live="polite">
                {note || "Tap letters in order, or drag them into the spaces."}
              </p>
            </div>
          ) : null}

          {phase !== "loading" ? (
            <ol className="gc-lanterns" aria-label={`${solved.length} of ${TOTAL} lanterns lit`}>
              {GRAND_CELEBRATION_QUESTIONS.map((q, i) => (
                <li key={q.id} className={`gc-lantern${i === newLantern ? " is-new" : ""}`}>
                  <Lantern lit={i < solved.length} />
                </li>
              ))}
            </ol>
          ) : null}
        </SceneBox>

        {saveError ? (
          <div className="vs-banner" role="alert">
            <span>{saveError}</span>
            <button type="button" onClick={completeLevel}>
              Retry
            </button>
          </div>
        ) : null}

        {phase === "saving" ? (
          <p className="vs-status" aria-live="polite">
            Saving your progress…
          </p>
        ) : null}
      </div>

      {drag ? (
        <div className="gc-ghost" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} aria-hidden="true">
          {renderTile(board.tiles[drag.tileId])}
        </div>
      ) : null}

      {phase === "story" ? (
        <Popup labelId="gc-story-title" title={GRAND_CELEBRATION_STORY.heading}>
          <p className="vs-card__quote">{GRAND_CELEBRATION_STORY.quote}</p>
          {GRAND_CELEBRATION_STORY.paragraphs.map((p) => (
            <p key={p} className="vs-card__text">
              {p}
            </p>
          ))}
          <p className="vs-card__objective">
            <strong>Objective:</strong> {GRAND_CELEBRATION_STORY.objective}
          </p>
          <GoldButton onClick={() => setPhase("playing")}>{GRAND_CELEBRATION_STORY.button}</GoldButton>
        </Popup>
      ) : null}

      {popup?.type === "hint" ? (
        <Popup labelId="gc-hint-title" title="Use a Hint?" onClose={() => setPopup(null)}>
          <p className="vs-card__text">
            A hint places one correct letter for you, but adds{" "}
            <strong>+{HINT_PENALTY_SEC} seconds</strong> to your time.
          </p>
          <p className="vs-card__text">Are you sure you want to use a hint?</p>
          <div className="gc-confirm">
            <GoldButton onClick={requestHint}>Yes, use hint</GoldButton>
            <GoldButton onClick={() => setPopup(null)}>Cancel</GoldButton>
          </div>
        </Popup>
      ) : null}

      {popup?.type === "retry" ? (
        <Popup labelId="gc-retry-title" title={GRAND_CELEBRATION_RETRY.heading} icon={<RetryIcon />} onClose={() => setPopup(null)}>
          <p className="vs-card__text">{GRAND_CELEBRATION_RETRY.text}</p>
          <GoldButton onClick={() => setPopup(null)}>{GRAND_CELEBRATION_RETRY.button}</GoldButton>
        </Popup>
      ) : null}

      {learningQuestion ? (
        <Popup labelId="gc-learning-title" title={popup.word} icon={<CheckIcon />} iconTone="success" onClose={closeLearning}>
          <p className="vs-card__eyebrow">🏮 A lantern lights up!</p>
          <p className="vs-card__text">{learningQuestion.learning}</p>
          <GoldButton onClick={closeLearning}>Continue</GoldButton>
        </Popup>
      ) : null}

      {phase === "success" ? (
        <Popup labelId="gc-success-title" title={GRAND_CELEBRATION_SUCCESS.heading}>
          <img className="vs-key" src={KEY_IMAGES.wisdom} alt="" />
          <p className="vs-card__text">{GRAND_CELEBRATION_SUCCESS.text}</p>
          <p className="vs-card__reward">{GRAND_CELEBRATION_SUCCESS.reward}</p>
          <JourneyProgress percent={GRAND_CELEBRATION_COMPLETION_PERCENT} />
          <p className="vs-card__text">{GRAND_CELEBRATION_SUCCESS.next}</p>
          <GoldButton onClick={() => setPhase("finale")}>{GRAND_CELEBRATION_SUCCESS.button}</GoldButton>
        </Popup>
      ) : null}

      {phase === "finale" ? (
        <FinalCelebration
          bgUrl={bgUrl}
          startAtFinal={finaleAtEnd}
          onFinalShown={onFinalShown}
          onSubmitFeedback={submitFeedback}
          onNext={() => (leaderboardEnabled ? navigate("/leaderboard") : goHome())}
        />
      ) : null}
    </div>
  );
}
