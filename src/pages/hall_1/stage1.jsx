import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  MEDAL_DISPLAY_UNLOCKS,
  unlockHall1Hotspot,
  markHall1HotspotCompleted,
  getRedirectIfHall1StageDone,
} from "./medalDisplayData";
import {
  VILLAGE_SQUARE_ITEMS,
  VILLAGE_SQUARE_PUZZLE_ID,
  VILLAGE_SQUARE_POINTS,
  VILLAGE_SQUARE_COMPLETION_PERCENT,
  VILLAGE_SQUARE_DESK_SVG,
  VILLAGE_SQUARE_MOB_SVG,
  VILLAGE_SQUARE_STORY,
  VILLAGE_SQUARE_RETRY,
  VILLAGE_SQUARE_SUCCESS,
  OPTION_LETTERS,
  readFoundFromStage,
  readCachedFound,
  writeCachedFound,
  readPopupSettings,
  submitVillageSquareAnswer,
} from "./villageSquareData";
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
  setSvgHref,
  SceneBox,
  Popup,
  CheckIcon,
  RetryIcon,
  GoldButton,
  JourneyProgress,
} from "./levelScene";
import { KEY_IMAGES } from "./keyImages";
import "../fonts/breuer-headline.css";

/** Hall hub hotspot id that stands for this checkpoint (stage1). */
const HUB_HOTSPOT_ID = "medal_display";
const TOTAL_ITEMS = VILLAGE_SQUARE_ITEMS.length;
const FOUND_ANIM_MS = 900;

const ITEM_BY_ID = Object.fromEntries(
  VILLAGE_SQUARE_ITEMS.map((i) => [i.id, i]),
);

/** Styles injected into the SVG document (it cannot see page CSS). */
const SCENE_STYLE = `
.vs-hit { fill: transparent; cursor: pointer; pointer-events: all; outline: none; }
.vs-hit:focus-visible { stroke: #f3d27a; stroke-width: 3; stroke-dasharray: 8 5; }
.vs-hit.is-found { pointer-events: none; cursor: default; }
.vs-scene.is-found { animation: vs-found ${FOUND_ANIM_MS}ms ease-out forwards; }
.vs-scene.is-gone { opacity: 0; }
.vs-tray { opacity: 0.35; filter: grayscale(1); transition: opacity 0.5s ease, filter 0.5s ease; }
.vs-tray.is-found { opacity: 0; }
.vs-tray-real { opacity: 0; pointer-events: none; }
.vs-tray-real.is-found { opacity: 1; animation: vs-tray-in 0.6s ease-out; filter: drop-shadow(0 0 6px rgba(255, 215, 106, 0.8)); }
@keyframes vs-tray-in {
  0% { opacity: 0; filter: brightness(2) drop-shadow(0 0 16px #ffd76a); }
  100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(255, 215, 106, 0.8)); }
}
@keyframes vs-found {
  0% { opacity: 1; filter: none; }
  40% { opacity: 1; filter: drop-shadow(0 0 14px #ffd76a) brightness(1.5); }
  100% { opacity: 0; filter: drop-shadow(0 0 26px #ffd76a) brightness(1.8); }
}
`;

function unionIds(a, b) {
  return [...new Set([...(a || []), ...(b || [])])];
}

/** Random display order of option indices (Fisher–Yates). */
function shuffledIndices(count) {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Scene viewBox sizes. `safe` (fractions of the art) is the band holding every
 * hidden item and the tray; the scene may crop outside it to fill the screen.
 * Phone items and the tray run nearly edge to edge, so only the sky above
 * the tree lantern (y 0.17) and the strip below the tray can be cropped.
 */
const SCENE_FIT = {
  desk: {
    w: 1920,
    h: 1080,
    fill: true,
    safe: { x0: 0.09, x1: 0.93, y0: 0.08, y1: 0.965 },
  },
  mob: {
    w: 414,
    h: 896,
    fill: true,
    safe: { x0: 0.01, x1: 0.99, y0: 0.07, y1: 0.94 },
  },
};

/** Real item art laid over its tray slot; shown once the item is found. */
function createTrayImage(doc, trayEl, item) {
  const { x, y, w, h } = elementBox(trayEl);
  const pad = Math.min(w, h) * 0.06;
  const img = doc.createElementNS(SVG_NS, "image");
  img.setAttribute("x", String(x + pad));
  img.setAttribute("y", String(y + pad));
  img.setAttribute("width", String(w - pad * 2));
  img.setAttribute("height", String(h - pad * 2));
  img.setAttribute("preserveAspectRatio", "xMidYMid meet");
  setSvgHref(img, item.image);
  img.setAttribute("class", "vs-tray-real");
  img.setAttribute("data-real", item.id);
  return img;
}

/** Transparent hit box over a scene object, padded to a minimum tap size. */
function createHitRect(doc, sceneEl, itemId, index, minSize) {
  const { x, y, w, h } = elementBox(sceneEl);
  const padX = Math.max(0, (minSize - w) / 2);
  const padY = Math.max(0, (minSize - h) / 2);

  const rect = doc.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(x - padX));
  rect.setAttribute("y", String(y - padY));
  rect.setAttribute("width", String(w + padX * 2));
  rect.setAttribute("height", String(h + padY * 2));
  rect.setAttribute("class", "vs-hit");
  rect.setAttribute("data-item", itemId);
  rect.setAttribute("tabindex", "0");
  rect.setAttribute("role", "button");
  rect.setAttribute("aria-label", `Hidden item ${index + 1}`);
  return rect;
}

/** Hall Stage 1 — Level 1: Village Square (hidden objects + MCQ). */
export default function HallStage1() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const themeData = useSelector((s) => s.theme?.data);
  const { storyPopupEnabled, learningPopupEnabled } = useMemo(
    () => readPopupSettings(themeData),
    [themeData],
  );

  const storedUser = useMemo(() => user || getStoredUser(), [user]);
  const isDemoBypass = useMemo(() => isDemoUser(storedUser), [storedUser]);
  const backendBase = getBackendBase();

  const svgUrl = useLayoutSvgUrl(
    VILLAGE_SQUARE_DESK_SVG,
    VILLAGE_SQUARE_MOB_SVG,
  );
  const stageRef = useRef(null);
  const objectRef = useRef(null);
  const wrapRef = useRef(null);
  useLevelPage(stageRef, svgUrl);

  const sceneFit = useSceneFit(
    wrapRef,
    svgUrl === VILLAGE_SQUARE_MOB_SVG ? SCENE_FIT.mob : SCENE_FIT.desk,
  );
  const sceneBox = sceneFit?.box;

  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || "",
  );
  /** loading → story → playing → saving → success */
  const [phase, setPhase] = useState("loading");
  const [found, setFound] = useState([]);

  const [activeItemId, setActiveItemId] = useState(null);
  /** Original option index (answers are checked by its letter), not the display slot. */
  const [selectedOption, setSelectedOption] = useState(null);
  /** Shuffled display order of the open question's options (original indices). */
  const [optionOrder, setOptionOrder] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState("");
  /** null | { type: "retry" } | { type: "learning", itemId } */
  const [popup, setPopup] = useState(null);
  const [saveError, setSaveError] = useState("");

  const elapsedRef = useRef(0);
  const foundRef = useRef([]);
  const animatingRef = useRef(new Set());
  const completingRef = useRef(false);
  const demoRedirectTriggeredRef = useRef(false);
  const itemClickRef = useRef(() => {});

  useEffect(() => {
    foundRef.current = found;
  }, [found]);

  useEffect(() => {
    dispatch(setBackButtonUrl("/hall-1"));
  }, [dispatch]);

  /* Load timer, score and saved finds (DB first, session cache for demo). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      ensureStageSessionForUser(storedUser);
      const {
        stageId,
        elapsedSec: sec,
        stage,
      } = await loadHallElapsedFromDb({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
      });
      if (cancelled) return;

      const redirect = getRedirectIfHall1StageDone(stage, 1);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      const restored = stage ? readFoundFromStage(stage) : readCachedFound();
      foundRef.current = restored;
      setFound(restored);
      writeCachedFound(restored);

      if (stageId) setStageRowId(String(stageId));
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTotalScore(readTotalScoreFromStage(stage));
      setTimerReady(true);
      setPhase(
        restored.length === 0 && storyPopupEnabled ? "story" : "playing",
      );
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
  }, [
    timerReady,
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
    stageRowId,
    phase,
  ]);

  const liveStagePoints = liveProgressPoints(
    found.length,
    TOTAL_ITEMS,
    VILLAGE_SQUARE_POINTS,
  );
  const displayPoints =
    phase === "success" ? totalScore : totalScore + liveStagePoints;

  /* ---------- completion ---------- */

  const completeLevel = useCallback(
    async (allFound) => {
      if (completingRef.current) return;
      completingRef.current = true;
      setSaveError("");
      setPhase("saving");

      try {
        let stageId = stageRowId || sessionStorage.getItem(STAGE_ROW_KEY);
        if (!stageId && !isDemoBypass && backendBase && adminToken) {
          stageId = await ensureStageRowId({
            backendBase,
            adminToken,
            storedUser,
            isDemoBypass,
          });
          if (stageId) setStageRowId(String(stageId));
        }

        if (!isDemoBypass && backendBase && adminToken && stageId) {
          const result = await saveGameStageAndReport({
            backendBase,
            adminToken,
            storedUser,
            isDemoBypass,
            stageId,
            stageNumber: 1,
            score: VILLAGE_SQUARE_POINTS,
            answers: {
              puzzle: VILLAGE_SQUARE_PUZZLE_ID,
              found: allFound,
              reward: "key_of_traditions",
            },
            time: formatSecondsToClock(elapsedRef.current),
          });
          if (!result?.ok) throw new Error("Stage save failed");
          setTotalScore(
            result.total_score != null
              ? Number(result.total_score) || 0
              : (prev) => prev + VILLAGE_SQUARE_POINTS,
          );
        } else {
          setTotalScore((prev) => prev + VILLAGE_SQUARE_POINTS);
        }

        markHall1HotspotCompleted(HUB_HOTSPOT_ID);
        unlockHall1Hotspot(MEDAL_DISPLAY_UNLOCKS);
        setPhase("success");
      } catch (err) {
        console.error("Village Square save:", err);
        completingRef.current = false;
        setPhase("playing");
        setSaveError("Could not save your progress.");
      }
    },
    [stageRowId, isDemoBypass, backendBase, adminToken, storedUser],
  );

  /* 8/8 collected (or restored on refresh): save once the last find animation ends.
     After a failed save the player retries from the banner, not automatically. */
  useEffect(() => {
    if (
      phase !== "playing" ||
      found.length < TOTAL_ITEMS ||
      popup ||
      saveError
    ) {
      return undefined;
    }
    const id = window.setTimeout(
      () => completeLevel(foundRef.current),
      FOUND_ANIM_MS,
    );
    return () => clearTimeout(id);
  }, [phase, found, popup, saveError, completeLevel]);

  /* ---------- finding items ---------- */

  const commitFound = useCallback((itemId) => {
    const next = unionIds(foundRef.current, [itemId]);
    foundRef.current = next;
    animatingRef.current.add(itemId);
    window.setTimeout(() => {
      animatingRef.current.delete(itemId);
    }, FOUND_ANIM_MS + 100);
    setFound(next);
    writeCachedFound(next);
  }, []);

  /* Demo players see one find, then the plans page (as in the other stages). */
  useEffect(() => {
    if (!isDemoBypass || found.length === 0 || demoRedirectTriggeredRef.current)
      return;
    if (phase !== "playing" || popup) return;
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
    }, FOUND_ANIM_MS);
  }, [isDemoBypass, found, phase, popup]);

  itemClickRef.current = (itemId) => {
    if (phase !== "playing" || activeItemId || popup) return;
    if (!ITEM_BY_ID[itemId] || foundRef.current.includes(itemId)) return;
    setOptionOrder(shuffledIndices(ITEM_BY_ID[itemId].options.length));
    setActiveItemId(itemId);
    setSelectedOption(null);
    setAnswerError("");
  };

  const closeQuestion = useCallback(() => {
    if (submitting) return;
    setActiveItemId(null);
    setSelectedOption(null);
    setAnswerError("");
  }, [submitting]);

  const submitAnswer = useCallback(async () => {
    if (!activeItemId || selectedOption == null || submitting) return;
    setSubmitting(true);
    setAnswerError("");
    try {
      const { correct } = await submitVillageSquareAnswer({
        backendBase,
        adminToken,
        storedUser,
        stageId: isDemoBypass
          ? ""
          : stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
        itemId: activeItemId,
        option: OPTION_LETTERS[selectedOption],
      });
      if (correct) {
        const itemId = activeItemId;
        setActiveItemId(null);
        setSelectedOption(null);
        if (learningPopupEnabled) {
          setPopup({ type: "learning", itemId });
        } else {
          commitFound(itemId);
        }
      } else {
        setPopup({ type: "retry" });
      }
    } catch (err) {
      console.error("Village Square answer:", err);
      setAnswerError("Could not check your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    activeItemId,
    selectedOption,
    submitting,
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
    stageRowId,
    learningPopupEnabled,
    commitFound,
  ]);

  const closeLearning = useCallback(() => {
    if (popup?.type !== "learning") return;
    const { itemId } = popup;
    setPopup(null);
    commitFound(itemId);
  }, [popup, commitFound]);

  const closeRetry = useCallback(() => {
    setPopup(null);
    setSelectedOption(null);
  }, []);

  /* ---------- SVG scene ---------- */

  const setupScene = useCallback((doc, svg, layout) => {
    // Minimum tap target in viewBox units (desktop 1920 wide, mobile 414 wide).
    const minSize = layout === "mob" ? 34 : 64;
    VILLAGE_SQUARE_ITEMS.forEach((item, index) => {
      const sceneEl = doc.getElementById(item.scene[layout]);
      if (!sceneEl) {
        console.warn(
          `[Village Square] missing scene id: ${item.scene[layout]}`,
        );
        return;
      }
      sceneEl.classList.add("vs-scene");
      svg.appendChild(createHitRect(doc, sceneEl, item.id, index, minSize));
      const trayEl = doc.getElementById(item.tray[layout]);
      if (trayEl) {
        trayEl.classList.add("vs-tray");
        trayEl.after(createTrayImage(doc, trayEl, item));
      }
    });

    const activate = (e) => {
      const target = e.target?.closest?.("[data-item]");
      if (!target) return;
      e.preventDefault();
      itemClickRef.current(target.getAttribute("data-item"));
    };
    svg.addEventListener("click", activate);
    svg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") activate(e);
    });
  }, []);

  const { ready: sceneReady, version: sceneVersion } = useObjectScene(
    objectRef,
    svgUrl,
    VILLAGE_SQUARE_MOB_SVG,
    setupScene,
    SCENE_STYLE,
  );
  useApplySceneFit(objectRef, sceneFit, sceneReady, sceneVersion);

  /* Reflect found items in the SVG: fade out scene object, show real art in the tray. */
  useEffect(() => {
    if (!sceneReady) return;
    const svg = getObjectSvg(objectRef);
    if (!svg?.__vsBound) return;
    const doc = svg.ownerDocument;
    const layout = svg.__vsLayout;
    const foundSet = new Set(found);

    VILLAGE_SQUARE_ITEMS.forEach((item) => {
      const isFound = foundSet.has(item.id);
      const sceneEl = doc.getElementById(item.scene[layout]);
      const trayEl = doc.getElementById(item.tray[layout]);
      const hit = svg.querySelector(`[data-item="${item.id}"]`);
      const animating = animatingRef.current.has(item.id);

      sceneEl?.classList.toggle("is-found", isFound && animating);
      sceneEl?.classList.toggle("is-gone", isFound && !animating);
      trayEl?.classList.toggle("is-found", isFound);
      svg
        .querySelector(`[data-real="${item.id}"]`)
        ?.classList.toggle("is-found", isFound);
      if (hit) {
        hit.classList.toggle("is-found", isFound);
        hit.setAttribute("tabindex", isFound ? "-1" : "0");
        hit.setAttribute("aria-disabled", isFound ? "true" : "false");
      }
    });
  }, [found, sceneReady, sceneVersion]);

  /* ---------- render ---------- */

  const activeItem = activeItemId ? ITEM_BY_ID[activeItemId] : null;
  const learningItem =
    popup?.type === "learning" ? ITEM_BY_ID[popup.itemId] : null;

  return (
    <div className="vs-stage vs-stage--full-bleed" ref={stageRef}>
      <div className="stage-escape-hud">
        <StageTimer
          timeLabel={formatSecondsToClock(elapsedSec)}
          points={displayPoints}
        />
      </div>

      <div className="vs-scene-wrap" ref={wrapRef}>
        <object
          ref={objectRef}
          className="vs-scene-svg"
          data={svgUrl}
          type="image/svg+xml"
          aria-label="Village Square scene. Find the hidden festive items."
        >
          <p className="vs-status">Unable to load the village scene.</p>
        </object>

        {!sceneReady || phase === "loading" ? (
          <p className="vs-status" aria-live="polite">
            Loading village…
          </p>
        ) : null}

        <SceneBox box={sceneBox}>
          <header className="vs-plaque">
            <h1 className="vs-plaque__title">Village Square</h1>
            <p className="vs-plaque__sub">
              Find all {TOTAL_ITEMS} festive items
            </p>
          </header>

          {phase !== "loading" ? (
            <p
              className="vs-counter"
              role="status"
              aria-label={`${found.length} of ${TOTAL_ITEMS} items found`}
            >
              <span className="vs-counter__num">
                {found.length} / {TOTAL_ITEMS}
              </span>{" "}
              Found
            </p>
          ) : null}
        </SceneBox>

        {saveError ? (
          <div className="vs-banner" role="alert">
            <span>{saveError}</span>
            <button
              type="button"
              onClick={() => completeLevel(foundRef.current)}
            >
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

      {phase === "story" ? (
        <Popup
          labelId="vs-story-title"
          className="vs-card--story"
          title={VILLAGE_SQUARE_STORY.heading}
        >
          <p className="vs-card__quote">{VILLAGE_SQUARE_STORY.quote}</p>
          {VILLAGE_SQUARE_STORY.paragraphs.map((p) => (
            <p key={p} className="vs-card__text">
              {p}
            </p>
          ))}
          <p className="vs-card__objective">
            <strong>Objective:</strong> {VILLAGE_SQUARE_STORY.objective}
          </p>
          <GoldButton onClick={() => setPhase("playing")}>
            {VILLAGE_SQUARE_STORY.button}
          </GoldButton>
        </Popup>
      ) : null}

      {activeItem && !popup ? (
        <Popup
          labelId="vs-question-title"
          title={activeItem.name}
          icon={<img src={activeItem.image} alt="" />}
          onClose={closeQuestion}
          closeDisabled={submitting}
        >
          <p id="vs-question" className="vs-card__question">
            {activeItem.question}
          </p>
          <div
            className="vs-options"
            role="radiogroup"
            aria-labelledby="vs-question"
          >
            {optionOrder.map((i) => (
              <button
                key={OPTION_LETTERS[i]}
                type="button"
                role="radio"
                aria-checked={selectedOption === i}
                className={`vs-option${selectedOption === i ? " is-selected" : ""}`}
                onClick={() => setSelectedOption(i)}
                disabled={submitting}
              >
                <span className="vs-option__text">{activeItem.options[i]}</span>
              </button>
            ))}
          </div>
          {answerError ? (
            <p className="vs-card__error" role="alert">
              {answerError}
            </p>
          ) : null}
          <GoldButton
            onClick={submitAnswer}
            disabled={selectedOption == null || submitting}
          >
            {submitting ? "Checking…" : "Submit"}
          </GoldButton>
        </Popup>
      ) : null}

      {popup?.type === "retry" ? (
        <Popup
          labelId="vs-retry-title"
          className="vs-card--retry"
          title={VILLAGE_SQUARE_RETRY.heading}
          icon={<RetryIcon />}
          onClose={closeRetry}
        >
          <p className="vs-card__text">{VILLAGE_SQUARE_RETRY.text}</p>
          <GoldButton onClick={closeRetry}>
            {VILLAGE_SQUARE_RETRY.button}
          </GoldButton>
        </Popup>
      ) : null}

      {learningItem ? (
        <Popup
          labelId="vs-learning-title"
          className="vs-card--learning"
          title={learningItem.learning.heading}
          icon={<CheckIcon />}
          iconTone="success"
          onClose={closeLearning}
        >
          <p className="vs-card__text">{learningItem.learning.text}</p>
          <GoldButton onClick={closeLearning}>Continue</GoldButton>
        </Popup>
      ) : null}

      {phase === "success" ? (
        <Popup
          labelId="vs-success-title"
          className="vs-card--success"
          title={VILLAGE_SQUARE_SUCCESS.heading}
        >
          <img className="vs-key" src={KEY_IMAGES.traditions} alt="" />
          <p className="vs-card__text">{VILLAGE_SQUARE_SUCCESS.text}</p>
          <p className="vs-card__reward">{VILLAGE_SQUARE_SUCCESS.reward}</p>
          <ul className="vs-collected" aria-label="Items collected">
            {VILLAGE_SQUARE_ITEMS.map((item) => (
              <li key={item.id} title={item.name}>
                <img src={item.image} alt="" />
                <span className="vs-sr-only">{item.name}</span>
              </li>
            ))}
          </ul>
          <JourneyProgress percent={VILLAGE_SQUARE_COMPLETION_PERCENT} />
          <GoldButton
            onClick={() =>
              navigate("/hall-1", {
                replace: true,
                state: { checkpointComplete: VILLAGE_SQUARE_PUZZLE_ID },
              })
            }
          >
            {VILLAGE_SQUARE_SUCCESS.button}
          </GoldButton>
        </Popup>
      ) : null}
    </div>
  );
}
