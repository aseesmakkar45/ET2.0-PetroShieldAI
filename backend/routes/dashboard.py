from fastapi import APIRouter
from services.risk_engine import (
    generate_risk_signals, compute_overall_risk_score,
    compute_energy_resilience_score, generate_price_history
)
from datetime import datetime
import json
from pathlib import Path
import random

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"


@router.get("/dashboard")
async def get_dashboard():
    signals = generate_risk_signals(count=6)
    risk_score = compute_overall_risk_score(signals)

    resilience = compute_energy_resilience_score(
        supplier_diversity=62,
        risk_score=risk_score,
        spr_level=72,
        shipping_delay_factor=35,
        price_volatility=28,
        inventory_level=78
    )

    brent = 82.5 + random.uniform(-3, 3)
    brent_change = random.uniform(-2.5, 3.5)

    kpi_cards = [
        {"id": "brent", "label": "Brent Crude", "value": f"${brent:.2f}", "unit": "USD/bbl",
         "change_pct": round(brent_change, 2), "trend": "up" if brent_change > 0 else "down",
         "status": "warning" if brent > 90 else "normal"},
        {"id": "imports", "label": "Active Imports", "value": "4.5", "unit": "MBD",
         "change_pct": -1.2, "trend": "down", "status": "normal"},
        {"id": "vessels", "label": "Tracked Vessels", "value": "48", "unit": "tankers",
         "change_pct": 3.1, "trend": "up", "status": "normal"},
        {"id": "spr", "label": "SPR Cover", "value": "64", "unit": "days",
         "change_pct": -2.0, "trend": "down", "status": "warning"},
        {"id": "risk", "label": "Overall Risk", "value": str(round(risk_score)), "unit": "/100",
         "change_pct": 5.2, "trend": "up", "status": "warning" if risk_score > 60 else "normal"},
        {"id": "resilience", "label": "Resilience Score", "value": str(resilience), "unit": "/100",
         "change_pct": -1.5, "trend": "down", "status": "warning" if resilience < 60 else "normal"}
    ]

    return {
        "energy_resilience_score": resilience,
        "overall_risk_score": risk_score,
        "risk_level": "high" if risk_score > 65 else "moderate" if risk_score > 40 else "low",
        "brent_price_usd": round(brent, 2),
        "brent_change_pct": round(brent_change, 2),
        "active_imports_mbd": 4.5,
        "active_vessels": 48,
        "active_alerts": len([s for s in signals if s["risk_level"] in ["high", "critical"]]),
        "spr_days_cover": 64,
        "kpi_cards": kpi_cards,
        "top_risks": signals[:3],
        "latest_recommendations": [
            "Accelerate diversification away from Hormuz-dependent routes",
            "Increase SPR buffer by 15 days before Q3 monsoon season",
            "Qualify US Permian crude for Jamnagar refinery compatibility"
        ],
        "timestamp": datetime.utcnow().isoformat()
    }
