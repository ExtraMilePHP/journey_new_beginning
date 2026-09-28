// src/utils/initQuestions.js


export async function initQuestions({ userId, email, fullName, themeName,token }) {
  // grab token from Redux


  const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/setUserQuestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      email,
      fullName,
      themeName,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.message || 'Failed to initialize questions');
  }
  return resp.json();
}
