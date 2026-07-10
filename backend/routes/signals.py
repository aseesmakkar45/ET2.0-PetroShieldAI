"""
Signals Routes – serves risk signals and triggers the multi-agent pipeline.
"""
from fastapi import APIRouter, Body, Query
from agents.orchestrator import get_active_state, run_petroshield_pipeline
from services.risk_engine import generate_price_history
import random

router = APIRouter()


@router.get("/signals")
async def get_risk_signals(count: int = Query(default=10, ge=1, le=50)):
    state = get_active_state()
    if state and state.risk_signal:
        return [state.risk_signal.model_dump()]
    return []


@router.post("/signals/simulate")
async def simulate_signal(
    raw_signal: str = Body(..., embed=True),
    source_type: str = Body(default="NEWS", embed=True)
):
    """Trigger the full 5-agent pipeline for a new signal."""
    # Generate mock AIS tankers from active routes to run vessel anomaly detection
    from simulation.ais_generator import generate_vessels
    mock_vessels = generate_vessels(count=15)
    
    state = run_petroshield_pipeline(raw_signal, source_type, mock_vessels)
    return state.to_dict()


@router.get("/prices")
async def get_price_history(days: int = Query(default=90, ge=7, le=365)):
    points = generate_price_history(days=days)
    state = get_active_state()
    
    current = points[-1]["brent_usd"] if points else 82.5
    # If active scenario price is higher, shift the last points to match
    if state and state.scenario_result:
        base_price = state.scenario_result.scenarios[1].brent_price_mean
        current = base_price
        points[-1]["brent_usd"] = round(current, 2)
        points[-1]["india_basket_usd"] = round(current - 1.80, 2)

    prev = points[-2]["brent_usd"] if len(points) > 1 else current
    week_ago = points[-8]["brent_usd"] if len(points) > 7 else current

    return {
        "points": points,
        "current_brent": current,
        "change_24h_pct": round((current - prev) / prev * 100, 2),
        "change_7d_pct": round((current - week_ago) / week_ago * 100, 2),
        "volatility_index": round(random.uniform(18, 42), 1)
    }


@router.get("/news")
async def get_news():
    state = get_active_state()
    news_items = []
    
    if state and state.risk_signal:
        sig = state.risk_signal
        news_items.append({
            "id": "news_active",
            "headline": sig.event_summary,
            "summary": sig.explainability.reasoning_chain[0],
            "source": sig.source_type,
            "published_at": sig.timestamp,
            "risk_score": sig.disruption_probability,
            "affected_countries": sig.affected_countries,
            "tags": ["active_crisis"],
            "url": None
        })
        
    return news_items
