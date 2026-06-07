#!/usr/bin/env python3
"""Evaluate model quality: MAE, ranking accuracy, ECE."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from rank_loss import ranking_accuracy


def expected_calibration_error(y_true: np.ndarray, y_pred: np.ndarray, bins: int = 10) -> float:
    if len(y_true) == 0:
        return 0.0
    bucket = np.linspace(0, 10, bins + 1)
    ece = 0.0
    for i in range(bins):
        mask = (y_pred >= bucket[i]) & (y_pred < bucket[i + 1])
        if not np.any(mask):
            continue
        ece += (np.sum(mask) / len(y_true)) * abs(np.mean(y_true[mask]) - np.mean(y_pred[mask]))
    return float(ece)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", type=Path, help="JSON list of {label, score}")
    parser.add_argument("--metrics", type=Path, help="Training metrics JSON from train.py")
    parser.add_argument("--min-ranking", type=float, default=0.0)
    parser.add_argument("--max-ece", type=float, default=10.0)
    parser.add_argument("--max-mae", type=float, default=10.0)
    args = parser.parse_args()

    if args.metrics and args.metrics.exists():
        metrics = json.loads(args.metrics.read_text())
        print(json.dumps({"source": "training_metrics", **metrics}, indent=2))
        if metrics.get("val_mae", 0) > args.max_mae:
            sys.exit(1)
        return

    if not args.predictions or not args.predictions.exists():
        print(json.dumps({"status": "skipped", "reason": "no predictions file"}, indent=2))
        return

    data = json.loads(args.predictions.read_text())
    y_true = np.array([d["label"] for d in data], dtype=float)
    y_pred = np.array([d["score"] for d in data], dtype=float)

    mae = float(np.mean(np.abs(y_true - y_pred)))
    ece = expected_calibration_error(y_true, y_pred)
    ranking = ranking_accuracy(y_pred, y_true)

    report = {
        "mae": mae,
        "ece": ece,
        "ranking_accuracy": ranking,
        "n": len(y_true),
    }
    print(json.dumps(report, indent=2))

    if ranking < args.min_ranking or ece > args.max_ece or mae > args.max_mae:
        sys.exit(1)


if __name__ == "__main__":
    main()
