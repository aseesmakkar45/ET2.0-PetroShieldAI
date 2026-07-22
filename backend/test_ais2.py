import asyncio
import websockets
import json

async def test_ais():
    uri = "wss://stream.aisstream.io/v0/stream"
    bounding_box = [[[20.0, 50.0], [30.0, 65.0]]]
    api_key = "e4786c9a683aa6cb7d494388cb21a2c96923d092"
    
    subscription_msg = {
        "APIKey": api_key,
        "BoundingBoxes": bounding_box,
        "FilterMessageTypes": ["PositionReport"]
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://localhost"
    }

    print("Connecting...")
    try:
        async with websockets.connect(uri, extra_headers=headers) as websocket:
            await websocket.send(json.dumps(subscription_msg))
            print("Connected and subscribed!")
            
            async for msg in websocket:
                print("Received:", msg[:100])
                break
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_ais())
