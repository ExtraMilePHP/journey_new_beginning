export const IMAGE_ONLY_CSV_COLUMN_COUNT = 6;

export const IMAGE_ONLY_CSV_HEADERS = [
  "image_file",
  "option_one",
  "option_two",
  "option_three",
  "option_four",
  "correct_answer",
];

export const IMAGE_ONLY_OPTION_MAX = 100;
export const IMAGE_ONLY_FILE_LABEL_MAX = 120;
export const IMAGE_ONLY_PAGE_SIZES = [10, 25, 50, 100];

export const IMAGE_ONLY_OPTION_KEYS = [
  "option_one",
  "option_two",
  "option_three",
  "option_four",
];

export const IMAGE_ONLY_OPTION_LABELS = ["Option 1", "Option 2", "Option 3", "Option 4"];

export function emptyImageOnlyQuestion(id) {
  return {
    id,
    image_file: "",
    option_one: "",
    option_two: "",
    option_three: "",
    option_four: "",
    correct_answer: "",
  };
}

export const IMAGE_ONLY_MAX_QUESTIONS = 10;
/** Minimum questions recommended for gameplay. */
export const IMAGE_ONLY_MIN_QUESTIONS = 2;
/** Minimum questions required to persist to the theme database. */
export const IMAGE_ONLY_SAVE_MIN_QUESTIONS = 1;

export const SAMPLE_IMAGE_ONLY_CSV_ROWS = [
  [
    "",
    "Khajuraho",
    "Amarkantak",
    "Hampi Ruins",
    "Pachmarhi",
    "Khajuraho",
  ],
  [
    "",
    "Golconda fort",
    "Bhimbetka",
    "Pachmarhi",
    "Ujjain",
    "Pachmarhi",
  ],
];

export function buildSampleImageOnlyCsvContent() {
  const escape = (val) => {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    IMAGE_ONLY_CSV_HEADERS.join(","),
    ...SAMPLE_IMAGE_ONLY_CSV_ROWS.map((row) => row.map(escape).join(",")),
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

export function downloadSampleImageOnlyCsv() {
  downloadCsvBlob(buildSampleImageOnlyCsvContent(), "IMAGE_ONLY_questions_sample.csv");
}

export function exportImageOnlyCsv(questions) {
  const escape = (val) => {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = (questions || []).map((q) => {
    const c = clampImageOnlyFields(q);
    return [
      c.image_file,
      c.option_one,
      c.option_two,
      c.option_three,
      c.option_four,
      c.correct_answer,
    ]
      .map(escape)
      .join(",");
  });
  const content = [IMAGE_ONLY_CSV_HEADERS.join(","), ...rows].join("\r\n");
  downloadCsvBlob(content, "IMAGE_ONLY_questions_export.csv");
}

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
  image_file: "image_file",
  image: "image_file",
  question_image: "image_file",
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

export const IMAGE_ONLY_CSV_HEADER_REQUIRED_MESSAGE =
  "CSV cannot be uploaded without a header row. Row 1 must contain: image_file, option_one, option_two, option_three, option_four, correct_answer. Download Sample CSV for the correct format.";

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
  const known = new Set(IMAGE_ONLY_CSV_HEADERS);
  const matches = mapped.filter((m) => known.has(m)).length;
  return matches >= 4;
}

function validateHeaderRow(headerCells) {
  if (!looksLikeHeaderRow(headerCells)) {
    throw new Error(IMAGE_ONLY_CSV_HEADER_REQUIRED_MESSAGE);
  }

  if (headerCells.length !== IMAGE_ONLY_CSV_COLUMN_COUNT) {
    throw new Error(
      `Invalid header row: expected ${IMAGE_ONLY_CSV_COLUMN_COUNT} columns (${IMAGE_ONLY_CSV_HEADERS.join(", ")}), found ${headerCells.length}.`
    );
  }

  const col = mapHeaderIndex(headerCells);
  const missing = IMAGE_ONLY_CSV_HEADERS.filter((k) => col[k] === undefined);
  if (missing.length) {
    throw new Error(
      `Invalid header row. Missing columns: ${missing.join(", ")}. Expected: ${IMAGE_ONLY_CSV_HEADERS.join(", ")}`
    );
  }

  return col;
}

export function parseImageOnlyCsv(text) {
  const raw = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!raw) {
    throw new Error("CSV file is empty.");
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error(IMAGE_ONLY_CSV_HEADER_REQUIRED_MESSAGE);
  }

  const headerCells = parseCsvLine(lines[0]);
  const col = validateHeaderRow(headerCells);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;

    if (cells.length !== IMAGE_ONLY_CSV_COLUMN_COUNT) {
      throw new Error(
        `Row ${lineNum}: expected ${IMAGE_ONLY_CSV_COLUMN_COUNT} columns, found ${cells.length}.`
      );
    }

    const row = {
      image_file: String(cells[col.image_file] ?? "").trim(),
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

function formatRowMessage(rowLabel, text) {
  return rowLabel ? `${rowLabel} — ${text}` : text;
}

export function getImageOnlyOptionValues(row) {
  return IMAGE_ONLY_OPTION_KEYS.map((key) => String(row[key] ?? "").trim()).filter(Boolean);
}

export function clampImageOnlyFields(row) {
  return {
    image_file: String(row.image_file ?? "").trim().slice(0, IMAGE_ONLY_FILE_LABEL_MAX),
    option_one: String(row.option_one ?? "").trim().slice(0, IMAGE_ONLY_OPTION_MAX),
    option_two: String(row.option_two ?? "").trim().slice(0, IMAGE_ONLY_OPTION_MAX),
    option_three: String(row.option_three ?? "").trim().slice(0, IMAGE_ONLY_OPTION_MAX),
    option_four: String(row.option_four ?? "").trim().slice(0, IMAGE_ONLY_OPTION_MAX),
    correct_answer: String(row.correct_answer ?? "").trim().slice(0, IMAGE_ONLY_OPTION_MAX),
  };
}

const IMPORT_FIELD_LIMITS = [
  { key: "image_file", label: "Image file (image_file)", max: IMAGE_ONLY_FILE_LABEL_MAX },
  ...IMAGE_ONLY_OPTION_KEYS.map((key, i) => ({
    key,
    label: `${IMAGE_ONLY_OPTION_LABELS[i]} (${key})`,
    max: IMAGE_ONLY_OPTION_MAX,
  })),
  { key: "correct_answer", label: "Correct answer (correct_answer)", max: IMAGE_ONLY_OPTION_MAX },
];

function validateCorrectAnswer(row, rowLabel = "") {
  const options = getImageOnlyOptionValues(row);
  const answer = String(row.correct_answer ?? "").trim();
  if (!answer) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatRowMessage(rowLabel, "Correct answer is required."),
    };
  }
  const normalizedAnswer = answer.toLowerCase();
  const match = options.find((opt) => opt.toLowerCase() === normalizedAnswer);
  if (!match) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatRowMessage(
        rowLabel,
        "Correct answer must exactly match one of the four options."
      ),
    };
  }
  return { ok: true, value: match };
}

export function validateImageOnlyRowForImport(row, rowLabel = "Row") {
  for (const { key, label, max } of IMPORT_FIELD_LIMITS) {
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
      message: formatRowMessage(rowLabel, "All four options are required."),
    };
  }

  const answerCheck = validateCorrectAnswer(row, rowLabel);
  if (!answerCheck.ok) return answerCheck;

  return { ok: true, data: clampImageOnlyFields({ ...row, correct_answer: answerCheck.value }) };
}

export function validateImageOnlyRow(row, rowLabel = "", options = {}) {
  const { requireImage = true } = options;

  if (requireImage && !String(row.image_file ?? "").trim()) {
    return {
      ok: false,
      code: "VALIDATION",
      message: formatRowMessage(rowLabel, "Image file is required."),
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
      message: formatRowMessage(rowLabel, "All four options are required."),
    };
  }

  const answerCheck = validateCorrectAnswer(row, rowLabel);
  if (!answerCheck.ok) return answerCheck;

  return { ok: true, data: clampImageOnlyFields({ ...row, correct_answer: answerCheck.value }) };
}

export function validateImageOnlyList(questions) {
  if (questions.length < IMAGE_ONLY_SAVE_MIN_QUESTIONS) {
    return {
      ok: false,
      message: `Add at least ${IMAGE_ONLY_SAVE_MIN_QUESTIONS} question before saving.`,
    };
  }
  if (questions.length > IMAGE_ONLY_MAX_QUESTIONS) {
    return { ok: false, message: `You can save up to ${IMAGE_ONLY_MAX_QUESTIONS} questions.` };
  }

  const normalized = [];
  for (let i = 0; i < questions.length; i++) {
    const result = validateImageOnlyRow(questions[i], `Question ${i + 1}`, {
      requireImage: false,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    normalized.push(result.data);
  }

  return { ok: true, data: normalized };
}
