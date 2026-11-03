"""Records which version of the legal texts (Terms, Privacy Policy, consent to personal-data
processing) a user accepted at sign-up.

The browser sends ``legal_version`` (YYYY-MM-DD) with the sign-up form. When
``LEARNHOUSE_REQUIRE_LEGAL_CONSENT`` is on, a public password sign-up without it is refused. OAuth sign-ups
and accounts created by a signed-in admin are not forced to send it.
"""
import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

_VERSION_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def legal_consent_required() -> bool:
    return os.environ.get("LEARNHOUSE_REQUIRE_LEGAL_CONSENT", "").strip().lower() in ("1", "true", "yes")


def check_legal_version(version: Optional[str], *, enforce: bool) -> Optional[str]:
    """Return the cleaned version, or raise 422 when it is malformed or required but missing."""
    version = (version or "").strip() or None
    if version is not None and not _VERSION_RE.match(version):
        raise HTTPException(status_code=422, detail="legal_version must look like 2026-11-03")
    if enforce and legal_consent_required() and version is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "LEGAL_CONSENT_REQUIRED",
                "message": "You must accept the Terms of Use, the Privacy Policy and the consent to personal data processing",
            },
        )
    return version


def apply_legal_consent(user, version: Optional[str], *, enforce: bool) -> None:
    """Validate ``version`` and stamp it on ``user`` (call before the user is saved)."""
    clean = check_legal_version(version, enforce=enforce)
    if clean:
        user.legal_consent_version = clean
        user.legal_consent_at = datetime.now(timezone.utc).isoformat()
