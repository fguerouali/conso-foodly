export function authHeader() {
  const token = sessionStorage.getItem('foodly-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader(),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/login') {
    sessionStorage.removeItem('foodly-token');
  }
  if (!response.ok) throw new Error(body.error || 'Impossible de joindre le serveur.');
  return body;
}
