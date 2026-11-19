// StudyScotty: Alisa's Week 6 (AddSpotScreen.js, replaces the week 5 version)
// Adds: duplicate-spot warning (spots within ~30 m) and optional opening hours.
//
// Setup: npx expo install expo-location expo-image-picker expo-secure-store react-native-maps
// Backend: needs GET /api/spots/nearby/ and the opens_at / closes_at fields (see week6_backend.txt)

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, Image, ScrollView,
  Alert, ActivityIndicator, StyleSheet, SafeAreaView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

const API_URL = "http://YOUR_LAN_IP:8000/api"; // or the deployed backend URL
const TOKEN_KEY = "token";                     // key the login screen saves the token under
const AUTH_PREFIX = "Token";                   // "Bearer" if DJ uses JWT
const DUPLICATE_METERS = 30;                   // warn if an existing spot is this close

const UCR_CENTER = { latitude: 33.9737, longitude: -117.3281 };
const NOISE_LEVELS = ["quiet", "moderate", "loud"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // 24-hour HH:MM

export default function AddSpotScreen({ navigation, onSaved }) {
  const mapRef = useRef(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [pin, setPin] = useState(null);
  const [locationNote, setLocationNote] = useState("");
  const [photoUri, setPhotoUri] = useState(null);

  const [noise, setNoise] = useState("moderate");
  const [outlets, setOutlets] = useState(true);
  const [wifi, setWifi] = useState(true);
  const [indoor, setIndoor] = useState(true);
  const [group, setGroup] = useState(true);

  // Opening hours (optional). Both empty = "always accessible"
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setPin({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setLocationNote("Pin placed at your location. Drag it to adjust.");
          return;
        }
      } catch (e) {}
      setPin(UCR_CENTER);
      setLocationNote("Location unavailable. Drag the pin to the spot.");
    })();
  }, []);

  useEffect(() => {
    if (pin && mapRef.current) {
      mapRef.current.animateToRegion({ ...pin, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 300);
    }
  }, [pin === null]);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission needed", "Allow camera access to take a photo of the spot.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  // Duplicate warning: ask the backend for spots near the pin.
  // Resolves true to go ahead and save, false to cancel. If the check fails, just save.
  const confirmIfNearby = async () => {
    try {
      const res = await fetch(
        `${API_URL}/spots/nearby/?lat=${pin.latitude}&lng=${pin.longitude}&radius=${DUPLICATE_METERS}`
      );
      if (!res.ok) return true;
      const nearby = await res.json();
      if (!nearby.length) return true;

      const names = nearby.map((s) => `${s.name} (${Math.round(s.distance_m)} m away)`).join("\n");
      return await new Promise((resolve) => {
        Alert.alert(
          "Similar spot nearby",
          `${names}\n\nIs this the same place?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Add anyway", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
    } catch (e) {
      return true;
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Give the spot a name.");
      return;
    }
    if (!pin) {
      Alert.alert("No location", "Wait for the pin to appear, or drag it onto the map.");
      return;
    }

    // Opening hours: both or neither, in HH:MM
    const hasOpen = opensAt.trim() !== "";
    const hasClose = closesAt.trim() !== "";
    if (hasOpen !== hasClose) {
      Alert.alert("Opening hours", "Fill in both the open and close times, or leave both empty.");
      return;
    }
    if (hasOpen && (!TIME_RE.test(opensAt.trim()) || !TIME_RE.test(closesAt.trim()))) {
      Alert.alert("Opening hours", "Use 24-hour time like 08:00 and 22:00.");
      return;
    }

    if (!(await confirmIfNearby())) return;

    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      form.append("location_details", details.trim());
      form.append("latitude", String(pin.latitude));
      form.append("longitude", String(pin.longitude));
      form.append("noise_level", noise);
      form.append("has_outlets", String(outlets));
      form.append("has_wifi", String(wifi));
      form.append("is_indoor", String(indoor));
      form.append("group_friendly", String(group));
      if (hasOpen) {
        form.append("opens_at", opensAt.trim());
        form.append("closes_at", closesAt.trim());
      }
      if (photoUri) {
        form.append("photo", { uri: photoUri, name: "spot.jpg", type: "image/jpeg" });
      }

      const res = await fetch(`${API_URL}/spots/`, {
        method: "POST",
        headers: token ? { Authorization: `${AUTH_PREFIX} ${token}` } : {},
        body: form,
      });

      if (!res.ok) {
        let message = `Server returned ${res.status}`;
        try {
          const body = await res.json();
          message = Object.values(body).flat().join("\n") || message;
        } catch (e) {}
        throw new Error(message);
      }

      Alert.alert("Spot added!", `${name.trim()} is now on the map.`);
      if (onSaved) onSaved();
      else if (navigation) navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save spot", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Spot name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Quiet courtyard behind Surge" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="What's it like?" />

        <Text style={styles.label}>Location details</Text>
        <TextInput style={styles.input} value={details} onChangeText={setDetails} placeholder="e.g. 2nd floor, east side, near the stairs" />

        <Text style={styles.label}>Location</Text>
        <Text style={styles.hint}>{locationNote}</Text>
        <MapView ref={mapRef} style={styles.map} initialRegion={{ ...UCR_CENTER, latitudeDelta: 0.02, longitudeDelta: 0.02 }}>
          {pin && <Marker coordinate={pin} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate)} />}
        </MapView>

        <Text style={styles.label}>Photo</Text>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} />}
        <Pressable style={styles.secondaryBtn} onPress={takePhoto}>
          <Text style={styles.secondaryText}>{photoUri ? "Retake photo" : "Take photo"}</Text>
        </Pressable>

        <Text style={styles.label}>Noise level</Text>
        <View style={styles.row}>
          {NOISE_LEVELS.map((n) => (
            <Chip key={n} label={n} on={noise === n} onPress={() => setNoise(n)} />
          ))}
        </View>

        <Text style={styles.label}>Tags</Text>
        <View style={styles.row}>
          <Chip label="Outlets" on={outlets} onPress={() => setOutlets(!outlets)} />
          <Chip label="Wi-Fi" on={wifi} onPress={() => setWifi(!wifi)} />
          <Chip label="Indoor" on={indoor} onPress={() => setIndoor(!indoor)} />
          <Chip label="Group-friendly" on={group} onPress={() => setGroup(!group)} />
        </View>

        <Text style={styles.label}>Opening hours (optional)</Text>
        <Text style={styles.hint}>24-hour time. Leave both empty if it's always accessible.</Text>
        <View style={styles.timeRow}>
          <TextInput style={[styles.input, styles.timeInput]} value={opensAt} onChangeText={setOpensAt} placeholder="Opens 08:00" maxLength={5} />
          <Text style={styles.dash}>to</Text>
          <TextInput style={[styles.input, styles.timeInput]} value={closesAt} onChangeText={setClosesAt} placeholder="Closes 22:00" maxLength={5} />
        </View>

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save spot</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={on ? styles.chipTextOn : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const BLUE = "#2563eb";
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 6 },
  hint: { fontSize: 13, color: "#666", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 15 },
  map: { height: 240, borderRadius: 8 },
  photo: { width: "100%", height: 180, borderRadius: 8, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap" },
  timeRow: { flexDirection: "row", alignItems: "center" },
  timeInput: { flex: 1 },
  dash: { marginHorizontal: 10, color: "#555" },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: BLUE, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: BLUE },
  chipText: { color: BLUE },
  chipTextOn: { color: "white", fontWeight: "600" },
  secondaryBtn: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: BLUE, alignItems: "center" },
  secondaryText: { color: BLUE, fontWeight: "600" },
  saveBtn: { marginTop: 24, padding: 14, borderRadius: 8, backgroundColor: BLUE, alignItems: "center" },
  saveText: { color: "white", fontWeight: "700", fontSize: 16 },
});