import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listFavorites } from '../api/favorites';

/**
 * The current user's favorite spots. Reloads whenever its screen gains focus,
 * so changes made on a spot page show up when returning to the Profile tab.
 */
export default function FavoriteSpotsList() {
  const [favorites, setFavorites] = useState(/** @type {import('../api/favorites').Favorite[] | null} */ (null));
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    listFavorites()
      .then((data) => {
        if (!active) return;
        setFavorites(data);
        setError('');
      })
      .catch(() => { if (active) setError('Could not load your favorite spots.'); });
    return () => { active = false; };
  }, []));

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Favorite spots</Text>
      {error ? (
        <Text style={styles.muted}>{error}</Text>
      ) : !favorites ? (
        <ActivityIndicator accessibilityLabel="Loading favorite spots" />
      ) : favorites.length ? (
        favorites.map((favorite) => (
          <View key={favorite.spot.id} style={styles.row}>
            <Link href={`/spots/${favorite.spot.id}`} style={styles.link}>♥ {favorite.spot.name} ›</Link>
            {favorite.opening_reminder_enabled ? <Text style={styles.muted}>Opening reminder on</Text> : null}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>No favorites yet. Tap Save on a spot to keep it here.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  heading: { fontSize: 18, fontWeight: '700', color: '#142d4e' },
  row: { gap: 2 },
  link: { color: '#2463a0', fontSize: 16, fontWeight: '600' },
  muted: { color: '#7a8797' },
});
