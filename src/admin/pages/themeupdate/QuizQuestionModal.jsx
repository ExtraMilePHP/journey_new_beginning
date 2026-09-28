import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  QUIZ_OPTION_KEYS,
  QUIZ_OPTION_LABELS,
  QUIZ_OPTION_MAX,
  clampQuizFields,
  emptyQuizQuestion,
  getQuizOptionValues,
  validateQuizRow,
} from "./quizHelpers";
import { validateQuizAudioFile } from "./quizAudioUpload";
import { getDvSourceImageUrl } from "../../../functions/themeAssets";

export default function QuizQuestionModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  isSaving,
  savingLabel,
}) {
  const audioInputRef = useRef(null);
  const [draft, setDraft] = useState(() => emptyQuizQuestion("temp"));
  const [localError, setLocalError] = useState("");
  const [pendingAudioFile, setPendingAudioFile] = useState(null);
  const [pendingAudioPreview, setPendingAudioPreview] = useState("");

  useEffect(() => {
    if (!open) return;
    const base = initial
      ? { id: initial.id, ...clampQuizFields(initial) }
      : emptyQuizQuestion(`new-${Date.now()}`);
    setDraft(base);
    setLocalError("");
    setPendingAudioFile(null);
    setPendingAudioPreview("");
    if (audioInputRef.current) audioInputRef.current.value = "";
  }, [open, mode, initial]);

  useEffect(() => {
    return () => {
      if (pendingAudioPreview) URL.revokeObjectURL(pendingAudioPreview);
    };
  }, [pendingAudioPreview]);

  const savedAudioUrl = useMemo(() => {
    if (!draft.audio_file) return "";
    return getDvSourceImageUrl(draft.audio_file);
  }, [draft.audio_file]);

  const previewAudioUrl = pendingAudioPreview || savedAudioUrl;

  if (!open) return null;

  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value.slice(0, QUIZ_OPTION_MAX) }));
    setLocalError("");
  };

  const handleAudioPick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const check = validateQuizAudioFile(file);
    if (!check.ok) {
      setLocalError(check.message);
      return;
    }

    if (pendingAudioPreview) URL.revokeObjectURL(pendingAudioPreview);
    setPendingAudioFile(file);
    setPendingAudioPreview(URL.createObjectURL(file));
    setLocalError("");
  };

  const clearPendingAudio = () => {
    if (pendingAudioPreview) URL.revokeObjectURL(pendingAudioPreview);
    setPendingAudioFile(null);
    setPendingAudioPreview("");
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const finalize = async () => {
    setLocalError("");

    const hasAudio = Boolean(pendingAudioFile || String(draft.audio_file ?? "").trim());
    const check = validateQuizRow(
      { ...draft, audio_file: hasAudio ? draft.audio_file || "pending" : "" },
      "",
      { requireAudio: !pendingAudioFile }
    );
    if (!check.ok) {
      setLocalError(check.message);
      return;
    }

    if (!pendingAudioFile && !String(draft.audio_file ?? "").trim()) {
      setLocalError("Audio file is required.");
      return;
    }

    try {
      await onSubmit(
        { id: draft.id, ...check.data, audio_file: draft.audio_file },
        pendingAudioFile
      );
    } catch {
      /* parent surfaces error */
    }
  };

  const isEdit = mode === "edit";

  return (
    <div className="quiz-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="quiz-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quiz-modal-header">
          <h2 id="quiz-modal-title">{isEdit ? "Edit Question" : "New Question"}</h2>
          <button type="button" className="quiz-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="quiz-modal-body">
          {localError ? <p className="cr-alert cr-alert-error quiz-modal-error">{localError}</p> : null}

          <div className="quiz-modal-field quiz-modal-field--full">
            <label htmlFor="quiz-modal-audio">Audio clip</label>
            <div className="quiz-modal-audio-row">
              <label className="quiz-toolbar-btn quiz-upload-label quiz-modal-audio-btn">
                <i className="fa-solid fa-upload" aria-hidden /> Choose audio
                <input
                  ref={audioInputRef}
                  id="quiz-modal-audio"
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg,audio/*"
                  className="quiz-upload-input"
                  onChange={handleAudioPick}
                  disabled={isSaving}
                />
              </label>
              {pendingAudioFile ? (
                <button
                  type="button"
                  className="quiz-modal-btn quiz-modal-btn-close"
                  onClick={clearPendingAudio}
                  disabled={isSaving}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
            <p className="quiz-modal-limit">
              Allowed: MP3, M4A, WAV, or OGG · max 2 MB. This audio replaces the question text in
              the game.
            </p>
            {previewAudioUrl ? (
              <audio className="quiz-modal-audio-player" controls src={previewAudioUrl}>
                Your browser does not support audio playback.
              </audio>
            ) : (
              <p className="themeupdate-muted">No audio selected yet.</p>
            )}
            {draft.audio_file && !pendingAudioFile ? (
              <p className="quiz-modal-limit">Saved file: {draft.audio_file}</p>
            ) : null}
          </div>

          <div className="quiz-modal-options-grid quiz-modal-options-grid--four">
            {QUIZ_OPTION_KEYS.map((key, i) => (
              <div key={key} className="quiz-modal-field">
                <label htmlFor={`quiz-modal-${key}`}>{QUIZ_OPTION_LABELS[i]}</label>
                <input
                  id={`quiz-modal-${key}`}
                  type="text"
                  value={draft[key]}
                  maxLength={QUIZ_OPTION_MAX}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={QUIZ_OPTION_LABELS[i]}
                />
                <p className="quiz-modal-limit">Max length {QUIZ_OPTION_MAX} characters</p>
              </div>
            ))}
          </div>

          <div className="quiz-modal-field quiz-modal-field--full">
            <span className="quiz-modal-correct-label">Correct answer</span>
            {getQuizOptionValues(draft).length ? (
              <div className="quiz-modal-correct-options">
                {QUIZ_OPTION_KEYS.map((key) => {
                  const label = String(draft[key] ?? "").trim();
                  if (!label) return null;
                  return (
                    <label key={key} className="quiz-modal-correct-option">
                      <input
                        type="radio"
                        name="quiz-correct-answer"
                        value={label}
                        checked={draft.correct_answer === label}
                        onChange={() => {
                          setDraft((prev) => ({ ...prev, correct_answer: label }));
                          setLocalError("");
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="themeupdate-muted">Fill in all four options to choose the correct answer.</p>
            )}
          </div>
        </div>

        <div className="quiz-modal-footer">
          <button
            type="button"
            className="quiz-modal-btn quiz-modal-btn-save"
            onClick={finalize}
            disabled={isSaving}
          >
            <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
            {isSaving ? savingLabel || "Saving…" : isEdit ? "Update" : "Add New Question"}
          </button>
          <button type="button" className="quiz-modal-btn quiz-modal-btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
