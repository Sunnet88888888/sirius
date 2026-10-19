"""
Platform-level switch that hides whole features for this deployment.

The environment variable SIRIUS_HIDDEN_FEATURES holds a comma-separated list of
feature keys (for example "boards,playgrounds"). A hidden feature:

- resolves as disabled for every organization, whatever the plan or the admin
  toggle says (see resolve_feature),
- answers 404 on its API routes (see require_feature_visible),
- is left out of the navigation by the web app (resolved_features[...]["hidden"]).

The code and the data stay in place. Unset the variable (or leave it empty) and
the features behave as before.
"""

import os

from fastapi import HTTPException


def hidden_features() -> frozenset[str]:
    raw = os.environ.get("SIRIUS_HIDDEN_FEATURES", "")
    return frozenset(p.strip().lower() for p in raw.split(",") if p.strip())


def is_feature_hidden(feature: str) -> bool:
    return feature.lower() in hidden_features()


def require_feature_visible(feature: str):
    """FastAPI dependency factory: 404 when the feature is hidden on this platform."""

    async def _dependency():
        if is_feature_hidden(feature):
            raise HTTPException(status_code=404, detail=f"{feature.capitalize()} is not available")

    return _dependency
