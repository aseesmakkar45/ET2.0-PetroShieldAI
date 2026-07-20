"""
PetroShield AI — Maritime Weather Service
Fetches real-time marine conditions at key energy chokepoints and Indian ports
using the Open-Meteo Marine API (completely free, no API key required).

Chokepoints covered:
  - Strait of Hormuz (Iran/Oman)
  - Bab-el-Mandeb / Red Sea (Yemen)
  - Suez Canal (Egypt)
  - Strait of Malacca (Singapore)
  - Cape of Good Hope (South Africa)

Indian ports covered:
  - Sikka / Vadinar (Gujarat)
  - Visakhapatnam
  - Kochi
  - Mumbai (JNPT)

Data: wave_height, wind_speed, wind_direction, sea_surface_temp, visibility proxy
Cache: 1 hour (marine conditions don't change minute-by-minute)
"""
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# ── Key maritime locations ────────────────────────────────────────────────────
_MARITIME_LOCATIONS = [
    # Global energy chokepoints
    {"id": "hormuz",        "name": "Strait of Hormuz",        "lat": 26.56, "lng": 56.25, "type": "chokepoint", "daily_flow_mbd": 21.0},
    {"id": "bab_mandeb",    "name": "Bab-el-Mandeb / Red Sea", "lat": 12.58, "lng": 43.40, "type": "chokepoint", "daily_flow_mbd": 8.8},
    {"id": "suez",          "name": "Suez Canal",               "lat": 30.00, "lng": 32.55, "type": "chokepoint", "daily_flow_mbd": 5.5},
    {"id": "malacca",       "name": "Strait of Malacca",        "lat":  2.50, "lng": 101.30,"type": "chokepoint", "daily_flow_mbd": 16.3},
    {"id": "cape_hope",     "name": "Cape of Good Hope",        "lat":-34.36, "lng": 18.48, "type": "chokepoint", "daily_flow_mbd": 3.0},
    {"id": "persian_gulf",  "name": "Persian Gulf",             "lat": 26.00, "lng": 52.00, "type": "chokepoint", "daily_flow_mbd": 18.0},
    # Indian ports
    {"id": "sikka_vadinar", "name": "Sikka / Vadinar Port",     "lat": 22.50, "lng": 69.65, "type": "port",       "daily_flow_mbd": 1.4},
    {"id": "visakhapatnam", "name": "Visakhapatnam Port",       "lat": 17.68, "lng": 83.21, "type": "port",       "daily_flow_mbd": 0.5},
    {"id": "kochi",         "name": "Kochi Port",               "lat":  9.96, "lng": 76.27, "type": "port",       "daily_flow_mbd": 0.4},
    {"id": "mumbai_jnpt",   "name": "Mumbai JNPT",              "lat": 18.95, "lng": 72.94, "type": "port",       "daily_flow_mbd": 0.3},
]

# Open-Meteo Marine API — completely free, no key
_MARINE_API_BASE = "https://marine-api.open-meteo.com/v1/marine"
_WEATHER_API_BASE = "https://api.open-meteo.com/v1/forecast"

# In-memory cache
_weather_cache: Dict[str, Any] = {}
_cache_timestamp: Optional[datetime] = None
_CACHE_TTL_MINUTES = 60


def _is_cache_valid() -> bool:
    if _cache_timestamp is None:
        return False
    return (datetime.now() - _cache_timestamp) < timedelta(minutes=_CACHE_TTL_MINUTES)


def _swell_to_risk(wave_height_m: float, wind_speed_kmh: float) -> str:
    """Convert marine conditions to operational risk level."""
    if wave_height_m >= 4.0 or wind_speed_kmh >= 75:
        return "SEVERE"
    elif wave_height_m >= 2.5 or wind_speed_kmh >= 50:
        return "ELEVATED"
    elif wave_height_m >= 1.5 or wind_speed_kmh >= 30:
        return "MODERATE"
    else:
        return "NORMAL"


def _wind_direction_label(degrees: float) -> str:
    """Convert wind bearing degrees to cardinal direction."""
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return dirs[round(degrees / 22.5) % 16]


def _fetch_location_weather(loc: Dict) -> Dict[str, Any]:
    """
    Fetch real-time marine + atmospheric conditions for a single location.
    Uses Open-Meteo Marine API for wave data, Open-Meteo Forecast for wind.
    """
    lat, lng = loc["lat"], loc["lng"]
    result = {
        "id": loc["id"],
        "name": loc["name"],
        "lat": lat,
        "lng": lng,
        "type": loc["type"],
        "daily_flow_mbd": loc.get("daily_flow_mbd", 0),
        "wave_height_m": None,
        "wave_period_s": None,
        "wind_speed_kmh": None,
        "wind_direction_deg": None,
        "wind_direction_label": None,
        "sea_surface_temp_c": None,
        "operational_risk": "NORMAL",
        "advisory": "",
        "timestamp": datetime.utcnow().isoformat(),
        "source": "Open-Meteo (live)",
        "error": None
    }

    # 1. Marine API — wave height, period, sea surface temp
    try:
        marine_params = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lng,
            "current": "wave_height,wave_period,sea_surface_temperature",
            "wind_speed_unit": "kmh",
            "timeformat": "iso8601"
        })
        marine_url = f"{_MARINE_API_BASE}?{marine_params}"
        req = urllib.request.Request(marine_url, headers={"User-Agent": "PetroShieldAI/2.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            marine_data = json.loads(resp.read().decode("utf-8"))
        current = marine_data.get("current", {})
        result["wave_height_m"] = current.get("wave_height")
        result["wave_period_s"] = current.get("wave_period")
        result["sea_surface_temp_c"] = current.get("sea_surface_temperature")
    except Exception as e:
        result["error"] = f"Marine API: {e}"

    # 2. Forecast API — wind speed and direction
    try:
        wx_params = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lng,
            "current": "wind_speed_10m,wind_direction_10m",
            "wind_speed_unit": "kmh",
            "timeformat": "iso8601"
        })
        wx_url = f"{_WEATHER_API_BASE}?{wx_params}"
        req = urllib.request.Request(wx_url, headers={"User-Agent": "PetroShieldAI/2.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            wx_data = json.loads(resp.read().decode("utf-8"))
        current_wx = wx_data.get("current", {})
        wind_speed = current_wx.get("wind_speed_10m")
        wind_dir = current_wx.get("wind_direction_10m")
        result["wind_speed_kmh"] = wind_speed
        result["wind_direction_deg"] = wind_dir
        if wind_dir is not None:
            result["wind_direction_label"] = _wind_direction_label(wind_dir)
    except Exception as e:
        if result["error"]:
            result["error"] += f" | Wind API: {e}"
        else:
            result["error"] = f"Wind API: {e}"

    # 3. Compute operational risk and advisory
    wave = result["wave_height_m"] or 0.0
    wind = result["wind_speed_kmh"] or 0.0
    risk = _swell_to_risk(wave, wind)
    result["operational_risk"] = risk

    advisories = []
    if wave >= 4.0:
        advisories.append(f"⚠ Significant swell {wave:.1f}m — VLCC loading suspended")
    elif wave >= 2.5:
        advisories.append(f"Wave height {wave:.1f}m — reduced tanker loading rate")
    if wind >= 75:
        advisories.append(f"Gale-force winds {wind:.0f} km/h — port ops disrupted")
    elif wind >= 50:
        advisories.append(f"Strong winds {wind:.0f} km/h — vessel schedule delays")
    if not advisories:
        advisories.append("Conditions nominal — full port and corridor operability")
    result["advisory"] = " | ".join(advisories)

    return result


def fetch_maritime_weather() -> Dict[str, Any]:
    """
    Fetch real-time marine weather for all key energy chokepoints and Indian ports.
    Results cached for 1 hour.
    Returns a structured dict ready to be served from /api/weather/maritime.
    """
    global _weather_cache, _cache_timestamp

    if _is_cache_valid() and _weather_cache:
        print(f"[WEATHER] Cache hit — returning {len(_weather_cache.get('locations', []))} location forecasts.")
        return _weather_cache

    print(f"[WEATHER] Fetching live marine weather for {len(_MARITIME_LOCATIONS)} locations...")
    locations_data = []
    severe_count = 0
    elevated_count = 0

    for loc in _MARITIME_LOCATIONS:
        data = _fetch_location_weather(loc)
        locations_data.append(data)
        if data["operational_risk"] == "SEVERE":
            severe_count += 1
        elif data["operational_risk"] == "ELEVATED":
            elevated_count += 1

    # Overall fleet advisory
    if severe_count >= 2:
        fleet_advisory = f"SEVERE — {severe_count} chokepoints reporting storm/gale conditions. Tanker diversions expected."
        fleet_risk = "SEVERE"
    elif severe_count == 1 or elevated_count >= 3:
        fleet_advisory = f"ELEVATED — {severe_count + elevated_count} locations with adverse marine conditions."
        fleet_risk = "ELEVATED"
    elif elevated_count >= 1:
        fleet_advisory = f"MODERATE — {elevated_count} location(s) with reduced operability."
        fleet_risk = "MODERATE"
    else:
        fleet_advisory = "Conditions favourable across all monitored maritime corridors."
        fleet_risk = "NORMAL"

    result = {
        "locations": locations_data,
        "fleet_risk": fleet_risk,
        "fleet_advisory": fleet_advisory,
        "severe_locations": severe_count,
        "elevated_locations": elevated_count,
        "fetched_at": datetime.utcnow().isoformat(),
        "cache_ttl_minutes": _CACHE_TTL_MINUTES,
        "source": "Open-Meteo Marine API (free, no key required)"
    }

    _weather_cache = result
    _cache_timestamp = datetime.now()
    print(f"[WEATHER] ✅ Fetched. Fleet risk: {fleet_risk} | Severe: {severe_count} | Elevated: {elevated_count}")
    return result
