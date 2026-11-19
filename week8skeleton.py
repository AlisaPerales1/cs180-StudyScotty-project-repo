// Week 8 skeleton (Alisa): session check-in, "Spot taken", "Session in progress" display
// Save as SessionCheckIn.js (or add to the spot detail screen)

import React, { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
// import * as Location from "expo-location";

const CHECKIN_OPENS_MIN = 10;   // minutes before start
const CHECKIN_CLOSES_MIN = 15;  // minutes after start
const MAX_METERS = 100;

// Is "now" inside the check-in window? (start is a Date)
function inCheckInWindow(start, now = new Date()) {
  const minutes = (now - start) / 60000;
  return minutes >= -CHECKIN_OPENS_MIN && minutes <= CHECKIN_CLOSES_MIN;
}

// TODO: distanceMeters(a, b), reuse the function from the week 7 file

export default function SessionCheckIn({ session, spot }) {
  const [busy, setBusy] = useState(false);

  // TODO: checkIn(): get location, check inCheckInWindow and distance <= MAX_METERS,
  //       then POST /api/sessions/<id>/checkin/  (Arsenii's endpoint)
  // TODO: spotTaken(): same checks, then POST /api/sessions/<id>/spot-taken/

  return (
    <View>
      <Text>{session.title}</Text>
      {/* TODO: show "Session in progress" when session.status === "in_progress" */}
      <Pressable onPress={() => {}}><Text>Check in</Text></Pressable>
      <Pressable onPress={() => {}}><Text>Spot taken</Text></Pressable>
      {/* TODO: disable both buttons outside the time window or when too far */}
    </View>
  );
}

// TODO (spot detail screen): list the spot's upcoming sessions (GET /api/sessions/?spot=<id>)
// TODO (SpotsScreen pins): mark a spot's pin when it has a session in progress