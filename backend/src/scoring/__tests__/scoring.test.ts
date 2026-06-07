import { describe, expect, it } from "vitest";
import { scoreRoute, scoreRoutes, scoreToLabel } from "../index.js";
import { highwayRoute } from "./fixtures/highway-route.js";
import { urbanRoute } from "./fixtures/urban-route.js";
import {
  trafficHeavyRoute,
  trafficLightRoute,
} from "./fixtures/traffic-route.js";
import { smoothstep } from "../smoothstep.js";
import { computeHighwayShare } from "../highway.js";
import { computeManeuverComplexity } from "../maneuvers.js";
import { computeTrafficStress } from "../traffic.js";

describe("smoothstep", () => {
  it("clamps below 0 and above 1", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
  });

  it("returns 0.5 at midpoint", () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
  });
});

describe("labels", () => {
  it("maps score boundaries correctly", () => {
    expect(scoreToLabel(1.9)).toBe("Very Easy");
    expect(scoreToLabel(2)).toBe("Easy");
    expect(scoreToLabel(3.9)).toBe("Easy");
    expect(scoreToLabel(4)).toBe("Moderate");
    expect(scoreToLabel(5.9)).toBe("Moderate");
    expect(scoreToLabel(6)).toBe("Hard");
    expect(scoreToLabel(7.9)).toBe("Hard");
    expect(scoreToLabel(8)).toBe("Very Hard");
  });
});

describe("highway route scoring", () => {
  it("scores pure highway corridor as very easy or easy (1–3)", () => {
    const result = scoreRoute(highwayRoute);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(3.5);
    expect(result.label).toMatch(/Very Easy|Easy/);
    expect(result.reasons).toContain("Mostly highway");
  });

  it("detects high highway share", () => {
    const { highwayShare } = computeHighwayShare(highwayRoute.steps);
    expect(highwayShare).toBeGreaterThanOrEqual(0.65);
  });
});

describe("urban route scoring", () => {
  it("scores urban grid as hard (6–8)", () => {
    const result = scoreRoute(urbanRoute);
    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(result.score).toBeLessThanOrEqual(9);
    expect(result.label).toMatch(/Hard|Very Hard/);
    expect(result.reasons).toContain("Many turns");
  });

  it("has high maneuver density", () => {
    const { maneuversPer10Mi } = computeManeuverComplexity(
      urbanRoute.steps,
      urbanRoute.distanceMeters
    );
    expect(maneuversPer10Mi).toBeGreaterThanOrEqual(8);
  });
});

describe("traffic scoring", () => {
  it("adds 1–2.5 points for heavy traffic vs light", () => {
    const light = scoreRoute(trafficLightRoute);
    const heavy = scoreRoute(trafficHeavyRoute);
    const delta = heavy.score - light.score;
    expect(delta).toBeGreaterThanOrEqual(1);
    expect(delta).toBeLessThanOrEqual(2.5);
    expect(heavy.reasons).toContain("Heavy traffic");
  });

  it("computes delay ratio for heavy traffic", () => {
    const { delayRatio } = computeTrafficStress(
      trafficHeavyRoute.durationSeconds,
      trafficHeavyRoute.staticDurationSeconds
    );
    expect(delayRatio).toBeGreaterThanOrEqual(0.25);
  });
});

describe("alternate route ranking", () => {
  it("sorts alternates easiest-first with scoreDelta", () => {
    const urban = scoreRoute(urbanRoute);
    const highway = scoreRoute(highwayRoute);

    const routes =
      urban.score > highway.score
        ? [urbanRoute, highwayRoute]
        : [highwayRoute, urbanRoute];

    const { primary, alternates } = scoreRoutes(routes);

    expect(alternates.length).toBe(1);
    expect(alternates[0].score).toBeLessThanOrEqual(primary.score);
    expect(alternates[0].scoreDelta).toBe(
      Math.round((alternates[0].score - primary.score) * 10) / 10
    );
  });
});

describe("response shape", () => {
  it("includes all required fields with new breakdown shape", () => {
    const result = scoreRoute(highwayRoute);
    expect(result).toMatchObject({
      score: expect.any(Number),
      label: expect.any(String),
      reasons: expect.any(Array),
      breakdown: {
        highway:    expect.any(Number),
        maneuvers:  expect.any(Number),
        traffic:    expect.any(Number),
        navDensity: expect.any(Number),
        effort:     expect.any(Number),
      },
      distanceMeters:        expect.any(Number),
      durationSeconds:       expect.any(Number),
      staticDurationSeconds: expect.any(Number),
      trafficDelaySeconds:   expect.any(Number),
      polyline: expect.any(String),
      bounds: {
        southwest: { lat: expect.any(Number), lng: expect.any(Number) },
        northeast: { lat: expect.any(Number), lng: expect.any(Number) },
      },
    });
  });
});
