/** Visual cues for hall SVG hotspots (injected into <object> documents). */

const STYLE_ID = "hall-hotspot-fx";

const STYLE_CSS = `
/* Current checkpoint (click me): strong pulsing golden glow. */
@keyframes hall-hotspot-pulse {
  0%, 100% {
    filter:
      brightness(1.05)
      drop-shadow(0 0 3px rgba(255, 236, 150, 0.95))
      drop-shadow(0 0 9px rgba(255, 200, 60, 0.75))
      drop-shadow(0 0 18px rgba(255, 170, 30, 0.45));
  }
  50% {
    filter:
      brightness(1.25)
      drop-shadow(0 0 6px rgba(255, 250, 200, 1))
      drop-shadow(0 0 16px rgba(255, 215, 80, 0.95))
      drop-shadow(0 0 30px rgba(255, 180, 40, 0.7));
  }
}

.hall-hotspot--active {
  animation: hall-hotspot-pulse 1.3s ease-in-out infinite;
}

/* Completed checkpoint: bright green glow with a slow, gentle pulse. */
@keyframes hall-hotspot-done {
  0%, 100% {
    filter:
      brightness(1.08)
      drop-shadow(0 0 2px rgba(255, 255, 255, 0.9))
      drop-shadow(0 0 6px rgba(120, 255, 150, 1))
      drop-shadow(0 0 14px rgba(40, 220, 100, 0.95))
      drop-shadow(0 0 26px rgba(20, 190, 80, 0.75));
  }
  50% {
    filter:
      brightness(1.15)
      drop-shadow(0 0 3px rgba(255, 255, 255, 1))
      drop-shadow(0 0 9px rgba(140, 255, 170, 1))
      drop-shadow(0 0 20px rgba(50, 235, 110, 1))
      drop-shadow(0 0 36px rgba(20, 200, 85, 0.9));
  }
}

.hall-hotspot--done {
  animation: hall-hotspot-done 2.6s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hall-hotspot--done {
    animation: none;
    filter:
      brightness(1.1)
      drop-shadow(0 0 6px rgba(120, 255, 150, 1))
      drop-shadow(0 0 16px rgba(40, 220, 100, 0.95));
  }

  .hall-hotspot--active {
    animation: none;
    filter:
      brightness(1.2)
      drop-shadow(0 0 5px rgba(255, 245, 190, 1))
      drop-shadow(0 0 14px rgba(255, 210, 70, 0.9));
  }
}
`;

/** Inject pulse / completed glow styles into an SVG document once. */
export function ensureHallHotspotStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const svg = doc.querySelector("svg");
  const style = svg
    ? doc.createElementNS("http://www.w3.org/2000/svg", "style")
    : doc.createElement("style");
  style.setAttribute("id", STYLE_ID);
  style.textContent = STYLE_CSS;
  if (svg) {
    svg.insertBefore(style, svg.firstChild);
  } else {
    (doc.head || doc.documentElement).appendChild(style);
  }
}

/**
 * Apply clickability + visual state.
 * @param {Element|null} el
 * @param {{ enabled: boolean, active?: boolean, completed?: boolean }} opts
 */
export function styleHallHotspot(el, { enabled, active = false, completed = false }) {
  if (!el) return;

  el.classList.remove("hall-hotspot--active", "hall-hotspot--done");
  if (active) el.classList.add("hall-hotspot--active");
  else if (completed) el.classList.add("hall-hotspot--done");

  el.style.pointerEvents = enabled ? "auto" : "none";
  el.style.cursor = enabled ? "pointer" : "default";
  if (enabled) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
  } else {
    el.removeAttribute("role");
    el.removeAttribute("tabindex");
  }
  el.querySelectorAll("*").forEach((child) => {
    child.style.pointerEvents = enabled ? "auto" : "none";
    child.style.cursor = enabled ? "pointer" : "default";
  });
}
