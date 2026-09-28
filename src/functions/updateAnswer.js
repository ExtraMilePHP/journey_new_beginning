export async function updateAnswer({
  userId,
  current,
  timerTime,
  isQuizCompleted,
  token,
  points,
  userData
}) {
  const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/updateAnswer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      current,         // new current question index
      timerTime,       // seconds elapsed for this question (e.g. 10)
      isQuizCompleted, // boolean flag
      points,
      userData
    }),
  });

  if (!resp.ok) {
    const { message } = await resp.json();
    throw new Error(message || 'Failed to update answer');
  }

  return resp.json();
}
