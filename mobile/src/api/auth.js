import { apiPost } from './client';

// Log in using a UCR email and password
export async function login(email, password) {
  return apiPost('accounts/login/', {
    email: email.trim().toLowerCase(),
    password,
  });
}

// Create a new student account
export async function signup(username, email, password) {
  return apiPost('accounts/signup/', {
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password,
  });
}