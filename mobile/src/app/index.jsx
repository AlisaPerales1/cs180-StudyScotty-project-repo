import { Link } from 'expo-router';
import { Text } from 'react-native';
import { MOCK_SPOTS } from '../api/reviews';
import CampusMap from '../components/CampusMap';
import Screen from '../components/Screen';

export default function DiscoverScreen() {
  return (
    <Screen title="Find your study spot" subtitle="Explore campus and make room for your next good idea.">
      <CampusMap />
      <Text>No study spots yet. Shared spots will appear here once the spots API is connected.</Text>
      {/* Temporary entry points to spot reviews until the spots API and map markers are connected. */}
      {MOCK_SPOTS.map((spot) => (
        <Link key={spot.id} href={`/spots/${spot.id}/reviews`} style={{ color: '#2463a0', fontSize: 16, fontWeight: '600' }}>
          {spot.name} — ratings & reviews ›
        </Link>
      ))}
    </Screen>
  );
}
