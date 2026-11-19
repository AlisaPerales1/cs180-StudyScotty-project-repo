// StudyScotty: Alisa's Week 4 (spots screen)
// Map/List toggle, filter chips, list view, spot detail. All in one file.
// Setup: npx expo install react-native-maps
// Use: render <SpotsScreen /> from App.js (or as a tab). No navigation setup needed:
// the detail screen is a modal inside this file.

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, Pressable, FlatList, Modal, ScrollView,
  ActivityIndicator, StyleSheet, SafeAreaView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

// Use your computer's LAN IP (phones can't reach localhost) or the deployed backend URL.
const API_URL = "http://YOUR_LAN_IP:8000/api";

// UCR campus center
const UCR_REGION = {
  latitude: 33.9737,
  longitude: -117.3281,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

// Filter chips. `param`/`value` must match the backend query params.
const FILTERS = [
  { key: "quiet", label: "Quiet", param: "noise", value: "quiet" },
  { key: "outlets", label: "Outlets", param: "outlets", value: "true" },
  { key: "wifi", label: "Wi-Fi", param: "wifi", value: "true" },
  { key: "indoor", label: "Indoor", param: "indoor", value: "true" },
  { key: "group", label: "Group-friendly", param: "group_friendly", value: "true" },
];

// Turns a spot into a list of tag labels (used in the list and detail views)
function spotTags(spot) {
  return [
    `Noise: ${spot.noise_level}`,
    spot.has_outlets ? "Outlets" : "No outlets",
    spot.has_wifi ? "Wi-Fi" : "No Wi-Fi",
    spot.is_indoor ? "Indoor" : "Outdoor",
    spot.group_friendly ? "Group-friendly" : "Solo-friendly",
  ];
}

export default function SpotsScreen() {
  const [view, setView] = useState("map"); // "map" | "list"
  const [activeKeys, setActiveKeys] = useState([]); // which filter chips are on
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // spot shown in the detail modal

  const loadSpots = useCallback(async () => {
    const active = FILTERS.filter((f) => activeKeys.includes(f.key));
    const query = active.map((f) => `${f.param}=${f.value}`).join("&");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/spots/${query ? "?" + query : ""}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setSpots(await res.json());
    } catch (e) {
      setError("Couldn't load study spots. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [activeKeys]);

  // Reload whenever the filters change
  useEffect(() => {
    loadSpots();
  }, [loadSpots]);

  const toggleFilter = (key) =>
    setActiveKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {FILTERS.map((f) => {
          const on = activeKeys.includes(f.key);
          return (
            <Pressable
              key={f.key}
              onPress={() => toggleFilter(f.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={on ? styles.chipTextOn : styles.chipText}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Map / List toggle */}
      <View style={styles.toggle}>
        {["map", "list"].map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[styles.tab, view === v && styles.tabOn]}
          >
            <Text style={view === v ? styles.tabTextOn : styles.tabText}>
              {v === "map" ? "Map" : "List"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator style={styles.fill} size="large" />
      ) : error ? (
        <View style={[styles.fill, styles.centered]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadSpots} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : view === "map" ? (
        <MapView style={styles.fill} initialRegion={UCR_REGION}>
          {spots.map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              title={s.name}
              description="Tap for details"
              onCalloutPress={() => setSelected(s)}
            />
          ))}
        </MapView>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setSelected(item)}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowSub}>{item.description}</Text>
              <View style={styles.tags}>
                {spotTags(item).slice(0, 3).map((t) => (
                  <Text key={t} style={styles.tag}>{t}</Text>
                ))}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No spots match these filters.</Text>
          }
        />
      )}

      {/* Spot detail */}
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={styles.detail}>
          {selected && (
            <ScrollView contentContainerStyle={styles.detailBody}>
              <Text style={styles.title}>{selected.name}</Text>
              <Text style={styles.desc}>{selected.description}</Text>
              <View style={styles.tags}>
                {spotTags(selected).map((t) => (
                  <Text key={t} style={styles.tag}>{t}</Text>
                ))}
              </View>
              {/* Weeks 5-6: photos, ratings, favorite button, open/closed hours */}
            </ScrollView>
          )}
          <Pressable style={styles.close} onPress={() => setSelected(null)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const BLUE = "#2563eb";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  fill: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", padding: 24 },

  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: 12, paddingVertical: 10 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16,
    borderWidth: 1, borderColor: BLUE, marginRight: 8,
  },
  chipOn: { backgroundColor: BLUE },
  chipText: { color: BLUE },
  chipTextOn: { color: "white", fontWeight: "600" },

  toggle: {
    flexDirection: "row", marginHorizontal: 12, marginBottom: 8,
    borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: BLUE,
  },
  tab: { flex: 1, padding: 8, alignItems: "center" },
  tabOn: { backgroundColor: BLUE },
  tabText: { color: BLUE },
  tabTextOn: { color: "white", fontWeight: "600" },

  errorText: { fontSize: 15, textAlign: "center", marginBottom: 12 },
  retry: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: BLUE, borderRadius: 8 },
  retryText: { color: "white", fontWeight: "600" },

  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowSub: { fontSize: 14, color: "#555", marginTop: 2 },
  empty: { padding: 24, textAlign: "center", color: "#555" },

  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  tag: {
    backgroundColor: "#e5edff", paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 12, marginRight: 8, marginBottom: 8, fontSize: 13,
  },

  detail: { flex: 1, backgroundColor: "white" },
  detailBody: { padding: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  desc: { fontSize: 16, color: "#444", marginTop: 8 },
  close: { margin: 16, padding: 12, borderRadius: 8, backgroundColor: BLUE, alignItems: "center" },
  closeText: { color: "white", fontWeight: "600" },
});
