import { uploadThemeMedia } from "../../functions/uploadThemeMedia";

const QUIZ_AUDIO_MAX_MB = 2;
const QUIZ_AUDIO_EXT = ["mp3", "m4a", "wav", "ogg"];

export const QUIZ_AUDIO_FIELD = "quiz_audio";

export function renameFileForUpload(file) {
  if (!file || !(file instanceof Blob)) return file;
  const original = file.name || "audio";
  const lastDot = original.lastIndexOf(".");
  const ext = lastDot >= 0 ? original.slice(lastDot) : "";
  const base = lastDot >= 0 ? original.slice(0, lastDot) : original;
  const id = `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
  const newName = `${id}-${base}${ext}`;
  return new File([file], newName, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

export function validateQuizAudioFile(file) {
  if (!file) return { ok: false, message: "Please choose an audio file." };
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!QUIZ_AUDIO_EXT.includes(ext)) {
    return {
      ok: false,
      message: `Unsupported format for ${file.name}. Use MP3, M4A, WAV, or OGG.`,
    };
  }
  if (file.size > QUIZ_AUDIO_MAX_MB * 1024 * 1024) {
    return {
      ok: false,
      message: `${file.name} exceeds ${QUIZ_AUDIO_MAX_MB}MB.`,
    };
  }
  return { ok: true };
}

/**
 * Upload quiz audio to S3 (same pattern as bug_smasher splash_sound upload).
 * Returns the stored filename to save on the quiz row in themeset.
 */
export async function uploadQuizAudioFile({ file, adminToken, currentTheme }) {
  const check = validateQuizAudioFile(file);
  if (!check.ok) throw new Error(check.message);

  const renamed = renameFileForUpload(file);
  const formData = new FormData();
  formData.append("themeName", currentTheme);
  formData.append("uploadOnly", "true");
  formData.append(QUIZ_AUDIO_FIELD, renamed);

  const data = await uploadThemeMedia({ formData, token: adminToken });
  const filename = data?.uploaded_files?.[QUIZ_AUDIO_FIELD];
  if (!filename) {
    throw new Error("Audio upload failed — no filename returned from server.");
  }
  return filename;
}
