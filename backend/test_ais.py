"""
AIS Debug test - print ALL messages to see what the server actually sends back.
"""
import asyncio
import json
import websockets
import sys

API_KEY = "e4786c9a683aa6cb7d494388cb21a2c96923d092"

async def test():
    uri = "wss://stream.aisstream.io/v0/stream"

    # Try global bounding box first to maximize data
    sub = {
        "APIKey": API_KEY,
        "BoundingBoxes": [[[-90, -180], [90, 180]]]
        # No FilterMessageTypes - receive everything
    }

    print(f"Connecting to {uri}...")
    sys.stdout.flush()

    try:
        async with websockets.connect(uri, open_timeout=15) as ws:
            await ws.send(json.dumps(sub))
            print("Sent subscription. Listening for 20 seconds...")
            sys.stdout.flush()

            count = 0
            try:
                async with asyncio.timeout(20):
                    async for raw in ws:
                        data = json.loads(raw)
                        msg_type = data.get("MessageType", "UNKNOWN")
                        meta = data.get("MetaData", {})
                        mmsi = meta.get("MMSI", "")
                        name = meta.get("ShipName", "").strip()
                        print(f"MSG #{count+1}: type={msg_type} mmsi={mmsi} name={name}")
                        sys.stdout.flush()
                        count += 1
                        if count >= 20:
                            break
            except TimeoutError:
                print(f"Timeout. Got {count} messages total.")
                sys.stdout.flush()

    except Exception as e:
        print(f"ERROR: {e}")
        sys.stdout.flush()

    if count == 0:
        print("NO DATA RECEIVED - API key may be invalid or exhausted.")
    else:
        print(f"SUCCESS: {count} messages received from live AIS stream.")
    sys.stdout.flush()

asyncio.run(test())
