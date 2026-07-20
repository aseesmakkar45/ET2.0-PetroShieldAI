"""
PetroShield AI – FastAPI Backend Entry Point
"""
import asyncio
import hashlib
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import init_db
import sys
import queue
from websocket.manager import (
    alert_manager, vessel_manager, log_manager,
    risk_alert_broadcaster, vessel_position_broadcaster
)
from routes import dashboard, signals, scenarios, procurement, spr, knowledge_graph, map as map_router, decision_replay, reports, auth, weather


# ─── Live Stdout Redirector to WebSocket ──────────────────────────────────────

# Thread-safe queue to buffer stdout/stderr
log_queue = queue.Queue()

class QueueStdoutRedirector:
    def __init__(self, original):
        self.original = original

    def write(self, message):
        self.original.write(message)
        stripped = message.strip()
        if stripped:
            lower_msg = stripped.lower()
            # Filter out WebSocket connection/frame logs and keepalive pings to avoid recursive loops
            if any(x in lower_msg for x in ["/ws/", "websocket", "127.0.0.1", "ping", "pong", "keepalive"]):
                return
            log_queue.put(stripped)

    def flush(self):
        self.original.flush()

# Apply standard out redirection
sys.stdout = QueueStdoutRedirector(sys.stdout)
sys.stderr = QueueStdoutRedirector(sys.stderr)


async def log_broadcaster():
    """
    Background task to broadcast buffered log lines to connected clients.
    """
    print("[INIT] Log broadcaster WebSocket stream initialized.")
    while True:
        await asyncio.sleep(0.05)
        while not log_queue.empty():
            try:
                line = log_queue.get_nowait()
                if log_manager.active_connections:
                    await log_manager.broadcast({
                        "type": "log_line",
                        "message": line,
                        "timestamp": datetime.utcnow().isoformat()
                    })
            except Exception:
                pass


# ─── Autonomous Brain Loop ────────────────────────────────────────────────────

# Set of article URL hashes already processed — prevents duplicate pipeline runs
_processed_article_hashes: set = set()

# Severity levels that trigger full pipeline (WARNING and above)
_PIPELINE_TRIGGER_SEVERITIES = {"WARNING", "ELEVATED", "CRITICAL"}

# Poll interval in seconds (45 minutes)
_NEWS_POLL_INTERVAL_SEC = 45 * 60


async def autonomous_brain_loop():
    """
    The PetroShield autonomous intelligence loop.

    Every 45 minutes:
      1. Fetches fresh geopolitical headlines from GDELT
      2. Scores each NEW article through the Risk Intelligence Agent
      3. If severity >= WARNING → fires the full 5-agent cascade
      4. Broadcasts real-time alerts + updated state to all WebSocket clients
      5. Saves the triggered pipeline state as the new active command center state
    """
    from services.live_connectors import connectors
    from agents.risk_intel import run_risk_intel_agent
    from agents.orchestrator import run_petroshield_pipeline, set_active_state
    from services.real_ais import get_real_vessels

    print("[BRAIN] Autonomous intelligence loop started.")

    # Stagger first run by 2 minutes to let startup settle
    await asyncio.sleep(120)

    while True:
        try:
            print(f"[BRAIN] Polling GDELT for new geopolitical signals...")
            articles = connectors.fetch_gdelt_news()

            new_articles_scored = 0
            pipeline_triggered = 0

            for article in articles:
                title = article.get("title") or ""
                url = article.get("url") or ""
                if not title:
                    continue

                # Deduplicate by hashing title+url
                article_hash = hashlib.md5(f"{title}{url}".encode()).hexdigest()
                if article_hash in _processed_article_hashes:
                    continue

                _processed_article_hashes.add(article_hash)
                new_articles_scored += 1

                # ── Step 1: Score article through Risk Intel Agent ──────────
                print(f"[BRAIN] Scoring article: {title[:80]}...")
                try:
                    # Build enriched signal combining headline + live AIS context
                    live_vessels = get_real_vessels()
                    vessel_context = f" {len(live_vessels)} vessels currently tracked in region." if live_vessels else ""
                    enriched_signal = f"{title}.{vessel_context}"

                    risk_signal = run_risk_intel_agent(
                        raw_signal=enriched_signal,
                        source_type="NEWS",
                        ais_data=live_vessels[:10] if live_vessels else []
                    )

                    severity = risk_signal.severity
                    score = risk_signal.disruption_probability
                    print(f"[BRAIN] → Severity: {severity} | Score: {score:.1f}% | Chokepoints: {risk_signal.affected_chokepoints}")

                    # Broadcast lightweight risk signal to all connected clients immediately
                    alert_payload = {
                        "type": "risk_alert",
                        "severity": severity,
                        "score": score,
                        "headline": title,
                        "source": article.get("source", "GDELT"),
                        "chokepoints": risk_signal.affected_chokepoints,
                        "corridors": risk_signal.affected_corridors,
                        "countries": risk_signal.affected_countries,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    await alert_manager.broadcast(alert_payload)

                    # ── Step 2: Full pipeline cascade if severity warrants ───
                    if severity in _PIPELINE_TRIGGER_SEVERITIES:
                        pipeline_triggered += 1
                        print(f"[BRAIN] ⚡ Severity={severity} — Triggering full 5-agent cascade...")

                        # Run full pipeline in thread pool to avoid blocking async loop
                        loop = asyncio.get_running_loop()
                        new_state = await loop.run_in_executor(
                            None,
                            lambda: run_petroshield_pipeline(
                                raw_signal=enriched_signal,
                                source_type="NEWS",
                                ais_data=live_vessels[:10] if live_vessels else []
                            )
                        )

                        # Update the active command center state
                        set_active_state(new_state)

                        # Broadcast full pipeline completion event to frontend
                        pipeline_event = {
                            "type": "pipeline_complete",
                            "severity": severity,
                            "score": score,
                            "headline": title,
                            "executive_brief": new_state.executive_brief or "",
                            "scenarios": len(new_state.scenario_result.scenarios) if new_state.scenario_result else 0,
                            "recommendations": [
                                r.tradeoff_summary for r in new_state.procurement_plan.recommendations
                            ] if new_state.procurement_plan else [],
                            "spr_runway_days": new_state.spr_advisory.current_runway_days if new_state.spr_advisory else 0,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        await alert_manager.broadcast(pipeline_event)
                        print(f"[BRAIN] ✅ Pipeline cascade complete. Brief: {(new_state.executive_brief or '')[:120]}...")

                except Exception as e:
                    print(f"[BRAIN] Error scoring article '{title[:60]}': {e}")
                    continue

            print(f"[BRAIN] Cycle done. New articles scored: {new_articles_scored} | Pipelines triggered: {pipeline_triggered}")

        except Exception as e:
            print(f"[BRAIN] Loop error: {e}")

        # Wait for next poll interval
        print(f"[BRAIN] Next intelligence cycle in {_NEWS_POLL_INTERVAL_SEC // 60} minutes.")
        await asyncio.sleep(_NEWS_POLL_INTERVAL_SEC)


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

    # ── Start the Autonomous Brain Loop ──────────────────────────────────────
    # This is the core intelligence engine: continuously polls GDELT, scores
    # each new article, and auto-triggers the full 5-agent cascade on threats.
    asyncio.create_task(autonomous_brain_loop())
    print("[INIT] Autonomous brain loop scheduled (first cycle in 2 minutes).")

    # ── Start Log Broadcaster ────────────────────────────────────────────────
    asyncio.create_task(log_broadcaster())

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
    allow_origins=["http://localhost:3000", "https://et-2-0-petro-shield-ai.vercel.app"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── REST Routes ──────────────────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api", tags=["Auth"])
app.include_router(weather.router,  prefix="/api", tags=["Weather"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(signals.router, prefix="/api", tags=["Signals"])
app.include_router(scenarios.router, prefix="/api", tags=["Scenarios"])
app.include_router(procurement.router, prefix="/api", tags=["Procurement"])
app.include_router(spr.router, prefix="/api", tags=["SPR"])
app.include_router(knowledge_graph.router, prefix="/api", tags=["Knowledge Graph"])
app.include_router(map_router.router, prefix="/api", tags=["Map"])
app.include_router(decision_replay.router, prefix="/api", tags=["Decision Replay"])
app.include_router(reports.router, prefix="/api", tags=["Reports"])


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


@app.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket):
    await log_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        log_manager.disconnect(websocket)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME, "demo_mode": settings.DEMO_MODE}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
