// src/utils/fetchUserQuestions.js
export async function fetchUserQuestions({ userId,token }) {
  const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/getUserQuestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({ userId}),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.message || 'Failed to fetch user questions');
  }
  return resp.json(); // { allQuestions, lifelines, points }
}
