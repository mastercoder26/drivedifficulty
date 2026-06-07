import type { ParsedRoute } from "../../../types.js";

/** 3+ hour mostly-highway trip for fatigue testing. */
export const longHighwayRoute: ParsedRoute = {
  distanceMeters: 483_000,
  durationSeconds: 12_600,
  staticDurationSeconds: 11_700,
  polyline: "encoded_long_highway_polyline",
  bounds: {
    southwest: { lat: 33.7, lng: -84.4 },
    northeast: { lat: 35.2, lng: -80.8 },
  },
  steps: Array.from({ length: 8 }, (_, i) => ({
    distanceMeters: 60_000,
    staticDurationSeconds: 1400,
    maneuver: i === 0 ? "DEPART" : "STRAIGHT",
    navigationInstruction: "Continue on I-85 North",
  })),
};
