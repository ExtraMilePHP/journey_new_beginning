import { ensureThemeJsonArray } from "../../functions/themeAssets";

export function parseUnscrambleFromTheme(themeData) {
  const raw = ensureThemeJsonArray(themeData?.unscramble);
  if (raw.length) {
    return raw
      .map((item) => ({
        scrambled: String(item?.question ?? "").trim(),
        answer: String(item?.answer ?? "").trim(),
        clue: String(item?.clue ?? "").trim(),
      }))
      .filter((e) => e.scrambled && e.answer);
  }

  const legacy = ensureThemeJsonArray(themeData?.questions_and_answers);
  return legacy
    .map((item) => ({
      scrambled: String(item?.question ?? "").trim(),
      answer: String(item?.answer ?? "").trim(),
      clue: String(item?.clue ?? "").trim(),
    }))
    .filter((e) => e.scrambled && e.answer);
}

export function parseShowClue(themeData) {
  const v = themeData?.show_clue;
  return v === true || v === "true" || v === 1 || v === "1";
}

function parseMinAnswersScalar(raw) {
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** Minimum correct unscrambles before submit (admin: Unscramble → settings). */
export function getUnscrambleMinAnswersForAdmin(themeData) {
  return (
    parseMinAnswersScalar(themeData?.unscramble_min_answers) ??
    parseMinAnswersScalar(themeData?.words) ??
    1
  );
}

export function parseMinSubmitCount(themeData, entryCount) {
  const configured =
    parseMinAnswersScalar(themeData?.unscramble_min_answers) ??
    parseMinAnswersScalar(themeData?.words);

  if (configured != null) {
    return Math.min(configured, entryCount || 1);
  }
  return entryCount > 0 ? entryCount : 1;
}

/** Compare user entry to answer (case/space insensitive). */
export function answersMatch(userValue, answer) {
  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  return norm(userValue) === norm(answer);
}

/** Letters-only length for tile count. */
export function answerLetterCount(answer) {
  return String(answer ?? "").replace(/[^a-zA-Z0-9]/gi, "").length;
}

export function buildAnswerSlots(answer) {
  const chars = String(answer ?? "").split("");
  const slots = [];
  chars.forEach((ch, i) => {
    if (/[a-zA-Z0-9]/.test(ch)) {
      slots.push({ char: ch, key: `slot-${i}` });
    }
  });
  return slots;
}

export function joinSlotValues(values) {
  return values.map((v) => String(v ?? "").trim()).join("");
}
