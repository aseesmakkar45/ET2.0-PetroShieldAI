"""
Auth Routes – Secure login endpoint for PetroShield AI portal.
All credentials are read from server-side environment variables only.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
async def login(body: LoginRequest):
    """
    Validates portal credentials against server-side env vars.
    Returns success on match. Never exposes credentials to client.
    """
    if body.email.strip().lower() == settings.PORTAL_EMAIL.strip().lower() and body.password.strip() == settings.PORTAL_PASSWORD.strip():
        return {"success": True, "email": body.email}

    raise HTTPException(status_code=401, detail="Invalid credentials")
