import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  IMAGE_QUIZ_OPTION_KEYS,
  IMAGE_QUIZ_OPTION_LABELS,
  IMAGE_QUIZ_OPTION_MAX,
  clampImageQuizFields,
  emptyImageQuizQuestion,
  getImageQuizOptionValues,
  validateImageQuizRow,
} from "./imageQuizHelpers";
import { validateImageQuizImageFile } from "./imageQuizImageUpload";
import { getDvSourceImageUrl } from "../../../functions/themeAssets";

export default function ImageQuizQuestionModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  isSaving,
  savingLabel,
}) {
  const imageInputRef = useRef(null);
  const [draft, setDraft] = useState(() => emptyImageQuizQuestion("temp"));
  const [localError, setLocalError] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState("");

  useEffect(() => {
    if (!open) return;
    const base = initial
      ? { id: initial.id, ...clampImageQuizFields(initial) }
      : emptyImageQuizQuestion(`new-${Date.now()}`);
    setDraft(base);
    setLocalError("");
    setPendingImageFile(null);
    setPendingImagePreview("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, [open, mode, initial]);

  useEffect(() => {
    return () => {
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    };
  }, [pendingImagePreview]);

  const savedImageUrl = useMemo(() => {
    if (!draft.image_file) return "";
    return getDvSourceImageUrl(draft.image_file);
  }, [draft.image_file]);

  const previewImageUrl = pendingImagePreview || savedImageUrl;

  if (!open) return null;

  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value.slice(0, IMAGE_QUIZ_OPTION_MAX) }));
    setLocalError("");
  };

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const check = validateImageQuizImageFile(file);
    if (!check.ok) {
      setLocalError(check.message);
      return;
    }

    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImageFile(file);
    setPendingImagePreview(URL.createObjectURL(file));
    setLocalError("");
  };

  const clearPendingImage = () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImageFile(null);
    setPendingImagePreview("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const finalize = async () => {
    setLocalError("");

    const hasImage = Boolean(pendingImageFile || String(draft.image_file ?? "").trim());
    const check = validateImageQuizRow(
      { ...draft, image_file: hasImage ? draft.image_file || "pending" : "" },
      "",
      { requireImage: !pendingImageFile }
    );
    if (!check.ok) {
      setLocalError(check.message);
      return;
    }

    if (!pendingImageFile && !String(draft.image_file ?? "").trim()) {
      setLocalError("Image file is required.");
      return;
    }

    try {
      await onSubmit(
        { id: draft.id, ...check.data, image_file: draft.image_file },
        pendingImageFile
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
        aria-labelledby="image-quiz-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quiz-modal-header">
          <h2 id="image-quiz-modal-title">{isEdit ? "Edit Question" : "New Question"}</h2>
          <button type="button" className="quiz-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="quiz-modal-body">
          {localError ? <p className="cr-alert cr-alert-error quiz-modal-error">{localError}</p> : null}

          <div className="quiz-modal-field quiz-modal-field--full">
            <label htmlFor="image-quiz-modal-image">Question image</label>
            <div className="quiz-modal-audio-row">
              <label className="quiz-toolbar-btn quiz-upload-label quiz-modal-audio-btn">
                <i className="fa-solid fa-upload" aria-hidden /> Choose image
                <input
                  ref={imageInputRef}
                  id="image-quiz-modal-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  className="quiz-upload-input"
                  onChange={handleImagePick}
                  disabled={isSaving}
                />
              </label>
              {pendingImageFile ? (
                <button
                  type="button"
                  className="quiz-modal-btn quiz-modal-btn-close"
                  onClick={clearPendingImage}
                  disabled={isSaving}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
            <p className="quiz-modal-limit">
              Allowed: JPG, JPEG, or PNG · max 5 MB. This image is shown as the question prompt in
              the game.
            </p>
            {previewImageUrl ? (
              <img
                className="quiz-modal-image-preview"
                src={previewImageUrl}
                alt="Question preview"
              />
            ) : (
              <p className="themeupdate-muted">No image selected yet.</p>
            )}
            {draft.image_file && !pendingImageFile ? (
              <p className="quiz-modal-limit">Saved file: {draft.image_file}</p>
            ) : null}
          </div>

          <div className="quiz-modal-options-grid quiz-modal-options-grid--four">
            {IMAGE_QUIZ_OPTION_KEYS.map((key, i) => (
              <div key={key} className="quiz-modal-field">
                <label htmlFor={`image-quiz-modal-${key}`}>{IMAGE_QUIZ_OPTION_LABELS[i]}</label>
                <input
                  id={`image-quiz-modal-${key}`}
                  type="text"
                  value={draft[key]}
                  maxLength={IMAGE_QUIZ_OPTION_MAX}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={IMAGE_QUIZ_OPTION_LABELS[i]}
                />
                <p className="quiz-modal-limit">Max length {IMAGE_QUIZ_OPTION_MAX} characters</p>
              </div>
            ))}
          </div>

          <div className="quiz-modal-field quiz-modal-field--full">
            <span className="quiz-modal-correct-label">Correct answer</span>
            {getImageQuizOptionValues(draft).length ? (
              <div className="quiz-modal-correct-options">
                {IMAGE_QUIZ_OPTION_KEYS.map((key) => {
                  const label = String(draft[key] ?? "").trim();
                  if (!label) return null;
                  return (
                    <label key={key} className="quiz-modal-correct-option">
                      <input
                        type="radio"
                        name="image-quiz-correct-answer"
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
