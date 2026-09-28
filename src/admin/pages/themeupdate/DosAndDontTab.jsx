import React, { useState } from "react";
import Swal from "sweetalert2";

export const DOS_DONT_STATEMENT_MAX = 100;
export const DOS_DONT_MAX_EACH = 5;
export const DOS_DONT_MIN_EACH = 2;

export function emptyStatement(id) {
  return { id, text: "" };
}

export function normalizeStatementsFromTheme(raw) {
  const list = Array.isArray(raw) ? raw : [];
  if (!list.length) {
    return [emptyStatement(`empty-${Date.now()}-0`), emptyStatement(`empty-${Date.now()}-1`)];
  }
  return list.map((item, i) => ({
    id: `stmt-${i}-${Date.now()}`,
    text: String(typeof item === "string" ? item : item?.statement ?? item?.text ?? "").slice(
      0,
      DOS_DONT_STATEMENT_MAX
    ),
  }));
}

export function validateStatementsList(items, label) {
  if (items.some((s) => !String(s.text ?? "").trim())) {
    return { ok: false, message: `Fill in all ${label} fields or remove empty statements.` };
  }

  const texts = items.map((s) => String(s.text ?? "").trim());

  if (texts.length < DOS_DONT_MIN_EACH) {
    return {
      ok: false,
      message: `Add at least ${DOS_DONT_MIN_EACH} ${label} statement before saving.`,
    };
  }

  if (texts.length > DOS_DONT_MAX_EACH) {
    return { ok: false, message: `You can save up to ${DOS_DONT_MAX_EACH} ${label} statements.` };
  }

  const tooLong = texts.find((t) => t.length > DOS_DONT_STATEMENT_MAX);
  if (tooLong) {
    return {
      ok: false,
      message: `Each ${label} statement must be ${DOS_DONT_STATEMENT_MAX} characters or fewer.`,
    };
  }

  return { ok: true, data: texts };
}

function StatementColumn({
  title,
  variant,
  items,
  setItems,
  editingId,
  setEditingId,
  newId,
  onAdd,
}) {
  const updateText = (id, value) => {
    setItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: value.slice(0, DOS_DONT_STATEMENT_MAX) } : s))
    );
  };

  const startEdit = (id) => {
    setEditingId(id);
  };

  const cancelEdit = (id) => {
    const item = items.find((s) => s.id === id);
    if (item && !item.text.trim() && items.length > DOS_DONT_MIN_EACH) {
      setItems((prev) => prev.filter((s) => s.id !== id));
    }
    setEditingId(null);
  };

  const saveEdit = (id) => {
    const item = items.find((s) => s.id === id);
    if (!item?.text.trim()) return;
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete statement?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    });
    if (!result.isConfirmed) return;
    if (items.length <= DOS_DONT_MIN_EACH) {
      Swal.fire("Limit", `You need at least ${DOS_DONT_MIN_EACH} ${title} statements.`, "warning");
      return;
    }
    setItems((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const renderCard = (item, index) => {
    const isEditing = editingId === item.id;

    return (
      <div
        key={item.id}
        className={`dos-dont-card dos-dont-card--${variant}${isEditing ? " is-editing" : ""}`}
      >
        <div className="dos-dont-card-head">
          <span className="dos-dont-card-num">{index + 1}</span>
          <div className="dos-dont-card-actions">
            {!isEditing ? (
              <button type="button" className="qa-btn qa-btn-outline qa-btn-sm" onClick={() => startEdit(item.id)}>
                Edit
              </button>
            ) : (
              <button type="button" className="qa-btn qa-btn-outline qa-btn-sm" onClick={() => saveEdit(item.id)}>
                Done
              </button>
            )}
            <button
              type="button"
              className="qa-btn qa-btn-outline qa-btn-sm dos-dont-btn-delete"
              onClick={() => handleDelete(item.id)}
              aria-label="Delete"
            >
              <i className="fa-regular fa-trash-can" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <>
            <label htmlFor={`stmt-${item.id}`}>Statement</label>
            <textarea
              id={`stmt-${item.id}`}
              className="dos-dont-textarea"
              value={item.text}
              maxLength={DOS_DONT_STATEMENT_MAX}
              onChange={(e) => updateText(item.id, e.target.value)}
              placeholder={`Enter a ${title.toLowerCase()} statement`}
              rows={3}
            />
            <p className="dos-dont-limit">Max length {DOS_DONT_STATEMENT_MAX} characters</p>
            <button type="button" className="qa-btn qa-btn-ghost qa-btn-sm" onClick={() => cancelEdit(item.id)}>
              Cancel
            </button>
          </>
        ) : (
          <p className="dos-dont-preview">{item.text.trim() || <em>Empty — click Edit to add text</em>}</p>
        )}
      </div>
    );
  };

  return (
    <div className={`dos-dont-col dos-dont-col--${variant}`}>
      <div className="dos-dont-col-header">
        <h3>{title}</h3>
        <button type="button" className="qa-btn qa-btn-outline" onClick={onAdd}>
          Add {title}
        </button>
      </div>
      <div className="dos-dont-col-list">{items.map(renderCard)}</div>
    </div>
  );
}

export default function DosAndDontTab({
  dosItems,
  setDosItems,
  dontItems,
  setDontItems,
  isSaving,
  onSave,
  errorMessage,
  successMessage,
  setErrorMessage,
  setSuccessMessage,
  newStatementId,
}) {
  const [editingDosId, setEditingDosId] = useState(null);
  const [editingDontId, setEditingDontId] = useState(null);

  const addDo = () => {
    if (dosItems.length >= DOS_DONT_MAX_EACH) {
      setErrorMessage(`You can add up to ${DOS_DONT_MAX_EACH} Do statements.`);
      return;
    }
    const id = newStatementId();
    setDosItems((prev) => [...prev, emptyStatement(id)]);
    setEditingDosId(id);
    setErrorMessage("");
  };

  const addDont = () => {
    if (dontItems.length >= DOS_DONT_MAX_EACH) {
      setErrorMessage(`You can add up to ${DOS_DONT_MAX_EACH} Don't statements.`);
      return;
    }
    const id = newStatementId();
    setDontItems((prev) => [...prev, emptyStatement(id)]);
    setEditingDontId(id);
    setErrorMessage("");
  };

  const clearAll = async () => {
    const result = await Swal.fire({
      title: "Clear all statements?",
      text: "This will remove all Do and Don't entries in the editor (not saved until you confirm save).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    const doId1 = newStatementId();
    const doId2 = newStatementId();
    const dontId1 = newStatementId();
    const dontId2 = newStatementId();
    setDosItems([emptyStatement(doId1), emptyStatement(doId2)]);
    setDontItems([emptyStatement(dontId1), emptyStatement(dontId2)]);
    setEditingDosId(doId1);
    setEditingDontId(dontId1);
    setSuccessMessage("");
    setErrorMessage("");
  };

  return (
    <div className="themeupdate-panel-wide dos-dont-panel">
      <p className="qa-char-limit-hint">
        * Up to {DOS_DONT_MAX_EACH} statements each · {DOS_DONT_STATEMENT_MAX} characters max per statement ·
        Add at least {DOS_DONT_MIN_EACH} Do and {DOS_DONT_MIN_EACH} Don't statements before saving.
      </p>

      {(errorMessage || successMessage) && (
        <div className="qa-alerts">
          {errorMessage ? <p className="cr-alert cr-alert-error">{errorMessage}</p> : null}
          {successMessage ? <p className="cr-alert cr-alert-success">{successMessage}</p> : null}
        </div>
      )}

      <div className="dos-dont-columns">
        <StatementColumn
          title="Do"
          variant="do"
          items={dosItems}
          setItems={setDosItems}
          editingId={editingDosId}
          setEditingId={setEditingDosId}
          newId={newStatementId}
          onAdd={addDo}
        />
        <StatementColumn
          title="Don't"
          variant="dont"
          items={dontItems}
          setItems={setDontItems}
          editingId={editingDontId}
          setEditingId={setEditingDontId}
          newId={newStatementId}
          onAdd={addDont}
        />
      </div>

      <div className="qa-pairs-actions">
        <button type="button" className="qa-btn qa-btn-primary" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save and Continue"}
        </button>
        <button type="button" className="qa-btn qa-btn-primary" onClick={clearAll} disabled={isSaving}>
          Clear All
        </button>
      </div>
    </div>
  );
}
