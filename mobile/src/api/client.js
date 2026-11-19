import { clearTokens, getAccessToken } from './tokenStorage';
import { router } from 'expo-router';
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

// General API request helper
async function apiRequest(path, options = {}, authenticated = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const token = authenticated ? await getAccessToken() : null;
    const url = `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      if (authenticated && response.status === 401) {
        await clearTokens();
        router.replace('/login');
      }
      const message =
        result.error ||
        result.detail ||
        result.message ||
        Object.entries(result).map(([field, messages]) =>
          `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`
        ).join('\n') ||
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
export async function apiPost(path, data, headers = {}, authenticated = true) {
  return apiRequest(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  }, authenticated);
}

export async function apiPatch(path, data) {
  return apiRequest(path, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getHealth() {
  return apiRequest('health/', {}, false);
}
