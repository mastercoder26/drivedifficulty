#!/usr/bin/env python3
"""Export LightGBM residual model to ONNX."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True, help="LightGBM model file")
    parser.add_argument("--schema", type=Path, default=Path("shared/features.schema.json"))
    parser.add_argument("--output", type=Path, default=Path("backend/models/residual_v1.onnx"))
    args = parser.parse_args()

    schema = json.loads(args.schema.read_text())
    n_features = len(schema["features"])

    booster = lgb.Booster(model_file=str(args.model))
    # Wrap booster as sklearn estimator for skl2onnx
    from lightgbm import LGBMRegressor

    reg = LGBMRegressor()
    reg._Booster = booster
    reg._n_features = n_features
    reg.fitted_ = True

    initial_type = [("features", FloatTensorType([None, n_features]))]
    onnx_model = convert_sklearn(reg, initial_types=initial_type, target_opset=12)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "wb") as f:
        f.write(onnx_model.SerializeToString())

    print(f"Exported ONNX model to {args.output}")


if __name__ == "__main__":
    main()
