/**
 * Shared pieces for the SVG-scene levels (Village Square, Riverside Crossing):
 * scene fitting, <object> SVG binding, header offset, page backdrop, popups.
 * Styles live in levelScene.css (class prefix `vs-`).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { setupHallPageBodyBackground, isMobViewport } from "../game/gameStageBackground";
import buttonImg from "../img/button1.png";
import "./levelScene.css";

export const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("userData") || "{}");
  } catch {
    return {};
  }
}

/** Demo sessions skip DB saves and end on the plans page. */
export function isDemoUser(storedUser) {
  const role = String(storedUser?.role || "").toLowerCase();
  const source = String(storedUser?.source || "").toUpperCase();
  const sessionId = String(storedUser?.sessionId || "");
  return (
    sessionId === "demobypass" ||
    role === "demobypass" ||
    source === "DEMO" ||
    sessionId.startsWith("demo")
  );
}

export function getBackendBase() {
  return String(process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
}

/** Desktop or phone-portrait SVG, switching on resize / rotation. */
export function useLayoutSvgUrl(deskUrl, mobUrl) {
  const [url, setUrl] = useState(() => (isMobViewport() ? mobUrl : deskUrl));
  useEffect(() => {
    const sync = () => {
      const next = isMobViewport() ? mobUrl : deskUrl;
      setUrl((prev) => (prev === next ? prev : next));
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [deskUrl, mobUrl]);
  return url;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * viewBox [x, y, w, h] that fills a container of aspect `A` (cover), cropping
 * only outside the scene's `safe` band (fractions of the art). If even that is
 * not enough, the safe band is shown whole and stretched slightly.
 */
export function fillViewBox({ w, h, safe }, A) {
  if (A >= w / h) {
    const needH = w / A;
    const minH = (safe.y1 - safe.y0) * h;
    if (needH < minH) return [0, safe.y0 * h, w, minH];
    return [0, clamp((h - needH) / 2, safe.y1 * h - needH, safe.y0 * h), w, needH];
  }
  const needW = h * A;
  const minW = (safe.x1 - safe.x0) * w;
  if (needW < minW) return [safe.x0 * w, 0, minW, h];
  return [clamp((w - needW) / 2, safe.x1 * w - needW, safe.x0 * w), 0, needW, h];
}

/**
 * How a scene `{ w, h, fill, safe }` fits into `wrapRef`: the SVG viewBox and
 * the on-screen box the art occupies (overlays are pinned to it).
 * `fill: true` covers the wrap (crop outside `safe`); otherwise letterbox.
 */
export function useSceneFit(wrapRef, scene) {
  const [fit, setFit] = useState(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const sync = () => {
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (!W || !H) return;
      if (scene.fill) {
        setFit({
          viewBox: fillViewBox(scene, W / H),
          box: { left: 0, top: 0, width: W, height: H },
          fills: true,
        });
        return;
      }
      const aspect = scene.w / scene.h;
      const width = Math.min(W, H * aspect);
      const height = width / aspect;
      setFit({
        viewBox: [0, 0, scene.w, scene.h],
        box: { left: (W - width) / 2, top: (H - height) / 2, width, height },
        fills: false,
      });
    };
    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [wrapRef, scene]);
  return fit;
}

/** The <svg> inside an <object>, or null (not loaded / cross-origin). */
export function getObjectSvg(objectRef) {
  try {
    return objectRef.current?.contentDocument?.querySelector("svg") || null;
  } catch {
    return null;
  }
}

/**
 * Loads the scene <object> and calls `setup(doc, svg, layout)` once per SVG
 * document. Returns { ready, version } — `version` bumps on every (re)bind so
 * effects that style the SVG can re-run.
 */
export function useObjectScene(objectRef, svgUrl, mobUrl, setup, styleText) {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const setupRef = useRef(setup);
  setupRef.current = setup;

  const bind = useCallback(() => {
    const obj = objectRef.current;
    const svg = getObjectSvg(objectRef);
    if (!obj || !svg) return;
    if (!svg.__vsBound) {
      const doc = svg.ownerDocument;
      const layout = String(obj.data || "").endsWith(mobUrl.split("/").pop()) ? "mob" : "desk";
      svg.style.width = "100%";
      svg.style.height = "100%";
      if (styleText) {
        const style = doc.createElementNS(SVG_NS, "style");
        style.textContent = styleText;
        svg.insertBefore(style, svg.firstChild);
      }
      svg.__vsLayout = layout;
      setupRef.current(doc, svg, layout);
      svg.__vsBound = true;
    }
    setVersion((v) => v + 1);
    setReady(true);
  }, [objectRef, mobUrl, styleText]);

  useEffect(() => {
    setReady(false);
    const obj = objectRef.current;
    if (!obj) return undefined;
    if (getObjectSvg(objectRef)) bind();
    obj.addEventListener("load", bind);
    return () => obj.removeEventListener("load", bind);
  }, [bind, objectRef, svgUrl]);

  return { ready, version };
}

/** Apply the fitted viewBox to the bound SVG. */
export function useApplySceneFit(objectRef, fit, ready, version) {
  const viewBox = fit?.viewBox.map((n) => Math.round(n * 100) / 100).join(" ");
  const fills = Boolean(fit?.fills);
  useEffect(() => {
    if (!ready || !viewBox) return;
    const svg = getObjectSvg(objectRef);
    if (!svg?.__vsBound) return;
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("preserveAspectRatio", fills ? "none" : "xMidYMid meet");
  }, [objectRef, ready, version, viewBox, fills]);
}

/**
 * Page chrome for a scene level: dark hall body, blurred copy of the scene as
 * the page backdrop, and the site header's height as `--vs-header-h` on the
 * stage (the stage slides up behind the transparent header).
 */
export function useLevelPage(stageRef, svgUrl) {
  useEffect(
    () => setupHallPageBodyBackground(document.body, { className: "level-scene-page" }),
    []
  );

  useEffect(() => {
    document.body.style.setProperty("--vs-bg", `url("${svgUrl}")`);
    return () => document.body.style.removeProperty("--vs-bg");
  }, [svgUrl]);

  useEffect(() => {
    const header = document.querySelector("header.upperaction");
    const stage = stageRef.current;
    if (!header || !stage) return undefined;
    const sync = () => stage.style.setProperty("--vs-header-h", `${header.offsetHeight}px`);
    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(header);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [stageRef]);
}

/** An element's box in the root SVG's user space (applies its own transform). */
export function elementBox(el) {
  const bb = el.getBBox();
  const m = el.transform?.baseVal?.consolidate()?.matrix;
  const a = m ? m.a : 1;
  const d = m ? m.d : 1;
  return {
    x: (m ? m.e : 0) + a * bb.x,
    y: (m ? m.f : 0) + d * bb.y,
    w: a * bb.width,
    h: d * bb.height,
  };
}

/** Set an <image>/<use> href for both modern and xlink-only renderers. */
export function setSvgHref(el, href) {
  el.setAttribute("href", href);
  el.setAttributeNS(XLINK_NS, "xlink:href", href);
}

/** Overlay layer matching the fitted art; plaques / counters go inside. */
export function SceneBox({ box, children }) {
  if (!box) return null;
  return (
    <div
      className="vs-scene-box"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        "--vs-box-top": `${box.top}px`,
      }}
    >
      {children}
    </div>
  );
}

/** Green-medal check mark for "correct answer" popups. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 48 48" width="60%" height="60%" aria-hidden="true">
      <path
        d="M10 25 L20 35 L39 14"
        fill="none"
        stroke="#f3d27a"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Circular arrows for "try again" popups. */
export function RetryIcon() {
  return (
    <svg viewBox="0 0 48 48" width="62%" height="62%" aria-hidden="true">
      <g fill="none" stroke="#f3d27a" strokeWidth="5" strokeLinecap="round">
        <path d="M38 20 A15 15 0 0 0 11 17" />
        <path d="M10 28 A15 15 0 0 0 37 31" />
      </g>
      <path d="M5 11 L15 11 L9 21 Z" fill="#f3d27a" />
      <path d="M43 37 L33 37 L39 27 Z" fill="#f3d27a" />
    </svg>
  );
}

/**
 * Centered dialog in the ornate msg.png frame; focuses itself and closes on
 * Escape (and via the corner × button) when `onClose` is given.
 * `title` renders as the navy ribbon (the dialog's label), with an optional
 * round `icon` medal; `iconTone="success"` makes the medal green.
 */
export function Popup({
  labelId,
  title,
  icon,
  iconTone = "",
  className = "",
  onClose,
  closeDisabled = false,
  children,
}) {
  const cardRef = useRef(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="vs-modal" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <div className="vs-modal__backdrop" aria-hidden="true" />
      <div ref={cardRef} className={`vs-card vs-card--msg ${className}`} tabIndex={-1}>
        {onClose ? (
          <button
            type="button"
            className="vs-card__close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
        {title ? (
          <header className={`vs-card__banner${icon ? " has-icon" : ""}`}>
            {icon ? (
              <span
                className={`vs-card__medal${iconTone ? ` is-${iconTone}` : ""}`}
                aria-hidden="true"
              >
                {icon}
              </span>
            ) : null}
            <h2 id={labelId} className="vs-card__banner-title">
              {title}
            </h2>
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function GoldButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`vs-btn ${className}`}
      style={{ backgroundImage: `url(${buttonImg})` }}
      {...props}
    >
      {children}
    </button>
  );
}

/** Journey progress bar used in the checkpoint success popups. */
export function JourneyProgress({ percent }) {
  return (
    <div className="vs-progress">
      <div className="vs-progress__label">
        <span>Journey progress</span>
        <span>{percent}%</span>
      </div>
      <div
        className="vs-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="vs-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
