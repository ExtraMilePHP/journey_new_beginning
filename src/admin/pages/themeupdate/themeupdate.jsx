import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./themeupdate.css";

import { fetchThemeData } from "../../themeSlice";
import { selectAdminToken, selectOrganizationId, selectSessionId } from "../../sessionSlice";
import { updateThemeData } from "../../functions/updateThemeData";
import { clampQuizFields, validateQuizList } from "./quizHelpers";
import { clampImageQuizFields, validateImageQuizList } from "./imageQuizHelpers";
import { clampImageOnlyFields, validateImageOnlyList } from "./imageOnlyHelpers";
import QuizTab from "./QuizTab";
import ImageQuizTab from "./ImageQuizTab";
import ImageOnlyTab from "./ImageOnlyTab";
import WordPuzzleTab, {
  normalizeWordEntriesFromTheme,
  validateWordPuzzleEntries,
} from "./WordPuzzleTab";
import StageRulesEditor, {
  normalizeRulesFromTheme,
  STAGE_HEADING_MAX_LEN,
  STAGE_SUBHEADING_MAX_LEN,
  validateStageHeadingSubheading,
  validateStageHeadingSubheadingAndRules,
  validateStageRules,
} from "./StageRulesEditor";
import { getUnscrambleMinAnswersForAdmin } from "../../../pages/game/unscrambleUtils";

const GAME_TABS = [
  { id: "wordpuzzle", label: "Word Puzzle" },
  { id: "unscramble", label: "Unscramble" },
  { id: "quiz", label: "Quiz" },
  { id: "image_quiz", label: "Image Quiz" },
  { id: "image_only", label: "Image Only" },
];

const DEFAULT_GAME_TAB = GAME_TABS[0].id;
const GAME_TAB_PARAM = "tab";

function getGameTabFromSearch(params) {
  const tab = params.get(GAME_TAB_PARAM);
  return GAME_TABS.some((t) => t.id === tab) ? tab : DEFAULT_GAME_TAB;
}

const UNSCRAMBLE_MAX_PAIRS = 6;
const UNSCRAMBLE_MIN_PAIRS = 2;
const UNSCRAMBLE_QA_MAX_LEN = 30;
const UNSCRAMBLE_MIN_ANSWERS_MAX = UNSCRAMBLE_MAX_PAIRS;

const DEFAULT_SUBTITLE_STAGE_1 =
  "Find the given words in the grid. (Words may be horizontal, vertical or diagonal)";
const DEFAULT_SUBTITLE_STAGE_2 =
  "Unscramble the words to discover key skills that help women unlock opportunities and grow personally and professionally.";
const DEFAULT_SUBTITLE_STAGE_3 = "Choose the option that best reflects your perspective.";
const DEFAULT_SUBTITLE_STAGE_4 =
  "We have Bollywood's biggest hub! Let's take this fun Emoji challenge to identify the songs.";
const DEFAULT_SUBTITLE_STAGE_5 =
  "We're known for our landmarks amongst many other things! Identify these iconic locations from the pictures and choose the right answer.";

const clampStageHeading = (raw) => String(raw ?? "").slice(0, STAGE_HEADING_MAX_LEN);
const clampStageSubheading = (raw) => String(raw ?? "").slice(0, STAGE_SUBHEADING_MAX_LEN);

let pairIdCounter = 0;
function newPairId(prefix = "pair") {
  pairIdCounter += 1;
  return `${prefix}-${pairIdCounter}`;
}

function sanitizeAlphaNum(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9\s]/g, "");
}

function emptyUnscramblePair() {
  return { id: newPairId("un"), question: "", answer: "" };
}

function normalizeUnscrambleFromTheme(raw) {
  const list = Array.isArray(raw) ? raw : [];
  if (!list.length) {
    return [emptyUnscramblePair(), emptyUnscramblePair()];
  }
  return list.map((item) => ({
    id: newPairId("un"),
    question: sanitizeAlphaNum(item?.question).slice(0, UNSCRAMBLE_QA_MAX_LEN),
    answer: sanitizeAlphaNum(item?.answer).slice(0, UNSCRAMBLE_QA_MAX_LEN),
  }));
}

function normalizeQuizFromTheme(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => ({
    id: newPairId("quiz"),
    ...clampQuizFields(item),
  }));
}

function normalizeImageQuizFromTheme(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => ({
    id: newPairId("image_quiz"),
    ...clampImageQuizFields(item),
  }));
}

function normalizeImageOnlyFromTheme(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => ({
    id: newPairId("image_only"),
    ...clampImageOnlyFields(item),
  }));
}

function UnscrambleTab({
  pairs,
  setPairs,
  minAnswersRequired,
  setMinAnswersRequired,
  isSaving,
  onSavePairs,
  onSaveSettings,
  errorMessage,
  successMessage,
  setErrorMessage,
  setSuccessMessage,
}) {
  const addPair = () => {
    if (pairs.length >= UNSCRAMBLE_MAX_PAIRS) {
      setErrorMessage(`You can add up to ${UNSCRAMBLE_MAX_PAIRS} pairs.`);
      return;
    }
    setErrorMessage("");
    setPairs((prev) => [...prev, emptyUnscramblePair()]);
  };

  const removePair = (id) => {
    if (pairs.length <= UNSCRAMBLE_MIN_PAIRS) {
      setErrorMessage(`You need at least ${UNSCRAMBLE_MIN_PAIRS} pairs.`);
      return;
    }
    setPairs((prev) => prev.filter((p) => p.id !== id));
    setErrorMessage("");
  };

  const updatePair = (id, field, value) => {
    const sanitized = sanitizeAlphaNum(value).slice(0, UNSCRAMBLE_QA_MAX_LEN);
    setPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: sanitized } : p))
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  const clearAll = () => {
    setPairs([emptyUnscramblePair(), emptyUnscramblePair()]);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleMinAnswersChange = (value) => {
    const raw = String(value ?? "").replace(/[^\d]/g, "");
    if (!raw) {
      setMinAnswersRequired("");
      return;
    }
    const n = Math.min(UNSCRAMBLE_MIN_ANSWERS_MAX, Math.max(1, Math.trunc(Number(raw) || 1)));
    setMinAnswersRequired(String(n));
  };

  const leftPairs = pairs.filter((_, i) => i % 2 === 0);
  const rightPairs = pairs.filter((_, i) => i % 2 === 1);

  const renderPairCard = (pair) => (
    <div key={pair.id} className="qa-pair-card">
      <label htmlFor={`uq-${pair.id}`}>Question</label>
      <input
        id={`uq-${pair.id}`}
        type="text"
        value={pair.question}
        maxLength={UNSCRAMBLE_QA_MAX_LEN}
        onChange={(e) => updatePair(pair.id, "question", e.target.value)}
        placeholder="Scrambled word or phrase"
      />
      <button
        type="button"
        className="qa-pair-delete"
        onClick={() => removePair(pair.id)}
        aria-label="Delete pair"
        title="Delete pair"
      >
        <i className="fa-regular fa-trash-can" />
      </button>
      <label htmlFor={`ua-${pair.id}`}>Answer</label>
      <input
        id={`ua-${pair.id}`}
        type="text"
        value={pair.answer}
        maxLength={UNSCRAMBLE_QA_MAX_LEN}
        onChange={(e) => updatePair(pair.id, "answer", e.target.value)}
        placeholder="Correct answer"
      />
    </div>
  );

  return (
    <div className="themeupdate-panel-wide unscramble-panel">
      <p className="qa-char-limit-hint">
        * Add {UNSCRAMBLE_MIN_PAIRS}–{UNSCRAMBLE_MAX_PAIRS} complete pairs. Letters, numbers, and
        spaces only. Question and answer — {UNSCRAMBLE_QA_MAX_LEN} characters each.
      </p>

      {(errorMessage || successMessage) && (
        <div className="qa-alerts">
          {errorMessage ? <p className="cr-alert cr-alert-error">{errorMessage}</p> : null}
          {successMessage ? <p className="cr-alert cr-alert-success">{successMessage}</p> : null}
        </div>
      )}

      <div className="qa-pairs-columns">
        <div className="qa-pairs-col">{leftPairs.map(renderPairCard)}</div>
        <div className="qa-pairs-col">{rightPairs.map(renderPairCard)}</div>
      </div>

      <div className="qa-pairs-actions">
        <button
          type="button"
          className="qa-btn qa-btn-outline"
          onClick={addPair}
          disabled={pairs.length >= UNSCRAMBLE_MAX_PAIRS}
        >
          Add Pair
        </button>
        <button
          type="button"
          className="qa-btn qa-btn-primary"
          onClick={onSavePairs}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save and Continue"}
        </button>
        <button type="button" className="qa-btn qa-btn-primary" onClick={clearAll}>
          Clear All
        </button>
      </div>

      <div className="unscramble-min-answers">
        <label htmlFor="unscramble-min-answers">Minimum answers required for submit</label>
        <input
          id="unscramble-min-answers"
          type="number"
          min={1}
          max={UNSCRAMBLE_MIN_ANSWERS_MAX}
          value={minAnswersRequired}
          onChange={(e) => handleMinAnswersChange(e.target.value)}
        />
      </div>

      <div className="unscramble-save-bottom">
        <button
          type="button"
          className="qa-btn qa-btn-primary"
          onClick={onSaveSettings}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function StageHeadingSubheadingEditor({
  stageLabel,
  heading,
  setHeading,
  subheading,
  setSubheading,
  onSave,
  isSaving = false,
  saveLabel = "Save",
}) {
  return (
    <div className="themeupdate-panel-wide">
      <div className="themeupdate-card">
        <div className="themeupdate-card-body">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: "1 1 320px", minWidth: 280 }}>
              <label className="themeupdate-label">{stageLabel} heading</label>
              <input
                type="text"
                className="themeupdate-input"
                value={heading}
                maxLength={STAGE_HEADING_MAX_LEN}
                onChange={(e) => setHeading(clampStageHeading(e.target.value))}
              />
            </div>

            <div style={{ flex: "1 1 320px", minWidth: 280 }}>
              <label className="themeupdate-label">{stageLabel} sub heading</label>
              <textarea
                className="themeupdate-input"
                rows={2}
                value={subheading}
                maxLength={STAGE_SUBHEADING_MAX_LEN}
                onChange={(e) => setSubheading(clampStageSubheading(e.target.value))}
              />
            </div>
          </div>

          <p className="themeupdate-muted" style={{ marginTop: 8 }}>
            * Heading — max {STAGE_HEADING_MAX_LEN} characters · Sub heading — max{" "}
            {STAGE_SUBHEADING_MAX_LEN} characters.
          </p>

          {onSave ? (
            <div className="stage-heading-save-wrap">
              <button
                type="button"
                className="qa-btn qa-btn-primary"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const ThemeUpdate = () => {
  const dispatch = useDispatch();
  const adminToken = useSelector(selectAdminToken);
  const organizationId = useSelector(selectOrganizationId);
  const sessionId = useSelector(selectSessionId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTheme, data, status } = useSelector((state) => state.theme);

  const activeTab = getGameTabFromSearch(searchParams);
  const [unscramblePairs, setUnscramblePairs] = useState([emptyUnscramblePair(), emptyUnscramblePair()]);
  const [minAnswersRequired, setMinAnswersRequired] = useState("1");
  const [isSaving, setIsSaving] = useState(false);
  const [unscrambleErrorMessage, setUnscrambleErrorMessage] = useState("");
  const [unscrambleSuccessMessage, setUnscrambleSuccessMessage] = useState("");
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizErrorMessage, setQuizErrorMessage] = useState("");
  const [quizSuccessMessage, setQuizSuccessMessage] = useState("");
  const [imageQuizQuestions, setImageQuizQuestions] = useState([]);
  const [imageQuizErrorMessage, setImageQuizErrorMessage] = useState("");
  const [imageQuizSuccessMessage, setImageQuizSuccessMessage] = useState("");
  const [imageOnlyQuestions, setImageOnlyQuestions] = useState([]);
  const [imageOnlyErrorMessage, setImageOnlyErrorMessage] = useState("");
  const [imageOnlySuccessMessage, setImageOnlySuccessMessage] = useState("");
  const [wordPuzzleEntries, setWordPuzzleEntries] = useState([]);
  const [wpErrorMessage, setWpErrorMessage] = useState("");
  const [wpSuccessMessage, setWpSuccessMessage] = useState("");

  // Stage title + subtitle (admin-configurable per mini-game stage).
  const [wordPuzzleHeading, setWordPuzzleHeading] = useState("");
  const [wordPuzzleSubheading, setWordPuzzleSubheading] = useState(
    DEFAULT_SUBTITLE_STAGE_1
  );
  const [unscrambleHeading, setUnscrambleHeading] = useState("");
  const [unscrambleSubheading, setUnscrambleSubheading] = useState(
    DEFAULT_SUBTITLE_STAGE_2
  );
  const [quizHeading, setQuizHeading] = useState("");
  const [quizSubheading, setQuizSubheading] = useState(DEFAULT_SUBTITLE_STAGE_3);
  const [imageQuizHeading, setImageQuizHeading] = useState("");
  const [imageQuizSubheading, setImageQuizSubheading] = useState(DEFAULT_SUBTITLE_STAGE_4);
  const [wordPuzzleRules, setWordPuzzleRules] = useState([""]);
  const [unscrambleRules, setUnscrambleRules] = useState([""]);
  const [quizRules, setQuizRules] = useState([""]);
  const [imageQuizRules, setImageQuizRules] = useState([""]);
  const [imageOnlyHeading, setImageOnlyHeading] = useState("");
  const [imageOnlySubheading, setImageOnlySubheading] = useState(DEFAULT_SUBTITLE_STAGE_5);
  const [imageOnlyRules, setImageOnlyRules] = useState([""]);

  useEffect(() => {
    if (currentTheme) dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true }));
  }, [dispatch, currentTheme]);

  useEffect(() => {
    if (!data) return;
    setUnscramblePairs(normalizeUnscrambleFromTheme(data.unscramble));
    const minWords = getUnscrambleMinAnswersForAdmin(data);
    setMinAnswersRequired(
      String(Math.min(UNSCRAMBLE_MIN_ANSWERS_MAX, minWords))
    );
    setQuizQuestions(normalizeQuizFromTheme(data.quiz));
    setImageQuizQuestions(normalizeImageQuizFromTheme(data.image_quiz));
    setImageOnlyQuestions(normalizeImageOnlyFromTheme(data.image_only));
    setWordPuzzleEntries(normalizeWordEntriesFromTheme(data.wordpuzzle));

    const titleFallback = String(
      data.landing_page_title ?? data.main_title ?? data.themename ?? ""
    ).trim();

    setWordPuzzleHeading(
      clampStageHeading(data.wordpuzzle_title ?? titleFallback ?? "Word Search")
    );
    setWordPuzzleSubheading(
      clampStageSubheading(data.wordpuzzle_subtitle ?? DEFAULT_SUBTITLE_STAGE_1)
    );

    setUnscrambleHeading(
      clampStageHeading(data.unscramble_title ?? titleFallback ?? "Unscramble")
    );
    setUnscrambleSubheading(
      clampStageSubheading(
        data.unscramble_subtitle ??
          data.unscramble_instructions ??
          DEFAULT_SUBTITLE_STAGE_2
      )
    );

    setQuizHeading(clampStageHeading(data.quiz_title ?? titleFallback ?? "Quiz"));
    setQuizSubheading(clampStageSubheading(data.quiz_subtitle ?? DEFAULT_SUBTITLE_STAGE_3));

    setImageQuizHeading(
      clampStageHeading(data.image_quiz_title ?? titleFallback ?? "Image Quiz")
    );
    setImageQuizSubheading(
      clampStageSubheading(data.image_quiz_subtitle ?? DEFAULT_SUBTITLE_STAGE_4)
    );

    setImageOnlyHeading(
      clampStageHeading(data.image_only_title ?? titleFallback ?? "Image Only")
    );
    setImageOnlySubheading(
      clampStageSubheading(data.image_only_subtitle ?? DEFAULT_SUBTITLE_STAGE_5)
    );

    setWordPuzzleRules(normalizeRulesFromTheme(data.wordpuzzle_rules));
    setUnscrambleRules(normalizeRulesFromTheme(data.unscramble_rules));
    setQuizRules(normalizeRulesFromTheme(data.quiz_rules));
    setImageQuizRules(normalizeRulesFromTheme(data.image_quiz_rules));
    setImageOnlyRules(normalizeRulesFromTheme(data.image_only_rules));
  }, [data]);

  const validateUnscramblePairs = () => {
    const filled = unscramblePairs
      .map((p) => ({
        question: sanitizeAlphaNum(p.question).trim(),
        answer: sanitizeAlphaNum(p.answer).trim(),
      }))
      .filter((p) => p.question || p.answer);

    const complete = filled.filter((p) => p.question && p.answer);

    if (complete.length < UNSCRAMBLE_MIN_PAIRS) {
      return {
        ok: false,
        message: `Please add at least ${UNSCRAMBLE_MIN_PAIRS} complete question/answer pairs before saving.`,
      };
    }

    if (complete.length > UNSCRAMBLE_MAX_PAIRS) {
      return {
        ok: false,
        message: `You can save up to ${UNSCRAMBLE_MAX_PAIRS} question/answer pairs.`,
      };
    }

    const hasEmpty = filled.some((p) => !p.question || !p.answer);
    if (hasEmpty) {
      return { ok: false, message: "Please fill in all fields or remove incomplete pairs." };
    }

    const tooLongQa = complete.find(
      (p) => p.question.length > UNSCRAMBLE_QA_MAX_LEN || p.answer.length > UNSCRAMBLE_QA_MAX_LEN
    );
    if (tooLongQa) {
      return {
        ok: false,
        message: `Each question and answer must be ${UNSCRAMBLE_QA_MAX_LEN} characters or fewer.`,
      };
    }

    return {
      ok: true,
      complete: complete.map((p) => ({
        question: p.question,
        answer: p.answer,
      })),
    };
  };

  const handleSaveUnscramblePairs = async () => {
    const stageMeta = validateStageHeadingSubheadingAndRules(
      unscrambleHeading,
      unscrambleSubheading,
      unscrambleRules,
      "Unscramble"
    );
    if (!stageMeta.ok) {
      setUnscrambleErrorMessage(stageMeta.message);
      setUnscrambleSuccessMessage("");
      return;
    }

    const validation = validateUnscramblePairs();
    if (!validation.ok) {
      setUnscrambleErrorMessage(validation.message);
      setUnscrambleSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setUnscrambleErrorMessage("");
    setUnscrambleSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            unscramble: validation.complete,
            unscramble_title: stageMeta.heading,
            unscramble_subtitle: stageMeta.subheading,
            // Backward-compat alias used by the stage renderer.
            unscramble_instructions: stageMeta.subheading,
            unscramble_rules: stageMeta.rules,
            question_count: validation.complete.length,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Unscramble words saved to theme.", "success");
      setUnscrambleSuccessMessage("Pairs saved to theme.");
    } catch (err) {
      setUnscrambleErrorMessage(err?.message || "Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUnscrambleSettings = async () => {
    const stageMeta = validateStageHeadingSubheadingAndRules(
      unscrambleHeading,
      unscrambleSubheading,
      unscrambleRules,
      "Unscramble"
    );
    if (!stageMeta.ok) {
      setUnscrambleErrorMessage(stageMeta.message);
      setUnscrambleSuccessMessage("");
      return;
    }

    const validation = validateUnscramblePairs();
    if (!validation.ok) {
      setUnscrambleErrorMessage(validation.message);
      setUnscrambleSuccessMessage("");
      return;
    }

    const minVal = Math.trunc(Number(minAnswersRequired) || 0);
    if (!Number.isFinite(minVal) || minVal < 1) {
      setUnscrambleErrorMessage("Minimum answers required must be at least 1.");
      setUnscrambleSuccessMessage("");
      return;
    }

    if (minVal > validation.complete.length) {
      setUnscrambleErrorMessage(
        `Minimum answers cannot be more than the number of pairs (${validation.complete.length}).`
      );
      setUnscrambleSuccessMessage("");
      return;
    }

    if (minVal > UNSCRAMBLE_MIN_ANSWERS_MAX) {
      setUnscrambleErrorMessage(`Minimum answers cannot exceed ${UNSCRAMBLE_MIN_ANSWERS_MAX}.`);
      return;
    }

    setIsSaving(true);
    setUnscrambleErrorMessage("");
    setUnscrambleSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            words: minVal,
            unscramble_min_answers: minVal,
            unscramble_title: stageMeta.heading,
            unscramble_subtitle: stageMeta.subheading,
            // Backward-compat alias used by the stage renderer.
            unscramble_instructions: stageMeta.subheading,
            unscramble_rules: stageMeta.rules,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Unscramble settings saved.", "success");
      setUnscrambleSuccessMessage("Settings saved.");
    } catch (err) {
      setUnscrambleErrorMessage(err?.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuizHeadings = async () => {
    const stageMeta = validateStageHeadingSubheading(
      quizHeading,
      quizSubheading,
      "Quiz"
    );
    if (!stageMeta.ok) {
      setQuizErrorMessage(stageMeta.message);
      setQuizSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setQuizErrorMessage("");
    setQuizSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            quiz_title: stageMeta.heading,
            quiz_subtitle: stageMeta.subheading,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Quiz heading saved to theme.", "success");
      setQuizSuccessMessage("Heading saved to theme.");
    } catch (err) {
      setQuizErrorMessage(err?.message || "Failed to save quiz heading.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuizRules = async () => {
    const rulesCheck = validateStageRules(quizRules, "Quiz");
    if (!rulesCheck.ok) {
      setQuizErrorMessage(rulesCheck.message);
      setQuizSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setQuizErrorMessage("");
    setQuizSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            quiz_rules: rulesCheck.rules,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Quiz rules saved to theme.", "success");
      setQuizSuccessMessage("Rules saved to theme.");
    } catch (err) {
      setQuizErrorMessage(err?.message || "Failed to save quiz rules.");
    } finally {
      setIsSaving(false);
    }
  };

  const persistQuizQuestions = async (nextQuestions) => {
    const validation = validateQuizList(
      nextQuestions.map(({ id, ...rest }) => rest)
    );
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    setIsSaving(true);
    setQuizErrorMessage("");
    setQuizSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            quiz: validation.data,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      setQuizQuestions(
        nextQuestions.map((q, i) => ({
          id: q.id || newPairId("quiz"),
          ...validation.data[i],
        }))
      );
    } catch (err) {
      setQuizErrorMessage(err?.message || "Failed to save quiz data.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImageQuizHeadings = async () => {
    const stageMeta = validateStageHeadingSubheading(
      imageQuizHeading,
      imageQuizSubheading,
      "Image Quiz"
    );
    if (!stageMeta.ok) {
      setImageQuizErrorMessage(stageMeta.message);
      setImageQuizSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setImageQuizErrorMessage("");
    setImageQuizSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            image_quiz_title: stageMeta.heading,
            image_quiz_subtitle: stageMeta.subheading,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Image Quiz heading saved to theme.", "success");
      setImageQuizSuccessMessage("Heading saved to theme.");
    } catch (err) {
      setImageQuizErrorMessage(err?.message || "Failed to save image quiz heading.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImageQuizRules = async () => {
    const rulesCheck = validateStageRules(imageQuizRules, "Image Quiz");
    if (!rulesCheck.ok) {
      setImageQuizErrorMessage(rulesCheck.message);
      setImageQuizSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setImageQuizErrorMessage("");
    setImageQuizSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            image_quiz_rules: rulesCheck.rules,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Image Quiz rules saved to theme.", "success");
      setImageQuizSuccessMessage("Rules saved to theme.");
    } catch (err) {
      setImageQuizErrorMessage(err?.message || "Failed to save image quiz rules.");
    } finally {
      setIsSaving(false);
    }
  };

  const persistImageQuizQuestions = async (nextQuestions) => {
    const validation = validateImageQuizList(
      nextQuestions.map(({ id, ...rest }) => rest)
    );
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    setIsSaving(true);
    setImageQuizErrorMessage("");
    setImageQuizSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            image_quiz: validation.data,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      setImageQuizQuestions(
        nextQuestions.map((q, i) => ({
          id: q.id || newPairId("image_quiz"),
          ...validation.data[i],
        }))
      );
    } catch (err) {
      setImageQuizErrorMessage(err?.message || "Failed to save image quiz data.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImageOnlyHeadings = async () => {
    const stageMeta = validateStageHeadingSubheading(
      imageOnlyHeading,
      imageOnlySubheading,
      "Image Only"
    );
    if (!stageMeta.ok) {
      setImageOnlyErrorMessage(stageMeta.message);
      setImageOnlySuccessMessage("");
      return;
    }

    setIsSaving(true);
    setImageOnlyErrorMessage("");
    setImageOnlySuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            image_only_title: stageMeta.heading,
            image_only_subtitle: stageMeta.subheading,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Image Only heading saved to theme.", "success");
      setImageOnlySuccessMessage("Heading saved to theme.");
    } catch (err) {
      setImageOnlyErrorMessage(err?.message || "Failed to save image only heading.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImageOnlyRules = async () => {
    const rulesCheck = validateStageRules(imageOnlyRules, "Image Only");
    if (!rulesCheck.ok) {
      setImageOnlyErrorMessage(rulesCheck.message);
      setImageOnlySuccessMessage("");
      return;
    }

    setIsSaving(true);
    setImageOnlyErrorMessage("");
    setImageOnlySuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            image_only_rules: rulesCheck.rules,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Image Only rules saved to theme.", "success");
      setImageOnlySuccessMessage("Rules saved to theme.");
    } catch (err) {
      setImageOnlyErrorMessage(err?.message || "Failed to save image only rules.");
    } finally {
      setIsSaving(false);
    }
  };

  const persistImageOnlyQuestions = async (nextQuestions) => {
    const validation = validateImageOnlyList(
      nextQuestions.map(({ id, ...rest }) => rest)
    );
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    setIsSaving(true);
    setImageOnlyErrorMessage("");
    setImageOnlySuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            image_only: validation.data,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      setImageOnlyQuestions(
        nextQuestions.map((q, i) => ({
          id: q.id || newPairId("image_only"),
          ...validation.data[i],
        }))
      );
    } catch (err) {
      setImageOnlyErrorMessage(err?.message || "Failed to save image only data.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWordPuzzle = async () => {
    const stageMeta = validateStageHeadingSubheadingAndRules(
      wordPuzzleHeading,
      wordPuzzleSubheading,
      wordPuzzleRules,
      "Word Puzzle"
    );
    if (!stageMeta.ok) {
      setWpErrorMessage(stageMeta.message);
      setWpSuccessMessage("");
      return;
    }

    const validation = validateWordPuzzleEntries(wordPuzzleEntries);
    if (!validation.ok) {
      setWpErrorMessage(validation.message);
      setWpSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setWpErrorMessage("");
    setWpSuccessMessage("");

    try {
      await updateThemeData({
        payload: {
          data: {
            wordpuzzle: {
              words: validation.data,
            },
            wordpuzzle_title: stageMeta.heading,
            wordpuzzle_subtitle: stageMeta.subheading,
            wordpuzzle_rules: stageMeta.rules,
          },
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });

      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Word puzzle saved to theme.", "success");
      setWpSuccessMessage("Saved to theme.");
    } catch (err) {
      setWpErrorMessage(err?.message || "Failed to save word puzzle.");
    } finally {
      setIsSaving(false);
    }
  };

  const clearTabMessages = () => {
    setUnscrambleErrorMessage("");
    setUnscrambleSuccessMessage("");
    setQuizErrorMessage("");
    setQuizSuccessMessage("");
    setWpErrorMessage("");
    setWpSuccessMessage("");
  };

  const changeTab = (tabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tabId === DEFAULT_GAME_TAB) {
          next.delete(GAME_TAB_PARAM);
        } else {
          next.set(GAME_TAB_PARAM, tabId);
        }
        return next;
      },
      { replace: true }
    );
    clearTabMessages();
  };

  if (status === "loading" && !data) {
    return (
      <div className="themeupdate-page">
        <div className="themeupdate-loading">Loading theme data…</div>
      </div>
    );
  }

  return (
    <div className="themeupdate-page">
      <div className="back-button-holder">
        <button type="button" className="back-button" onClick={() => navigate("/admin/rules")}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
      </div>

      <header className="themeupdate-header themeupdate-panel-wide">
        <h1 className="themeupdate-title">Game Content</h1>
        <p className="themeupdate-muted">Manage questions and content for each mini-game in this theme.</p>
      </header>

      <nav className="themeupdate-tabs" aria-label="Game tabs">
        {GAME_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`themeupdate-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => changeTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "wordpuzzle" && (
        <>
          <StageHeadingSubheadingEditor
            stageLabel="Stage 1"
            heading={wordPuzzleHeading}
            setHeading={setWordPuzzleHeading}
            subheading={wordPuzzleSubheading}
            setSubheading={setWordPuzzleSubheading}
          />
          <StageRulesEditor
            stageLabel="Stage 1"
            rules={wordPuzzleRules}
            setRules={setWordPuzzleRules}
          />
          <WordPuzzleTab
            entries={wordPuzzleEntries}
            setEntries={setWordPuzzleEntries}
            isSaving={isSaving}
            onSave={handleSaveWordPuzzle}
            errorMessage={wpErrorMessage}
            successMessage={wpSuccessMessage}
            setErrorMessage={setWpErrorMessage}
            setSuccessMessage={setWpSuccessMessage}
            newEntryId={() => newPairId("wp")}
          />
        </>
      )}
      {activeTab === "unscramble" && (
        <>
          <StageHeadingSubheadingEditor
            stageLabel="Stage 2"
            heading={unscrambleHeading}
            setHeading={setUnscrambleHeading}
            subheading={unscrambleSubheading}
            setSubheading={setUnscrambleSubheading}
          />
          <StageRulesEditor
            stageLabel="Stage 2"
            rules={unscrambleRules}
            setRules={setUnscrambleRules}
          />
          <UnscrambleTab
            pairs={unscramblePairs}
            setPairs={setUnscramblePairs}
            minAnswersRequired={minAnswersRequired}
            setMinAnswersRequired={setMinAnswersRequired}
            isSaving={isSaving}
            onSavePairs={handleSaveUnscramblePairs}
            onSaveSettings={handleSaveUnscrambleSettings}
            errorMessage={unscrambleErrorMessage}
            successMessage={unscrambleSuccessMessage}
            setErrorMessage={setUnscrambleErrorMessage}
            setSuccessMessage={setUnscrambleSuccessMessage}
          />
        </>
      )}
      {activeTab === "quiz" && (
        <>
          <StageHeadingSubheadingEditor
            stageLabel="Stage 3"
            heading={quizHeading}
            setHeading={setQuizHeading}
            subheading={quizSubheading}
            setSubheading={setQuizSubheading}
            onSave={handleSaveQuizHeadings}
            isSaving={isSaving}
            saveLabel="Save heading"
          />
          <StageRulesEditor
            stageLabel="Stage 3"
            rules={quizRules}
            setRules={setQuizRules}
            onSave={handleSaveQuizRules}
            isSaving={isSaving}
            saveLabel="Save rules"
          />
          <QuizTab
            questions={quizQuestions}
            setQuestions={setQuizQuestions}
            isSaving={isSaving}
            onPersist={persistQuizQuestions}
            errorMessage={quizErrorMessage}
            successMessage={quizSuccessMessage}
            setErrorMessage={setQuizErrorMessage}
            setSuccessMessage={setQuizSuccessMessage}
            newQuestionId={() => newPairId("quiz")}
            adminToken={adminToken}
            currentTheme={currentTheme}
            onRefresh={() =>
              dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap()
            }
          />
        </>
      )}
      {activeTab === "image_quiz" && (
        <>
          <StageHeadingSubheadingEditor
            stageLabel="Stage 4"
            heading={imageQuizHeading}
            setHeading={setImageQuizHeading}
            subheading={imageQuizSubheading}
            setSubheading={setImageQuizSubheading}
            onSave={handleSaveImageQuizHeadings}
            isSaving={isSaving}
            saveLabel="Save heading"
          />
          <StageRulesEditor
            stageLabel="Stage 4"
            rules={imageQuizRules}
            setRules={setImageQuizRules}
            onSave={handleSaveImageQuizRules}
            isSaving={isSaving}
            saveLabel="Save rules"
          />
          <ImageQuizTab
            questions={imageQuizQuestions}
            setQuestions={setImageQuizQuestions}
            isSaving={isSaving}
            onPersist={persistImageQuizQuestions}
            errorMessage={imageQuizErrorMessage}
            successMessage={imageQuizSuccessMessage}
            setErrorMessage={setImageQuizErrorMessage}
            setSuccessMessage={setImageQuizSuccessMessage}
            newQuestionId={() => newPairId("image_quiz")}
            adminToken={adminToken}
            currentTheme={currentTheme}
          />
        </>
      )}
      {activeTab === "image_only" && (
        <>
          <StageHeadingSubheadingEditor
            stageLabel="Stage 5"
            heading={imageOnlyHeading}
            setHeading={setImageOnlyHeading}
            subheading={imageOnlySubheading}
            setSubheading={setImageOnlySubheading}
            onSave={handleSaveImageOnlyHeadings}
            isSaving={isSaving}
            saveLabel="Save heading"
          />
          <StageRulesEditor
            stageLabel="Stage 5"
            rules={imageOnlyRules}
            setRules={setImageOnlyRules}
            onSave={handleSaveImageOnlyRules}
            isSaving={isSaving}
            saveLabel="Save rules"
          />
          <ImageOnlyTab
            questions={imageOnlyQuestions}
            setQuestions={setImageOnlyQuestions}
            isSaving={isSaving}
            onPersist={persistImageOnlyQuestions}
            errorMessage={imageOnlyErrorMessage}
            successMessage={imageOnlySuccessMessage}
            setErrorMessage={setImageOnlyErrorMessage}
            setSuccessMessage={setImageOnlySuccessMessage}
            newQuestionId={() => newPairId("image_only")}
            adminToken={adminToken}
            currentTheme={currentTheme}
          />
        </>
      )}
    </div>
  );
};

export default ThemeUpdate;
