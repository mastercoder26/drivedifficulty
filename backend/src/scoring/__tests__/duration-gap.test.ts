import { describe, expect, it } from "vitest";
import { scoreRoute } from "../index.js";
import { highwayRoute } from "./fixtures/highway-route.js";

const short10min = {
  ...highwayRoute,
  distanceMeters: 19_312,
  durationSeconds: 600,
  staticDurationSeconds: 600,
  steps: [
    {
      distanceMeters: 18_000,
      staticDurationSeconds: 560,
      maneuver: "DEPART",
      navigationInstruction: "Head north on I-95",
    },
    {
      distanceMeters: 1_312,
      staticDurationSeconds: 40,
      maneuver: "RAMP_RIGHT",
      navigationInstruction: "Take exit",
    },
  ],
};

const threeHour = {
  ...highwayRoute,
  distanceMeters: 337_962,
  durationSeconds: 10_800,
  staticDurationSeconds: 10_800,
  steps: [
    {
      distanceMeters: 320_000,
      staticDurationSeconds: 10_200,
      maneuver: "DEPART",
      navigationInstruction: "Head north on I-95",
    },
    {
      distanceMeters: 12_000,
      staticDurationSeconds: 400,
      maneuver: "STRAIGHT",
      navigationInstruction: "Continue on I-95",
    },
    {
      distanceMeters: 5_962,
      staticDurationSeconds: 200,
      maneuver: "RAMP_RIGHT",
      navigationInstruction: "Take exit",
    },
  ],
};

describe("duration separation", () => {
  it("scores long drives much higher than short hops on similar roads", () => {
    const short = scoreRoute(short10min);
    const medium = scoreRoute(highwayRoute);
    const long = scoreRoute(threeHour);

    expect(short.score).toBeLessThan(3.5);
    expect(long.score).toBeGreaterThan(short.score + 2);
    expect(long.score).toBeGreaterThan(medium.score);
    expect(medium.score).toBeGreaterThan(short.score);
    expect(long.score).toBeLessThan(7.5);
  });
});
