/**
 * Normalize theme list fields from fetchThemeData: API may return arrays or JSON-encoded strings.
 * (Admin themeupdate uses the same logic as ensureArray.)
 */
export function ensureThemeJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (val == null || val === "") return [];
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Build a safe URL for theme images (S3 keys under REACT_APP_S3_PATH, or full https URLs).
 * Encodes each path segment so spaces, parentheses, %, etc. resolve to the correct object key.
 */
export function getDvSourceImageUrl(imgPath) {
  if (!imgPath) return "";
  const s = String(imgPath).trim();
  if (!s) return "";
  const encodePathSegments = (relativePath) =>
    relativePath
      .split("/")
      .map((seg) => {
        if (!seg) return seg;
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join("/");
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const parts = u.pathname.split("/").filter(Boolean);
      u.pathname = `/${parts.map((seg) => encodePathSegments(seg)).join("/")}`;
      return u.toString();
    } catch {
      return encodeURI(s);
    }
  }
  const base = (process.env.REACT_APP_S3_PATH || "").replace(/\/?$/, "/");
  const path = s.replace(/^\/+/, "");
  return `${base}${encodePathSegments(path)}`;
}

/**
 * Value for CSS `background-image` / `url(...)`. Unquoted `url(https://.../a(2).png)` is invalid — the `(` ends the URL.
 */
export function toCssUrlValue(href) {
  if (!href) return "none";
  const escaped = String(href).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

/**
 * Pick `background_mob` vs `background_desk` from theme data.
 * Portrait mobile art must not be used in landscape: many phones stay ≤768px wide when rotated,
 * so width alone would stretch tall portrait assets across a wide viewport.
 */
export function themeBackgroundKeyForViewport(themeData) {
  if (!themeData || typeof themeData !== "object") return null;
  const w = typeof window !== "undefined" ? window.innerWidth : 0;
  const narrow = w > 0 && w <= 768;
  const portrait =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(orientation: portrait)").matches;
  const mob = themeData.background_mob;
  const desk = themeData.background_desk;
  if (narrow && portrait) return mob || desk || null;
  return desk || mob || null;
}

const STAGE_BACKGROUND_KEYS = {
  1: ["stage1_background", "stage_1_background", "wordpuzzle_background"],
  2: ["stage2_background", "stage_2_background", "unscramble_background"],
  3: ["stage3_background", "stage_3_background", "quiz_background"],
  4: ["stage4_background", "stage_4_background", "image_quiz_background"],
  5: ["stage5_background", "stage_5_background", "image_only_background"],
};

/** Per-stage background from theme admin, with global desk/mob fallback. */
export function themeBackgroundKeyForStage(themeData, stageNumber) {
  if (!themeData || typeof themeData !== "object") return null;
  const keys = STAGE_BACKGROUND_KEYS[stageNumber] || [];
  for (const key of keys) {
    const val = themeData[key];
    if (val != null && String(val).trim() !== "") return String(val).trim();
  }
  return themeBackgroundKeyForViewport(themeData);
}

export function parseStageNumberFromPath(pathname) {
  const m = String(pathname || "").match(/^\/stage(\d)(?:\/|$)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/** Theme text color for stage titles, subtitles, and related copy. */
export function getLandingPageTitleColor(themeData) {
  const raw =
    themeData?.landing_page_title_color ?? themeData?.landing_page_title_colour;
  if (raw == null || raw === "") return undefined;
  const c = String(raw).trim();
  return c || undefined;
}
