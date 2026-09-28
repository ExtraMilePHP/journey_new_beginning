import Swal from "sweetalert2";
import "../pages/game/stageHelp.css";

export const STAGE_RULES_KEYS = {
  1: "wordpuzzle_rules",
  2: "unscramble_rules",
  3: "quiz_rules",
  4: "image_quiz_rules",
  5: "image_only_rules",
};

export const DEFAULT_STAGE_RULES = {
  wordpuzzle_rules: [
    "Click and drag across letters to select a word.",
    "Words may run horizontally, vertically, or diagonally.",
    "Find all hidden words in the grid, then tap Submit.",
  ],
  unscramble_rules: [
    "Read the scrambled phrase on the left.",
    "Type your answer in the box on the right.",
    "Solve the minimum number of words, then tap Submit.",
  ],
  quiz_rules: [
    "Listen to each audio clip and choose the correct answer.",
    "Select an option for every question.",
    "Tap Submit when all answers are filled in.",
  ],
  image_quiz_rules: [
    "Look at each image clue and choose the matching answer.",
    "Select an option for every question.",
    "Tap Submit when all answers are filled in.",
  ],
  image_only_rules: [
    "Look at each landmark image and choose the correct location name.",
    "Select an option for every question.",
    "Tap Submit when all answers are filled in.",
  ],
};

export const STAGE_RULES_LABELS = {
  wordpuzzle_rules: "Stage 1 — Word Puzzle",
  unscramble_rules: "Stage 2 — Unscramble",
  quiz_rules: "Stage 3 — Quiz",
  image_quiz_rules: "Stage 4 — Image Quiz",
  image_only_rules: "Stage 5 — Image Only",
};

export function ensureRulesArray(val) {
  if (Array.isArray(val)) {
    return val.map((r) => String(r ?? "").trim()).filter(Boolean);
  }
  if (val == null || val === "") return [];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map((r) => String(r ?? "").trim()).filter(Boolean);
      }
    } catch {
      const t = val.trim();
      return t ? [t] : [];
    }
    const t = val.trim();
    return t ? [t] : [];
  }
  return [];
}

export function getStageRulesFromTheme(themeData, rulesKey) {
  const configured = ensureRulesArray(themeData?.[rulesKey]);
  if (configured.length) return configured;

  if (rulesKey === "wordpuzzle_rules") {
    const legacy = ensureRulesArray(themeData?.rules_text ?? themeData?.rules);
    if (legacy.length) return legacy;
  }

  return [...(DEFAULT_STAGE_RULES[rulesKey] || [])];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatRulesAsHelpHtml(rules, title = "How to play") {
  const list = ensureRulesArray(rules);
  const steps = list.length
    ? list
        .map(
          (rule, i) => `<li class="stage-help-step">
            <span class="stage-help-step__num" aria-hidden="true">${i + 1}</span>
            <span class="stage-help-step__text">${escapeHtml(rule)}</span>
          </li>`
        )
        .join("")
    : `<li class="stage-help-step">
        <span class="stage-help-step__num" aria-hidden="true">1</span>
        <span class="stage-help-step__text">No rules configured for this stage.</span>
      </li>`;

  return `<div class="stage-help-card">
    <div class="stage-help-card__hero">
      <div class="stage-help-card__icon" aria-hidden="true">?</div>
      <h2 class="stage-help-card__title">${escapeHtml(title)}</h2>
      <p class="stage-help-card__subtitle">Follow these steps to complete this stage</p>
    </div>
    <ul class="stage-help-steps">${steps}</ul>
    <div class="stage-help-card__footer">
      <button type="button" class="stage-help-got-it-btn" data-stage-help-close>Got it!</button>
    </div>
  </div>`;
}

function resolveHelpButtonColor(themeData, fallback = "#2f9e4f") {
  const raw =
    themeData?.button_color ||
    themeData?.colors?.ui_color_1 ||
    themeData?.colors?.ui_color_2;
  if (raw == null || String(raw).trim() === "") return fallback;
  return String(raw).trim();
}

const STAGE_HELP_MODAL_CLASS = "stage-help-modal-open";
const STAGE_HELP_BACKDROP_ID = "stage-help-backdrop";

let helpModalScrollY = 0;

function mountStageHelpBackdrop() {
  if (document.getElementById(STAGE_HELP_BACKDROP_ID)) return;
  const backdrop = document.createElement("div");
  backdrop.id = STAGE_HELP_BACKDROP_ID;
  backdrop.className = "stage-help-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.appendChild(backdrop);
}

function unmountStageHelpBackdrop() {
  document.getElementById(STAGE_HELP_BACKDROP_ID)?.remove();
}

export function lockPageScrollForStageModal() {
  helpModalScrollY =
    window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.classList.add(STAGE_HELP_MODAL_CLASS);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${helpModalScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  mountStageHelpBackdrop();
}

export function unlockPageScrollForStageModal() {
  document.documentElement.classList.remove(STAGE_HELP_MODAL_CLASS);
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  unmountStageHelpBackdrop();
  window.scrollTo(0, helpModalScrollY);
}

export function fireStageHelpSwal({
  rules,
  title = "How to play",
  themeData,
  confirmButtonColor,
}) {
  lockPageScrollForStageModal();

  const btnColor =
    confirmButtonColor || resolveHelpButtonColor(themeData);

  Swal.fire({
    html: formatRulesAsHelpHtml(rules, title),
    showConfirmButton: false,
    showCloseButton: false,
    position: "center",
    width: "min(92vw, 26rem)",
    heightAuto: true,
    scrollbarPadding: false,
    returnFocus: false,
    customClass: {
      popup: "stage-help-popup",
      htmlContainer: "stage-help-popup__html",
    },
    showClass: { popup: "stage-help-popup--in" },
    didOpen: () => {
      const btn = Swal.getPopup()?.querySelector("[data-stage-help-close]");
      if (btn) {
        btn.style.background = `linear-gradient(135deg, ${btnColor}, ${btnColor})`;
        btn.addEventListener("click", () => Swal.close(), { once: true });
      }
    },
    didClose: () => {
      unlockPageScrollForStageModal();
    },
  });
}

export function getAllStageRulesSections(themeData) {
  return Object.entries(STAGE_RULES_KEYS).map(([, key]) => ({
    key,
    label: STAGE_RULES_LABELS[key] || key,
    rules: getStageRulesFromTheme(themeData, key),
  }));
}
