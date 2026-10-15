import { Text } from 'react-native';
import CampusMap from '../components/CampusMap';
import Screen from '../components/Screen';

export default function DiscoverScreen() {
  return (
    <Screen title="Find your study spot" subtitle="Explore campus and make room for your next good idea.">
      <CampusMap />
      <Text>No study spots yet. Shared spots will appear here once the spots API is connected.</Text>
    </Screen>
  );
}
