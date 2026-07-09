from fastapi import APIRouter, Query
from services.risk_engine import generate_risk_signals, generate_price_history
import random
from datetime import datetime

router = APIRouter()


@router.get("/signals")
async def get_risk_signals(count: int = Query(default=10, ge=1, le=50)):
    return generate_risk_signals(count=count)


@router.get("/prices")
async def get_price_history(days: int = Query(default=90, ge=7, le=365)):
    points = generate_price_history(days=days)
    current = points[-1]["brent_usd"] if points else 82.5
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
    signals = generate_risk_signals(count=12)
    news_items = []
    sources = ["Reuters", "Bloomberg", "S&P Global Platts", "Argus Media", "EIA", "IEA", "MarineTraffic"]

    for i, sig in enumerate(signals):
        news_items.append({
            "id": f"news_{i}",
            "headline": sig["title"],
            "summary": sig["description"],
            "source": sig["source"],
            "published_at": sig["timestamp"],
            "risk_score": sig["risk_score"],
            "affected_countries": sig["affected_countries"],
            "tags": sig["tags"],
            "url": None
        })

    return news_items
