/**
 * Grand Celebration finale: a staged, full-screen animation that ends on the
 * Final Screen. Stages: Keys of Knowledge panel → arch opens → lanterns →
 * lights → banners → confetti → fireworks → Final Screen → feedback.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FINAL_SCREEN, JOURNEY_KEYS } from "./grandCelebrationData";
import { GoldButton, JourneyProgress } from "./levelScene";
import { KEY_IMAGES } from "./keyImages";
import lampGold from "./stage5/lamp_gold.png";
import lampGrey from "./stage5/lamp_grey.png";
import "./finalCelebration.css";

/** Stage start times (ms from "Celebrate"); index = stage number. */
const TIMELINE = [0, 3800, 5200, 6800, 7800, 8800, 9400, 11800];
const STAGES = ["keys", "arch", "lanterns", "lights", "banners", "confetti", "fireworks", "final"];

/** Post-game feedback choices; `value` is what the server stores. */
const FEEDBACK_OPTIONS = [
  { value: "Meh", emoji: "😐" },
  { value: "Okay", emoji: "🙂" },
  { value: "Fun", emoji: "😄" },
  { value: "Loved it", emoji: "😍" },
  { value: "Epic!", emoji: "🤩" },
];
const at = (name) => STAGES.indexOf(name);

const CONFETTI_COLORS = ["#f3d27a", "#e2563d", "#2f9e8f", "#f28c28", "#d9468f", "#5b7fd6", "#ffffff"];
const BANNER_COLORS = ["#c0392b", "#f2a31b", "#1f7a8c", "#8e44ad", "#e67e22", "#16a085"];

/** Hanging festival lantern; `lit` adds the warm glow. */
export function Lantern({ lit = false, className = "" }) {
  return (
    <img
      className={`fc-lantern-svg${lit ? " is-lit" : ""} ${className}`}
      src={lit ? lampGold : lampGrey}
      alt=""
      draggable={false}
    />
  );
}

function Key({ src, glow }) {
  return <img className={`fc-key-img${glow ? " is-glow" : ""}`} src={src} alt="" draggable={false} />;
}

function Firework({ x, y, color, delay }) {
  return (
    <span className="fc-firework" style={{ left: `${x}%`, top: `${y}%`, "--fc-fw": color, animationDelay: `${delay}s` }}>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="fc-firework__spark" style={{ "--fc-a": `${i * (360 / 14)}deg`, animationDelay: `${delay}s` }} />
      ))}
    </span>
  );
}

export default function FinalCelebration({
  bgUrl,
  onNext,
  onSubmitFeedback,
  onFinalShown,
  startAtFinal = false,
}) {
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [stage, setStage] = useState(startAtFinal || reducedMotion ? at("final") : 0);
  const finalShownRef = useRef(false);
  /** "message" (final screen) → "feedback" → onNext() */
  const [step, setStep] = useState("message");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const sendFeedback = async () => {
    if (!feedback || sending) return;
    setSending(true);
    setFeedbackError("");
    try {
      await onSubmitFeedback?.(feedback);
      onNext?.();
    } catch (err) {
      console.error("Feedback save:", err);
      setFeedbackError("Could not save your feedback. Please try again.");
      setSending(false);
    }
  };

  useEffect(() => {
    if (stage >= at("final")) return undefined;
    const timers = TIMELINE.slice(stage + 1).map((t, i) =>
      window.setTimeout(() => setStage(stage + 1 + i), t - TIMELINE[stage])
    );
    return () => timers.forEach(clearTimeout);
    // Schedule once from the starting stage; later stages come from these timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage >= at("final") && !finalShownRef.current) {
      finalShownRef.current = true;
      onFinalShown?.();
    }
  }, [stage, onFinalShown]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 8,
        spin: Math.random() > 0.5 ? 1 : -1,
      })),
    []
  );

  const reached = (name) => stage >= at(name);
  const cls = STAGES.filter((n) => reached(n)).map((n) => `fc-at-${n}`).join(" ");

  return (
    <div className={`fc-overlay ${cls}`} role="dialog" aria-modal="true" aria-labelledby="fc-final-title">
      <div className="fc-scene" style={{ backgroundImage: `url("${bgUrl}")` }} aria-hidden="true" />

      {/* Decorations, each revealed at its stage. */}
      <div className="fc-lights" aria-hidden="true">
        {[0, 1].map((row) => (
          <div key={row} className={`fc-lights__row fc-lights__row--${row}`}>
            {Array.from({ length: 22 }, (_, i) => (
              <span key={i} className="fc-bulb" style={{ animationDelay: `${i * 0.05 + row * 0.2}s` }} />
            ))}
          </div>
        ))}
      </div>

      <div className="fc-banners" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="fc-flag" style={{ "--fc-flag": BANNER_COLORS[i % BANNER_COLORS.length], animationDelay: `${i * 0.04}s` }} />
        ))}
      </div>

      <div className="fc-lanterns" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="fc-lantern" style={{ "--fc-i": i, animationDelay: `${i * 0.18}s` }}>
            <span className="fc-lantern__string" />
            <Lantern lit={reached("lanterns")} />
          </span>
        ))}
      </div>

      <div className="fc-fireworks" aria-hidden="true">
        {reached("fireworks") ? (
          <>
            <Firework x={18} y={16} color="#f3d27a" delay={0} />
            <Firework x={78} y={12} color="#e2563d" delay={0.6} />
            <Firework x={48} y={8} color="#5bd6c4" delay={1.2} />
            <Firework x={32} y={22} color="#d9468f" delay={1.8} />
            <Firework x={66} y={24} color="#ffffff" delay={2.4} />
          </>
        ) : null}
      </div>

      <div className="fc-confetti" aria-hidden="true">
        {reached("confetti")
          ? confetti.map((c, i) => (
              <span
                key={i}
                className="fc-confetti__piece"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.size * 0.45,
                  background: c.color,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.duration}s`,
                  "--fc-spin": c.spin,
                }}
              />
            ))
          : null}
      </div>

      {/* Entrance arch: curtains part to reveal the venue. */}
      <div className="fc-arch" aria-hidden="true">
        <span className="fc-curtain fc-curtain--left" />
        <span className="fc-curtain fc-curtain--right" />
        <span className="fc-arch__frame" />
      </div>

      {/* Keys of Knowledge panel; the Key of Wisdom joins last, then it fades. */}
      <section className="fc-keys" aria-label="Keys of Knowledge">
        <header className="fc-keys__banner">
          <h2 className="fc-keys__title">Keys of Knowledge</h2>
        </header>
        <p className="fc-keys__sub">You collected every key on your journey.</p>
        <ol className="fc-keys__list">
          {JOURNEY_KEYS.map((k, i) => (
            <li key={k.id} className={`fc-key${i === JOURNEY_KEYS.length - 1 ? " fc-key--new" : ""}`}>
              <Key src={KEY_IMAGES[k.id]} glow />
              <span className="fc-key__label">{k.label}</span>
            </li>
          ))}
        </ol>
        <p className="fc-keys__count">
          {JOURNEY_KEYS.length} of {JOURNEY_KEYS.length} collected
        </p>
      </section>

      {!reached("final") ? (
        <button type="button" className="fc-skip" onClick={() => setStage(at("final"))}>
          Skip ›
        </button>
      ) : null}

      {reached("final") && step === "message" ? (
        <section className="fc-final" aria-live="polite">
          <h2 id="fc-final-title" className="fc-final__title">
            {FINAL_SCREEN.heading}
          </h2>
          {FINAL_SCREEN.paragraphs.map((p) => (
            <p key={p} className="fc-final__text">
              {p}
            </p>
          ))}
          <JourneyProgress percent={100} />
          <div className="fc-final__actions">
            <GoldButton onClick={() => setStep("feedback")}>Next</GoldButton>
          </div>
        </section>
      ) : null}

      {reached("final") && step === "feedback" ? (
        <section className="fc-final fc-final--feedback" aria-live="polite">
          <h2 id="fc-final-title" className="fc-final__title">
            How was your journey?
          </h2>
          <p className="fc-final__text">Pick the one that fits best, then continue.</p>
          <div className="fc-feedback" role="radiogroup" aria-labelledby="fc-final-title">
            {FEEDBACK_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={feedback === o.value}
                className={`fc-feedback__option${feedback === o.value ? " is-selected" : ""}`}
                onClick={() => setFeedback(o.value)}
                disabled={sending}
              >
                <span className="fc-feedback__emoji" aria-hidden="true">
                  {o.emoji}
                </span>
                <span className="fc-feedback__label">{o.value}</span>
              </button>
            ))}
          </div>
          {feedbackError ? (
            <p className="fc-feedback__error" role="alert">
              {feedbackError}
            </p>
          ) : null}
          <div className="fc-final__actions">
            <GoldButton onClick={sendFeedback} disabled={!feedback || sending}>
              {sending ? "Saving…" : "Submit"}
            </GoldButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
