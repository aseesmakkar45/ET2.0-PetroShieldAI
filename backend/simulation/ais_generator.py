"""
AIS Generator – produces synthetic vessel position data simulating
tanker movements along active shipping routes and combines them with live AIS data.
"""
import random
import time
import json
import math
from pathlib import Path
from typing import List, Dict, Any

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
    
    n = len(waypoints) - 1
    seg_progress = progress * n
    seg_idx = min(int(seg_progress), n - 1)
    seg_frac = seg_progress - seg_idx
    
    p1 = waypoints[seg_idx]
    p2 = waypoints[seg_idx + 1]
    
    lat = p1["lat"] + (p2["lat"] - p1["lat"]) * seg_frac
    lng = p1["lng"] + (p2["lng"] - p1["lng"]) * seg_frac
    
    return {"lat": round(lat, 5), "lng": round(lng, 5)}


def generate_vessels(count: int = 45) -> List[Dict[str, Any]]:
    """
    Returns combined vessel fleet:
    1. Real-time tracked AIS vessels from aisstream.io (data_source = 'LIVE')
    2. 15-20 synthetic open-ocean tankers (data_source = 'SIMULATED') moving at ~14 knots
    """
    vessels = []
    
    # 1. Fetch real-time live vessels if connected
    try:
        from services.real_ais import get_real_vessels
        live_vessels = get_real_vessels()
        for v in live_vessels:
            v["data_source"] = "LIVE"
            vessels.append(v)
    except Exception as e:
        print(f"[AIS] Error loading live vessels: {e}")

    # 2. Add 15-20 synthetic vessels moving along routes.json at 14 knots
    try:
        routes_path = DATA_DIR / "routes.json"
        if routes_path.exists():
            with open(routes_path, "r") as f:
                routes = json.load(f)
        else:
            routes = []
    except Exception as e:
        print(f"[AIS] Error loading routes.json: {e}")
        routes = []

    if not routes:
        return vessels

    current_time_sec = time.time()
    
    for i in range(min(count, len(VESSEL_NAMES))):
        name = VESSEL_NAMES[i]
        # Assign a deterministic route based on index
        route = routes[i % len(routes)]
        waypoints = route.get("waypoints", [])
        
        if len(waypoints) < 2:
            continue
            
        distance_nm = route.get("distance_nm", 2000)
        speed_knots = 14.0  # realistic tanker speed
        
        # Calculate transit duration in seconds
        transit_duration_sec = (distance_nm / speed_knots) * 3600
        
        # Calculate progress deterministically based on timestamp + shift per vessel
        shift = i * 20000  # shift start times so vessels are spread out
        progress = ((current_time_sec + shift) % transit_duration_sec) / transit_duration_sec
        
        pos = _interpolate_route(waypoints, progress)
        
        # Determine heading based on next waypoint
        heading = 90.0
        n_points = len(waypoints)
        seg_progress = progress * (n_points - 1)
        next_idx = min(int(seg_progress) + 1, n_points - 1)
        if next_idx < n_points:
            next_pt = waypoints[next_idx]
            dy = next_pt["lat"] - pos["lat"]
            dx = next_pt["lng"] - pos["lng"]
            heading = round((math.atan2(dx, dy) * 180 / math.pi) % 360, 1)

        vessels.append({
            "mmsi": f"999{100000 + i}",
            "name": name,
            "vessel_type": VESSEL_TYPES[i % len(VESSEL_TYPES)],
            "flag": FLAGS[i % len(FLAGS)],
            "dwt": 150000 + (i * 10000),
            "current_position": pos,
            "speed_knots": speed_knots,
            "heading": heading,
            "origin_port": route.get("from_location", "Export Terminal"),
            "destination_port": route.get("to_location", "Sikka Port"),
            "cargo": "Crude Oil",
            "data_source": "SIMULATED",
            "eta": "In Transit"
        })

    return vessels
