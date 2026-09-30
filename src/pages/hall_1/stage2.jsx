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
  RIVERSIDE_PUZZLE_ID,
  RIVERSIDE_POINTS,
  RIVERSIDE_COMPLETION_PERCENT,
  RIVERSIDE_DESK_SVG,
  RIVERSIDE_MOB_SVG,
  RIVERSIDE_SVG_IDS,
  RIVERSIDE_STATEMENTS,
  RIVERSIDE_STORY,
  RIVERSIDE_RETRY,
  RIVERSIDE_SUCCESS,
  ANSWER_BUTTONS,
  cleanProgress,
  readProgressFromStage,
  readCachedProgress,
  writeCachedProgress,
  submitRiversideAnswer,
  saveRiversidePlanks,
} from "./riversideData";
import {
  formatSecondsToClock,
  loadHallElapsedFromDb,
  persistHallElapsedTime,
  readTotalScoreFromStage,
  liveProgressPoints,
} from "./hallTimer";
import {
  SVG_NS,
  getStoredUser,
  isDemoUser,
  getBackendBase,
  useLayoutSvgUrl,
  useSceneFit,
  useObjectScene,
  useApplySceneFit,
  useLevelPage,
  getObjectSvg,
  elementBox,
  SceneBox,
  Popup,
  CheckIcon,
  RetryIcon,
  GoldButton,
  JourneyProgress,
} from "./levelScene";
import { KEY_IMAGES } from "./keyImages";
import "../fonts/breuer-headline.css";
import "./stage2.css";

/** Hall hub hotspot for this checkpoint (stage2) and the one it unlocks (Festival Market). */
const HUB_HOTSPOT_ID = "commentary_booth";
const HUB_UNLOCKS = "museum_archive";

const TOTAL = RIVERSIDE_STATEMENTS.length;
const EARN_ANIM_MS = 900;
const SNAP_MS = 260;
const WALK_MS = 5000;

/**
 * The scene fills the screen, cropping only outside the band that holds the
 * bridge and the plank tray. On phones the tray runs edge to edge, so only a
 * little sky and the bottom strip can go (otherwise the art stretches slightly).
 */
const SCENE_FIT = {
  desk: { w: 1920, h: 1080, fill: true, safe: { x0: 0.04, x1: 0.96, y0: 0.12, y1: 0.95 } },
  mob: { w: 414, h: 896, fill: true, safe: { x0: 0.01, x1: 0.99, y0: 0.04, y1: 0.985 } },
};

/** Styles injected into the SVG document (it cannot see page CSS). */
const SCENE_STYLE = `
.rc-complete { opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }
.rc-complete.is-shown { opacity: 1; }
.rc-slot { opacity: 0; pointer-events: none; }
.rc-slot.is-placed { opacity: 1; }
.rc-slot.is-snap { animation: rc-snap 0.4s ease-out; }
.rc-outline { display: none; } /* slot markers kept for placement logic, not shown */
.rc-frame { transition: opacity 0.3s ease; pointer-events: none; }
.rc-frame.is-placed { opacity: 0; }
.rc-tray { transition: opacity 0.4s ease, filter 0.4s ease; outline: none; }
.rc-tray.is-locked { opacity: 0.35; filter: grayscale(1) brightness(0.8); }
.rc-tray.is-earned { filter: drop-shadow(0 0 6px rgba(255, 215, 106, 0.9)); }
.rc-tray.is-new { animation: rc-earn ${EARN_ANIM_MS}ms ease-out; }
.rc-tray.is-draggable { cursor: grab; }
.rc-tray.is-draggable:focus-visible { filter: drop-shadow(0 0 8px #f3d27a) brightness(1.2); }
.rc-tray.is-lifted { opacity: 0.25; }
.rc-tray.is-used { opacity: 0; pointer-events: none; }
.rc-ghost { pointer-events: none; cursor: grabbing; filter: drop-shadow(0 10px 8px rgba(0, 0, 0, 0.45)); }
.rc-walker { pointer-events: none; }
/* Walk cycle: legs and arms swing from the hip / shoulder, body bobs per step. */
.rc-walker__bob { animation: rc-bob 0.32s ease-in-out infinite alternate; }
.rc-leg { transform-origin: 0px -42px; animation: rc-swing-leg 0.64s ease-in-out infinite alternate; }
.rc-arm { transform-origin: 0px -68px; animation: rc-swing-arm 0.64s ease-in-out infinite alternate; }
.rc-leg--back, .rc-arm--front { animation-direction: alternate-reverse; }
@keyframes rc-swing-leg { from { transform: rotate(26deg); } to { transform: rotate(-26deg); } }
@keyframes rc-swing-arm { from { transform: rotate(22deg); } to { transform: rotate(-22deg); } }
@keyframes rc-bob { from { transform: translateY(0px); } to { transform: translateY(-2.4px); } }
@keyframes rc-snap { 0% { filter: brightness(1.8) drop-shadow(0 0 10px #ffd76a); } 100% { filter: none; } }
@keyframes rc-earn {
  0% { opacity: 0.35; filter: grayscale(1); }
  40% { opacity: 1; filter: brightness(1.8) drop-shadow(0 0 14px #ffd76a); }
  100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(255, 215, 106, 0.9)); }
}
`;

const easeOut = (t) => 1 - (1 - t) ** 3;

/** rAF tween of an {x, y} offset; returns a cancel function. */
function tween(from, to, ms, onFrame, onDone) {
  let raf = 0;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const k = easeOut(t);
    onFrame({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    if (t < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

const centerOf = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/**
 * Traveller for the bridge crossing: a festive figure facing right, drawn in a
 * 100-unit-tall box with the feet at (0, 0). Limbs are separate groups so the
 * injected CSS (SCENE_STYLE) can swing them as a walk cycle.
 */
const WALKER_MARKUP = `
<g class="rc-walker__bob">
  <ellipse cx="0" cy="1" rx="15" ry="3.4" fill="rgba(0,0,0,0.28)"/>
  <g class="rc-arm rc-arm--back">
    <rect x="-3.2" y="-69" width="6.4" height="25" rx="3.2" fill="#b8431f"/>
    <circle cx="0" cy="-43" r="3.4" fill="#c98f5e"/>
  </g>
  <g class="rc-leg rc-leg--back">
    <rect x="-4.2" y="-43" width="8.4" height="40" rx="4.2" fill="#ece0c4"/>
    <path d="M-4.5 -4 h10 a5 3.6 0 0 1 5 3.6 v0.4 h-15 z" fill="#5a3416"/>
  </g>
  <path d="M-10 -72 q10 -6 20 0 l2.5 36 q-12.5 5 -25 0 z" fill="#e2622b"/>
  <path d="M-12.4 -37 q12.4 5 24.8 0 l0.3 3.4 q-12.7 5 -25.4 0 z" fill="#f3d27a"/>
  <path d="M0 -74 v34" stroke="#f3d27a" stroke-width="1.6" fill="none"/>
  <path d="M-8 -70 q11 10 17 30" stroke="#1d4172" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="5" y="-44" width="9" height="10" rx="2" fill="#1d4172" stroke="#f3d27a" stroke-width="0.8"/>
  <g class="rc-leg rc-leg--front">
    <rect x="-4.2" y="-43" width="8.4" height="40" rx="4.2" fill="#fbf3df"/>
    <path d="M-4.5 -4 h10 a5 3.6 0 0 1 5 3.6 v0.4 h-15 z" fill="#6e401c"/>
  </g>
  <rect x="-2.6" y="-78" width="5.2" height="6" fill="#c98f5e"/>
  <circle cx="1" cy="-86" r="9.2" fill="#dba774"/>
  <path d="M-8.4 -87 a9.6 9.6 0 0 1 17.6 -4.4 q-7 -1.2 -11 1.6 q-3.4 2.4 -3.2 7 q-2.8 -1 -3.4 -4.2 z" fill="#2a1a10"/>
  <circle cx="5.2" cy="-86.4" r="1.1" fill="#2a1a10"/>
  <path d="M4 -81.4 q2.4 1.4 4.4 0" stroke="#8a4a2a" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  <g class="rc-arm rc-arm--front">
    <rect x="-3.4" y="-69" width="6.8" height="25" rx="3.4" fill="#e2622b"/>
    <circle cx="0" cy="-43" r="3.6" fill="#dba774"/>
  </g>
</g>`;

/** Hall Stage 2 — Level 2: Riverside Crossing (Myth or Fact + build the bridge). */
export default function HallStage2() {
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

  const svgUrl = useLayoutSvgUrl(RIVERSIDE_DESK_SVG, RIVERSIDE_MOB_SVG);
  const stageRef = useRef(null);
  const objectRef = useRef(null);
  const wrapRef = useRef(null);
  useLevelPage(stageRef, svgUrl);
  const sceneFit = useSceneFit(
    wrapRef,
    svgUrl === RIVERSIDE_MOB_SVG ? SCENE_FIT.mob : SCENE_FIT.desk
  );

  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || ""
  );
  /** loading → story → quiz → success → build → saving → crossing */
  const [phase, setPhase] = useState("loading");
  const [correct, setCorrect] = useState([]);
  const [placed, setPlaced] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState("");
  /** null | { type: "retry" } | { type: "learning", statementId } */
  const [popup, setPopup] = useState(null);
  const [saveError, setSaveError] = useState("");
  /** Index of the plank that just lit up in the tray (earn animation). */
  const [newPlank, setNewPlank] = useState(-1);

  const elapsedRef = useRef(0);
  const correctRef = useRef([]);
  const placedRef = useRef(0);
  const phaseRef = useRef(phase);
  const usedTrayRef = useRef(new Set());
  const dragRef = useRef(null);
  const busyRef = useRef(false);
  const demoRedirectTriggeredRef = useRef(false);
  const handlersRef = useRef({});

  phaseRef.current = phase;

  const stageIdNow = () =>
    isDemoBypass ? "" : stageRowId || sessionStorage.getItem(STAGE_ROW_KEY) || "";

  useEffect(() => {
    dispatch(setBackButtonUrl("/hall-1"));
  }, [dispatch]);

  /* Load timer, score and saved progress (DB first, session cache for demo). */
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

      const redirect = getRedirectIfHall1StageDone(stage, 2);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      const restored = stage ? readProgressFromStage(stage) : readCachedProgress();
      correctRef.current = restored.correct;
      placedRef.current = restored.placed;
      usedTrayRef.current = new Set(Array.from({ length: restored.placed }, (_, i) => i));
      setCorrect(restored.correct);
      setPlaced(restored.placed);
      writeCachedProgress(restored);

      if (stageId) setStageRowId(String(stageId));
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTotalScore(readTotalScoreFromStage(stage));
      setTimerReady(true);
      if (restored.correct.length >= TOTAL) setPhase("build");
      else if (restored.correct.length === 0 && storyPopupEnabled) setPhase("story");
      else setPhase("quiz");
    })();
    return () => {
      cancelled = true;
    };
    // storyPopupEnabled is read once at load; toggling mid-level should not reopen the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendBase, adminToken, storedUser, isDemoBypass, navigate]);

  useEffect(() => {
    if (!timerReady || phase === "crossing") return undefined;
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
      if (phase !== "crossing") save();
    };
  }, [timerReady, backendBase, adminToken, storedUser, isDemoBypass, stageRowId, phase]);

  const levelSaved = phase === "crossing";
  const displayPoints = levelSaved
    ? totalScore
    : totalScore + liveProgressPoints(correct.length, TOTAL, RIVERSIDE_POINTS);

  const currentStatement = RIVERSIDE_STATEMENTS.find((s) => !correct.includes(s.id)) || null;

  /* ---------- quiz ---------- */

  const commitCorrect = useCallback((statementId) => {
    if (correctRef.current.includes(statementId)) return;
    const next = [...correctRef.current, statementId];
    correctRef.current = next;
    setCorrect(next);
    setNewPlank(next.length - 1);
    writeCachedProgress({ correct: next, placed: 0 });
  }, []);

  /* 8/8 answered → Key of Beliefs popup once the last plank has lit up. */
  useEffect(() => {
    if (phase !== "quiz" || correct.length < TOTAL || popup) return undefined;
    const id = window.setTimeout(() => setPhase("success"), EARN_ANIM_MS);
    return () => clearTimeout(id);
  }, [phase, correct, popup]);

  /* Demo players see one plank, then the plans page (as in the other stages). */
  useEffect(() => {
    if (!isDemoBypass || correct.length === 0 || demoRedirectTriggeredRef.current) return;
    if (phase !== "quiz" || popup) return;
    demoRedirectTriggeredRef.current = true;
    window.setTimeout(() => {
      void Swal.fire({
        icon: "info",
        text: "Thank you for playing. Subscribe to any PLAN to play with your peers.",
        confirmButtonText: "OK",
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        window.location.assign("https://extramileplay.com/plans");
      });
    }, EARN_ANIM_MS);
  }, [isDemoBypass, correct, phase, popup]);

  const submitAnswer = useCallback(
    async (answer) => {
      if (!currentStatement || submitting || popup || phase !== "quiz") return;
      setSubmitting(true);
      setAnswerError("");
      try {
        const { correct: isCorrect } = await submitRiversideAnswer({
          backendBase,
          adminToken,
          storedUser,
          stageId: stageIdNow(),
          statementId: currentStatement.id,
          answer,
        });
        if (!isCorrect) setPopup({ type: "retry" });
        else if (learningPopupEnabled) {
          setPopup({ type: "learning", statementId: currentStatement.id });
        } else commitCorrect(currentStatement.id);
      } catch (err) {
        console.error("Riverside answer:", err);
        setAnswerError("Could not check your answer. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    // stageIdNow reads the same values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentStatement,
      submitting,
      popup,
      phase,
      backendBase,
      adminToken,
      storedUser,
      isDemoBypass,
      stageRowId,
      learningPopupEnabled,
      commitCorrect,
    ]
  );

  const closeLearning = useCallback(() => {
    if (popup?.type !== "learning") return;
    const { statementId } = popup;
    setPopup(null);
    commitCorrect(statementId);
  }, [popup, commitCorrect]);

  const closeRetry = useCallback(() => setPopup(null), []);

  /* ---------- bridge building ---------- */

  const recordPlaced = useCallback(
    (count) => {
      placedRef.current = count;
      setPlaced(count);
      writeCachedProgress({ correct: correctRef.current, placed: count });
      if (!isDemoBypass) {
        saveRiversidePlanks({
          backendBase,
          adminToken,
          storedUser,
          stageId: stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
          placed: count,
        }).catch((err) => console.error("Riverside planks save:", err));
      }
    },
    [isDemoBypass, backendBase, adminToken, storedUser, stageRowId]
  );

  /** Tray plank `trayIndex` flies to the next empty slot, then the slot shows its plank. */
  const snapToNextSlot = useCallback(
    (svg, ghost, trayIndex, from) => {
      const slotIndex = placedRef.current;
      const slotBox = svg.__rcSlotBoxes[slotIndex];
      const trayBox = svg.__rcTrayBoxes[trayIndex];
      if (!slotBox || !trayBox) return;
      busyRef.current = true;
      const target = {
        x: centerOf(slotBox).x - centerOf(trayBox).x,
        y: centerOf(slotBox).y - centerOf(trayBox).y,
      };
      tween(
        from,
        target,
        SNAP_MS,
        (p) => ghost.setAttribute("transform", `translate(${p.x} ${p.y})`),
        () => {
          ghost.remove();
          usedTrayRef.current.add(trayIndex);
          const slotEl = svg.querySelector(`[data-slot="${slotIndex}"]`);
          slotEl?.classList.add("is-snap");
          window.setTimeout(() => slotEl?.classList.remove("is-snap"), 450);
          busyRef.current = false;
          recordPlaced(slotIndex + 1);
        }
      );
    },
    [recordPlaced]
  );

  const makeGhost = (svg, trayEl) => {
    const g = svg.ownerDocument.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "rc-ghost");
    const clone = trayEl.cloneNode(true);
    ["id", "data-plank", "tabindex", "role", "aria-label", "class"].forEach((a) =>
      clone.removeAttribute(a)
    );
    g.appendChild(clone);
    svg.appendChild(g);
    return g;
  };

  const canDrag = (trayIndex) =>
    phaseRef.current === "build" &&
    !busyRef.current &&
    placedRef.current < TOTAL &&
    !usedTrayRef.current.has(trayIndex);

  /* Pointer / keyboard handlers, read through a ref by listeners bound once per SVG. */
  handlersRef.current = {
    down(e, svg) {
      const el = e.target?.closest?.("[data-plank]");
      if (!el || dragRef.current) return;
      const trayIndex = Number(el.getAttribute("data-plank"));
      if (!canDrag(trayIndex)) return;
      e.preventDefault();
      svg.setPointerCapture?.(e.pointerId);
      const toUser = (ev) => {
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
      };
      el.classList.add("is-lifted");
      dragRef.current = {
        pointerId: e.pointerId,
        trayIndex,
        trayEl: el,
        start: toUser(e),
        toUser,
        offset: { x: 0, y: 0 },
        ghost: makeGhost(svg, el),
      };
    },
    move(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const p = d.toUser(e);
      d.offset = { x: p.x - d.start.x, y: p.y - d.start.y };
      d.ghost.setAttribute("transform", `translate(${d.offset.x} ${d.offset.y})`);
    },
    up(e, svg) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      d.trayEl.classList.remove("is-lifted");

      // Drop zone: the whole remaining gap, padded, so the drop is forgiving.
      const empty = svg.__rcSlotBoxes.slice(placedRef.current);
      const trayC = centerOf(svg.__rcTrayBoxes[d.trayIndex]);
      const c = { x: trayC.x + d.offset.x, y: trayC.y + d.offset.y };
      const first = empty[0];
      const last = empty[empty.length - 1];
      const inZone =
        first &&
        c.x >= first.x - first.w &&
        c.x <= last.x + last.w * 2 &&
        c.y >= first.y - first.h * 1.5 &&
        c.y <= first.y + first.h * 2.5;

      if (e.type !== "pointercancel" && inZone) {
        d.trayEl.classList.add("is-used");
        snapToNextSlot(svg, d.ghost, d.trayIndex, d.offset);
        return;
      }
      tween(
        d.offset,
        { x: 0, y: 0 },
        SNAP_MS,
        (p) => d.ghost.setAttribute("transform", `translate(${p.x} ${p.y})`),
        () => d.ghost.remove()
      );
    },
    key(e, svg) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = e.target?.closest?.("[data-plank]");
      if (!el) return;
      const trayIndex = Number(el.getAttribute("data-plank"));
      if (!canDrag(trayIndex)) return;
      e.preventDefault();
      el.classList.add("is-used");
      snapToNextSlot(svg, makeGhost(svg, el), trayIndex, { x: 0, y: 0 });
    },
  };

  /* ---------- SVG scene ---------- */

  const setupScene = useCallback((doc, svg, layout) => {
    const ids = RIVERSIDE_SVG_IDS[layout];
    doc.getElementById(ids.complete)?.classList.add("rc-complete");

    svg.__rcSlotBoxes = ids.slots.map((id, i) => {
      const el = doc.getElementById(id);
      if (!el) {
        console.warn(`[Riverside] missing slot id: ${id}`);
        return null;
      }
      el.classList.add("rc-slot");
      el.setAttribute("data-slot", String(i));
      const box = elementBox(el);
      const outline = doc.createElementNS(SVG_NS, "rect");
      outline.setAttribute("x", String(box.x));
      outline.setAttribute("y", String(box.y));
      outline.setAttribute("width", String(box.w));
      outline.setAttribute("height", String(box.h));
      outline.setAttribute("rx", String(box.h * 0.12));
      outline.setAttribute("class", "rc-outline");
      outline.setAttribute("data-outline", String(i));
      el.after(outline);
      return box;
    });

    // The art's own yellow slot frames (.cls-1, no ids): tag each with the slot
    // it sits over so it can fade out once that plank is placed.
    doc.querySelectorAll(".cls-1").forEach((frame) => {
      const cx = centerOf(elementBox(frame)).x;
      let best = -1;
      let bestDist = Infinity;
      svg.__rcSlotBoxes.forEach((box, i) => {
        if (!box) return;
        const dist = Math.abs(centerOf(box).x - cx);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      if (best === -1) return;
      frame.classList.add("rc-frame");
      frame.setAttribute("data-frame", String(best));
    });

    svg.__rcTrayBoxes = ids.tray.map((id, i) => {
      const el = doc.getElementById(id);
      if (!el) {
        console.warn(`[Riverside] missing tray id: ${id}`);
        return null;
      }
      el.classList.add("rc-tray");
      el.setAttribute("data-plank", String(i));
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Bridge plank ${i + 1}`);
      return elementBox(el);
    });

    svg.style.touchAction = "none";
    svg.addEventListener("pointerdown", (e) => handlersRef.current.down(e, svg));
    svg.addEventListener("pointermove", (e) => handlersRef.current.move(e, svg));
    svg.addEventListener("pointerup", (e) => handlersRef.current.up(e, svg));
    svg.addEventListener("pointercancel", (e) => handlersRef.current.up(e, svg));
    svg.addEventListener("keydown", (e) => handlersRef.current.key(e, svg));
  }, []);

  const { ready: sceneReady, version: sceneVersion } = useObjectScene(
    objectRef,
    svgUrl,
    RIVERSIDE_MOB_SVG,
    setupScene,
    SCENE_STYLE
  );
  useApplySceneFit(objectRef, sceneFit, sceneReady, sceneVersion);

  /* Reflect progress in the SVG: tray planks, bridge slots, outlines, finished bridge. */
  useEffect(() => {
    if (!sceneReady) return;
    const svg = getObjectSvg(objectRef);
    if (!svg?.__vsBound) return;
    const doc = svg.ownerDocument;
    const ids = RIVERSIDE_SVG_IDS[svg.__vsLayout];
    const building = phase === "build" || phase === "saving" || phase === "crossing";
    const complete = placed >= TOTAL;

    svg.classList.toggle("rc-build", building && !complete);
    doc.getElementById(ids.complete)?.classList.toggle("is-shown", complete);

    ids.slots.forEach((_, i) => {
      svg.querySelector(`[data-slot="${i}"]`)?.classList.toggle("is-placed", i < placed && !complete);
      const outline = svg.querySelector(`[data-outline="${i}"]`);
      outline?.classList.toggle("is-placed", i < placed);
      outline?.classList.toggle("is-next", i === placed);
      svg
        .querySelectorAll(`[data-frame="${i}"]`)
        .forEach((frame) => frame.classList.toggle("is-placed", i < placed));
    });

    ids.tray.forEach((id, i) => {
      const el = doc.getElementById(id);
      if (!el) return;
      const earned = building || i < correct.length;
      const used = building && (complete || usedTrayRef.current.has(i));
      el.classList.toggle("is-locked", !earned);
      el.classList.toggle("is-earned", earned && !building);
      el.classList.toggle("is-new", !building && i === newPlank);
      el.classList.toggle("is-used", used);
      el.classList.toggle("is-draggable", building && !used && !complete);
      el.setAttribute("tabindex", building && !used && !complete ? "0" : "-1");
      el.setAttribute("aria-disabled", building && !used && !complete ? "false" : "true");
    });
  }, [sceneReady, sceneVersion, phase, correct, placed, newPlank]);

  /* ---------- crossing ---------- */

  /** Walk a traveller across the finished bridge (SVG user space), then resolve. */
  const walkAcross = useCallback(
    () =>
      new Promise((resolve) => {
        const svg = getObjectSvg(objectRef);
        const boxes = svg?.__rcSlotBoxes?.filter(Boolean);
        if (!svg || !boxes?.length) {
          resolve();
          return;
        }
        const first = boxes[0];
        const last = boxes[boxes.length - 1];
        // Figure is 100 units tall (WALKER_MARKUP); about twice a plank's height.
        const scale = (first.h * 2) / 100;
        const walker = svg.ownerDocument.createElementNS(SVG_NS, "g");
        walker.setAttribute("class", "rc-walker");
        walker.innerHTML = WALKER_MARKUP;
        svg.appendChild(walker);
        // Feet on the centre line of the deck, nudged 2 units up.
        const y = first.y + first.h / 2 - 2;
        const fromX = first.x - first.w * 1.5;
        const toX = last.x + last.w * 2.5;
        const start = performance.now();
        // Steady pace (no easing) so the steps read as walking; fade at both ends.
        const step = (now) => {
          const t = Math.min(1, (now - start) / WALK_MS);
          const x = fromX + (toX - fromX) * t;
          walker.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
          walker.setAttribute("opacity", String(Math.min(1, t / 0.08, (1 - t) / 0.08)));
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            walker.remove();
            resolve();
          }
        };
        requestAnimationFrame(step);
      }),
    []
  );

  const crossBridge = useCallback(async () => {
    if (phase !== "build" || placed < TOTAL) return;
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
          stageNumber: 2,
          score: RIVERSIDE_POINTS,
          answers: {
            puzzle: RIVERSIDE_PUZZLE_ID,
            ...cleanProgress({ correct: correctRef.current, placed: TOTAL }),
            reward: "key_of_beliefs",
          },
          time: formatSecondsToClock(elapsedRef.current),
        });
        if (!result?.ok) throw new Error("Stage save failed");
        setTotalScore(
          result.total_score != null
            ? Number(result.total_score) || 0
            : (prev) => prev + RIVERSIDE_POINTS
        );
      } else {
        setTotalScore((prev) => prev + RIVERSIDE_POINTS);
      }
      markHall1HotspotCompleted(HUB_HOTSPOT_ID);
      unlockHall1Hotspot(HUB_UNLOCKS);
    } catch (err) {
      console.error("Riverside save:", err);
      setPhase("build");
      setSaveError("Could not save your progress.");
      return;
    }

    setPhase("crossing");
    await walkAcross();
    navigate("/hall-1", {
      replace: true,
      state: { checkpointComplete: RIVERSIDE_PUZZLE_ID },
    });
  }, [
    phase,
    placed,
    stageRowId,
    isDemoBypass,
    backendBase,
    adminToken,
    storedUser,
    walkAcross,
    navigate,
  ]);

  /* ---------- render ---------- */

  const building = phase === "build" || phase === "saving" || phase === "crossing";
  const bridgeDone = placed >= TOTAL;
  const learningStatement =
    popup?.type === "learning"
      ? RIVERSIDE_STATEMENTS.find((s) => s.id === popup.statementId)
      : null;
  const counterValue = building ? placed : correct.length;
  const counterLabel = building ? "Placed" : "Planks";

  return (
    <div className="vs-stage vs-stage--full-bleed rc-stage" ref={stageRef}>
      <div className="stage-escape-hud">
        <StageTimer timeLabel={formatSecondsToClock(elapsedSec)} points={displayPoints} />
      </div>

      <div className="vs-scene-wrap" ref={wrapRef}>
        <object
          ref={objectRef}
          className="vs-scene-svg"
          data={svgUrl}
          type="image/svg+xml"
          aria-label="Riverside Crossing: a river with an unfinished bridge."
        >
          <p className="vs-status">Unable to load the riverside scene.</p>
        </object>

        {!sceneReady || phase === "loading" ? (
          <p className="vs-status" aria-live="polite">
            Loading riverside…
          </p>
        ) : null}

        <SceneBox box={sceneFit?.box}>
          <header className="vs-plaque">
            <h1 className="vs-plaque__title">
              {building ? "Build the Bridge" : "Riverside Crossing"}
            </h1>
            <p className="vs-plaque__sub">
              {building ? `Drag all ${TOTAL} planks into place` : "Separate Myth from Fact"}
            </p>
          </header>

          {phase !== "loading" ? (
            <p
              className="vs-counter rc-counter"
              role="status"
              aria-label={`${counterValue} of ${TOTAL} planks ${counterLabel.toLowerCase()}`}
            >
              <span className="vs-counter__num">
                {counterValue} / {TOTAL}
              </span>{" "}
              {counterLabel}
              <span className="rc-counter__bar" aria-hidden="true">
                <span style={{ width: `${(counterValue / TOTAL) * 100}%` }} />
              </span>
            </p>
          ) : null}

          {phase === "quiz" && currentStatement ? (
            <div className="rc-quiz">
              <div className="rc-statement">
                <p key={currentStatement.id} aria-live="polite">
                  {currentStatement.text}
                </p>
              </div>
              <div className="rc-answers" role="group" aria-label="Is this a myth or a fact?">
                {ANSWER_BUTTONS.map((b) => (
                  <button
                    key={b.answer}
                    type="button"
                    className="rc-answer"
                    onClick={() => submitAnswer(b.answer)}
                    disabled={submitting || Boolean(popup)}
                  >
                    <img src={b.image} alt={b.label} draggable={false} />
                  </button>
                ))}
              </div>
              <p className="rc-hint">
                {answerError || "Choose the correct answer to earn a bridge plank."}
              </p>
            </div>
          ) : null}

          {building && !bridgeDone ? (
            <p className="rc-build-hint">Place each plank to complete the crossing.</p>
          ) : null}

          {building ? (
            <div className="rc-cross">
              <GoldButton
                onClick={crossBridge}
                disabled={!bridgeDone || phase !== "build"}
                aria-label={bridgeDone ? "Cross the bridge" : "Cross bridge (locked until the bridge is complete)"}
              >
                {!bridgeDone ? "🔒 " : ""}
                {phase === "saving" ? "Saving…" : "Cross Bridge"}
              </GoldButton>
            </div>
          ) : null}
        </SceneBox>

        {saveError ? (
          <div className="vs-banner" role="alert">
            <span>{saveError}</span>
            <button type="button" onClick={crossBridge}>
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {phase === "story" ? (
        <Popup labelId="rc-story-title" title={RIVERSIDE_STORY.heading}>
          <p className="vs-card__quote">{RIVERSIDE_STORY.quote}</p>
          {RIVERSIDE_STORY.paragraphs.map((p) => (
            <p key={p} className="vs-card__text">
              {p}
            </p>
          ))}
          <p className="vs-card__objective">
            <strong>Objective:</strong> {RIVERSIDE_STORY.objective}
          </p>
          <GoldButton onClick={() => setPhase("quiz")}>{RIVERSIDE_STORY.button}</GoldButton>
        </Popup>
      ) : null}

      {popup?.type === "retry" ? (
        <Popup labelId="rc-retry-title" title={RIVERSIDE_RETRY.heading} icon={<RetryIcon />} onClose={closeRetry}>
          <p className="vs-card__text">{RIVERSIDE_RETRY.text}</p>
          <GoldButton onClick={closeRetry}>{RIVERSIDE_RETRY.button}</GoldButton>
        </Popup>
      ) : null}

      {learningStatement ? (
        <Popup labelId="rc-learning-title" title={learningStatement.learning.heading} icon={<CheckIcon />} iconTone="success" onClose={closeLearning}>
          <p className="vs-card__eyebrow">🪵 Bridge plank earned!</p>
          <p className="vs-card__text">{learningStatement.learning.text}</p>
          <GoldButton onClick={closeLearning}>Continue</GoldButton>
        </Popup>
      ) : null}

      {phase === "success" ? (
        <Popup labelId="rc-success-title" title={RIVERSIDE_SUCCESS.heading}>
          <img className="vs-key" src={KEY_IMAGES.beliefs} alt="" />
          <p className="vs-card__text">{RIVERSIDE_SUCCESS.text}</p>
          <p className="vs-card__reward">{RIVERSIDE_SUCCESS.reward}</p>
          <JourneyProgress percent={RIVERSIDE_COMPLETION_PERCENT} />
          <p className="vs-card__text">{RIVERSIDE_SUCCESS.next}</p>
          <GoldButton onClick={() => setPhase("build")}>{RIVERSIDE_SUCCESS.button}</GoldButton>
        </Popup>
      ) : null}
    </div>
  );
}
