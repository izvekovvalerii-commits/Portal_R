from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from .config import settings

PBKDF2_ITERATIONS = 100_000


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Format: pbkdf2_sha256$<iterations>$<salt_b64>$<digest_b64>
    try:
        algo, iterations_raw, salt_b64, digest_b64 = hashed_password.split("$")
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        expected = base64.b64decode(digest_b64.encode("utf-8"))
    except Exception:
        return False

    actual = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def get_password_hash(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256$%s$%s$%s" % (
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("utf-8"),
        base64.b64encode(digest).decode("utf-8"),
    )


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None
