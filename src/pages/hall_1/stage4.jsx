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
import {
  unlockHall1Hotspot,
  markHall1HotspotCompleted,
  getRedirectIfHall1StageDone,
} from "./medalDisplayData";
import { readPopupSettings } from "./villageSquareData";
import {
  CELEBRATION_STEPS_DESK_BG,
  CELEBRATION_STEPS_MOB_BG,
  CELEBRATION_STEPS_PUZZLE_ID,
  CELEBRATION_STEPS_POINTS,
  CELEBRATION_STEPS_COMPLETION_PERCENT,
  CELEBRATION_ACTIVITIES,
  ACTIVITY_BY_ID,
  SLOT_COUNT,
  STEP_LADDER,
  CELEBRATION_STEPS_STORY,
  CELEBRATION_STEPS_RETRY,
  CELEBRATION_STEPS_SUCCESS,
  readLockedFromStage,
  readCachedLocked,
  writeCachedLocked,
  shuffled,
  submitCelebrationOrder,
} from "./celebrationStepsData";
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
import "../fonts/breuer-headline.css";
import "./stage4.css";

/** Hall hub hotspot for this checkpoint (stage4) and the final one it unlocks. */
const HUB_HOTSPOT_ID = "newspaper";
const HUB_UNLOCKS = "trophy_vault";

const FULL_BOX = { left: 0, top: 0, width: "100%", height: "100%" };
const DRAG_THRESHOLD = 6;
const ALL_IDS = CELEBRATION_ACTIVITIES.map((a) => a.id);

/**
 * Box the background image occupies under `background-size: cover` (centred).
 * `viewport`: measure the window instead of the scene (phones, where the art
 * is the full-screen page backdrop).
 */
function useCoverBox(wrapRef, imgW, imgH, viewport = false) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const sync = () => {
      const W = viewport ? window.innerWidth : wrap.clientWidth;
      const H = viewport ? window.innerHeight : wrap.clientHeight;
      if (!W || !H) return;
      const scale = Math.max(W / imgW, H / imgH);
      const width = imgW * scale;
      const height = imgH * scale;
      setBox({ left: (W - width) / 2, top: (H - height) / 2, width, height });
    };
    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [wrapRef, imgW, imgH, viewport]);
  return box;
}

/** Gold medallions on the staircase; one lights per locked activity, bottom first. */
function StepLadder({ ladder, box, lit }) {
  if (!box) return null;
  return (
    <div
      className="cs-ladder"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      aria-hidden="true"
    >
      {ladder.steps.map((s, i) => (
        <span
          key={i}
          className={`cs-step${i < lit ? " is-lit" : ""}`}
          style={{
            left: `${(s.x / ladder.w) * 100}%`,
            top: `${(s.y / ladder.h) * 100}%`,
            width: `${((s.r * 2) / ladder.w) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

/** Hall Stage 4 — Level 4: Celebration Steps (arrange the sequence). */
export default function HallStage4() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const themeData = useSelector((s) => s.theme?.data);
  const { storyPopupEnabled, learningPopupEnabled } = useMemo(
    () => readPopupSettings(themeData),
    [themeData]
  );

  const storedUser = useMemo(() => user || getStoredUser(), [user]);
  const isDemoBypass = useMemo(() => isDemoUser(storedUser), [storedUser]);
  const backendBase = getBackendBase();

  const bgUrl = useLayoutSvgUrl(CELEBRATION_STEPS_DESK_BG, CELEBRATION_STEPS_MOB_BG);
  const isMob = bgUrl === CELEBRATION_STEPS_MOB_BG;
  const ladder = isMob ? STEP_LADDER.mob : STEP_LADDER.desk;
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  useLevelPage(stageRef, bgUrl);
  const coverBox = useCoverBox(wrapRef, ladder.w, ladder.h, isMob);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || ""
  );
  /** loading → story → playing → saving → success */
  const [phase, setPhase] = useState("loading");
  /** Slot index → activity id (or null). */
  const [slots, setSlots] = useState(() => Array(SLOT_COUNT).fill(null));
  /** Activity ids still in the Activities list, in display order. */
  const [pool, setPool] = useState([]);
  /** Slot index → activity id for server-confirmed (locked) cards. */
  const [locked, setLocked] = useState({});
  const [wrongSlots, setWrongSlots] = useState([]);
  /** Card picked up by click / keyboard: { id, from: "pool" | slotIndex }. */
  const [selected, setSelected] = useState(null);
  /** Pointer drag in progress: { id, from, x, y, w, h, dx, dy, over }. */
  const [drag, setDrag] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  /** Learning popups still to show (activity ids), then maybe the retry popup. */
  const [learningQueue, setLearningQueue] = useState([]);
  /** Learning popups already closed in the current run (for "2 of 3"). */
  const [learningDone, setLearningDone] = useState(0);
  const [retryPending, setRetryPending] = useState(false);
  const [saveError, setSaveError] = useState("");

  const elapsedRef = useRef(0);
  const completingRef = useRef(false);
  const demoRedirectTriggeredRef = useRef(false);
  const pressRef = useRef(null);

  const lockedCount = Object.keys(locked).length;
  const isLocked = (slot) => locked[slot] != null;

  useEffect(() => {
    dispatch(setBackButtonUrl("/hall-1"));
  }, [dispatch]);

  /* Load timer, score and locked cards (DB first, session cache for demo). */
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

      const redirect = getRedirectIfHall1StageDone(stage, 4);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      const restored = stage ? readLockedFromStage(stage) : readCachedLocked();
      const restoredSlots = Array(SLOT_COUNT).fill(null);
      Object.entries(restored).forEach(([slot, id]) => {
        restoredSlots[Number(slot)] = id;
      });
      const lockedIds = new Set(Object.values(restored));
      setLocked(restored);
      setSlots(restoredSlots);
      setPool(shuffled(ALL_IDS.filter((id) => !lockedIds.has(id))));
      writeCachedLocked(restored);

      if (stageId) setStageRowId(String(stageId));
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTotalScore(readTotalScoreFromStage(stage));
      setTimerReady(true);
      setPhase(Object.keys(restored).length === 0 && storyPopupEnabled ? "story" : "playing");
    })();
    return () => {
      cancelled = true;
    };
    // storyPopupEnabled is read once at load; toggling mid-level should not reopen the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendBase, adminToken, storedUser, isDemoBypass, navigate]);

  useEffect(() => {
    if (!timerReady || phase === "success") return undefined;
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

  const displayPoints =
    phase === "success"
      ? totalScore
      : totalScore + liveProgressPoints(lockedCount, SLOT_COUNT, CELEBRATION_STEPS_POINTS);

  /* ---------- checking placements ---------- */

  /**
   * Apply server results for `placedSlots` (slot → id at the time of the check):
   * correct cards lock and queue their learning popup; wrong ones are marked.
   */
  const applyResults = useCallback(
    (results, placedSlots, { showRetry }) => {
      const newlyLocked = results.filter((r) => r.correct).map((r) => r.slot);
      const wrong = results.filter((r) => !r.correct).map((r) => r.slot);
      if (newlyLocked.length) {
        setLocked((prev) => {
          const next = { ...prev };
          newlyLocked.forEach((slot) => {
            next[slot] = placedSlots[slot];
          });
          writeCachedLocked(next);
          return next;
        });
      }
      setWrongSlots((prev) => [
        ...prev.filter((s) => !newlyLocked.includes(s) && !wrong.includes(s)),
        ...wrong,
      ]);
      if (showRetry && wrong.length) setRetryPending(true);
      if (learningPopupEnabled && newlyLocked.length) {
        const add = [...newlyLocked].sort((a, b) => a - b).map((slot) => placedSlots[slot]);
        setLearningQueue((q) => [...q, ...add]);
      }
      return { newlyLocked, wrong };
    },
    [learningPopupEnabled]
  );

  const checkPlacements = useCallback(
    async (placements, placedSlots, { showRetry }) => {
      setSubmitting(true);
      setNote("");
      setSelected(null);
      try {
        const { results } = await submitCelebrationOrder({
          backendBase,
          adminToken,
          storedUser,
          stageId: isDemoBypass ? "" : stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
          placements,
        });
        const { wrong } = applyResults(results, placedSlots, { showRetry });
        if (!showRetry && wrong.length) {
          setNote("Not quite — that activity belongs on a different step.");
        }
      } catch (err) {
        console.error("Celebration Steps check:", err);
        setNote("Could not check your order. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [backendBase, adminToken, storedUser, isDemoBypass, stageRowId, applyResults]
  );

  /* ---------- moving cards ---------- */

  /** Move card `id` from "pool" / slot to "pool" / slot; an occupant swaps back. */
  const moveCard = useCallback(
    (id, from, to) => {
      if (from === to || (typeof to === "number" && locked[to] != null)) return;
      if (typeof from === "number" && locked[from] != null) return;
      const nextSlots = [...slots];
      let nextPool = pool.filter((p) => p !== id);
      const occupant = typeof to === "number" ? nextSlots[to] : null;

      if (typeof from === "number") nextSlots[from] = null;
      if (typeof to === "number") {
        nextSlots[to] = id;
        if (occupant) {
          if (typeof from === "number") nextSlots[from] = occupant;
          else nextPool = [...nextPool, occupant];
        }
      } else {
        nextPool = [...nextPool, id];
      }

      setSlots(nextSlots);
      setPool(nextPool);
      setWrongSlots((w) => w.filter((s) => s !== from && s !== to));
      setSelected(null);
      setNote("");

      // Check each card that just landed in a slot; correct ones lock at once.
      const landed = {};
      if (typeof to === "number") landed[to] = id;
      if (typeof from === "number" && nextSlots[from]) landed[from] = nextSlots[from];
      if (Object.keys(landed).length) {
        checkPlacements(landed, nextSlots, { showRetry: false });
      }
    },
    [slots, pool, locked, checkPlacements]
  );

  const canInteract = phase === "playing" && !submitting && !learningQueue.length && !retryPending;

  /** Click / keyboard: pick up a card, or drop the held card here. */
  const activate = useCallback(
    (target, cardId) => {
      if (!canInteract) return;
      if (selected && selected.id !== cardId) {
        moveCard(selected.id, selected.from, target);
        return;
      }
      if (!cardId || (typeof target === "number" && isLocked(target))) return;
      setSelected(selected?.id === cardId ? null : { id: cardId, from: target });
    },
    // isLocked reads `locked`, listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canInteract, selected, moveCard, locked]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Pointer drag: press → move past threshold → ghost follows → drop on a target. */
  const onCardPointerDown = (e, id, from) => {
    if (!canInteract || e.button > 0) return;
    if (typeof from === "number" && isLocked(from)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pressRef.current = {
      id,
      from,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      dragging: false,
      pointerId: e.pointerId,
    };
  };

  useEffect(() => {
    const dropTargetAt = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest?.("[data-drop]");
      if (!el) return null;
      const v = el.getAttribute("data-drop");
      return v === "pool" ? "pool" : Number(v);
    };
    /* While a card is held near the top / bottom edge of the scrolling flow
       list (phones), scroll the list so rows out of view can be reached. */
    const EDGE = 36;
    const autoScroll = () => {
      const p = pressRef.current;
      if (!p?.dragging) return;
      const list = document.querySelector(".cs-flow__grid");
      if (list && list.scrollHeight > list.clientHeight + 1) {
        const r = list.getBoundingClientRect();
        if (p.x >= r.left && p.x <= r.right) {
          const down = p.y - (r.bottom - EDGE);
          const up = r.top + EDGE - p.y;
          if (down > 0 && p.y < r.bottom + 16) list.scrollTop += Math.min(3.5, 1 + down / 14);
          else if (up > 0 && p.y > r.top - 16) list.scrollTop -= Math.min(3.5, 1 + up / 14);
        }
      }
      p.raf = requestAnimationFrame(autoScroll);
    };
    const onMove = (e) => {
      const p = pressRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) return;
        p.dragging = true;
        setSelected(null);
        document.body.classList.add("cs-dragging");
      }
      e.preventDefault();
      p.x = e.clientX;
      p.y = e.clientY;
      if (!p.raf) p.raf = requestAnimationFrame(autoScroll);
      setDrag({
        id: p.id,
        from: p.from,
        x: e.clientX - (p.startX - p.rect.left),
        y: e.clientY - (p.startY - p.rect.top),
        w: p.rect.width,
        h: p.rect.height,
        over: dropTargetAt(e.clientX, e.clientY),
      });
    };
    const onUp = (e) => {
      const p = pressRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      pressRef.current = null;
      if (p.raf) cancelAnimationFrame(p.raf);
      if (!p.dragging) return; // a plain click; the button's onClick handles it
      document.body.classList.remove("cs-dragging");
      const target = e.type === "pointercancel" ? null : dropTargetAt(e.clientX, e.clientY);
      setDrag(null);
      if (target != null) moveCard(p.id, p.from, target);
      pressRef.lastDragEnd = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("cs-dragging");
    };
  }, [moveCard]);

  /** Ignore the click that follows a drag release. */
  const justDragged = () => performance.now() - (pressRef.lastDragEnd || 0) < 250;

  /* ---------- submit ---------- */

  const submitOrder = useCallback(() => {
    if (!canInteract) return;
    const placements = {};
    slots.forEach((id, i) => {
      if (id && locked[i] == null) placements[i] = id;
    });
    if (!Object.keys(placements).length) {
      setNote("Place at least one activity in the Celebration Flow first.");
      return;
    }
    checkPlacements(placements, slots, { showRetry: true });
  }, [canInteract, slots, locked, checkPlacements]);

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
          stageNumber: 4,
          score: CELEBRATION_STEPS_POINTS,
          answers: {
            puzzle: CELEBRATION_STEPS_PUZZLE_ID,
            locked,
            reward: "key_of_values",
          },
          time: formatSecondsToClock(elapsedRef.current),
        });
        if (!result?.ok) throw new Error("Stage save failed");
        setTotalScore(
          result.total_score != null
            ? Number(result.total_score) || 0
            : (prev) => prev + CELEBRATION_STEPS_POINTS
        );
      } else {
        setTotalScore((prev) => prev + CELEBRATION_STEPS_POINTS);
      }
      markHall1HotspotCompleted(HUB_HOTSPOT_ID);
      unlockHall1Hotspot(HUB_UNLOCKS);
      setPhase("success");
    } catch (err) {
      console.error("Celebration Steps save:", err);
      completingRef.current = false;
      setPhase("playing");
      setSaveError("Could not save your progress.");
    }
  }, [stageRowId, isDemoBypass, backendBase, adminToken, storedUser, locked]);

  /* All 12 locked (or restored on refresh): save after the last learning popup. */
  useEffect(() => {
    if (phase !== "playing" || lockedCount < SLOT_COUNT) return undefined;
    if (learningQueue.length || retryPending || saveError) return undefined;
    const id = window.setTimeout(completeLevel, 700);
    return () => clearTimeout(id);
  }, [phase, lockedCount, learningQueue, retryPending, saveError, completeLevel]);

  /* Demo players lock one activity, then see the plans page (as in the other stages). */
  useEffect(() => {
    if (!isDemoBypass || lockedCount === 0 || demoRedirectTriggeredRef.current) return;
    if (phase !== "playing" || learningQueue.length) return;
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
  }, [isDemoBypass, lockedCount, phase, learningQueue]);

  /* ---------- render ---------- */

  const learning = learningQueue.length ? ACTIVITY_BY_ID[learningQueue[0]] : null;
  const closeLearning = () => {
    const last = learningQueue.length <= 1;
    setLearningQueue((q) => q.slice(1));
    setLearningDone((d) => (last ? 0 : d + 1));
  };
  const learningTotal = learningDone + learningQueue.length;
  const hasUnlockedPlaced = slots.some((id, i) => id && locked[i] == null);
  const hint = note
    ? note
    : selected
    ? `Now choose where “${ACTIVITY_BY_ID[selected.id].label}” goes (Esc to cancel).`
    : "Correct activities lock into place and light each step.";

  const renderCard = (id, from, extraClass = "") => {
    const a = ACTIVITY_BY_ID[id];
    const lockedCard = typeof from === "number" && isLocked(from);
    return (
      <span
        className={`cs-card${lockedCard ? " is-locked" : ""}${
          selected?.id === id ? " is-selected" : ""
        }${drag?.id === id ? " is-lifted" : ""}${extraClass}`}
      >
        {!lockedCard ? (
          <span className="cs-card__grip" aria-hidden="true">
            ⠿
          </span>
        ) : null}
        <span className="cs-card__label">{a.label}</span>
        {lockedCard ? (
          <span className="cs-card__lock" aria-hidden="true">
            🔒
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div
      className="vs-stage cs-stage"
      ref={stageRef}
      style={{
        "--cs-bg-desk": `url("${CELEBRATION_STEPS_DESK_BG}")`,
        "--cs-bg-mob": `url("${CELEBRATION_STEPS_MOB_BG}")`,
      }}
    >
      <div className="stage-escape-hud">
        <StageTimer timeLabel={formatSecondsToClock(elapsedSec)} points={displayPoints} />
      </div>

      <div className="vs-scene-wrap cs-scene" ref={wrapRef}>
        <StepLadder ladder={ladder} box={coverBox} lit={lockedCount} />

        {phase === "loading" ? (
          <p className="vs-status" aria-live="polite">
            Loading the celebration steps…
          </p>
        ) : null}

        <SceneBox box={FULL_BOX}>
          <header className="vs-plaque">
            <h1 className="vs-plaque__title">Celebration Steps</h1>
            <p className="vs-plaque__sub">Arrange the celebration in the correct order</p>
          </header>

          {phase !== "loading" ? (
            <p
              className="vs-counter"
              role="status"
              aria-label={`${lockedCount} of ${SLOT_COUNT} activities placed`}
            >
              <span className="vs-counter__num">
                {lockedCount} / {SLOT_COUNT}
              </span>{" "}
              Placed
            </p>
          ) : null}

          {phase !== "loading" ? (
            <div className="cs-panels">
              <section
                className={`cs-pool${drag?.over === "pool" ? " is-over" : ""}${
                  selected && typeof selected.from === "number" ? " is-target" : ""
                }`}
                data-drop="pool"
                aria-labelledby="cs-pool-title"
                onClick={(e) => {
                  if (e.target === e.currentTarget && selected && typeof selected.from === "number") {
                    moveCard(selected.id, selected.from, "pool");
                  }
                }}
              >
                <h2 id="cs-pool-title" className="cs-panel__title">
                  Activities
                </h2>
                <ul className="cs-pool__list" data-drop="pool">
                  {pool.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="cs-pick"
                        onPointerDown={(e) => onCardPointerDown(e, id, "pool")}
                        onClick={() => !justDragged() && activate("pool", id)}
                        aria-pressed={selected?.id === id}
                        aria-label={`${ACTIVITY_BY_ID[id].label}. ${
                          selected?.id === id ? "Picked up." : "Press to pick up."
                        }`}
                      >
                        {renderCard(id, "pool")}
                      </button>
                    </li>
                  ))}
                  {!pool.length ? (
                    <li className="cs-pool__empty">All activities are in the flow.</li>
                  ) : null}
                </ul>
                {selected && typeof selected.from === "number" ? (
                  <button
                    type="button"
                    className="cs-return"
                    onClick={() => moveCard(selected.id, selected.from, "pool")}
                  >
                    Return to activities
                  </button>
                ) : (
                  <p className="cs-pool__count">
                    {pool.length} of {SLOT_COUNT} activities
                  </p>
                )}
              </section>

              <section className="cs-flow" aria-labelledby="cs-flow-title">
                <h2 id="cs-flow-title" className="cs-panel__title cs-panel__title--flow">
                  Celebration Flow
                </h2>
                <ol className="cs-flow__grid">
                  {slots.map((id, i) => {
                    const lockedSlot = isLocked(i);
                    const wrong = wrongSlots.includes(i);
                    return (
                      <li
                        key={i}
                        className={`cs-slot${lockedSlot ? " is-locked" : ""}${
                          wrong ? " is-wrong" : ""
                        }${drag?.over === i && !lockedSlot ? " is-over" : ""}${
                          selected && !lockedSlot ? " is-target" : ""
                        }`}
                      >
                        <span className="cs-slot__num" aria-hidden="true">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          className="cs-slot__drop"
                          data-drop={lockedSlot ? undefined : String(i)}
                          onPointerDown={(e) => id && onCardPointerDown(e, id, i)}
                          onClick={() => !justDragged() && activate(i, id)}
                          aria-disabled={lockedSlot}
                          aria-label={`Step ${i + 1}: ${
                            id ? ACTIVITY_BY_ID[id].label : "empty"
                          }${lockedSlot ? ", locked in place" : ""}${
                            wrong ? ", not in the right place yet" : ""
                          }`}
                        >
                          {id ? (
                            renderCard(id, i)
                          ) : (
                            <span className="cs-slot__empty">Drag activity here</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          ) : null}

          {phase !== "loading" ? (
            <p className={`cs-hint${note ? " is-alert" : ""}`} aria-live="polite">
              {hint}
            </p>
          ) : null}

          {phase !== "loading" ? (
            <div className="cs-submit">
              <GoldButton
                onClick={submitOrder}
                disabled={!canInteract || !hasUnlockedPlaced}
              >
                {submitting ? "Checking…" : "Submit Order"}
              </GoldButton>
            </div>
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
        <div
          className="cs-ghost"
          style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }}
          aria-hidden="true"
        >
          {renderCard(drag.id, drag.from, " is-ghost")}
        </div>
      ) : null}

      {phase === "story" ? (
        <Popup labelId="cs-story-title" title={CELEBRATION_STEPS_STORY.heading}>
          <p className="vs-card__quote">{CELEBRATION_STEPS_STORY.quote}</p>
          {CELEBRATION_STEPS_STORY.paragraphs.map((p) => (
            <p key={p} className="vs-card__text">
              {p}
            </p>
          ))}
          <p className="vs-card__objective">
            <strong>Objective:</strong> {CELEBRATION_STEPS_STORY.objective}
          </p>
          <GoldButton onClick={() => setPhase("playing")}>
            {CELEBRATION_STEPS_STORY.button}
          </GoldButton>
        </Popup>
      ) : null}

      {learning ? (
        <Popup labelId="cs-learning-title" title={learning.learning.heading} icon={<CheckIcon />} iconTone="success" onClose={closeLearning}>
          <p className="vs-card__eyebrow">
            ✨ Step lit
            {learningTotal > 1
              ? ` · ${learningDone + 1} of ${learningTotal}`
              : ""}
          </p>
          <p className="vs-card__text">{learning.learning.text}</p>
          <GoldButton onClick={closeLearning}>Continue</GoldButton>
        </Popup>
      ) : null}

      {!learning && retryPending ? (
        <Popup labelId="cs-retry-title" title={CELEBRATION_STEPS_RETRY.heading} icon={<RetryIcon />} onClose={() => setRetryPending(false)}>
          <p className="vs-card__text">{CELEBRATION_STEPS_RETRY.text}</p>
          <GoldButton onClick={() => setRetryPending(false)}>
            {CELEBRATION_STEPS_RETRY.button}
          </GoldButton>
        </Popup>
      ) : null}

      {phase === "success" ? (
        <Popup labelId="cs-success-title" title={CELEBRATION_STEPS_SUCCESS.heading}>
          <img className="vs-key" src={KEY_IMAGES.values} alt="" />
          <p className="vs-card__text">{CELEBRATION_STEPS_SUCCESS.text}</p>
          <p className="vs-card__reward">{CELEBRATION_STEPS_SUCCESS.reward}</p>
          <JourneyProgress percent={CELEBRATION_STEPS_COMPLETION_PERCENT} />
          <p className="vs-card__text">{CELEBRATION_STEPS_SUCCESS.next}</p>
          <GoldButton
            onClick={() =>
              navigate("/hall-1", {
                replace: true,
                state: { checkpointComplete: CELEBRATION_STEPS_PUZZLE_ID },
              })
            }
          >
            {CELEBRATION_STEPS_SUCCESS.button}
          </GoldButton>
        </Popup>
      ) : null}
    </div>
  );
}
