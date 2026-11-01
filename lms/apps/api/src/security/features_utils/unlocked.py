"""
Platform-level switch that unlocks features the open-source edition blocks.

The environment variable SIRIUS_UNLOCKED_FEATURES holds a comma-separated list
of feature keys (for example "analytics_advanced"). A key listed here is no
longer treated as Enterprise-only when the platform runs in OSS mode, so its
API routes work without an enterprise plan.

It is the counterpart of SIRIUS_HIDDEN_FEATURES (hidden.py). Unset the
variable (or leave it empty) and nothing changes.
"""

import os


def unlocked_features() -> frozenset[str]:
    raw = os.environ.get("SIRIUS_UNLOCKED_FEATURES", "")
    return frozenset(p.strip().lower() for p in raw.split(",") if p.strip())


def is_feature_unlocked(feature: str) -> bool:
    return feature.lower() in unlocked_features()
