import type { VercelRequest, VercelResponse } from "@vercel/node";
import { submitFeedback } from "../../src/db/supabase.js";
import type { FeedbackRequest } from "../../src/types.js";

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

function validateFeedback(body: unknown): FeedbackRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const { predictionId, userRating, routeRejected, alternateSelected, comment } =
    body as FeedbackRequest;

  if (!predictionId || typeof predictionId !== "string") {
    throw new Error("predictionId is required");
  }

  if (
    userRating !== undefined &&
    (typeof userRating !== "number" || userRating < 1 || userRating > 10)
  ) {
    throw new Error("userRating must be between 1 and 10");
  }

  return {
    predictionId,
    userRating,
    routeRejected: routeRejected ?? false,
    alternateSelected: alternateSelected ?? false,
    comment: typeof comment === "string" ? comment : undefined,
  };
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

  try {
    const feedback = validateFeedback(req.body);
    const result = await submitFeedback(feedback);

    if (!result.ok) {
      res.status(503).json({ error: result.error ?? "Feedback storage unavailable" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    const status = message.includes("required") ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
