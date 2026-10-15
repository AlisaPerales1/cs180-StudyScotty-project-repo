import MapView from 'react-native-maps';

export default function CampusMap() {
  return (
    <MapView
      style={{ height: 320, width: '100%', borderRadius: 16 }}
      initialRegion={{
        latitude: 33.9737,
        longitude: -117.3281,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }}
      accessibilityLabel="Map of the UCR campus"
    />
  );
}
