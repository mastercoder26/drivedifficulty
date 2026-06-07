#!/usr/bin/env python3
"""Train LightGBM residual model: target = composite_label - raw_score."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

try:
    from supabase import create_client
except ImportError:
    create_client = None

from rank_loss import pairwise_hinge_loss


def load_schema(path: Path) -> list[str]:
    return json.loads(path.read_text())["features"]


def load_from_csv(csv_path: Path, feature_names: list[str]) -> tuple[np.ndarray, np.ndarray]:
    df = pd.read_csv(csv_path)
    x = df[feature_names].values.astype(float)
    y = df["y"].values.astype(float) - df["d_base"].values.astype(float)
    return x, y


def load_from_supabase(feature_names: list[str]) -> tuple[np.ndarray, np.ndarray]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or create_client is None:
        raise RuntimeError("Supabase not configured")

    client = create_client(url, key)
    rows = (
        client.table("training_labels")
        .select("composite_target, predictions(features, raw_score)")
        .limit(5000)
        .execute()
        .data
    )

    features_list: list[list[float]] = []
    targets: list[float] = []
    for row in rows or []:
        pred = row.get("predictions") or {}
        feat = pred.get("features") or {}
        vec = [float(feat.get(k, 0)) for k in feature_names]
        raw = float(pred.get("raw_score", 0))
        composite = float(row["composite_target"]) * 10
        features_list.append(vec)
        targets.append(composite - raw)

    if not features_list:
        raise RuntimeError("No training labels found")

    return np.array(features_list), np.array(targets)


def synthetic_bootstrap(n: int, n_features: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    x = rng.random((n, n_features))
    y = rng.normal(0, 0.8, n)
    return x, y


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, default=Path("shared/features.schema.json"))
    parser.add_argument("--csv", type=Path, help="Training CSV from export_training_data.py")
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts/residual.lgb"))
    parser.add_argument("--ranking-lambda", type=float, default=0.15)
    args = parser.parse_args()

    feature_names = load_schema(args.schema)

    try:
        if args.csv and args.csv.exists():
            x, y = load_from_csv(args.csv, feature_names)
        else:
            x, y = load_from_supabase(feature_names)
    except Exception:
        x, y = synthetic_bootstrap(200, len(feature_names))

    split = int(len(x) * 0.8)
    x_train, x_val = x[:split], x[split:]
    y_train, y_val = y[:split], y[split:]

    train_data = lgb.Dataset(x_train, label=y_train, feature_name=feature_names)
    val_data = lgb.Dataset(x_val, label=y_val, reference=train_data)

    params = {
        "objective": "regression",
        "metric": "mae",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.9,
        "bagging_freq": 1,
        "verbose": -1,
    }

    model = lgb.train(
        params,
        train_data,
        num_boost_round=300,
        valid_sets=[val_data],
        callbacks=[lgb.early_stopping(30), lgb.log_evaluation(20)],
    )

    val_pred = model.predict(x_val)
    rank_loss = pairwise_hinge_loss(val_pred, y_val)
    metrics = {
        "val_mae": float(np.mean(np.abs(val_pred - y_val))),
        "val_ranking_hinge": float(rank_loss),
        "ranking_lambda": args.ranking_lambda,
        "n_train": len(x_train),
        "n_val": len(x_val),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(args.output))
    metrics_path = args.output.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
