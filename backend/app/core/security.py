from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
import hashlib
import uuid
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings

# Argon2id password hasher with secure production defaults:
# Memory: 64 MB (65536 KB), Time cost: 3 iterations, Parallelism: 4 threads
hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hash password using modern Argon2id algorithm."""
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    return hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id hash."""
    try:
        return hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def hash_token_identifier(token: str) -> str:
    """Hash refresh token using SHA-256 for secure DB storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
    user_id: str,
    jti: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, datetime]:
    """
    Create a signed JWT access token.
    Returns: (token_string, jti, expires_at)
    """
    now = datetime.now(timezone.utc)
    token_jti = jti or str(uuid.uuid4())
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode: Dict[str, Any] = {
        "sub": str(user_id),
        "jti": token_jti,
        "type": "access",
        "iat": now,
        "exp": expire,
    }
    if additional_claims:
        to_encode.update(additional_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt, token_jti, expire


def create_refresh_token(
    user_id: str,
    jti: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str, datetime]:
    """
    Create a signed JWT refresh token.
    Returns: (token_string, jti, expires_at)
    """
    now = datetime.now(timezone.utc)
    token_jti = jti or str(uuid.uuid4())
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))

    to_encode = {
        "sub": str(user_id),
        "jti": token_jti,
        "type": "refresh",
        "iat": now,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt, token_jti, expire


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate signature and expiry of a JWT token.
    Raises jwt.PyJWTError on invalid or expired token.
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "iat", "sub", "jti", "type"]},
    )
