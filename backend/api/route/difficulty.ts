import type { VercelRequest, VercelResponse } from "@vercel/node";
import { computeRoutes } from "../../src/google/routes.js";
import { enrichRouteWithSpeedLimits } from "../../src/google/roads.js";
import { scoreRoutes } from "../../src/scoring/index.js";
import { buildFeaturesFromRoute } from "../../src/scoring/features.js";
import {
  loadActiveCalibrationKnots,
  logPrediction,
} from "../../src/db/supabase.js";
import { setCalibrationKnots } from "../../src/scoring/calibration.js";
import { createHash } from "node:crypto";
import { MODEL_VERSION, type DifficultyRequest } from "../../src/types.js";

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "*";
  if (raw === "*") return ["*"];
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const allowed = getAllowedOrigins();
  const origin = req.headers.origin ?? "";

  if (allowed.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function validateRequest(body: unknown): DifficultyRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const {
    origin,
    destination,
    departureTime,
    includeAlternates,
    hoursSlept,
    continuousDriveMinutes,
  } = body as DifficultyRequest;

  if (!origin || typeof origin !== "string") {
    throw new Error("origin is required and must be a string");
  }
  if (!destination || typeof destination !== "string") {
    throw new Error("destination is required and must be a string");
  }

  return {
    origin: origin.trim(),
    destination: destination.trim(),
    departureTime:
      typeof departureTime === "string" ? departureTime : undefined,
    includeAlternates: includeAlternates ?? false,
    hoursSlept: typeof hoursSlept === "number" ? hoursSlept : undefined,
    continuousDriveMinutes:
      typeof continuousDriveMinutes === "number"
        ? continuousDriveMinutes
        : undefined,
  };
}

function routeHash(origin: string, destination: string, polyline: string): string {
  return createHash("sha256")
    .update(`${origin}|${destination}|${polyline}`)
    .digest("hex")
    .slice(0, 16);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GOOGLE_MAPS_API_KEY is not configured" });
    return;
  }

  try {
    const knots = await loadActiveCalibrationKnots(MODEL_VERSION);
    if (knots) setCalibrationKnots(knots);

    const request = validateRequest(req.body);
    const routes = await computeRoutes({
      origin: request.origin,
      destination: request.destination,
      departureTime: request.departureTime,
      includeAlternates: request.includeAlternates,
      apiKey,
    });

    const optionsList = await Promise.all(
      routes.map((route) => enrichRouteWithSpeedLimits(route, apiKey))
    );

    const scoreOptions = routes.map((_route, i) => ({
      stepSpeedsMph: optionsList[i],
      departureTime: request.departureTime,
      hoursSlept: request.hoursSlept,
      continuousDriveMinutes: request.continuousDriveMinutes,
    }));

    const { primary, alternates } = scoreRoutes(routes, scoreOptions);

    try {
      const { features } = buildFeaturesFromRoute(routes[0]!, {
        stepSpeedsMph: optionsList[0],
        departureTime: request.departureTime,
      });

      const predictionId = await logPrediction({
        routeHash: routeHash(
          request.origin,
          request.destination,
          primary.polyline
        ),
        origin: request.origin,
        destination: request.destination,
        departureTime: request.departureTime,
        features: features as unknown as Record<string, unknown>,
        rawScore: primary.uncalibratedScore ?? primary.score,
        calibratedScore: primary.score,
        uncertaintyLow: primary.uncertainty.low,
        uncertaintyHigh: primary.uncertainty.high,
        modelVersion: primary.modelVersion ?? MODEL_VERSION,
      });

      if (predictionId) {
        primary.predictionId = predictionId;
      }
    } catch {
      // Logging must not break the scoring response
    }

    res.status(200).json({
      primaryRoute: primary,
      alternateRoutes: alternates,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    const status = message.includes("required") ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
