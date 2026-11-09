import { fireEvent, render, screen } from '@testing-library/react-native';
import BusynessCard from '../BusynessCard';

const NOW = new Date(2026, 10, 16, 15, 0);
const SUMMARY = {
  level: /** @type {const} */ ('some_seats'),
  label: 'Some seats',
  reportedAt: new Date(NOW.getTime() - 12 * 60 * 1000),
  recentCount: 3,
  counts: { empty: 0, some_seats: 2, packed: 1 },
};

describe('BusynessCard', () => {
  it('shows the current busyness and when it was reported', async () => {
    await render(<BusynessCard summary={SUMMARY} onCheckIn={jest.fn()} now={NOW} />);

    expect(screen.getByText('Right now: Some seats')).toBeOnTheScreen();
    expect(screen.getByText('Updated 12 min ago · 3 check-ins in the last hour')).toBeOnTheScreen();
  });

  it('invites the first check-in when there are no recent reports', async () => {
    await render(<BusynessCard summary={null} onCheckIn={jest.fn()} now={NOW} />);

    expect(screen.getByText('No recent check-ins. Be the first to report.')).toBeOnTheScreen();
  });

  it('asks how busy it is, then checks in with the chosen level', async () => {
    const onCheckIn = jest.fn();
    await render(<BusynessCard summary={null} onCheckIn={onCheckIn} now={NOW} />);

    await fireEvent.press(screen.getByText('Check in here'));
    expect(screen.getByText('How busy is it where you are?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Packed'));

    expect(onCheckIn).toHaveBeenCalledWith('packed');
    expect(screen.queryByText('How busy is it where you are?')).toBeNull();
  });

  it('can cancel without checking in', async () => {
    const onCheckIn = jest.fn();
    await render(<BusynessCard summary={null} onCheckIn={onCheckIn} now={NOW} />);

    await fireEvent.press(screen.getByText('Check in here'));
    await fireEvent.press(screen.getByText('Cancel'));

    expect(onCheckIn).not.toHaveBeenCalled();
    expect(screen.getByText('Check in here')).toBeOnTheScreen();
  });

  it('disables the button while checking the location and shows the result', async () => {
    await render(<BusynessCard summary={null} onCheckIn={jest.fn()} checkingIn message="Checked in!" now={NOW} />);

    expect(screen.getByRole('button', { name: 'Checking your location…' })).toBeDisabled();
    expect(screen.getByText('Checked in!')).toBeOnTheScreen();
  });
});
