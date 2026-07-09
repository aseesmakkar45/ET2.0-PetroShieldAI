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
    """Generate synthetic AIS vessel data."""
    with open(DATA_DIR / "routes.json") as f:
        routes = json.load(f)
    
    active_routes = [r for r in routes if r["is_active"]]
    vessels = []
    
    used_names = set()
    
    for i in range(count):
        route = random.choice(active_routes)
        name = random.choice([n for n in VESSEL_NAMES if n not in used_names] or VESSEL_NAMES)
        used_names.add(name)
        
        progress = random.uniform(0, 1)
        position = _interpolate_route(route["waypoints"], progress)
        
        # Compute heading based on direction along route
        if len(route["waypoints"]) >= 2:
            wp_idx = min(int(progress * (len(route["waypoints"]) - 1)), len(route["waypoints"]) - 2)
            p1 = route["waypoints"][wp_idx]
            p2 = route["waypoints"][wp_idx + 1]
            heading = math.degrees(math.atan2(p2["lng"] - p1["lng"], p2["lat"] - p1["lat"])) % 360
        else:
            heading = random.uniform(0, 360)
        
        vessel_type = random.choice(VESSEL_TYPES)
        dwt = {"VLCC": 280000, "Suezmax": 160000, "Aframax": 100000, "ULCC": 440000}[vessel_type]
        dwt += random.randint(-20000, 20000)
        
        vessels.append({
            "mmsi": str(random.randint(200000000, 780000000)),
            "name": name,
            "vessel_type": vessel_type,
            "flag": random.choice(FLAGS),
            "dwt": dwt,
            "current_position": position,
            "speed_knots": round(random.uniform(10, 16), 1),
            "heading": round(heading, 1),
            "origin_port": route["from_location"],
            "destination_port": route["to_location"],
            "cargo": random.choice(["Crude Oil", "Dirty Petroleum"]),
            "eta": f"{random.randint(1, 20)} days",
            "route_id": route["id"]
        })
    
    return vessels
