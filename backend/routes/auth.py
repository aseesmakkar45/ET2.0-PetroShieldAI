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
    Returns user role on success. Never exposes password hashes to client.
    """
    demo_users = [
        {
            "email": settings.DEMO_ADMIN_EMAIL,
            "password": settings.DEMO_ADMIN_PASSWORD,
            "role": "Admin",
            "name": "Administrator"
        },
        {
            "email": settings.DEMO_ANALYST_EMAIL,
            "password": settings.DEMO_ANALYST_PASSWORD,
            "role": "Analyst",
            "name": "Intelligence Analyst"
        },
        {
            "email": settings.DEMO_POLICY_EMAIL,
            "password": settings.DEMO_POLICY_PASSWORD,
            "role": "Policy Maker",
            "name": "Policy Maker"
        },
    ]

    for user in demo_users:
        if user["email"] == body.email and user["password"] == body.password:
            return {
                "success": True,
                "role": user["role"],
                "name": user["name"],
                "email": user["email"]
            }

    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/auth/demo-accounts")
async def get_demo_accounts():
    """
    Returns the list of demo account emails (NOT passwords) for display on the login page.
    Passwords are never sent to the client.
    """
    return [
        {"role": "Admin", "email": settings.DEMO_ADMIN_EMAIL},
        {"role": "Analyst", "email": settings.DEMO_ANALYST_EMAIL},
        {"role": "Policy Maker", "email": settings.DEMO_POLICY_EMAIL},
    ]
