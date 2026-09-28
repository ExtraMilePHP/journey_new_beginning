import { uploadThemeMedia } from "../../functions/uploadThemeMedia";

const IMAGE_QUIZ_MAX_MB = 5;
const IMAGE_QUIZ_EXT = ["jpg", "jpeg", "png"];

export const IMAGE_QUIZ_FIELD = "image_quiz_image";

export function renameFileForUpload(file) {
  if (!file || !(file instanceof Blob)) return file;
  const original = file.name || "image";
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

export function validateImageQuizImageFile(file) {
  if (!file) return { ok: false, message: "Please choose an image file." };
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!IMAGE_QUIZ_EXT.includes(ext)) {
    return {
      ok: false,
      message: `Unsupported format for ${file.name}. Use JPG, JPEG, or PNG.`,
    };
  }
  if (file.size > IMAGE_QUIZ_MAX_MB * 1024 * 1024) {
    return {
      ok: false,
      message: `${file.name} exceeds ${IMAGE_QUIZ_MAX_MB}MB.`,
    };
  }
  return { ok: true };
}

export async function uploadImageQuizImageFile({ file, adminToken, currentTheme }) {
  const check = validateImageQuizImageFile(file);
  if (!check.ok) throw new Error(check.message);

  const renamed = renameFileForUpload(file);
  const formData = new FormData();
  formData.append("themeName", currentTheme);
  formData.append("uploadOnly", "true");
  formData.append(IMAGE_QUIZ_FIELD, renamed);

  const data = await uploadThemeMedia({ formData, token: adminToken });
  const filename = data?.uploaded_files?.[IMAGE_QUIZ_FIELD];
  if (!filename) {
    throw new Error("Image upload failed — no filename returned from server.");
  }
  return filename;
}
