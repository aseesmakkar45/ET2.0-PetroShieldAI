from fastapi import APIRouter
from simulation.ais_generator import generate_vessels
import json
from pathlib import Path

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"


@router.get("/map")
async def get_map_data():
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

    vessels = generate_vessels(count=45)

    # SPR facilities
    spr_facilities = [
        {"id": "spr_vizag", "name": "Visakhapatnam SPR", "capacity_mb": 9.75, "fill_pct": 78, "lat": 17.68, "lng": 83.21},
        {"id": "spr_mangaluru", "name": "Mangaluru SPR", "capacity_mb": 1.5, "fill_pct": 82, "lat": 12.91, "lng": 74.86},
        {"id": "spr_padur", "name": "Padur SPR", "capacity_mb": 2.5, "fill_pct": 85, "lat": 12.97, "lng": 74.78}
    ]

    return {
        "vessels": vessels,
        "routes": routes,
        "chokepoints": chokepoints,
        "ports": ports,
        "refineries": refineries,
        "oil_fields": oil_fields,
        "spr_facilities": spr_facilities
    }
