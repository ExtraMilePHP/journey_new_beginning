import React from "react";
import Swal from "sweetalert2";

export const WP_MAX_WORDS = 8;
export const WP_WORD_MAX_LEN = 13;
export const WP_MIN_WORDS = 2;

function sanitizeWordPuzzleWord(value) {
  return String(value ?? "").replace(/\d/g, "");
}

export function emptyWordEntry(id) {
  return { id, word: "" };
}

export function normalizeWordEntriesFromTheme(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    list = raw.words || raw.entries || [];
  }
  if (!list.length) {
    return [
      emptyWordEntry(`wp-${Date.now()}-0`),
      emptyWordEntry(`wp-${Date.now()}-1`),
    ];
  }
  return list.map((item, i) => ({
    id: `wp-${i}-${Date.now()}`,
    word: sanitizeWordPuzzleWord(item?.word ?? item?.name ?? "").slice(0, WP_WORD_MAX_LEN),
  }));
}

export function clampWordEntry(entry) {
  return {
    word: sanitizeWordPuzzleWord(entry.word ?? "").trim().slice(0, WP_WORD_MAX_LEN),
  };
}

export function validateWordPuzzleEntries(entries) {
  const filled = entries.map((e) => clampWordEntry(e)).filter((e) => e.word);

  if (entries.some((e) => !String(e.word ?? "").trim()) && filled.length > 0) {
    return { ok: false, message: "Remove empty word rows or fill in every word field." };
  }

  if (filled.length < WP_MIN_WORDS) {
    return { ok: false, message: `Add at least ${WP_MIN_WORDS} word before saving.` };
  }

  if (filled.length > WP_MAX_WORDS) {
    return { ok: false, message: `You can add up to ${WP_MAX_WORDS} words.` };
  }

  const hasNumbers = filled.find((e) => /\d/.test(e.word));
  if (hasNumbers) {
    return { ok: false, message: "Words cannot contain numbers." };
  }

  return {
    ok: true,
    data: filled.map((e) => ({ word: e.word })),
  };
}

export default function WordPuzzleTab({
  entries,
  setEntries,
  isSaving,
  onSave,
  errorMessage,
  successMessage,
  setErrorMessage,
  setSuccessMessage,
  newEntryId,
}) {
  const addMore = () => {
    if (entries.length >= WP_MAX_WORDS) {
      setErrorMessage(`Maximum ${WP_MAX_WORDS} words allowed.`);
      return;
    }
    setEntries((prev) => [...prev, emptyWordEntry(newEntryId())]);
    setErrorMessage("");
  };

  const updateEntry = (id, value) => {
    const sanitized = sanitizeWordPuzzleWord(value).slice(0, WP_WORD_MAX_LEN);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, word: sanitized } : e))
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete this word?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    });
    if (!result.isConfirmed) return;

    setEntries((prev) => {
      if (prev.length <= WP_MIN_WORDS) {
        Swal.fire("Limit", `You need at least ${WP_MIN_WORDS} words.`, "warning");
        return prev;
      }
      return prev.filter((e) => e.id !== id);
    });
    setSuccessMessage("Word removed.");
    setErrorMessage("");
  };

  return (
    <div className="themeupdate-panel-wide wordpuzzle-panel">
      <div className="wordpuzzle-card themeupdate-card">
        <div className="themeupdate-card-header">Words</div>
        <div className="themeupdate-card-body">
          <p className="wordpuzzle-limits">
            * {WP_MIN_WORDS}–{WP_MAX_WORDS} words · Word length — {WP_WORD_MAX_LEN} characters ·
            Numbers not allowed in words
          </p>

          {(errorMessage || successMessage) && (
            <div className="qa-alerts">
              {errorMessage ? <p className="cr-alert cr-alert-error">{errorMessage}</p> : null}
              {successMessage ? <p className="cr-alert cr-alert-success">{successMessage}</p> : null}
            </div>
          )}

          <div className="wordpuzzle-rows">
            {entries.map((entry) => (
              <div key={entry.id} className="wordpuzzle-row">
                <div className="wordpuzzle-field wordpuzzle-field--word">
                  <label htmlFor={`wp-word-${entry.id}`}>Word:</label>
                  <input
                    id={`wp-word-${entry.id}`}
                    type="text"
                    value={entry.word}
                    maxLength={WP_WORD_MAX_LEN}
                    onChange={(e) => updateEntry(entry.id, e.target.value)}
                    placeholder="Word"
                  />
                </div>
                <button
                  type="button"
                  className="wordpuzzle-delete"
                  onClick={() => handleDelete(entry.id)}
                  aria-label="Delete word"
                  title="Delete"
                >
                  <i className="fa-regular fa-trash-can" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="wordpuzzle-add-more"
            onClick={addMore}
            disabled={entries.length >= WP_MAX_WORDS}
          >
            Add More
          </button>

          <div className="wordpuzzle-save-wrap">
            <button
              type="button"
              className="wordpuzzle-save-btn"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
