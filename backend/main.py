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
from routes import dashboard, signals, scenarios, procurement, spr, knowledge_graph, map as map_router, decision_replay


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    
    # Initialize live AIS stream if API key is configured
    if settings.AISSTREAM_API_KEY:
        try:
            from services.real_ais import connect_ais_stream, _api_key_in_use
            import services.real_ais as real_ais_module
            real_ais_module._api_key_in_use = settings.AISSTREAM_API_KEY
            real_ais_module._listener_task = asyncio.create_task(
                connect_ais_stream(settings.AISSTREAM_API_KEY)
            )
            print("[INIT] Started live AIS stream listener on boot.")
        except Exception as e:
            print(f"[INIT] Failed to start AIS stream on boot: {e}")
    
    # Pre-run and cache standard demo scenarios for instant display
    try:
        from agents.orchestrator import run_petroshield_pipeline
        
        # 1. Strait of Hormuz Blockade
        run_petroshield_pipeline(
            "CRITICAL conflict and sanctions blockade: Iran blockades the Strait of Hormuz. Brent price spikes 20% on OPEC quota anxiety.",
            source_type="NEWS",
            ais_data=[]
        )
        
        # 2. Red Sea Shipping Crisis
        run_petroshield_pipeline(
            "CRITICAL shipping crisis: Houthi forces launch missile strikes in the Bab-el-Mandeb strait, forcing Suez route diversions.",
            source_type="NEWS",
            ais_data=[]
        )
        
        # 3. OPEC Voluntary Cuts
        run_petroshield_pipeline(
            "POLICY change: OPEC+ announces emergency production cuts of 2.0 mbpd, causing global supply shortages.",
            source_type="POLICY",
            ais_data=[]
        )
        print("[INIT] Pre-cached the 3 hackathon demo scenarios successfully.")
    except Exception as e:
        print(f"[WARNING] Failed to pre-cache scenarios: {e}")

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
app.include_router(decision_replay.router, prefix="/api", tags=["Decision Replay"])


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
