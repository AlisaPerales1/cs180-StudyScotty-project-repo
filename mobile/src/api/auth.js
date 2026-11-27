import { apiPost } from './client';

// Log in using a UCR email and password
export async function login(email, password) {
  return apiPost('accounts/login/', {
    email: email.trim().toLowerCase(),
    password,
  }, {}, false);
}

// Create a new student account
export async function signup(username, email, password) {
  return apiPost('accounts/signup/', {
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password,
  }, {}, false);
}

// Log in using a Google account
export async function loginWithGoogle(idToken) {
  return apiPost('accounts/google/', {
    id_token: idToken,
  }, {}, false);
}

export async function linkGoogleAccount(
  idToken,
  password,
  accessToken
) {
  return apiPost(
    'accounts/google/link/',
    {
      id_token: idToken,
      password,
    },
    {
      Authorization: `Bearer ${accessToken}`,
    }
  );
}
