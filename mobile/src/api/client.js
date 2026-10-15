export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

/** @param {string} path */
export async function apiGet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function getHealth() {
  return apiGet('health/');
}
