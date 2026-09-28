import React from "react";
import timerIcon from "../img/timer.png";
import "./StageTimer.css";

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle
        cx="12"
        cy="12"
        r="6.75"
        stroke="currentColor"
        strokeWidth="1.15"
        opacity="0.85"
      />
      <path
        d="M12 7.4v9.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14.55 9.1c-.35-.55-1.05-.9-2.05-.9-1.35 0-2.25.7-2.25 1.65 0 .95.75 1.4 2.05 1.7 1.45.35 2.35.85 2.35 1.9 0 1.05-1 1.8-2.45 1.8-1.1 0-1.9-.4-2.3-1.05"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shared stage HUD: timer + points in one gold-on-black pill. */
export default function StageTimer({ timeLabel, points = 0 }) {
  const showPoints = points != null && Number.isFinite(Number(points));
  const pointsValue = showPoints ? Number(points) : null;

  return (
    <div
      className="stage-escape-timer"
      aria-live="polite"
      aria-label={
        showPoints
          ? `Elapsed time ${timeLabel}, ${pointsValue} points`
          : `Elapsed time ${timeLabel}`
      }
    >
      <span className="stage-escape-timer__icon" aria-hidden>
        <img src={timerIcon} alt="" draggable={false} />
      </span>
      <span className="stage-escape-timer__value">{timeLabel}</span>
      {showPoints ? (
        <>
          <span className="stage-escape-timer__divider" aria-hidden>
            |
          </span>
          <span className="stage-escape-timer__coin" aria-hidden>
            <CoinIcon />
          </span>
          <span className="stage-escape-timer__points">{pointsValue}</span>
        </>
      ) : null}
    </div>
  );
}
