import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import LoginScreen from '../app/login';
import SignupScreen from '../app/signup';
import { login, signup } from '../api/auth';
import { saveTokens } from '../api/tokenStorage';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../api/auth', () => ({ login: jest.fn(), signup: jest.fn(), loginWithGoogle: jest.fn() }));
jest.mock('../api/tokenStorage', () => ({ saveTokens: jest.fn() }));
// Expo Go has no native Google module. Rendering password login must not load it.
jest.mock('@react-native-google-signin/google-signin', () => {
  throw new Error('Native Google module must stay deferred');
});

const replace = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  useRouter.mockReturnValue({ replace, push: jest.fn() });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('logs in with his existing form, saves tokens, and opens Discovery without Google', async () => {
  login.mockResolvedValue({ access: 'access', refresh: 'refresh', user: { username: 'student' } });
  await render(<LoginScreen />);
  expect(screen.queryByText('Continue with Google')).toBeNull();
  await fireEvent.changeText(screen.getByPlaceholderText('UCR Email'), 'student@ucr.edu');
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'safe-password');
  await fireEvent.press(screen.getByText('Log In'));
  expect(login).toHaveBeenCalledWith('student@ucr.edu', 'safe-password');
  expect(saveTokens).toHaveBeenCalledWith('access', 'refresh');
  expect(replace).toHaveBeenCalledWith('/discovery');
});

it('creates an account and returns to login without pretending signup authenticated the user', async () => {
  signup.mockResolvedValue({ user: { id: 1 } });
  await render(<SignupScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('Username'), 'student');
  await fireEvent.changeText(screen.getByPlaceholderText('UCR Email'), 'student@ucr.edu');
  await fireEvent.changeText(screen.getByPlaceholderText('Password (8+ characters)'), 'safe-password');
  await fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'safe-password');
  await fireEvent.press(screen.getByText('Create Account'));
  expect(signup).toHaveBeenCalledWith('student', 'student@ucr.edu', 'safe-password');
  expect(saveTokens).not.toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith('/login');
});

it('shows missing-field feedback on web instead of silently returning', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<LoginScreen />);
  await fireEvent.press(screen.getByText('Log In'));

  expect(screen.getByRole('alert')).toHaveTextContent(/Please fill in all fields\./);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
});

it('shows rejected login feedback on web and keeps the form usable', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  login.mockRejectedValue(new Error('Invalid email or password.'));
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('UCR Email'), 'student@ucr.edu');
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong-password');
  await fireEvent.press(screen.getByText('Log In'));

  expect(screen.getByRole('alert')).toHaveTextContent('Login Failed: Invalid email or password.');
  expect(screen.getByText('Log In')).toBeOnTheScreen();
  expect(saveTokens).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('shows signup validation feedback on web without sending invalid data', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<SignupScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('Username'), 'student');
  await fireEvent.changeText(screen.getByPlaceholderText('UCR Email'), 'student@ucr.edu');
  await fireEvent.changeText(screen.getByPlaceholderText('Password (8+ characters)'), 'safe-password');
  await fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'different-password');
  await fireEvent.press(screen.getByText('Create Account'));

  expect(screen.getByRole('alert')).toHaveTextContent(/Passwords do not match\./);
  expect(signup).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('shows signup server errors on web instead of appearing to do nothing', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  signup.mockRejectedValue(new Error('email: An account with this email already exists.'));
  await render(<SignupScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('Username'), 'student');
  await fireEvent.changeText(screen.getByPlaceholderText('UCR Email'), 'student@ucr.edu');
  await fireEvent.changeText(screen.getByPlaceholderText('Password (8+ characters)'), 'safe-password');
  await fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'safe-password');
  await fireEvent.press(screen.getByText('Create Account'));

  expect(screen.getByRole('alert')).toHaveTextContent(/An account with this email already exists\./);
  expect(replace).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});
