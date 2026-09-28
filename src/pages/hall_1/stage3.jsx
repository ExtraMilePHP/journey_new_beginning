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
  FESTIVAL_MARKET_DESK_BG,
  FESTIVAL_MARKET_MOB_BG,
  CARD_FRONT_IMG,
  CARD_BACK_IMG,
  FESTIVAL_MARKET_PUZZLE_ID,
  FESTIVAL_MARKET_POINTS,
  FESTIVAL_MARKET_COMPLETION_PERCENT,
  FESTIVAL_MARKET_PAIRS,
  FESTIVAL_MARKET_STORY,
  FESTIVAL_MARKET_RETRY,
  FESTIVAL_MARKET_SUCCESS,
  MISMATCH_DELAY_MS,
  newBoardSeed,
  buildBoard,
  readProgressFromStage,
  readCachedProgress,
  writeCachedProgress,
  submitFestivalMatch,
  playSfx,
} from "./festivalMarketData";
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
  GoldButton,
  JourneyProgress,
} from "./levelScene";
import "../fonts/breuer-headline.css";
import "./stage3.css";

/** Hall hub hotspot for this checkpoint (stage3) and the one it unlocks next. */
const HUB_HOTSPOT_ID = "museum_archive";
const HUB_UNLOCKS = "newspaper";

const TOTAL = FESTIVAL_MARKET_PAIRS.length;
const PAIR_BY_ID = Object.fromEntries(FESTIVAL_MARKET_PAIRS.map((p) => [p.id, p]));
const FULL_BOX = { left: 0, top: 0, width: "100%", height: "100%" };
const RETRY_NOTE_MS = 3500;

function CardFace({ card }) {
  const { pair, kind } = card;
  if (kind === "meaning") {
    return <span className="fm-card__meaning">{pair.meaning}</span>;
  }
  return (
    <>
      {pair.image ? (
        <img className="fm-card__art" src={pair.image} alt="" draggable={false} />
      ) : (
        <span className="fm-card__emoji" aria-hidden="true">
          {pair.emoji}
        </span>
      )}
      <span className="fm-card__label">{pair.item}</span>
    </>
  );
}

/** Hall Stage 3 — Level 3: Festival Market (memory match). */
export default function HallStage3() {
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

  const bgUrl = useLayoutSvgUrl(FESTIVAL_MARKET_DESK_BG, FESTIVAL_MARKET_MOB_BG);
  const stageRef = useRef(null);
  useLevelPage(stageRef, bgUrl);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || ""
  );
  /** loading → story → playing → saving → success */
  const [phase, setPhase] = useState("loading");
  const [seed, setSeed] = useState(null);
  const [matched, setMatched] = useState([]);
  /** Card ids face up but not (yet) matched — at most two. */
  const [flipped, setFlipped] = useState([]);
  const [checking, setChecking] = useState(false);
  const [retryNote, setRetryNote] = useState(false);
  const [errorNote, setErrorNote] = useState("");
  /** Pair id whose learning popup is open. */
  const [learningPair, setLearningPair] = useState(null);
  const [saveError, setSaveError] = useState("");

  const elapsedRef = useRef(0);
  const matchedRef = useRef([]);
  const completingRef = useRef(false);
  const demoRedirectTriggeredRef = useRef(false);
  const timersRef = useRef([]);

  const board = useMemo(() => (seed == null ? [] : buildBoard(seed)), [seed]);

  useEffect(() => {
    dispatch(setBackButtonUrl("/hall-1"));
  }, [dispatch]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const later = (fn, ms) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  /* Load timer, score, board seed and matched pairs (DB first, session cache second). */
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

      const redirect = getRedirectIfHall1StageDone(stage, 3);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      const fromDb = stage ? readProgressFromStage(stage) : { seed: null, matched: [] };
      const cached = readCachedProgress();
      const restored = {
        seed: fromDb.seed ?? cached.seed ?? newBoardSeed(),
        matched: stage ? fromDb.matched : cached.matched,
      };
      matchedRef.current = restored.matched;
      setSeed(restored.seed);
      setMatched(restored.matched);
      writeCachedProgress(restored);

      if (stageId) setStageRowId(String(stageId));
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTotalScore(readTotalScoreFromStage(stage));
      setTimerReady(true);
      setPhase(restored.matched.length === 0 && storyPopupEnabled ? "story" : "playing");
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
      : totalScore + liveProgressPoints(matched.length, TOTAL, FESTIVAL_MARKET_POINTS);

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
          stageNumber: 3,
          score: FESTIVAL_MARKET_POINTS,
          answers: {
            puzzle: FESTIVAL_MARKET_PUZZLE_ID,
            seed,
            matched: matchedRef.current,
            reward: "key_of_symbolism",
          },
          time: formatSecondsToClock(elapsedRef.current),
        });
        if (!result?.ok) throw new Error("Stage save failed");
        setTotalScore(
          result.total_score != null
            ? Number(result.total_score) || 0
            : (prev) => prev + FESTIVAL_MARKET_POINTS
        );
      } else {
        setTotalScore((prev) => prev + FESTIVAL_MARKET_POINTS);
      }
      markHall1HotspotCompleted(HUB_HOTSPOT_ID);
      unlockHall1Hotspot(HUB_UNLOCKS);
      setPhase("success");
    } catch (err) {
      console.error("Festival Market save:", err);
      completingRef.current = false;
      setPhase("playing");
      setSaveError("Could not save your progress.");
    }
  }, [stageRowId, isDemoBypass, backendBase, adminToken, storedUser, seed]);

  /* All pairs matched (or restored on refresh): save once the last learning popup closes. */
  useEffect(() => {
    if (phase !== "playing" || matched.length < TOTAL || learningPair || saveError) {
      return undefined;
    }
    const id = window.setTimeout(completeLevel, 600);
    return () => clearTimeout(id);
  }, [phase, matched, learningPair, saveError, completeLevel]);

  /* Demo players see one match, then the plans page (as in the other stages). */
  useEffect(() => {
    if (!isDemoBypass || matched.length === 0 || demoRedirectTriggeredRef.current) return;
    if (phase !== "playing" || learningPair) return;
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
  }, [isDemoBypass, matched, phase, learningPair]);

  /* ---------- flipping ---------- */

  const checkPair = useCallback(
    async (first, second) => {
      setChecking(true);
      const shownAt = performance.now();
      let match = false;
      try {
        ({ match } = await submitFestivalMatch({
          backendBase,
          adminToken,
          storedUser,
          stageId: isDemoBypass ? "" : stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
          first,
          second,
          seed,
        }));
      } catch (err) {
        console.error("Festival Market match:", err);
        setErrorNote("Could not check that pair. Please try again.");
        later(() => setErrorNote(""), RETRY_NOTE_MS);
        // Treat as a miss so the cards flip back and can be tried again.
      }

      if (match) {
        const pairId = first.split(":")[1];
        const next = [...new Set([...matchedRef.current, pairId])];
        matchedRef.current = next;
        setMatched(next);
        setFlipped([]);
        setChecking(false);
        setRetryNote(false);
        writeCachedProgress({ seed, matched: next });
        playSfx("match");
        if (learningPopupEnabled) setLearningPair(pairId);
        return;
      }

      playSfx("mismatch");
      const wait = Math.max(0, MISMATCH_DELAY_MS - (performance.now() - shownAt));
      later(() => {
        setFlipped([]);
        setChecking(false);
        setRetryNote(true);
        later(() => setRetryNote(false), RETRY_NOTE_MS);
      }, wait);
    },
    // `later` only schedules timers; it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backendBase, adminToken, storedUser, isDemoBypass, stageRowId, seed, learningPopupEnabled]
  );

  const flipCard = useCallback(
    (card) => {
      if (phase !== "playing" || learningPair || checking) return;
      if (flipped.length >= 2 || flipped.includes(card.id)) return;
      if (matchedRef.current.includes(card.pair.id)) return;
      playSfx("card-flip");
      const next = [...flipped, card.id];
      setFlipped(next);
      if (next.length === 2) checkPair(next[0], next[1]);
    },
    [phase, learningPair, checking, flipped, checkPair]
  );

  /* ---------- render ---------- */

  const learning = learningPair ? PAIR_BY_ID[learningPair] : null;
  const locked = checking || flipped.length >= 2;
  const hint = errorNote
    ? errorNote
    : retryNote
    ? `${FESTIVAL_MARKET_RETRY.heading} — ${FESTIVAL_MARKET_RETRY.text}`
    : "Flip two cards to find a matching symbol and meaning.";

  return (
    <div
      className="vs-stage fm-stage"
      ref={stageRef}
      style={{
        "--fm-bg-desk": `url("${FESTIVAL_MARKET_DESK_BG}")`,
        "--fm-bg-mob": `url("${FESTIVAL_MARKET_MOB_BG}")`,
        "--fm-card-front": `url("${CARD_FRONT_IMG}")`,
        "--fm-card-back": `url("${CARD_BACK_IMG}")`,
      }}
    >
      <div className="stage-escape-hud">
        <StageTimer timeLabel={formatSecondsToClock(elapsedSec)} points={displayPoints} />
      </div>

      <div className="vs-scene-wrap fm-scene">
        {phase === "loading" ? (
          <p className="vs-status" aria-live="polite">
            Loading market…
          </p>
        ) : null}

        <SceneBox box={FULL_BOX}>
          <header className="vs-plaque">
            <h1 className="vs-plaque__title">Festival Market</h1>
            <p className="vs-plaque__sub">Match every symbol with its meaning</p>
          </header>

          {phase !== "loading" ? (
            <p
              className="vs-counter"
              role="status"
              aria-label={`${matched.length} of ${TOTAL} pairs matched`}
            >
              <span className="vs-counter__num">
                {matched.length} / {TOTAL}
              </span>{" "}
              Pairs
            </p>
          ) : null}

          {board.length ? (
            <ul className={`fm-board${locked ? " is-locked" : ""}`} aria-label="Memory cards">
              {board.map((card, i) => {
                const isMatched = matched.includes(card.pair.id);
                const faceUp = isMatched || flipped.includes(card.id);
                const label = card.kind === "item" ? card.pair.item : card.pair.meaning;
                return (
                  <li key={card.id} className="fm-board__cell">
                    <button
                      type="button"
                      className={`fm-card${faceUp ? " is-up" : ""}${isMatched ? " is-matched" : ""}`}
                      onClick={() => flipCard(card)}
                      aria-disabled={isMatched || locked || phase !== "playing"}
                      aria-label={
                        faceUp
                          ? `${label}${isMatched ? ", matched" : ""}`
                          : `Card ${i + 1}, face down`
                      }
                    >
                      <span className="fm-card__inner">
                        <span className="fm-card__face fm-card__back" aria-hidden="true" />
                        <span className="fm-card__face fm-card__front" aria-hidden="true">
                          <CardFace card={card} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {phase !== "loading" ? (
            <p className={`fm-hint${retryNote || errorNote ? " is-alert" : ""}`} aria-live="polite">
              {hint}
            </p>
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

      {phase === "story" ? (
        <Popup labelId="fm-story-title">
          <h2 id="fm-story-title" className="vs-card__title">
            {FESTIVAL_MARKET_STORY.heading}
          </h2>
          <p className="vs-card__quote">{FESTIVAL_MARKET_STORY.quote}</p>
          {FESTIVAL_MARKET_STORY.paragraphs.map((p) => (
            <p key={p} className="vs-card__text">
              {p}
            </p>
          ))}
          <p className="vs-card__objective">
            <strong>Objective:</strong> {FESTIVAL_MARKET_STORY.objective}
          </p>
          <GoldButton onClick={() => setPhase("playing")}>{FESTIVAL_MARKET_STORY.button}</GoldButton>
        </Popup>
      ) : null}

      {learning ? (
        <Popup labelId="fm-learning-title" onClose={() => setLearningPair(null)}>
          <p className="vs-card__eyebrow">
            <span aria-hidden="true">{learning.emoji}</span> {learning.item} → {learning.meaning}
          </p>
          <h2 id="fm-learning-title" className="vs-card__title">
            {learning.learning.heading}
          </h2>
          <p className="vs-card__text">{learning.learning.text}</p>
          <GoldButton onClick={() => setLearningPair(null)}>Continue</GoldButton>
        </Popup>
      ) : null}

      {phase === "success" ? (
        <Popup labelId="fm-success-title">
          <div className="vs-key" aria-hidden="true">
            🗝️
          </div>
          <h2 id="fm-success-title" className="vs-card__title">
            {FESTIVAL_MARKET_SUCCESS.heading}
          </h2>
          <p className="vs-card__text">{FESTIVAL_MARKET_SUCCESS.text}</p>
          <p className="vs-card__reward">{FESTIVAL_MARKET_SUCCESS.reward}</p>
          <JourneyProgress percent={FESTIVAL_MARKET_COMPLETION_PERCENT} />
          <p className="vs-card__text">{FESTIVAL_MARKET_SUCCESS.next}</p>
          <GoldButton
            onClick={() =>
              navigate("/hall-1", {
                replace: true,
                state: { checkpointComplete: FESTIVAL_MARKET_PUZZLE_ID },
              })
            }
          >
            {FESTIVAL_MARKET_SUCCESS.button}
          </GoldButton>
        </Popup>
      ) : null}
    </div>
  );
}
