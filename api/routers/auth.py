"""
Auth router — register, login, refresh, logout.
Access token returned in JSON body.
Refresh token stored in httpOnly cookie.
"""

from fastapi import APIRouter, HTTPException, Request, Response

from models import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenError,
    REFRESH_TOKEN_EXPIRE_SECONDS,
)
from services.users import UserService

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE_NAME = "refresh_token"
_COOKIE_OPTS = dict(
    key=_COOKIE_NAME,
    httponly=True,
    secure=False,   # set True in production (HTTPS only)
    samesite="lax",
    max_age=REFRESH_TOKEN_EXPIRE_SECONDS,
    path="/api/auth",
)


# ── register ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201, response_model=UserResponse)
async def register(body: RegisterRequest):
    """Create a new user account."""
    password_hash = hash_password(body.password)
    user = await UserService.create_user(body.email, password_hash)
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        plan=user["plan"],
        created_at=user["created_at"],
    )


# ── login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response):
    """Authenticate and return access + refresh tokens."""
    user = await UserService.get_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(value=refresh_token, **_COOKIE_OPTS)
    return TokenResponse(access_token=access_token)


# ── refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response):
    """Issue a new access token using the refresh cookie."""
    refresh_token = request.cookies.get(_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = decode_token(refresh_token)
    except TokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Wrong token type")

    user_id = payload["sub"]
    # Verify user still exists and is active
    user = await UserService.get_by_id(user_id)
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="User not found or inactive")

    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    response.set_cookie(value=new_refresh, **_COOKIE_OPTS)
    return TokenResponse(access_token=new_access)


# ── logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(response: Response):
    """Clear the refresh token cookie."""
    response.delete_cookie(key=_COOKIE_NAME, path="/api/auth")
    return {"message": "Logged out"}
