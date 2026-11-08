
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

// General API request helper
async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';

    let result;

    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      result = { detail: text };
    }

    if (!response.ok) {
      const message =
        result.error ||
        result.detail ||
        result.message ||
        `API request failed (${response.status})`;

      throw new Error(
        typeof message === 'string'
          ? message
          : JSON.stringify(message)
      );
    }

    return result;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

// GET request
export async function apiGet(path, headers = {}) {
  return apiRequest(path, {
    method: 'GET',
    headers,
  });
}

// POST request
export async function apiPost(path, data, headers = {}) {
  return apiRequest(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export async function getHealth() {
  return apiGet('health');
}