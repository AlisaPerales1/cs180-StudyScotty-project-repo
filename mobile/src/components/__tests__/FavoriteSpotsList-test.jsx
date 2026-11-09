import { render, screen } from '@testing-library/react-native';
import { listFavorites } from '../../api/favorites';
import FavoriteSpotsList from '../FavoriteSpotsList';

jest.mock('../../api/favorites', () => ({ listFavorites: jest.fn() }));

// Render outside a navigator: run focus effects once on mount, and links as text.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    useFocusEffect: (effect) => useEffect(effect, [effect]),
    Link: ({ href, children, ...props }) => <Text accessibilityHint={href} {...props}>{children}</Text>,
  };
});

describe('FavoriteSpotsList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists favorite spots with links and reminder status', async () => {
    listFavorites.mockResolvedValue([
      { spot: { id: 1, name: 'Rivera Library' }, opening_reminder_enabled: true, created_at: '2026-11-16T10:00:00Z' },
      { spot: { id: 2, name: 'Orbach Science Library' }, opening_reminder_enabled: false, created_at: '2026-11-15T10:00:00Z' },
    ]);
    await render(<FavoriteSpotsList />);

    expect(await screen.findByText('♥ Rivera Library ›')).toHaveProp('accessibilityHint', '/spots/1');
    expect(screen.getByText('♥ Orbach Science Library ›')).toHaveProp('accessibilityHint', '/spots/2');
    expect(screen.getAllByText('Opening reminder on')).toHaveLength(1);
  });

  it('explains how to add favorites when there are none', async () => {
    listFavorites.mockResolvedValue([]);
    await render(<FavoriteSpotsList />);

    expect(await screen.findByText('No favorites yet. Tap Save on a spot to keep it here.')).toBeOnTheScreen();
  });

  it('shows an error when favorites cannot be loaded', async () => {
    listFavorites.mockRejectedValue(new Error('offline'));
    await render(<FavoriteSpotsList />);

    expect(await screen.findByText('Could not load your favorite spots.')).toBeOnTheScreen();
  });
});
