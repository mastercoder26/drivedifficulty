#!/usr/bin/env python3
"""Pairwise ranking loss for alternate-route training."""

from __future__ import annotations

import numpy as np


def pairwise_ranking_loss(
    scores: np.ndarray,
    labels: np.ndarray,
    margin: float = 0.0,
) -> float:
    """Hinge loss: penalize when easier route (lower label) scores higher."""
    n = len(scores)
    if n < 2:
        return 0.0

    loss = 0.0
    pairs = 0
    for i in range(n):
        for j in range(i + 1, n):
            if labels[i] == labels[j]:
                continue
            if labels[i] > labels[j]:
                diff = scores[j] - scores[i] + margin
            else:
                diff = scores[i] - scores[j] + margin
            if diff > 0:
                loss += diff
            pairs += 1

    return float(loss / pairs) if pairs else 0.0
