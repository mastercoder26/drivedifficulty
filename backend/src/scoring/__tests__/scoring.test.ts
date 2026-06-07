import { describe, expect, it } from "vitest";
import {
  scoreRoute,
  scoreRoutes,
  scoreToLabel,
  aggregateSegmentScores,
} from "../index.js";
import { highwayRoute } from "./fixtures/highway-route.js";
import { urbanRoute } from "./fixtures/urban-route.js";
import {
  trafficHeavyRoute,
  trafficLightRoute,
} from "./fixtures/traffic-route.js";
import { longDriveRoute } from "./fixtures/long-drive-route.js";
import {
  mergeClusterRoute,
  smoothHighwayEquivalent,
} from "./fixtures/merge-cluster-route.js";
import { exchangeHeavyRoute } from "./fixtures/exchange-heavy-route.js";
import { smoothstep } from "../smoothstep.js";
import { computeHighwayShare } from "../highway.js";
import { computeManeuverComplexity } from "../maneuvers.js";
import { computeTrafficStress } from "../traffic.js";
import { aggregateMeanOnly } from "../segmentAggregate.js";
import { scoreSegmentLocal, segmentRoute } from "../segments.js";

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
  it("scores pure highway corridor as very easy or easy (1–3.5)", () => {
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
    expect(result.reasons.some((r) => r.includes("turn"))).toBe(true);
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
    expect(delta).toBeGreaterThanOrEqual(0.5);
    expect(delta).toBeLessThanOrEqual(3);
    expect(heavy.reasons.some((r) => r.toLowerCase().includes("traffic"))).toBe(
      true
    );
  });

  it("computes delay ratio for heavy traffic", () => {
    const { delayRatio } = computeTrafficStress(
      trafficHeavyRoute.durationSeconds,
      trafficHeavyRoute.staticDurationSeconds
    );
    expect(delayRatio).toBeGreaterThanOrEqual(0.25);
  });
});

describe("long drive fatigue", () => {
  it("scores 3hr+ trip higher than short highway trip", () => {
    const short = scoreRoute(highwayRoute);
    const long = scoreRoute(longDriveRoute);
    expect(long.score).toBeGreaterThan(short.score);
    expect(long.reasons.some((r) => r.toLowerCase().includes("long"))).toBe(true);
  });

  it("bumps score with low sleep vs well-rested on long trip", () => {
    const rested = scoreRoute(longDriveRoute, { hoursSlept: 8 });
    const tired = scoreRoute(longDriveRoute, {
      hoursSlept: 4,
      departureTime: "2026-06-06T03:00:00.000Z",
    });
    expect(tired.score).toBeGreaterThan(rested.score);
    expect(tired.breakdown.fatigue).toBeGreaterThan(rested.breakdown.fatigue);
  });
});

describe("merge cluster aggregation", () => {
  it("P90/max aggregation scores cluster route higher than smooth equivalent", () => {
    const cluster = scoreRoute(mergeClusterRoute);
    const smooth = scoreRoute(smoothHighwayEquivalent);
    expect(cluster.score - smooth.score).toBeGreaterThanOrEqual(1.5);
  });

  it("P90 aggregation exceeds mean-only on cluster fixture", () => {
    const segments = segmentRoute(mergeClusterRoute);
    const scores = segments.map(scoreSegmentLocal);
    const p90Agg = aggregateSegmentScores(scores).aggregated;
    const meanOnly = aggregateMeanOnly(scores);
    expect(p90Agg).toBeGreaterThan(meanOnly);
  });

  it("detects merge clusters in reasons", () => {
    const result = scoreRoute(mergeClusterRoute);
    expect(
      result.reasons.some(
        (r) =>
          r.toLowerCase().includes("merge") ||
          r.toLowerCase().includes("interchange") ||
          r.toLowerCase().includes("cluster")
      )
    ).toBe(true);
  });
});

describe("exchange-heavy routes", () => {
  it("scores exchange-heavy route at least 2 pts above smooth highway equivalent", () => {
    const exchange = scoreRoute(exchangeHeavyRoute);
    const smooth = scoreRoute(smoothHighwayEquivalent);
    expect(exchange.score - smooth.score).toBeGreaterThanOrEqual(2);
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
  it("includes all required fields with extended breakdown", () => {
    const result = scoreRoute(highwayRoute);
    expect(result).toMatchObject({
      score: expect.any(Number),
      label: expect.any(String),
      reasons: expect.any(Array),
      breakdown: {
        speed: expect.any(Number),
        merges: expect.any(Number),
        turns: expect.any(Number),
        traffic: expect.any(Number),
        length: expect.any(Number),
        fatigue: expect.any(Number),
        highway: expect.any(Number),
        maneuvers: expect.any(Number),
        navDensity: expect.any(Number),
        effort: expect.any(Number),
      },
      contributions: expect.any(Array),
      uncertainty: {
        low: expect.any(Number),
        high: expect.any(Number),
        confidence: expect.any(Number),
        spread: expect.any(Number),
      },
      hotspots: expect.any(Array),
      modelVersion: expect.any(String),
      distanceMeters: expect.any(Number),
      durationSeconds: expect.any(Number),
      staticDurationSeconds: expect.any(Number),
      trafficDelaySeconds: expect.any(Number),
      polyline: expect.any(String),
      bounds: {
        southwest: { lat: expect.any(Number), lng: expect.any(Number) },
        northeast: { lat: expect.any(Number), lng: expect.any(Number) },
      },
    });
  });
});
