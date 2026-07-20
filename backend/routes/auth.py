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
    if body.email == settings.PORTAL_EMAIL and body.password == settings.PORTAL_PASSWORD:
        return {"success": True, "email": body.email}

    raise HTTPException(status_code=401, detail="Invalid credentials")
