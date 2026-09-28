export async function uploadThemeMedia({ formData, token }) {
  const resp = await fetch(
    `${process.env.REACT_APP_BACKEND_URL}/updateThemeMedia`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || err.message || "Failed to upload theme media");
  }

  return resp.json();
}
