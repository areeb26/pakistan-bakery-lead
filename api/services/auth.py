"""
Auth service — pure functions for password hashing and JWT handling.
No database access here. All functions are synchronous and side-effect free.
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, ExpiredSignatureError, jwt

# ── configuration ─────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production-use-a-long-random-string")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = int(os.getenv("ACCESS_TOKEN_EXPIRE_SECONDS", "900"))    # 15 min
REFRESH_TOKEN_EXPIRE_SECONDS = int(os.getenv("REFRESH_TOKEN_EXPIRE_SECONDS", "604800"))  # 7 days


# ── exceptions ────────────────────────────────────────────────────────────────

class TokenError(Exception):
    """Raised when a JWT cannot be decoded or is invalid."""


# ── password hashing ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the plain-text password."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the bcrypt hash."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── token creation ────────────────────────────────────────────────────────────

def create_access_token(user_id: str, expires_in_seconds: int = ACCESS_TOKEN_EXPIRE_SECONDS) -> str:
    """Create a short-lived JWT access token."""
    return _make_token(user_id, token_type="access", expires_in=expires_in_seconds)


def create_refresh_token(user_id: str, expires_in_seconds: int = REFRESH_TOKEN_EXPIRE_SECONDS) -> str:
    """Create a long-lived JWT refresh token (stored in httpOnly cookie)."""
    return _make_token(user_id, token_type="refresh", expires_in=expires_in_seconds)


def _make_token(user_id: str, token_type: str, expires_in: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── token decoding ────────────────────────────────────────────────────────────

def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT. Returns the payload dict.
    Raises TokenError on any failure (expired, tampered, malformed).
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise TokenError("Token has expired")
    except JWTError as exc:
        raise TokenError(f"Invalid token: {exc}")
