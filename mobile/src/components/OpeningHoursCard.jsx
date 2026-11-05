import { StyleSheet, Text, View } from 'react-native';
import { describeOpenStatus, formatWeeklyHours, getOpenStatus, toDbWeekday } from '../lib/hours';

const STATUS_COLORS = {
  open: '#1e7d4f',
  always_open: '#1e7d4f',
  closed: '#c0392b',
  unknown: '#7a8797',
};

/**
 * Open/closed status plus the weekly schedule for a spot.
 * @param {{
 *   hoursStatus: import('../lib/hours').HoursStatus,
 *   hours: import('../lib/hours').OpeningInterval[],
 *   now?: Date,
 * }} props
 */
export default function OpeningHoursCard({ hoursStatus, hours, now = new Date() }) {
  const status = getOpenStatus(hoursStatus, hours, now);
  const today = toDbWeekday(now);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Hours</Text>
      <Text accessibilityRole="text" style={[styles.status, { color: STATUS_COLORS[status.state] }]}>
        {describeOpenStatus(status, now)}
      </Text>
      {hoursStatus === 'scheduled' ? (
        <View style={styles.table}>
          {formatWeeklyHours(hours).map((row) => (
            <View key={row.weekday} style={styles.row} accessibilityLabel={`${row.day}: ${row.text}`}>
              <Text style={[styles.day, row.weekday === today && styles.today]}>{row.day}</Text>
              <Text style={[styles.time, row.weekday === today && styles.today]}>{row.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>
          {hoursStatus === 'always_accessible'
            ? 'This spot is accessible at any time.'
            : 'No one has added hours for this spot yet.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  heading: { fontSize: 18, fontWeight: '700', color: '#142d4e' },
  status: { fontSize: 16, fontWeight: '600' },
  table: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  day: { color: '#526277', width: 96 },
  time: { color: '#142d4e', flexShrink: 1, textAlign: 'right' },
  today: { fontWeight: '700', color: '#142d4e' },
  muted: { color: '#7a8797' },
});
