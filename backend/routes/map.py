"""
Map Routes – serves live vessel positions from AISstream.io and static overlay data.
"""
from fastapi import APIRouter
from simulation.ais_generator import generate_vessels
from agents.orchestrator import get_active_state
import json
from pathlib import Path

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"

# Cache static map data in memory
_cached_routes = None
_cached_chokepoints = None
_cached_ports = None
_cached_refineries = None
_cached_oil_fields = None

def _load_raw_static_data():
    global _cached_routes, _cached_chokepoints, _cached_ports, _cached_refineries, _cached_oil_fields
    if _cached_routes is None:
        with open(DATA_DIR / "routes.json") as f:
            _cached_routes = json.load(f)
        with open(DATA_DIR / "chokepoints.json") as f:
            _cached_chokepoints = json.load(f)
        with open(DATA_DIR / "ports.json") as f:
            _cached_ports = json.load(f)
        with open(DATA_DIR / "refineries.json") as f:
            _cached_refineries = json.load(f)
        with open(DATA_DIR / "oil_fields.json") as f:
            _cached_oil_fields = json.load(f)

@router.get("/map")
async def get_map_data():
    state = get_active_state()
    _load_raw_static_data()

    # Fast shallow mapping instead of deepcopying thousands of waypoints
    affected_corridors = set(state.risk_signal.affected_corridors) if (state and state.risk_signal) else set()
    affected_chokepoints = set(state.risk_signal.affected_chokepoints) if (state and state.risk_signal) else set()
    sig_disruption_prob = int(state.risk_signal.disruption_probability) if (state and state.risk_signal) else 0
    sig_severity = state.risk_signal.severity if (state and state.risk_signal) else "NORMAL"

    routes = []
    for r in _cached_routes:
        is_disrupted = r["id"] in affected_corridors
        routes.append({
            **r,
            "risk_score": 95.0 if is_disrupted else r.get("risk_score", 0.0),
            "is_disrupted": is_disrupted
        })

    chokepoints = []
    for cp in _cached_chokepoints:
        is_affected = cp["id"] in affected_chokepoints
        chokepoints.append({
            **cp,
            "risk_score": sig_disruption_prob if is_affected else cp.get("risk_score", 0),
            "status": sig_severity if is_affected else "NORMAL"
        })

    # Combined live AIS stream and simulated tankers
    vessels = generate_vessels()

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
        "ports": _cached_ports,
        "refineries": _cached_refineries,
        "oil_fields": _cached_oil_fields,
        "spr_facilities": spr_facilities,
        "recommended_routes": state.procurement_plan.recommended_routes_geojson if (state and state.procurement_plan) else []
    }
