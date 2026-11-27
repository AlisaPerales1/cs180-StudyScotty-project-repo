import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import LoginScreen from '../app/login';

jest.mock('../lib/reminders', () => ({ configureNotifications: jest.fn() }));
jest.mock('expo-status-bar', () => ({
  ...jest.requireActual('expo-status-bar'),
  StatusBar: () => null,
}));
jest.mock('../api/tokenStorage', () => ({ getAccessToken: jest.fn().mockResolvedValue(null) }));

const Placeholder = () => <Text>Private screen</Text>;

it.each(['/', '/login', '/discovery'])(
  'opens the login form from %s without a stored session', async (initialUrl) => {
    await renderRouter({
      _layout: RootLayout,
      index: Index,
      login: LoginScreen,
      signup: Placeholder,
      'link-google': Placeholder,
      discovery: Placeholder,
      sessions: Placeholder,
      profile: Placeholder,
      admin: Placeholder,
      'spots/[id]/index': Placeholder,
      'spots/[id]/reviews': Placeholder,
    }, { initialUrl });

    expect(screen).toHavePathname('/login');
    expect(screen.getByPlaceholderText('UCR Email')).toBeOnTheScreen();
  },
);
