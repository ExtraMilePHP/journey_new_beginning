
export async function updateLifelines({ userId, token, lifelines }) {
  const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/updateLifelines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, lifelines }),
  });
  if (!resp.ok) {
    const { message } = await resp.json();
    throw new Error(message || 'Failed to update lifelines');
  }
  return resp.json(); 
}
