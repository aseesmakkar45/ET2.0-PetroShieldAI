"""
Map Routes – serves live vessel positions from AISstream.io and static overlay data.
"""
from fastapi import APIRouter
from services.real_ais import get_real_vessels, get_vessel_count
from agents.orchestrator import get_active_state
import json
from pathlib import Path

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"


@router.get("/map")
async def get_map_data():
    state = get_active_state()
    
    with open(DATA_DIR / "routes.json") as f:
        routes = json.load(f)
    with open(DATA_DIR / "chokepoints.json") as f:
        chokepoints = json.load(f)
    with open(DATA_DIR / "ports.json") as f:
        ports = json.load(f)
    with open(DATA_DIR / "refineries.json") as f:
        refineries = json.load(f)
    with open(DATA_DIR / "oil_fields.json") as f:
        oil_fields = json.load(f)

    # Live vessels from AISstream.io WebSocket — no synthetic data
    vessels = get_real_vessels()

    # Adjust route color status based on active orchestrator risk signal
    if state and state.risk_signal:
        sig = state.risk_signal
        for r in routes:
            # Highlight affected routes as RED/CRITICAL
            if r["id"] in sig.affected_corridors:
                r["risk_score"] = 95.0
                r["is_disrupted"] = True
            else:
                r["is_disrupted"] = False
                
        # Adjust chokepoint threat status
        for cp in chokepoints:
            if cp["id"] in sig.affected_chokepoints:
                cp["risk_score"] = int(sig.disruption_probability)
                cp["status"] = sig.severity
            else:
                cp["status"] = "NORMAL"

    # Strategic reserve fill capacities
    spr_facilities = [
        {"id": "spr_vizag", "name": "Visakhapatnam SPR", "capacity_mb": 9.77, "fill_pct": 78, "lat": 17.68, "lng": 83.21},
        {"id": "spr_mangaluru", "name": "Mangaluru SPR", "capacity_mb": 11.0, "fill_pct": 82, "lat": 12.91, "lng": 74.86},
        {"id": "spr_padur", "name": "Padur SPR", "capacity_mb": 18.37, "fill_pct": 85, "lat": 12.97, "lng": 74.78}
    ]

    return {
        "vessels": vessels,
        "routes": routes,
        "chokepoints": chokepoints,
        "ports": ports,
        "refineries": refineries,
        "oil_fields": oil_fields,
        "spr_facilities": spr_facilities,
        "recommended_routes": state.procurement_plan.recommended_routes_geojson if (state and state.procurement_plan) else []
    }
