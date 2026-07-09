"""
PetroShield AI – FastAPI Backend Entry Point
"""
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import init_db
from websocket.manager import (
    alert_manager, vessel_manager,
    risk_alert_broadcaster, vessel_position_broadcaster
)
from routes import dashboard, signals, scenarios, procurement, spr, knowledge_graph, map as map_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    # Start background broadcasters
    asyncio.create_task(risk_alert_broadcaster())
    asyncio.create_task(vessel_position_broadcaster())
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="PetroShield AI",
    description="AI-Driven Energy Supply Chain Resilience Platform",
    version="1.0.0",
    lifespan=lifespan
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ─── REST Routes ──────────────────────────────────────────────────────────────
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(signals.router, prefix="/api", tags=["Signals"])
app.include_router(scenarios.router, prefix="/api", tags=["Scenarios"])
app.include_router(procurement.router, prefix="/api", tags=["Procurement"])
app.include_router(spr.router, prefix="/api", tags=["SPR"])
app.include_router(knowledge_graph.router, prefix="/api", tags=["Knowledge Graph"])
app.include_router(map_router.router, prefix="/api", tags=["Map"])


# ─── WebSocket Endpoints ──────────────────────────────────────────────────────

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await alert_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)


@app.websocket("/ws/vessels")
async def ws_vessels(websocket: WebSocket):
    await vessel_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        vessel_manager.disconnect(websocket)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME, "demo_mode": settings.DEMO_MODE}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
