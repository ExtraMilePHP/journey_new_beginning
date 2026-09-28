
export async function fetchReport({ userId, token }) {
  const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/fetchReport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  });
  if (!resp.ok) {
    const { message } = await resp.json();
    throw new Error(message || 'Failed to update lifelines');
  }
  return resp.json(); 
}
