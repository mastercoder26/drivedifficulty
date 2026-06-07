-- Predictions, feedback, training labels, and calibration artifacts

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  route_hash TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIMESTAMPTZ,
  features JSONB NOT NULL,
  raw_score DOUBLE PRECISION NOT NULL,
  calibrated_score DOUBLE PRECISION NOT NULL,
  uncertainty_low DOUBLE PRECISION NOT NULL,
  uncertainty_high DOUBLE PRECISION NOT NULL,
  model_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_predictions_route_hash ON predictions(route_hash);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_rating SMALLINT CHECK (user_rating BETWEEN 1 AND 10),
  route_rejected BOOLEAN DEFAULT FALSE,
  alternate_selected BOOLEAN DEFAULT FALSE,
  comment TEXT,
  UNIQUE (prediction_id)
);

CREATE TABLE IF NOT EXISTS training_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  composite_target DOUBLE PRECISION NOT NULL,
  rating_component DOUBLE PRECISION,
  rejected_component DOUBLE PRECISION,
  proxy_component DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'bootstrap',
  UNIQUE (prediction_id)
);

CREATE TABLE IF NOT EXISTS calibration_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  knots JSONB NOT NULL,
  ece DOUBLE PRECISION,
  sample_count INTEGER NOT NULL DEFAULT 0
);

-- Bootstrap label helper: composite y = 0.6*rating + 0.25*rejected + 0.15*proxy
CREATE OR REPLACE FUNCTION recompute_training_label(p_prediction_id UUID)
RETURNS VOID AS $$
DECLARE
  v_rating DOUBLE PRECISION;
  v_rejected DOUBLE PRECISION;
  v_proxy DOUBLE PRECISION;
  v_raw DOUBLE PRECISION;
  v_composite DOUBLE PRECISION;
  v_features JSONB;
BEGIN
  SELECT f.user_rating, f.route_rejected, p.raw_score, p.features
  INTO v_rating, v_rejected, v_raw, v_features
  FROM predictions p
  LEFT JOIN feedback f ON f.prediction_id = p.id
  WHERE p.id = p_prediction_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_rejected := CASE WHEN COALESCE(v_rejected, FALSE) THEN 1.0 ELSE 0.0 END;

  v_proxy := LEAST(1.0, GREATEST(0.0, v_raw / 10.0));
  IF (v_features->>'mergeClusterCount')::INT >= 2 THEN
    v_proxy := LEAST(1.0, v_proxy + 0.15);
  END IF;
  IF (v_features->>'delayRatio')::DOUBLE PRECISION >= 0.25 THEN
    v_proxy := LEAST(1.0, v_proxy + 0.1);
  END IF;

  IF v_rating IS NOT NULL THEN
    v_composite := 0.6 * (v_rating / 10.0) + 0.25 * v_rejected + 0.15 * v_proxy;
  ELSE
    v_composite := v_proxy;
  END IF;

  INSERT INTO training_labels (
    prediction_id, composite_target, rating_component,
    rejected_component, proxy_component, source
  ) VALUES (
    p_prediction_id,
    v_composite,
    CASE WHEN v_rating IS NOT NULL THEN v_rating / 10.0 END,
    v_rejected,
    v_proxy,
    CASE WHEN v_rating IS NOT NULL THEN 'feedback' ELSE 'bootstrap' END
  )
  ON CONFLICT (prediction_id) DO UPDATE SET
    composite_target = EXCLUDED.composite_target,
    rating_component = EXCLUDED.rating_component,
    rejected_component = EXCLUDED.rejected_component,
    proxy_component = EXCLUDED.proxy_component,
    source = EXCLUDED.source,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;
