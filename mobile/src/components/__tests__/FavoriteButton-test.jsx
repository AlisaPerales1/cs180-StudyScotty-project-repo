import { fireEvent, render, screen } from '@testing-library/react-native';
import FavoriteButton from '../FavoriteButton';

describe('FavoriteButton', () => {
  it('offers to save a spot that is not a favorite', async () => {
    await render(<FavoriteButton favorited={false} onToggle={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Save to favorites' })).toBeOnTheScreen();
    expect(screen.getByText('Save')).toBeOnTheScreen();
  });

  it('shows a saved spot as selected', async () => {
    await render(<FavoriteButton favorited onToggle={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeSelected();
    expect(screen.getByText('Saved')).toBeOnTheScreen();
  });

  it('calls onToggle when pressed', async () => {
    const onToggle = jest.fn();
    await render(<FavoriteButton favorited={false} onToggle={onToggle} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save to favorites' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onToggle = jest.fn();
    await render(<FavoriteButton favorited={false} onToggle={onToggle} disabled />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save to favorites' }));

    expect(onToggle).not.toHaveBeenCalled();
  });
});
