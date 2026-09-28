import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { setBackButtonUrl } from "../uiSlice";
import { setupAppPageBodyBackground } from "../game/gameStageBackground";
import {
  formatSecondsToClock,
  loadHallElapsedFromDb,
} from "../hall_1/hallTimer";
import { selectAdminToken } from "../../admin/sessionSlice";
import {
  STAGE_ROW_KEY,
  saveGameStageAndReport,
} from "../../functions/stageReportSync";
import {
  COMPLETION_ASSETS,
  RESTORE_COPY,
  CEREMONY_MESSAGES,
  FEEDBACK_OPTIONS,
  computeFinalScore,
  countCompletedStages,
  getCompletionSnapshot,
  hasSubmittedLeaderboard,
  markLeaderboardSubmitted,
} from "./completionData";
import deskBg from "../final_screen/final_desk.jpg";
import mobBg from "../final_screen/final_mob.jpg";
import legacyDeskBg from "../final_screen/final2_desk.jpg";
import legacyMobBg from "../final_screen/final2_mob.jpg";
import trophyImg from "../final_screen/trophy.png";
import congratsBanner from "../final_screen/congratulationschampion.png";
import continueBtn from "../final_screen/continue.png";
import "../fonts/breuer-headline.css";
import "../game/stageSuccessLetter.css";
import "./final.css";

function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("userData") || "{}");
  } catch {
    return {};
  }
}

function playerNameFromUser(storedUser) {
  return (
    storedUser?.name ||
    storedUser?.player_name ||
    storedUser?.userName ||
    storedUser?.username ||
    (storedUser?.email ? String(storedUser.email).split("@")[0] : "") ||
    "Conservator"
  );
}

function readFeedbackUserId(user) {
  const fromUser = user?.userId ?? user?.id;
  if (fromUser != null && String(fromUser).trim() !== "") {
    return String(fromUser).trim();
  }
  try {
    const u = JSON.parse(sessionStorage.getItem("userData") || "{}");
    const id = u?.userId ?? u?.userid ?? u?.id;
    if (id != null && String(id).trim() !== "") return String(id).trim();
  } catch {
    /* ignore */
  }
  return "";
}

/** Ceremonial completion: restore reveal → score summary → leaderboard. */
export default function FinalPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const adminToken = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const storedUser = useMemo(() => user || getStoredUser(), [user]);
  const isDemoBypass = storedUser?.sessionId === "demobypass";
  const backendBase = String(process.env.REACT_APP_BACKEND_URL || "").replace(
    /\/+$/,
    ""
  );

  const nav = location.state || {};

  const [step, setStep] = useState("restore"); // restore | summary | feedback
  const [elapsedSec, setElapsedSec] = useState(() =>
    typeof nav.elapsedSec === "number" ? nav.elapsedSec : 0
  );
  const [stageRow, setStageRow] = useState(null);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || ""
  );
  const [submitStatus, setSubmitStatus] = useState(
    hasSubmittedLeaderboard() ? "done" : "idle"
  );
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);
  const [selectedFeedback, setSelectedFeedback] = useState("Fun");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const feedbackIndex = Math.max(
    0,
    FEEDBACK_OPTIONS.findIndex((o) => o.value === selectedFeedback)
  );
  const feedbackCount = FEEDBACK_OPTIONS.length;
  const feedbackMaxIndex = Math.max(0, feedbackCount - 1);
  const pctFromFeedbackIndex = useCallback(
    (idx) => {
      if (feedbackCount <= 0) return 0;
      return ((idx + 0.5) / feedbackCount) * 100;
    },
    [feedbackCount]
  );
  const [sliderPct, setSliderPct] = useState(() =>
    ((2 + 0.5) / Math.max(1, FEEDBACK_OPTIONS.length)) * 100
  );
  const [sliderDragging, setSliderDragging] = useState(false);
  const sliderTrackRef = useRef(null);
  const sliderDraggingRef = useRef(false);

  useEffect(() => {
    if (sliderDraggingRef.current) return;
    setSliderPct(pctFromFeedbackIndex(feedbackIndex));
  }, [feedbackIndex, pctFromFeedbackIndex]);

  const feedbackPctFromClientX = useCallback((clientX) => {
    const el = sliderTrackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const feedbackIndexFromPct = useCallback(
    (pct) => {
      if (feedbackCount <= 0) return 0;
      return Math.min(
        feedbackMaxIndex,
        Math.max(0, Math.floor((pct / 100) * feedbackCount))
      );
    },
    [feedbackCount, feedbackMaxIndex]
  );

  const moveFeedbackSlider = useCallback(
    (clientX, { snap = false } = {}) => {
      let pct = feedbackPctFromClientX(clientX);
      const idx = feedbackIndexFromPct(pct);
      if (snap) {
        pct = pctFromFeedbackIndex(idx);
      }
      setSliderPct(pct);
      const opt = FEEDBACK_OPTIONS[idx];
      if (opt) setSelectedFeedback(opt.value);
      setFeedbackError("");
    },
    [
      feedbackPctFromClientX,
      feedbackIndexFromPct,
      pctFromFeedbackIndex,
    ]
  );

  const onFeedbackSliderPointerDown = useCallback(
    (e) => {
      if (feedbackSaving) return;
      e.preventDefault();
      sliderDraggingRef.current = true;
      setSliderDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      moveFeedbackSlider(e.clientX);
    },
    [feedbackSaving, moveFeedbackSlider]
  );

  const onFeedbackSliderPointerMove = useCallback(
    (e) => {
      if (!sliderDraggingRef.current) return;
      moveFeedbackSlider(e.clientX);
    },
    [moveFeedbackSlider]
  );

  const onFeedbackSliderPointerUp = useCallback(
    (e) => {
      if (!sliderDraggingRef.current) return;
      sliderDraggingRef.current = false;
      setSliderDragging(false);
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* already released */
      }
      moveFeedbackSlider(e.clientX, { snap: true });
    },
    [moveFeedbackSlider]
  );

  const selectFeedbackOption = useCallback(
    (value) => {
      setSelectedFeedback(value);
      setFeedbackError("");
      const idx = FEEDBACK_OPTIONS.findIndex((o) => o.value === value);
      if (idx >= 0) setSliderPct(pctFromFeedbackIndex(idx));
    },
    [pctFromFeedbackIndex]
  );


  const snapshot = useMemo(
    () =>
      getCompletionSnapshot({
        nav: { ...nav, elapsedSec },
        stage: stageRow,
      }),
    [nav, elapsedSec, stageRow]
  );

  const timeLabel = formatSecondsToClock(snapshot.elapsedSec);
  const finalScore = snapshot.score;

  useEffect(() => {
    dispatch(setBackButtonUrl("/hall-1"));
  }, [dispatch]);

  useEffect(() => {
    document.body.classList.add("final-page");
    const useLegacyBg = step === "restore";
    const desk = useLegacyBg ? legacyDeskBg : deskBg;
    const mob = useLegacyBg ? legacyMobBg : mobBg;
    const cleanupBg = setupAppPageBodyBackground(document.body, {
      deskForeground: desk,
      mobForeground: mob,
    });
    const t = window.setTimeout(() => {
      const isMob =
        window.innerWidth > 0 &&
        window.innerWidth <= 768 &&
        window.matchMedia("(orientation: portrait)").matches;
      document.body.style.setProperty(
        "background-image",
        `url("${isMob ? mob : desk}")`,
        "important"
      );
      document.body.style.setProperty("background-size", "100% 100%", "important");
      document.body.style.setProperty("background-position", "center center", "important");
      document.body.style.setProperty("background-repeat", "no-repeat", "important");
      document.body.style.setProperty("background-attachment", "fixed", "important");
    }, 0);
    return () => {
      window.clearTimeout(t);
      cleanupBg?.();
      document.body.classList.remove("final-page");
      document.body.style.removeProperty("background-image");
    };
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { stageId, elapsedSec: sec, stage } = await loadHallElapsedFromDb({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
      });
      if (cancelled) return;
      if (stageId) setStageRowId(String(stageId));
      if (stage) setStageRow(stage);
      if (!nav.elapsedSec && sec > 0) {
        setElapsedSec(sec);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendBase, adminToken, storedUser, isDemoBypass, nav.elapsedSec]);

  const submitFinalScore = useCallback(async () => {
    if (submittingRef.current || hasSubmittedLeaderboard()) {
      setSubmitStatus("done");
      return { ok: true, duplicate: true };
    }
    submittingRef.current = true;
    setSubmitStatus("saving");
    setSubmitError("");

    const stagesCompleted = countCompletedStages(stageRow);
    const score = computeFinalScore({
      stagesCompleted,
      stage: stageRow,
    });
    const timeStr = formatSecondsToClock(elapsedSec);
    const stageId = stageRowId || sessionStorage.getItem(STAGE_ROW_KEY);

    try {
      if (!isDemoBypass && backendBase && adminToken && stageId) {
        const result = await saveGameStageAndReport({
          backendBase,
          adminToken,
          storedUser,
          isDemoBypass,
          stageId,
          time: timeStr,
          total_score: score,
          answers: {
            puzzle: "museum_complete",
            playerName: playerNameFromUser(storedUser),
            completionTime: timeStr,
            score,
            timestamp: Date.now(),
            restorationStatus: 100,
          },
        });
        if (!result?.ok) {
          throw new Error("leaderboard submit failed");
        }
      }
      markLeaderboardSubmitted();
      setSubmitStatus("done");
      return { ok: true, score };
    } catch (err) {
      console.error("Final score submit:", err);
      submittingRef.current = false;
      setSubmitStatus("error");
      setSubmitError("Could not submit score. You can try again from this screen.");
      return { ok: false };
    }
  }, [
    stageRow,
    elapsedSec,
    stageRowId,
    isDemoBypass,
    backendBase,
    adminToken,
    storedUser,
  ]);

  const goToSummary = useCallback(async () => {
    setStep("summary");
    await submitFinalScore();
  }, [submitFinalScore]);

  const goToFeedback = useCallback(() => {
    setFeedbackError("");
    setStep("feedback");
  }, []);

  const onViewLeaderboard = useCallback(() => {
    navigate("/leaderboard", {
      state: {
        points: finalScore,
        time: timeLabel,
        elapsedSec,
        gameComplete: true,
      },
    });
  }, [navigate, finalScore, timeLabel, elapsedSec]);

  const submitFeedbackAndContinue = useCallback(async () => {
    if (feedbackSaving) return;
    if (!selectedFeedback) {
      setFeedbackError("Please pick a rating before continuing.");
      return;
    }

    const uid = readFeedbackUserId(storedUser);
    setFeedbackError("");

    if (isDemoBypass || !backendBase || !adminToken || !uid) {
      onViewLeaderboard();
      return;
    }

    setFeedbackSaving(true);
    try {
      const res = await fetch(`${backendBase}/welcomeStageFeedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ userId: uid, feedback: selectedFeedback }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setFeedbackError(
          data.message || "Could not save feedback. Please try again."
        );
        return;
      }
      onViewLeaderboard();
    } catch (err) {
      setFeedbackError(err?.message || "Could not save feedback.");
    } finally {
      setFeedbackSaving(false);
    }
  }, [
    feedbackSaving,
    selectedFeedback,
    storedUser,
    isDemoBypass,
    backendBase,
    adminToken,
    onViewLeaderboard,
  ]);

  if (step === "restore") {
    return (
      <div className="final-screen final-screen--restore">
        <div className="final-screen__inner final-screen__inner--restore">
          <header className="final-legacy__header">
            <span className="final-legacy__crown" aria-hidden>
              ♛
            </span>
            <h1 className="final-legacy__title">{RESTORE_COPY.title}</h1>
            <img
              src={congratsBanner}
              alt="Congratulations, Champion!"
              className="final-legacy__banner"
              draggable={false}
            />
          </header>

          <div className="final-legacy__stage">
            <div className="final-legacy__trophy-wrap">
              <div className="final-legacy__glow" aria-hidden />
              <img
                src={trophyImg}
                alt="Hall of Champions trophy"
                className="final-legacy__trophy"
                draggable={false}
              />
            </div>
          </div>

          <div className="final-legacy__closing">
            {RESTORE_COPY.praise.map((line, i) => (
              <p
                key={line}
                className={`final-legacy__closing-line${
                  i === 0 ? " final-legacy__closing-line--lead" : ""
                }`}
              >
                {line}
              </p>
            ))}
            <div className="final-screen__rule final-screen__rule--sm" aria-hidden>
              <span />
            </div>
            <p className="final-legacy__quote">
              <span className="final-legacy__quote-mark" aria-hidden>
                “
              </span>
              {RESTORE_COPY.quote}
              <span className="final-legacy__quote-mark" aria-hidden>
                ”
              </span>
            </p>
          </div>

          <div className="final-legacy__actions">
            <button
              type="button"
              className="final-legacy__btn final-legacy__btn--primary"
              onClick={goToSummary}
            >
              VIEW SUMMARY
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "feedback") {
    return (
      <div className="final-screen final-screen--feedback">
        <div className="final-screen__inner final-screen__inner--feedback">
          <section
            className="final-feedback stage-success-letter"
            aria-label="Did you like the game?"
          >
            <h1 className="final-feedback__title">Did you like the game?</h1>

            <div
              className="final-feedback__scale"
              role="radiogroup"
              aria-label="Rate your experience"
            >
              <div className="final-feedback__options">
                {FEEDBACK_OPTIONS.map((opt) => {
                  const selected = selectedFeedback === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`final-feedback__option${
                        selected ? " final-feedback__option--selected" : ""
                      }`}
                      onClick={() => selectFeedbackOption(opt.value)}
                      disabled={feedbackSaving}
                    >
                      <span className="final-feedback__emoji" aria-hidden>
                        {opt.emoji}
                      </span>
                      <span className="final-feedback__label">{opt.label}</span>
                      <span className="final-feedback__sub">{opt.sub}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className={`final-feedback__slider-wrap${
                  sliderDragging ? " final-feedback__slider-wrap--dragging" : ""
                }`}
              >
                <div
                  ref={sliderTrackRef}
                  className="final-feedback__slider"
                  role="slider"
                  tabIndex={feedbackSaving ? -1 : 0}
                  aria-label="Feedback rating"
                  aria-valuemin={0}
                  aria-valuemax={feedbackMaxIndex}
                  aria-valuenow={feedbackIndex}
                  aria-valuetext={
                    FEEDBACK_OPTIONS[feedbackIndex]
                      ? `${FEEDBACK_OPTIONS[feedbackIndex].label} — ${FEEDBACK_OPTIONS[feedbackIndex].sub}`
                      : undefined
                  }
                  aria-disabled={feedbackSaving}
                  onPointerDown={onFeedbackSliderPointerDown}
                  onPointerMove={onFeedbackSliderPointerMove}
                  onPointerUp={onFeedbackSliderPointerUp}
                  onPointerCancel={onFeedbackSliderPointerUp}
                  onKeyDown={(e) => {
                    if (feedbackSaving) return;
                    let next = feedbackIndex;
                    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                      next = Math.max(0, feedbackIndex - 1);
                    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                      next = Math.min(feedbackMaxIndex, feedbackIndex + 1);
                    } else if (e.key === "Home") {
                      next = 0;
                    } else if (e.key === "End") {
                      next = feedbackMaxIndex;
                    } else {
                      return;
                    }
                    e.preventDefault();
                    selectFeedbackOption(FEEDBACK_OPTIONS[next].value);
                  }}
                >
                  <div
                    className="final-feedback__slider-fill"
                    style={{ width: `${sliderPct}%` }}
                  />
                  <div
                    className="final-feedback__slider-thumb"
                    style={{ left: `${sliderPct}%` }}
                  />
                </div>
              </div>
            </div>

            {feedbackError ? (
              <p className="final-feedback__error" role="alert">
                {feedbackError}
              </p>
            ) : null}

            <p className="final-feedback__hint">
              Your feedback helps us create even more fun experiences!
            </p>
          </section>

          <div className="final-feedback__actions">
            <button
              type="button"
              className="final-screen__continue"
              style={{ backgroundImage: `url(${continueBtn})` }}
              onClick={submitFeedbackAndContinue}
              disabled={feedbackSaving}
            >
              <span>{feedbackSaving ? "SAVING…" : "CONTINUE"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="final-screen final-screen--summary">
      <div className="final-screen__inner final-screen__inner--summary">
        <header className="final-screen__header">
          <h1 className="final-screen__title">SCORE SUMMARY</h1>
          <div className="final-screen__rule" aria-hidden>
            <span />
          </div>
        </header>

        <div className="final-summary-stage">
          <section
            className="final-perf stage-success-letter"
            aria-label="Your performance"
          >
            <div className="final-perf__top">
              <h2 className="final-perf__heading">YOUR PERFORMANCE</h2>
              <div className="final-perf__seals">
                <span className="final-perf__seal-chip">
                  <img
                    src={COMPLETION_ASSETS.championsSeal}
                    alt=""
                    draggable={false}
                  />
                  Champion&apos;s Seal ✅
                </span>
              </div>
            </div>

            <div className="final-perf__metrics">
              <div className="final-perf__metric">
                <span className="final-perf__icon" aria-hidden>
                  ⏳
                </span>
                <span className="final-perf__label">TIME TAKEN</span>
                <span className="final-perf__value">{timeLabel}</span>
              </div>
              <div className="final-perf__divider" aria-hidden />
              <div className="final-perf__metric">
                <span className="final-perf__icon" aria-hidden>
                  🏆
                </span>
                <span className="final-perf__label">FINAL SCORE</span>
                <span className="final-perf__value">{finalScore}</span>
              </div>
              <div className="final-perf__divider" aria-hidden />
              <div className="final-perf__metric">
                <span className="final-perf__icon" aria-hidden>
                  ◎
                </span>
                <span className="final-perf__label">ACCURACY</span>
                <span className="final-perf__value">100%</span>
              </div>
            </div>

            <div
              className="final-perf__stars"
              aria-label={`${snapshot.stars} of 3 stars`}
            >
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`final-perf__star${
                    n <= snapshot.stars ? " final-perf__star--on" : ""
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </section>

          <section className="final-ceremony" aria-label="Completion message">
            {CEREMONY_MESSAGES.map((line, i) => (
              <p
                key={line}
                className={`final-ceremony__line${
                  i === CEREMONY_MESSAGES.length - 1
                    ? " final-ceremony__line--strong"
                    : ""
                }`}
              >
                {line}
              </p>
            ))}
          </section>
        </div>

        {submitError ? (
          <p className="final-screen__error" role="alert">
            {submitError}
          </p>
        ) : null}
        {submitStatus === "saving" ? (
          <p className="final-screen__status" aria-live="polite">
            Submitting your score…
          </p>
        ) : null}

        <div className="final-summary__actions">
          <button
            type="button"
            className="final-screen__continue"
            style={{ backgroundImage: `url(${continueBtn})` }}
            onClick={goToFeedback}
          >
            <span>CONTINUE</span>
          </button>
          {submitStatus === "error" ? (
            <button
              type="button"
              className="final-summary__text-btn"
              onClick={submitFinalScore}
            >
              Retry submit
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
