import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RouteFeatures } from "./features.js";
import { featuresToVector } from "./features.js";

export interface MlResidualResult {
  residual: number;
  uncertaintyLow: number;
  uncertaintyHigh: number;
  modelLoaded: boolean;
}

let sessionPromise: Promise<unknown | null> | null = null;

async function loadSession(): Promise<unknown | null> {
  try {
    const ort = await import("onnxruntime-node");
    const here = dirname(fileURLToPath(import.meta.url));
    const modelPath = join(here, "../../models/residual_v1.onnx");
    if (!existsSync(modelPath)) return null;
    return ort.InferenceSession.create(modelPath);
  } catch {
    return null;
  }
}

async function getSession(): Promise<unknown | null> {
  if (!sessionPromise) sessionPromise = loadSession();
  return sessionPromise;
}

export async function predictMlResidual(
  features: RouteFeatures
): Promise<MlResidualResult> {
  const session = (await getSession()) as {
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
  } | null;

  if (!session) {
    return {
      residual: 0,
      uncertaintyLow: -0.3,
      uncertaintyHigh: 0.3,
      modelLoaded: false,
    };
  }

  try {
    const ort = await import("onnxruntime-node");
    const vector = featuresToVector(features);
    const tensor = new ort.Tensor("float32", Float32Array.from(vector), [1, vector.length]);
    const output = await session.run({ features: tensor });
    const data = output.output?.data ?? output.residual?.data;
    const residual = data ? Math.max(-3, Math.min(3, data[0] ?? 0)) : 0;
    return {
      residual,
      uncertaintyLow: residual - 0.4,
      uncertaintyHigh: residual + 0.4,
      modelLoaded: true,
    };
  } catch {
    return {
      residual: 0,
      uncertaintyLow: -0.3,
      uncertaintyHigh: 0.3,
      modelLoaded: false,
    };
  }
}

export function predictMlResidualSync(_features: RouteFeatures): MlResidualResult {
  return {
    residual: 0,
    uncertaintyLow: -0.3,
    uncertaintyHigh: 0.3,
    modelLoaded: false,
  };
}

/** Alias for orchestrator import */
export const predictMLResidualSync = predictMlResidualSync;

export function loadFeatureSchema(): string[] {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const schemaPath = join(here, "../../features.schema.json");
    if (!existsSync(schemaPath)) return [];
    const raw = JSON.parse(readFileSync(schemaPath, "utf8")) as { features: string[] };
    return raw.features ?? [];
  } catch {
    return [];
  }
}
