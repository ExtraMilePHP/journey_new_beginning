import React, { useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";

import QuizQuestionModal from "./QuizQuestionModal";
import {
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_QUESTIONS,
  QUIZ_SAVE_MIN_QUESTIONS,
  QUIZ_PAGE_SIZES,
  downloadSampleQuizCsv,
  exportQuizCsv,
  parseQuizCsv,
  validateQuizRow,
  validateQuizRowForImport,
} from "./quizHelpers";
import { uploadQuizAudioFile } from "./quizAudioUpload";

function truncate(text, max = 80) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function QuizTab({
  questions,
  setQuestions,
  isSaving,
  onPersist,
  errorMessage,
  successMessage,
  setErrorMessage,
  setSuccessMessage,
  newQuestionId,
  adminToken,
  currentTheme,
  onRefresh,
}) {
  const fileInputRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("option_one");
  const [sortDir, setSortDir] = useState("asc");
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  const persistList = async (nextList, message) => {
    setErrorMessage("");
    try {
      await onPersist(nextList);
      setQuestions(nextList);
      if (message) setSuccessMessage(message);
    } catch (err) {
      setErrorMessage(err?.message || "Failed to save questions.");
      throw err;
    }
  };

  const saveMessage = (action, count) => {
    if (count < QUIZ_MIN_QUESTIONS) {
      const remaining = QUIZ_MIN_QUESTIONS - count;
      return `Saved to theme. Add ${remaining} more question${remaining === 1 ? "" : "s"} for the game (minimum ${QUIZ_MIN_QUESTIONS}).`;
    }
    if (action === "edit") return "Question updated and saved.";
    if (action === "delete") return "Question deleted.";
    return "Question added and saved.";
  };

  const openAdd = () => {
    if (questions.length >= QUIZ_MAX_QUESTIONS) {
      setErrorMessage(`You can add up to ${QUIZ_MAX_QUESTIONS} questions.`);
      return;
    }
    setErrorMessage("");
    setModalMode("add");
    setEditingQuestion(null);
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setErrorMessage("");
    setModalMode("edit");
    setEditingQuestion(q);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingQuestion(null);
  };

  const handleModalSubmit = async (row, pendingAudioFile) => {
    const rowId = row.id || newQuestionId();
    let next;
    if (modalMode === "add") {
      next = [...questions, { id: rowId, ...row }];
    } else {
      next = questions.map((q) => (q.id === row.id ? { id: q.id, ...row } : q));
    }

    setErrorMessage("");

    if (pendingAudioFile) {
      if (!adminToken || !currentTheme) {
        setErrorMessage("Cannot upload audio — admin session or theme is missing.");
        return;
      }

      const rowCheck = validateQuizRow(row, "", { requireAudio: false });
      if (!rowCheck.ok) {
        setErrorMessage(rowCheck.message);
        return;
      }

      try {
        setErrorMessage("");
        setSuccessMessage("");
        setIsUploadingAudio(true);
        const audioFile = await uploadQuizAudioFile({
          file: pendingAudioFile,
          adminToken,
          currentTheme,
        });

        const updatedRow = { ...rowCheck.data, audio_file: audioFile };
        if (modalMode === "add") {
          next = [...questions, { id: rowId, ...updatedRow }];
        } else {
          next = questions.map((q) =>
            q.id === row.id ? { id: q.id, ...updatedRow } : q
          );
        }

        await persistList(next, saveMessage(modalMode === "edit" ? "edit" : "add", next.length));
        closeModal();
      } catch (err) {
        setErrorMessage(err?.message || "Failed to upload quiz audio.");
      } finally {
        setIsUploadingAudio(false);
      }
      return;
    }

    await persistList(next, saveMessage(modalMode === "edit" ? "edit" : "add", next.length));
    closeModal();
  };

  const handleDelete = async (q) => {
    const result = await Swal.fire({
      title: "Delete question?",
      text: "This question will be removed from the theme.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    });
    if (!result.isConfirmed) return;

    if (questions.length <= QUIZ_SAVE_MIN_QUESTIONS) {
      setErrorMessage(`You need at least ${QUIZ_SAVE_MIN_QUESTIONS} question in the theme.`);
      return;
    }

    const next = questions.filter((row) => row.id !== q.id);
    await persistList(next, saveMessage("delete", next.length));
  };

  const showCsvUploadError = (message, options = {}) => {
    const { code } = options;
    const isCharLimit = code === "CHAR_LIMIT" || /Maximum allowed is \d+ characters/i.test(message);
    const title = isCharLimit ? "Character limit exceeded" : "CSV upload failed";
    setSuccessMessage("");
    setErrorMessage(message);
    Swal.fire({
      icon: "error",
      title,
      text: message,
      confirmButtonText: "OK",
      confirmButtonColor: "#39b467",
    });
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!/\.csv$/i.test(file.name)) {
      showCsvUploadError("Please upload a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = parseQuizCsv(reader.result);

        if (parsed.length < QUIZ_MIN_QUESTIONS) {
          showCsvUploadError(
            `CSV has ${parsed.length} questions. At least ${QUIZ_MIN_QUESTIONS} are required.`
          );
          return;
        }

        if (parsed.length > QUIZ_MAX_QUESTIONS) {
          showCsvUploadError(
            `CSV has ${parsed.length} questions. Maximum allowed is ${QUIZ_MAX_QUESTIONS}.`
          );
          return;
        }

        const validated = [];
        for (let i = 0; i < parsed.length; i++) {
          const result = validateQuizRowForImport(parsed[i], `CSV row ${i + 2}`);
          if (!result.ok) {
            showCsvUploadError(result.message, { code: result.code });
            return;
          }
          validated.push({ id: newQuestionId(), ...result.data });
        }

        const missingAudio = validated.some((row) => !String(row.audio_file ?? "").trim());
        if (missingAudio) {
          setErrorMessage("");
          setQuestions(validated);
          setSuccessMessage(
            "CSV imported into the table. Upload an audio clip for each question, then save by editing or re-importing with audio_file paths."
          );
          setPage(1);
          return;
        }

        setErrorMessage("");
        await persistList(
          validated,
          `Replaced all questions with ${validated.length} imported from CSV.`
        );
        setPage(1);
      } catch (err) {
        showCsvUploadError(err?.message || "Failed to parse CSV.");
      }
    };
    reader.onerror = () => showCsvUploadError("Could not read the CSV file.");
    reader.readAsText(file);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...questions];
    if (q) {
      list = list.filter(
        (row) =>
          row.audio_file?.toLowerCase().includes(q) ||
          row.correct_answer?.toLowerCase().includes(q) ||
          row.option_one?.toLowerCase().includes(q) ||
          row.option_two?.toLowerCase().includes(q) ||
          row.option_three?.toLowerCase().includes(q) ||
          row.option_four?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [questions, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="themeupdate-panel-wide quiz-panel">
      <div className="quiz-page-header">
        <h2 className="quiz-page-title">Add Questions</h2>
        <div className="quiz-toolbar">
          <button type="button" className="quiz-toolbar-btn" onClick={openAdd}>
            <i className="fa-solid fa-plus" aria-hidden /> Add Question
          </button>
          <label className="quiz-toolbar-btn quiz-upload-label">
            <i className="fa-solid fa-upload" aria-hidden /> Upload CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="quiz-upload-input"
              onChange={handleCsvUpload}
              disabled={isSaving}
            />
          </label>
          <button
            type="button"
            className="quiz-toolbar-btn"
            onClick={() => exportQuizCsv(questions)}
            disabled={!questions.length}
          >
            <i className="fa-regular fa-file-lines" aria-hidden /> Export CSV
          </button>
          <button type="button" className="quiz-toolbar-btn" onClick={downloadSampleQuizCsv}>
            <i className="fa-solid fa-download" aria-hidden /> Sample CSV
          </button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className="qa-alerts">
          {errorMessage ? <p className="cr-alert cr-alert-error">{errorMessage}</p> : null}
          {successMessage ? <p className="cr-alert cr-alert-success">{successMessage}</p> : null}
        </div>
      )}

      {questions.length > 0 && questions.length < QUIZ_MIN_QUESTIONS ? (
        <p className="cr-alert cr-alert-info quiz-min-hint">
          {questions.length} question{questions.length === 1 ? "" : "s"} saved. Add{" "}
          {QUIZ_MIN_QUESTIONS - questions.length} more for the game (minimum {QUIZ_MIN_QUESTIONS}).
        </p>
      ) : null}

      <div className="quiz-table-card themeupdate-card">
        <div className="quiz-table-controls">
          <label className="quiz-table-show">
            Show{" "}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {QUIZ_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>{" "}
            entries
          </label>
          <label className="quiz-table-search">
            Search:{" "}
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder=""
            />
          </label>
        </div>

        <div className="quiz-table-wrap">
          <table className="quiz-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Audio</th>
                <th>
                  <button type="button" className="quiz-th-sort" onClick={() => toggleSort("option_one")}>
                    Option 1{sortIcon("option_one")}
                  </button>
                </th>
                <th>
                  <button type="button" className="quiz-th-sort" onClick={() => toggleSort("option_two")}>
                    Option 2{sortIcon("option_two")}
                  </button>
                </th>
                <th>
                  <button type="button" className="quiz-th-sort" onClick={() => toggleSort("option_three")}>
                    Option 3{sortIcon("option_three")}
                  </button>
                </th>
                <th>
                  <button type="button" className="quiz-th-sort" onClick={() => toggleSort("option_four")}>
                    Option 4{sortIcon("option_four")}
                  </button>
                </th>
                <th>Correct answer</th>
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="quiz-table-empty">
                    No questions yet. Click <strong>Add Question</strong> or upload a CSV.
                  </td>
                </tr>
              ) : (
                pageRows.map((q, idx) => (
                  <tr key={q.id}>
                    <td>{(safePage - 1) * pageSize + idx + 1}</td>
                    <td className="quiz-cell-audio" title={q.audio_file}>
                      {q.audio_file ? truncate(q.audio_file, 28) : <em>No audio</em>}
                    </td>
                    <td title={q.option_one}>{truncate(q.option_one, 40)}</td>
                    <td title={q.option_two}>{truncate(q.option_two, 40)}</td>
                    <td title={q.option_three}>{truncate(q.option_three, 40)}</td>
                    <td title={q.option_four}>{truncate(q.option_four, 40)}</td>
                    <td className="quiz-correct-badge" title={q.correct_answer}>
                      {truncate(q.correct_answer, 40) || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="quiz-table-btn quiz-table-btn-edit"
                        onClick={() => openEdit(q)}
                      >
                        <i className="fa-solid fa-pencil" aria-hidden /> Edit
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="quiz-table-btn quiz-table-btn-delete"
                        onClick={() => handleDelete(q)}
                        disabled={isSaving}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="quiz-table-footer">
          <span className="quiz-table-info">
            Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
            {search ? ` (filtered from ${questions.length})` : ""}
          </span>
          <div className="quiz-table-pager">
            <button
              type="button"
              className="quiz-pager-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="quiz-pager-num">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="quiz-pager-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <QuizQuestionModal
        open={modalOpen}
        mode={modalMode}
        initial={editingQuestion}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        isSaving={isSaving || isUploadingAudio}
        savingLabel={isUploadingAudio ? "Uploading audio…" : undefined}
      />
    </div>
  );
}
