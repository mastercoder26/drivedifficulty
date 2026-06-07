"""Export labeled rows from Supabase for offline training."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path

SCHEMA_PATH = Path("shared/features.schema.json")
FEATURES = json.loads(SCHEMA_PATH.read_text())["features"]


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Supabase env vars required")

    from supabase import create_client

    client = create_client(url, key)
    resp = (
        client.table("training_labels")
        .select("composite_target, predictions(features, raw_score)")
        .limit(5000)
        .execute()
    )

    out = Path("ml/training.csv")
    out.parent.mkdir(parents=True, exist_ok=True)

    with out.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([*FEATURES, "d_base", "y"])
        for row in resp.data or []:
            pred = row.get("predictions") or {}
            features = pred.get("features") or {}
            d_base = pred.get("raw_score", 0)
            y = float(row.get("composite_target", 0)) * 10
            writer.writerow([features.get(k, 0) for k in FEATURES] + [d_base, y])


if __name__ == "__main__":
    main()
