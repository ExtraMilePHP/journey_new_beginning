/** Visual cues for hall SVG hotspots (injected into <object> documents). */

const STYLE_ID = "hall-hotspot-fx";

const STYLE_CSS = `
@keyframes hall-hotspot-pulse {
  0%, 100% {
    filter:
      drop-shadow(0 0 2px rgba(255, 230, 140, 0.45))
      drop-shadow(0 0 6px rgba(232, 198, 90, 0.35))
      drop-shadow(0 0 12px rgba(232, 198, 90, 0.2));
  }
  50% {
    filter:
      drop-shadow(0 0 4px rgba(255, 245, 180, 0.6))
      drop-shadow(0 0 10px rgba(255, 220, 120, 0.45))
      drop-shadow(0 0 18px rgba(232, 198, 90, 0.28));
  }
}

.hall-hotspot--active {
  animation: hall-hotspot-pulse 1.55s ease-in-out infinite;
}

.hall-hotspot--done {
  filter:
    drop-shadow(0 0 1px rgba(255, 230, 140, 0.45))
    drop-shadow(0 0 3px rgba(232, 198, 90, 0.35))
    drop-shadow(0 0 6px rgba(201, 164, 92, 0.22));
}

@media (prefers-reduced-motion: reduce) {
  .hall-hotspot--active {
    animation: none;
    filter:
      drop-shadow(0 0 3px rgba(255, 230, 140, 0.55))
      drop-shadow(0 0 8px rgba(232, 198, 90, 0.4));
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
