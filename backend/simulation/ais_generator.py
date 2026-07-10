"""
AIS Generator – produces synthetic vessel position data simulating
tanker movements along active shipping routes.
"""
import random
import math
from datetime import datetime
from typing import List, Dict
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

VESSEL_NAMES = [
    "CRUDE TITAN", "PERSIAN NAVIGATOR", "GULF EMPRESS", "ARABIAN STAR",
    "MUMBAI SPIRIT", "VADINAR PIONEER", "OCEAN CONDUCTOR", "ENERGY HORIZON",
    "SUEZ CHAMPION", "BRENT VOYAGER", "INDIA PRIDE", "RED SEA MARINER",
    "CAPE GLORY", "ARCTIC SOVEREIGN", "VOLGA SPIRIT", "CAUCASUS EAGLE",
    "NIGERIA STAR", "ANGOLA SUNRISE", "TEXAS TITAN", "PERMIAN CARRIER"
]

FLAGS = ["Panama", "Marshall Islands", "Bahamas", "Liberia", "Malta", "Singapore", "India"]

VESSEL_TYPES = ["VLCC", "Suezmax", "Aframax", "ULCC"]


def _interpolate_route(waypoints: List[Dict], progress: float) -> Dict:
    """Interpolate position along waypoints at given progress (0-1)."""
    if not waypoints or len(waypoints) < 2:
        return waypoints[0] if waypoints else {"lat": 20.0, "lng": 65.0}
    
    # Find segment
    n = len(waypoints) - 1
    seg_progress = progress * n
    seg_idx = min(int(seg_progress), n - 1)
    seg_frac = seg_progress - seg_idx
    
    p1 = waypoints[seg_idx]
    p2 = waypoints[seg_idx + 1]
    
    lat = p1["lat"] + (p2["lat"] - p1["lat"]) * seg_frac
    lng = p1["lng"] + (p2["lng"] - p1["lng"]) * seg_frac
    
    # Add small noise
    lat += random.gauss(0, 0.2)
    lng += random.gauss(0, 0.2)
    
    return {"lat": round(lat, 4), "lng": round(lng, 4)}


def generate_vessels(count: int = 45) -> List[Dict]:
    """Return only real-time tracked AIS vessels (synthetic generator fallback removed)."""
    try:
        from services.real_ais import get_real_vessels
        return get_real_vessels()
    except Exception as e:
        print(f"[AIS] Error loading real vessels: {e}")
        return []
