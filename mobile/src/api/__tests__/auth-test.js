import { router } from 'expo-router';
import { login, signup } from '../auth';
import { apiGet } from '../client';
import { getProfile, updateProfile } from '../profile';
import { clearTokens, getAccessToken } from '../tokenStorage';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../tokenStorage', () => ({
  clearTokens: jest.fn(),
  getAccessToken: jest.fn(),
}));

const reply = (status, data) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => data,
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  getAccessToken.mockResolvedValue('stored-access');
});

afterEach(() => jest.restoreAllMocks());

it('sends normalized signup/login fields without stale stored credentials', async () => {
  fetch.mockResolvedValue(reply(200, {}));
  await signup(' student ', ' STUDENT@UCR.EDU ', ' password ');
  await login(' STUDENT@UCR.EDU ', ' password ');

  const signupOptions = fetch.mock.calls[0][1];
  expect(JSON.parse(signupOptions.body)).toEqual({ username: 'student', email: 'student@ucr.edu', password: ' password ' });
  expect(signupOptions.headers.Authorization).toBeUndefined();
  expect(fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
  expect(getAccessToken).not.toHaveBeenCalled();
});

it('loads and saves the signed-in profile with a bearer token and editable fields only', async () => {
  fetch.mockResolvedValue(reply(200, { username: 'student' }));
  await getProfile();
  await updateProfile({ username: 'renamed', email: 'ignored@ucr.edu', study_preferences: 'Quiet' });

  expect(fetch.mock.calls[0][0]).toMatch(/accounts\/me\/$/);
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer stored-access');
  expect(fetch.mock.calls[1][1].method).toBe('PATCH');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ username: 'renamed', study_preferences: 'Quiet' });
});

it('clears expired credentials and returns to login after a protected 401', async () => {
  fetch.mockResolvedValue(reply(401, { detail: 'Token is expired' }));
  await expect(apiGet('accounts/me/')).rejects.toThrow('Token is expired');
  expect(clearTokens).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/login');
});

it('shows field validation errors and does not erase a session for a public login failure', async () => {
  fetch.mockResolvedValueOnce(reply(400, { email: ['An account with this email already exists.'] }));
  await expect(signup('student', 'student@ucr.edu', 'password')).rejects.toThrow('email: An account with this email already exists.');
  fetch.mockResolvedValueOnce(reply(401, { detail: 'Invalid credentials' }));
  await expect(login('student@ucr.edu', 'bad')).rejects.toThrow('Invalid credentials');
  expect(clearTokens).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
