export const QUIZ_CSV_COLUMN_COUNT = 6;

/** Required header row for CSV import/export (row 1). */
export const QUIZ_CSV_HEADERS = [
  "audio_file",
  "option_one",
  "option_two",
  "option_three",
  "option_four",
  "correct_answer",
];

export const QUIZ_OPTION_MAX = 100;
export const QUIZ_AUDIO_LABEL_MAX = 120;
export const QUIZ_PAGE_SIZES = [10, 25, 50, 100];

export const QUIZ_OPTION_KEYS = [
  "option_one",
  "option_two",
  "option_three",
  "option_four",
];

export const QUIZ_OPTION_LABELS = ["Option 1", "Option 2", "Option 3", "Option 4"];

export function emptyQuizQuestion(id) {
  return {
    id,
    audio_file: "",
    question_name: "",
    option_one: "",
    option_two: "",
    option_three: "",
    option_four: "",
    correct_answer: "",
  };
}

export const QUIZ_MAX_QUESTIONS = 10;
/** Minimum questions recommended for gameplay. */
export const QUIZ_MIN_QUESTIONS = 2;
/** Minimum questions required to persist to the theme database. */
export const QUIZ_SAVE_MIN_QUESTIONS = 1;

export const SAMPLE_CSV_ROWS = [
  [
    "",
    "Nadaswaram",
    "Guitar",
    "Ghatam",
    "Vina",
    "Nadaswaram",
  ],
  [
    "",
    "Trust",
    "Silence",
    "Conflict",
    "Apathy",
    "Trust",
  ],
];

export function buildSampleCsvContent() {
  const escape = (val) => {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    QUIZ_CSV_HEADERS.join(","),
    ...SAMPLE_CSV_ROWS.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\r\n");
}

function downloadCsvBlob(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadSampleQuizCsv() {
  downloadCsvBlob(buildSampleCsvContent(), "quiz_questions_sample.csv");
}

export function exportQuizCsv(questions) {
  const escape = (val) => {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = (questions || []).map((q) => {
    const c = clampQuizFields(q);
    return [
      c.audio_file,
      c.option_one,
      c.option_two,
      c.option_three,
      c.option_four,
      c.correct_answer,
    ]
      .map(escape)
      .join(",");
  });
  const content = [QUIZ_CSV_HEADERS.join(","), ...rows].join("\r\n");
  downloadCsvBlob(content, "quiz_questions_export.csv");
}

/** Parse a single CSV line respecting quoted fields */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

const HEADER_ALIASES = {
  audio_file: "audio_file",
  audio: "audio_file",
  question_audio: "audio_file",
  option_one: "option_one",
  option1: "option_one",
  option_1: "option_one",
  option_two: "option_two",
  option2: "option_two",
  option_2: "option_two",
  option_three: "option_three",
  option3: "option_three",
  option_3: "option_three",
  option_four: "option_four",
  option4: "option_four",
  option_4: "option_four",
  correct_answer: "correct_answer",
  correctanswer: "correct_answer",
  answer: "correct_answer",
};

export const QUIZ_CSV_HEADER_REQUIRED_MESSAGE =
  "CSV cannot be uploaded without a header row. Row 1 must contain: audio_file, option_one, option_two, option_three, option_four, correct_answer. Download Sample CSV for the correct format.";

function mapHeaderIndex(headers) {
  const index = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key && index[key] === undefined) index[key] = i;
  });
  return index;
}

function looksLikeHeaderRow(cells) {
  const mapped = cells.map((c) => HEADER_ALIASES[normalizeHeader(c)] || normalizeHeader(c));
  const known = new Set(QUIZ_CSV_HEADERS);
  const matches = mapped.filter((m) => known.has(m)).length;
  return matches >= 4;
}

function validateHeaderRow(headerCells) {
  if (!looksLikeHeaderRow(headerCells)) {
    throw new Error(QUIZ_CSV_HEADER_REQUIRED_MESSAGE);
  }

  if (headerCells.length !== QUIZ_CSV_COLUMN_COUNT) {
    throw new Error(
      `Invalid header row: expected ${QUIZ_CSV_COLUMN_COUNT} columns (${QUIZ_CSV_HEADERS.join(", ")}), found ${headerCells.length}.`
    );
  }

  const col = mapHeaderIndex(headerCells);
  const missing = QUIZ_CSV_HEADERS.filter((k) => col[k] === undefined);
  if (missing.length) {
    throw new Error(
      `Invalid header row. Missing columns: ${missing.join(", ")}. Expected: ${QUIZ_CSV_HEADERS.join(", ")}`
    );
  }

  return col;
}

export function parseQuizCsv(text) {
  const raw = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!raw) {
    throw new Error("CSV file is empty.");
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error(QUIZ_CSV_HEADER_REQUIRED_MESSAGE);
  }

  const headerCells = parseCsvLine(lines[0]);
  const col = validateHeaderRow(headerCells);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;

    if (cells.length !== QUIZ_CSV_COLUMN_COUNT) {
      throw new Error(
        `Row ${lineNum}: expected ${QUIZ_CSV_COLUMN_COUNT} columns, found ${cells.length}.`
      );
    }

    const row = {
      audio_file: String(cells[col.audio_file] ?? "").trim(),
      question_name: "",
      option_one: String(cells[col.option_one] ?? "").trim(),
      option_two: String(cells[col.option_two] ?? "").trim(),
      option_three: String(cells[col.option_three] ?? "").trim(),
      option_four: String(cells[col.option_four] ?? "").trim(),
      correct_answer: String(cells[col.correct_answer] ?? "").trim(),
    };

    if (
      !row.option_one &&
      !row.option_two &&
      !row.option_three &&
      !row.option_four
    ) {
      continue;
    }
    rows.push(row);
  }

  if (!rows.length) {
    throw new Error("No question rows found in CSV (header row only).");
  }

  return rows;
}

function formatQuizRowMessage(rowLabel, text) {
  return rowLabel ? `${rowLabel} — ${text}` : text;
}

export function getQuizOptionValues(row) {
  return QUIZ_OPTION_KEYS.map((key) => String(row[key] ?? "").trim()).filter(Boolean);
}

export function clampQuizFields(row) {
  return {
    audio_file: String(row.audio_file ?? "").trim().slice(0, QUIZ_AUDIO_LABEL_MAX),
    question_name: String(row.question_name ?? "").trim().slice(0, QUIZ_AUDIO_LABEL_MAX),
    option_one: String(row.option_one ?? "").trim().slice(0, QUIZ_OPTION_MAX),
    option_two: String(row.option_two ?? "").trim().slice(0, QUIZ_OPTION_MAX),
    option_three: String(row.option_three ?? "").trim().slice(0, QUIZ_OPTION_MAX),
    option_four: String(row.option_four ?? "").trim().slice(0, QUIZ_OPTION_MAX),
    correct_answer: String(row.correct_answer ?? "").trim().slice(0, QUIZ_OPTION_MAX),
  };
}

const QUIZ_IMPORT_FIELD_LIMITS = [
  { key: "audio_file", label: "Audio file (audio_file)", max: QUIZ_AUDIO_LABEL_MAX },
  ...QUIZ_OPTION_KEYS.map((key, i) => ({
    key,
    label: `${QUIZ_OPTION_LABELS[i]} (${key})`,
    max: QUIZ_OPTION_MAX,
  })),
  { key: "correct_answer", label: "Correct answer (correct_answer)", max: QUIZ_OPTION_MAX },
];

function validateCorrectAnswer(row, rowLabel = "") {
  const options = getQuizOptionValues(row);
  const answer = String(row.correct_answer ?? "").trim();
  if (!answer) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatQuizRowMessage(rowLabel, "Correct answer is required."),
    };
  }
  const normalizedAnswer = answer.toLowerCase();
  const match = options.find((opt) => opt.toLowerCase() === normalizedAnswer);
  if (!match) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatQuizRowMessage(
        rowLabel,
        "Correct answer must exactly match one of the four options."
      ),
    };
  }
  return { ok: true, value: match };
}

/** Strict import checks — rejects over-length fields before saving. */
export function validateQuizRowForImport(row, rowLabel = "Row") {
  for (const { key, label, max } of QUIZ_IMPORT_FIELD_LIMITS) {
    const value = String(row[key] ?? "").trim();
    if (value.length > max) {
      return {
        ok: false,
        code: "CHAR_LIMIT",
        message: `${rowLabel} — ${label} has ${value.length} characters. Maximum allowed is ${max} characters. Please shorten the text and upload again.`,
      };
    }
  }

  if (
    !String(row.option_one ?? "").trim() ||
    !String(row.option_two ?? "").trim() ||
    !String(row.option_three ?? "").trim() ||
    !String(row.option_four ?? "").trim()
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatQuizRowMessage(rowLabel, "All four options are required."),
    };
  }

  const answerCheck = validateCorrectAnswer(row, rowLabel);
  if (!answerCheck.ok) return answerCheck;

  const q = clampQuizFields({
    ...row,
    correct_answer: answerCheck.value,
  });

  return { ok: true, data: q };
}

export function validateQuizRow(row, rowLabel = "", options = {}) {
  const { requireAudio = true } = options;

  if (requireAudio && !String(row.audio_file ?? "").trim()) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatQuizRowMessage(rowLabel, "Audio file is required."),
    };
  }

  if (
    !String(row.option_one ?? "").trim() ||
    !String(row.option_two ?? "").trim() ||
    !String(row.option_three ?? "").trim() ||
    !String(row.option_four ?? "").trim()
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatQuizRowMessage(rowLabel, "All four options are required."),
    };
  }

  const answerCheck = validateCorrectAnswer(row, rowLabel);
  if (!answerCheck.ok) return answerCheck;

  const q = clampQuizFields({
    ...row,
    correct_answer: answerCheck.value,
  });

  return { ok: true, data: q };
}

export function validateQuizList(questions) {
  if (questions.length < QUIZ_SAVE_MIN_QUESTIONS) {
    return {
      ok: false,
      message: `Add at least ${QUIZ_SAVE_MIN_QUESTIONS} question before saving.`,
    };
  }
  if (questions.length > QUIZ_MAX_QUESTIONS) {
    return { ok: false, message: `You can save up to ${QUIZ_MAX_QUESTIONS} questions.` };
  }

  const normalized = [];
  for (let i = 0; i < questions.length; i++) {
    const result = validateQuizRow(questions[i], `Question ${i + 1}`, {
      requireAudio: false,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    normalized.push(result.data);
  }

  return { ok: true, data: normalized };
}
