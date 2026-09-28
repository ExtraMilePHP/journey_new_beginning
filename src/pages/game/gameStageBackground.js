export function isMobViewport() {
  const w = window.innerWidth;
  const narrow = w > 0 && w <= 768;
  const portrait =
    window.matchMedia &&
    window.matchMedia("(orientation: portrait)").matches;
  return narrow && portrait;
}

/** Stage scene art: full bleed on mobile portrait, height-fit on desktop. */
export function getStageForegroundSize(mob = isMobViewport()) {
  return mob ? "100% 100%" : "auto 100%";
}

export function applyStageBodyBackground(
  body,
  {
    foregroundUrl = null,
    mob = isMobViewport(),
    plainPhase = false,
    foregroundSize,
    fixedAttachment = false,
  } = {}
) {
  const attachment = fixedAttachment ? "fixed" : mob ? "scroll" : "fixed";
  const fgSize = foregroundSize ?? getStageForegroundSize(mob);
  const sizePriority = mob ? "important" : "";

  if (foregroundUrl) {
    body.style.backgroundImage = `url("${foregroundUrl}")`;
    body.style.backgroundRepeat = "no-repeat";
    body.style.backgroundPosition = "center center";
    body.style.setProperty("background-size", fgSize, sizePriority);
    body.style.backgroundColor = "#dce8f5";
  } else {
    body.style.backgroundImage = "none";
    body.style.backgroundRepeat = "no-repeat";
    body.style.backgroundPosition = "center center";
    body.style.setProperty("background-size", "cover", sizePriority);
    body.style.backgroundColor = plainPhase ? "#e8eef5" : "#dce8f5";
  }

  body.style.backgroundAttachment = attachment;
}

/** Login / app pages: stretch foreground to fill the viewport. */
export function getAppForegroundSize() {
  return "100% 100%";
}

const APP_BODY_STYLE_KEYS = [
  "background-attachment",
  "background-size",
  "background-repeat",
  "background-position",
  "background-image",
  "background-color",
  "overflow-x",
  "margin",
  "padding",
  "height",
  "font-family",
];

/** Clear leftover inline body backgrounds (e.g. light begin/intro fill) for dark hall hubs. */
export function setupHallPageBodyBackground(
  body,
  { className, deskForeground = null, mobForeground = null } = {}
) {
  const snapshot = APP_BODY_STYLE_KEYS.map((k) => [
    k,
    body.style.getPropertyValue(k),
  ]);

  if (className) body.classList.add(className);
  body.style.setProperty("background-color", "#0b0d12");
  body.style.setProperty("background-repeat", "no-repeat");
  body.style.setProperty("background-position", "center center");
  body.style.setProperty("background-size", "cover");
  body.style.setProperty("background-attachment", "fixed");
  body.style.setProperty("overflow-x", "hidden");
  body.style.setProperty("margin", "0");

  const applyBlur = () => {
    const mob = isMobViewport();
    const url = mob
      ? mobForeground || deskForeground
      : deskForeground || mobForeground;
    body.style.setProperty(
      "background-image",
      url ? `url("${url}")` : "none"
    );
  };

  applyBlur();
  window.addEventListener("resize", applyBlur);
  window.addEventListener("orientationchange", applyBlur);

  return () => {
    window.removeEventListener("resize", applyBlur);
    window.removeEventListener("orientationchange", applyBlur);
    if (className) body.classList.remove(className);
    snapshot.forEach(([k, v]) => {
      if (v) body.style.setProperty(k, v);
      else body.style.removeProperty(k);
    });
  };
}

/** Shared body background for login and leaderboard (single foreground image). */
export function setupAppPageBodyBackground(body, { deskForeground, mobForeground }) {
  const snapshot = APP_BODY_STYLE_KEYS.map((k) => [
    k,
    body.style.getPropertyValue(k),
  ]);

  body.style.setProperty("background-attachment", "fixed");
  body.style.setProperty("background-size", "100% 100%");
  body.style.setProperty("background-repeat", "no-repeat");
  body.style.setProperty("background-position", "center");
  body.style.setProperty("overflow-x", "hidden");
  body.style.setProperty("margin", "0");
  body.style.setProperty("padding", "0");
  body.style.setProperty("height", "100vh");
  body.style.setProperty(
    "font-family",
    "'FiraSans-Medium', sans-serif",
    "important"
  );

  const apply = () => {
    const mob = isMobViewport();
    applyStageBodyBackground(body, {
      foregroundUrl: mob ? mobForeground : deskForeground,
      mob,
      foregroundSize: getAppForegroundSize(mob),
      fixedAttachment: true,
    });
  };

  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);

  return () => {
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
    snapshot.forEach(([k, v]) => {
      if (v) body.style.setProperty(k, v);
      else body.style.removeProperty(k);
    });
  };
}
