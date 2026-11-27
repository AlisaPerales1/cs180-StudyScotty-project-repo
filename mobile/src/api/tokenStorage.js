import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'studyscotty_access_token';
const REFRESH_TOKEN_KEY = 'studyscotty_refresh_token';

// Temporary token storage for web testing.
// Tokens disappear when the page reloads.
let webAccessToken = null;
let webRefreshToken = null;

// Load SecureStore only on native platforms.
async function getSecureStore() {
  if (Platform.OS === 'web') {
    return null;
  }

  return import('expo-secure-store');
}

export async function saveTokens(accessToken, refreshToken) {
  if (Platform.OS === 'web') {
    webAccessToken = accessToken;
    webRefreshToken = refreshToken;
    return;
  }

  const SecureStore = await getSecureStore();

  await SecureStore.setItemAsync(
    ACCESS_TOKEN_KEY,
    accessToken
  );

  await SecureStore.setItemAsync(
    REFRESH_TOKEN_KEY,
    refreshToken
  );
}

export async function getAccessToken() {
  if (Platform.OS === 'web') {
    return webAccessToken;
  }

  const SecureStore = await getSecureStore();

  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  if (Platform.OS === 'web') {
    return webRefreshToken;
  }

  const SecureStore = await getSecureStore();

  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  if (Platform.OS === 'web') {
    webAccessToken = null;
    webRefreshToken = null;
    return;
  }

  const SecureStore = await getSecureStore();

  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}