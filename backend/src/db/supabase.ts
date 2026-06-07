import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackRequest, PredictionLogPayload } from "../types.js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function logPrediction(
  payload: PredictionLogPayload
): Promise<string | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;

  const { data, error } = await supabase
    .from("predictions")
    .insert({
      route_hash: payload.routeHash,
      origin: payload.origin,
      destination: payload.destination,
      departure_time: payload.departureTime ?? null,
      features: payload.features,
      raw_score: payload.rawScore,
      calibrated_score: payload.calibratedScore,
      uncertainty_low: payload.uncertaintyLow,
      uncertainty_high: payload.uncertaintyHigh,
      model_version: payload.modelVersion,
    })
    .select("id")
    .single();

  if (error || !data) return undefined;

  await supabase.rpc("recompute_training_label", {
    p_prediction_id: data.id,
  });

  return data.id as string;
}

export async function submitFeedback(
  request: FeedbackRequest
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  const { error } = await supabase.from("feedback").upsert(
    {
      prediction_id: request.predictionId,
      user_rating: request.userRating ?? null,
      route_rejected: request.routeRejected ?? false,
      alternate_selected: request.alternateSelected ?? false,
      comment: request.comment ?? null,
    },
    { onConflict: "prediction_id" }
  );

  if (error) return { ok: false, error: error.message };

  await supabase.rpc("recompute_training_label", {
    p_prediction_id: request.predictionId,
  });

  return { ok: true };
}

export async function countNewLabelsSince(since: Date): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("training_labels")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since.toISOString());

  if (error) return 0;
  return count ?? 0;
}

export async function loadActiveCalibrationKnots(
  modelVersion = "hybrid-v1"
): Promise<Array<{ x: number; y: number }> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("calibration_artifacts")
    .select("knots")
    .eq("model_version", modelVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.knots) return null;
  return data.knots as Array<{ x: number; y: number }>;
}
