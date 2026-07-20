"""
Real-time AIS Data Service — connects directly to the aisstream.io WebSocket stream
to retrieve live vessel positions in the Indian Ocean, Persian Gulf, and Red Sea.

The cache starts empty and is populated purely by live data from the stream.
No synthetic or pre-populated vessels.
"""
import asyncio
import json
import websockets
from typing import Dict, List, Any

# Starts empty — filled entirely by live AISstream data
real_vessel_cache: Dict[str, Dict[str, Any]] = {}

_listener_task: Any = None
_api_key_in_use: str = ""


def get_real_vessels() -> List[Dict[str, Any]]:
    """Return all vessels currently tracked from the live AIS stream."""
    return list(real_vessel_cache.values())


def get_vessel_count() -> int:
    return len(real_vessel_cache)


async def connect_ais_stream(api_key: str):
    """
    Establish a persistent WebSocket connection to aisstream.io.
    Subscribes to the Indian Ocean / Persian Gulf / Red Sea corridor.
    Populates real_vessel_cache as position reports arrive.
    """
    global real_vessel_cache
    uri = "wss://stream.aisstream.io/v0/stream"

    # Multi-box coverage for full Indian Ocean tanker corridor:
    # Box 1: Persian Gulf, Strait of Hormuz, Gulf of Oman (lat 20-30, lng 50-65)
    # Box 2: Arabian Sea, India West Coast  (lat 8-25, lng 60-80)
    # Box 3: Red Sea, Bab-el-Mandeb         (lat 10-30, lng 32-50)
    # Box 4: Cape of Good Hope route        (lat -40-0, lng 10-50)
    bounding_box = [
        [[20.0, 50.0], [30.0, 65.0]],
        [[8.0,  60.0], [25.0, 80.0]],
        [[10.0, 32.0], [30.0, 50.0]],
        [[-40.0, 10.0], [0.0, 50.0]]
    ]

    subscription_msg = {
        "APIKey": api_key,
        "BoundingBoxes": bounding_box,
        "FilterMessageTypes": ["PositionReport", "ShipStaticData", "StandardClassBPositionReport"]
    }

    print(f"[AIS] Connecting to aisstream.io WebSocket...")

    async for websocket in websockets.connect(uri):
        try:
            await websocket.send(json.dumps(subscription_msg))
            print(f"[AIS] Subscribed to live stream. Waiting for vessel data...")

            async for raw_msg in websocket:
                try:
                    data = json.loads(raw_msg)
                    msg_type = data.get("MessageType")
                    meta = data.get("MetaData", {})
                    mmsi = str(meta.get("MMSI", "")).strip()

                    if not mmsi:
                        continue

                    # Create entry on first sight of this vessel
                    if mmsi not in real_vessel_cache:
                        real_vessel_cache[mmsi] = {
                            "mmsi": mmsi,
                            "name": meta.get("ShipName", "").strip() or f"VESSEL_{mmsi[-4:]}",
                            "vessel_type": "Tanker",
                            "flag": meta.get("flag", ""),
                            "dwt": 0,
                            "current_position": {"lat": 0.0, "lng": 0.0},
                            "speed_knots": 0.0,
                            "heading": 0.0,
                            "origin_port": "",
                            "destination_port": "",
                            "cargo": "Crude Oil",
                            "data_source": "LIVE",
                            "eta": ""
                        }
                        total = len(real_vessel_cache)
                        print(f"[AIS] New vessel: {mmsi} ({meta.get('ShipName','').strip() or 'UNNAMED'}) — total live: {total}")

                    vessel = real_vessel_cache[mmsi]

                    if msg_type == "PositionReport":
                        pos = data.get("Message", {}).get("PositionReport", {})
                        lat = pos.get("Latitude")
                        lng = pos.get("Longitude")
                        if lat is not None and lng is not None:
                            # Filter out invalid positions (0,0 is an AIS null position)
                            if not (abs(lat) < 0.01 and abs(lng) < 0.01):
                                vessel["current_position"] = {
                                    "lat": round(lat, 5),
                                    "lng": round(lng, 5)
                                }
                        sog = pos.get("Sog")
                        cog = pos.get("Cog")
                        if sog is not None:
                            vessel["speed_knots"] = round(float(sog), 1)
                        if cog is not None:
                            vessel["heading"] = round(float(cog), 1)

                    elif msg_type == "StandardClassBPositionReport":
                        pos = data.get("Message", {}).get("StandardClassBPositionReport", {})
                        lat = pos.get("Latitude")
                        lng = pos.get("Longitude")
                        if lat is not None and lng is not None:
                            if not (abs(lat) < 0.01 and abs(lng) < 0.01):
                                vessel["current_position"] = {
                                    "lat": round(lat, 5),
                                    "lng": round(lng, 5)
                                }
                        sog = pos.get("Sog")
                        cog = pos.get("Cog")
                        if sog is not None:
                            vessel["speed_knots"] = round(float(sog), 1)
                        if cog is not None:
                            vessel["heading"] = round(float(cog), 1)

                    elif msg_type == "ShipStaticData":
                        static = data.get("Message", {}).get("ShipStaticData", {})
                        name = static.get("Name", "").strip()
                        if name:
                            vessel["name"] = name
                        dest = static.get("Destination", "").strip()
                        if dest:
                            vessel["destination_port"] = dest
                        callsign = static.get("CallSign", "").strip()
                        if callsign:
                            vessel["callsign"] = callsign
                        ship_type = static.get("Type", 0)
                        if 80 <= ship_type <= 89:
                            vessel["vessel_type"] = "Tanker"
                            vessel["cargo"] = "Crude Oil"
                        elif 70 <= ship_type <= 79:
                            vessel["vessel_type"] = "Cargo"
                        dim = static.get("Dimension", {})
                        if dim:
                            length = (dim.get("A", 0) or 0) + (dim.get("B", 0) or 0)
                            if length > 300:
                                vessel["vessel_type"] = "VLCC"
                            elif length > 250:
                                vessel["vessel_type"] = "Suezmax"
                            elif length > 200:
                                vessel["vessel_type"] = "Aframax"

                except Exception:
                    continue

        except websockets.ConnectionClosed:
            print("[AIS] Connection closed. Reconnecting in 5s...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"[AIS] Stream error: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)


def update_ais_stream_key(api_key: str):
    """Start or restart the live AIS stream with the given API key."""
    global _listener_task, _api_key_in_use

    if not api_key:
        if _listener_task:
            _listener_task.cancel()
            _listener_task = None
        _api_key_in_use = ""
        return

    if api_key == _api_key_in_use and _listener_task and not _listener_task.done():
        return  # Already running with this key

    _api_key_in_use = api_key
    if _listener_task:
        _listener_task.cancel()

    try:
        loop = asyncio.get_running_loop()
        _listener_task = loop.create_task(connect_ais_stream(api_key))
        print(f"[AIS] Started live stream listener.")
    except RuntimeError:
        # No running event loop (called from sync context) - start in thread
        import threading
        def run_in_thread():
            asyncio.run(connect_ais_stream(api_key))
        threading.Thread(target=run_in_thread, daemon=True).start()
        print(f"[AIS] Started live stream listener (thread).")
