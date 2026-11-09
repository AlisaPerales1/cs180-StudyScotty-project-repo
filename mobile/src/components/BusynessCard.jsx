import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BUSYNESS_LEVELS, formatTimeAgo } from '../lib/busyness';
import { CHECK_IN_RADIUS_METERS } from '../lib/proximity';
import ActionButton from './ActionButton';

const LEVEL_COLORS = { empty: '#1e7d4f', some_seats: '#b7791f', packed: '#c0392b' };

/**
 * Current busyness plus the check-in flow (pick a level, then check in).
 * @param {{
 *   summary: ReturnType<typeof import('../lib/busyness').summarizeBusyness>,
 *   onCheckIn: (level: import('../lib/busyness').BusynessLevel) => void,
 *   checkingIn?: boolean,
 *   message?: string,
 *   now?: Date,
 * }} props
 */
export default function BusynessCard({ summary, onCheckIn, checkingIn, message, now = new Date() }) {
  const [picking, setPicking] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>How busy is it?</Text>
      {summary ? (
        <View style={styles.summary}>
          <Text style={[styles.level, { color: LEVEL_COLORS[summary.level] }]}>Right now: {summary.label}</Text>
          <Text style={styles.muted}>
            Updated {formatTimeAgo(summary.reportedAt, now)} · {summary.recentCount} check-in{summary.recentCount === 1 ? '' : 's'} in the last hour
          </Text>
        </View>
      ) : (
        <Text style={styles.muted}>No recent check-ins. Be the first to report.</Text>
      )}

      {picking ? (
        <View style={styles.picker}>
          <Text style={styles.label}>How busy is it where you are?</Text>
          <View style={styles.levels}>
            {BUSYNESS_LEVELS.map((item) => (
              <View key={item.value} style={styles.levelButton}>
                <ActionButton
                  title={item.label}
                  variant="secondary"
                  disabled={checkingIn}
                  onPress={() => {
                    setPicking(false);
                    onCheckIn(item.value);
                  }}
                />
              </View>
            ))}
          </View>
          <ActionButton title="Cancel" variant="secondary" onPress={() => setPicking(false)} disabled={checkingIn} />
        </View>
      ) : (
        <ActionButton
          title={checkingIn ? 'Checking your location…' : 'Check in here'}
          onPress={() => setPicking(true)}
          disabled={checkingIn}
        />
      )}
      <Text style={styles.hint}>You need to be within {CHECK_IN_RADIUS_METERS} m of the spot to check in.</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  heading: { fontSize: 18, fontWeight: '700', color: '#142d4e' },
  summary: { gap: 4 },
  level: { fontSize: 16, fontWeight: '700' },
  muted: { color: '#7a8797' },
  picker: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#526277' },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelButton: { flexGrow: 1 },
  hint: { color: '#7a8797', fontSize: 13 },
  message: { color: '#2463a0' },
});
