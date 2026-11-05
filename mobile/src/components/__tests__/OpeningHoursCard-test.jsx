import { render, screen } from '@testing-library/react-native';
import OpeningHoursCard from '../OpeningHoursCard';

// Monday 16 November 2026, 10:00 local time.
const MONDAY_10AM = new Date(2026, 10, 16, 10, 0);
const weekdays9to5 = [0, 1, 2, 3, 4].map((weekday) => ({
  weekday, opens_at: '09:00:00', closes_at: '17:00:00', closes_next_day: false,
}));

describe('OpeningHoursCard', () => {
  it('shows the open status and the weekly schedule', async () => {
    await render(<OpeningHoursCard hoursStatus="scheduled" hours={weekdays9to5} now={MONDAY_10AM} />);

    expect(screen.getByText('Open now · Closes at 5:00 PM')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday: 9:00 AM – 5:00 PM')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saturday: Closed')).toBeOnTheScreen();
    expect(screen.getAllByText('9:00 AM – 5:00 PM')).toHaveLength(5);
  });

  it('explains always-accessible spots without a schedule table', async () => {
    await render(<OpeningHoursCard hoursStatus="always_accessible" hours={[]} now={MONDAY_10AM} />);

    expect(screen.getByText('Always open')).toBeOnTheScreen();
    expect(screen.getByText('This spot is accessible at any time.')).toBeOnTheScreen();
    expect(screen.queryByText('Monday')).toBeNull();
  });

  it('explains spots with unknown hours', async () => {
    await render(<OpeningHoursCard hoursStatus="unknown" hours={[]} now={MONDAY_10AM} />);

    expect(screen.getByText('Hours not listed')).toBeOnTheScreen();
    expect(screen.getByText('No one has added hours for this spot yet.')).toBeOnTheScreen();
  });
});
