/**
 * Shared drag helpers for hall matching stages (mobile portrait auto-scroll).
 */

const PORTRAIT_MQ = "(max-width: 768px) and (orientation: portrait)";

export function isMobilePortrait() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(PORTRAIT_MQ).matches;
}

/**
 * Edge auto-scroller for long portrait layouts where drop slots sit above the name pool.
 * Call `update(clientY)` on pointermove while dragging; `stop()` on pointerup/cancel.
 */
export function createDragAutoScroller(options = {}) {
  const edgePx = options.edgePx ?? 110;
  const maxStep = options.maxStep ?? 24;
  let lastY = null;
  let rafId = null;

  const step = () => {
    rafId = null;
    if (lastY == null || !isMobilePortrait()) return;

    const y = lastY;
    const vh = window.innerHeight || 0;
    if (vh <= 0) return;

    let dy = 0;
    if (y < edgePx) {
      const t = Math.min(1, (edgePx - y) / edgePx);
      dy = -Math.ceil(maxStep * (0.4 + 0.6 * t));
    } else if (y > vh - edgePx) {
      const t = Math.min(1, (y - (vh - edgePx)) / edgePx);
      dy = Math.ceil(maxStep * (0.4 + 0.6 * t));
    }

    if (dy !== 0) {
      const root = document.scrollingElement || document.documentElement;
      const beforeRoot = root.scrollTop;
      const beforeBody = document.body ? document.body.scrollTop : 0;

      if (typeof root.scrollBy === "function") {
        root.scrollBy(0, dy);
      } else {
        root.scrollTop = beforeRoot + dy;
      }

      // Some stage CSS makes `body` the scrollport on mobile portrait.
      if (root.scrollTop === beforeRoot && document.body) {
        document.body.scrollTop = beforeBody + dy;
      }

      if (
        root.scrollTop === beforeRoot &&
        (!document.body || document.body.scrollTop === beforeBody)
      ) {
        window.scrollBy(0, dy);
      }
    }

    rafId = window.requestAnimationFrame(step);
  };

  return {
    update(clientY) {
      if (typeof clientY !== "number" || Number.isNaN(clientY)) return;
      lastY = clientY;
      if (rafId == null && isMobilePortrait()) {
        rafId = window.requestAnimationFrame(step);
      }
    },
    stop() {
      lastY = null;
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
