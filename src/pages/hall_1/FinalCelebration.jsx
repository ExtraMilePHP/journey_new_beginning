/**
 * Grand Celebration finale: a staged, full-screen animation that ends on the
 * Final Screen. Stages: keys glow → arch opens → lanterns → lights → rangoli →
 * banners → confetti → fireworks → silhouettes → Final Screen.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FINAL_SCREEN, JOURNEY_KEYS } from "./grandCelebrationData";
import { GoldButton, JourneyProgress } from "./levelScene";
import "./finalCelebration.css";

/** Stage start times (ms from "Celebrate"); index = stage number. */
const TIMELINE = [0, 2400, 3800, 5400, 6400, 7400, 8400, 9000, 9800, 12200];
const STAGES = [
  "keys",
  "arch",
  "lanterns",
  "lights",
  "rangoli",
  "banners",
  "confetti",
  "fireworks",
  "people",
  "final",
];
const at = (name) => STAGES.indexOf(name);

const CONFETTI_COLORS = ["#f3d27a", "#e2563d", "#2f9e8f", "#f28c28", "#d9468f", "#5b7fd6", "#ffffff"];
const BANNER_COLORS = ["#c0392b", "#f2a31b", "#1f7a8c", "#8e44ad", "#e67e22", "#16a085"];

/** Hanging festival lantern; `lit` adds the warm glow. */
export function Lantern({ lit = false, className = "" }) {
  return (
    <svg
      className={`fc-lantern-svg${lit ? " is-lit" : ""} ${className}`}
      viewBox="0 0 40 72"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="fcLanternGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fff6cf" />
          <stop offset="55%" stopColor="#ffc947" />
          <stop offset="100%" stopColor="#e08a12" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="4" r="3" fill="none" strokeWidth="1.6" className="fc-lantern-metal" />
      <path d="M11 14 L29 14 L25 8 L15 8 Z" className="fc-lantern-metal fc-lantern-fill" />
      <rect x="9" y="14" width="22" height="34" rx="6" className="fc-lantern-body" />
      <path
        d="M20 18 L20 44 M13 20 Q20 31 13 42 M27 20 Q20 31 27 42"
        fill="none"
        strokeWidth="1.2"
        className="fc-lantern-metal"
      />
      <path d="M11 48 L29 48 L26 54 L14 54 Z" className="fc-lantern-metal fc-lantern-fill" />
      <path d="M20 54 L20 60 M17 60 L23 60 L22 70 L18 70 Z" className="fc-lantern-metal fc-lantern-fill" />
    </svg>
  );
}

function Key({ glow }) {
  return (
    <svg className={`fc-key-svg${glow ? " is-glow" : ""}`} viewBox="0 0 64 28" aria-hidden="true">
      <circle cx="12" cy="14" r="9" className="fc-key-metal" fill="none" strokeWidth="4" />
      <path d="M21 14 H60 M50 14 V22 M56 14 V20" className="fc-key-metal" strokeWidth="4" />
    </svg>
  );
}

/** Simple celebrating people (arms up / waving / child), drawn as silhouettes. */
const PEOPLE = [
  { x: 6, s: 1, arms: "up" },
  { x: 15, s: 0.72, arms: "wave" },
  { x: 24, s: 1.05, arms: "side" },
  { x: 36, s: 0.95, arms: "up" },
  { x: 47, s: 0.7, arms: "wave" },
  { x: 57, s: 1.1, arms: "side" },
  { x: 68, s: 0.98, arms: "up" },
  { x: 79, s: 0.75, arms: "wave" },
  { x: 90, s: 1.02, arms: "up" },
];

function Person({ arms }) {
  const armPath =
    arms === "up"
      ? "M14 30 L6 8 M26 30 L34 8"
      : arms === "wave"
      ? "M14 30 L4 40 M26 30 L36 10"
      : "M14 30 L8 50 M26 30 L32 50";
  return (
    <svg viewBox="0 0 40 110" className="fc-person-svg" aria-hidden="true">
      <circle cx="20" cy="14" r="9" />
      <path d="M11 28 Q20 22 29 28 L31 70 L9 70 Z" />
      <path d={armPath} strokeWidth="6" strokeLinecap="round" fill="none" className="fc-person-limb" />
      <path d="M14 68 L12 106 M26 68 L28 106" strokeWidth="7" strokeLinecap="round" fill="none" className="fc-person-limb" />
    </svg>
  );
}

function Rangoli() {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  const inner = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg viewBox="-100 -100 200 200" className="fc-rangoli-svg" aria-hidden="true">
      <circle r="96" fill="#1f7a8c" opacity="0.85" />
      {petals.map((a) => (
        <ellipse key={a} rx="16" ry="44" cy="-46" fill="#f2a31b" transform={`rotate(${a})`} />
      ))}
      {petals.map((a) => (
        <ellipse key={`r${a}`} rx="9" ry="30" cy="-44" fill="#e2563d" transform={`rotate(${a + 15})`} />
      ))}
      <circle r="42" fill="#8e44ad" />
      {inner.map((a) => (
        <ellipse key={`i${a}`} rx="8" ry="22" cy="-22" fill="#f3d27a" transform={`rotate(${a})`} />
      ))}
      <circle r="12" fill="#c0392b" />
      <circle r="5" fill="#fff6cf" />
    </svg>
  );
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
  leaderboardEnabled,
  onHome,
  onLeaderboard,
  onFinalShown,
  startAtFinal = false,
}) {
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [stage, setStage] = useState(startAtFinal || reducedMotion ? at("final") : 0);
  const finalShownRef = useRef(false);

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

      <div className="fc-rangoli" aria-hidden="true">
        <Rangoli />
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

      <div className="fc-people" aria-hidden="true">
        {PEOPLE.map((p, i) => (
          <span
            key={i}
            className="fc-person"
            style={{ left: `${p.x}%`, "--fc-s": p.s, animationDelay: `${i * 0.12}s, ${0.8 + (i % 3) * 0.25}s` }}
          >
            <Person arms={p.arms} />
          </span>
        ))}
      </div>

      {/* Entrance arch: curtains part to reveal the venue. */}
      <div className="fc-arch" aria-hidden="true">
        <span className="fc-curtain fc-curtain--left" />
        <span className="fc-curtain fc-curtain--right" />
        <span className="fc-arch__frame" />
      </div>

      {/* The five Keys of Knowledge; the Key of Wisdom joins, then all glow. */}
      <ol className="fc-keys" aria-label="Keys of Knowledge">
        {JOURNEY_KEYS.map((k, i) => (
          <li key={k.id} className={`fc-key${i === JOURNEY_KEYS.length - 1 ? " fc-key--new" : ""}`}>
            <Key glow />
            <span className="fc-key__label">{k.label}</span>
          </li>
        ))}
      </ol>

      {!reached("final") ? (
        <button type="button" className="fc-skip" onClick={() => setStage(at("final"))}>
          Skip ›
        </button>
      ) : null}

      {reached("final") ? (
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
            {leaderboardEnabled ? (
              <GoldButton onClick={onLeaderboard}>Leaderboard</GoldButton>
            ) : null}
            <GoldButton onClick={onHome}>Home</GoldButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
