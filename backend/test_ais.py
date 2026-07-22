import asyncio
import websockets
import json

async def test_ais():
    uri = "wss://stream.aisstream.io/v0/stream"
    bounding_box = [
        [[20.0, 50.0], [30.0, 65.0]],
        [[8.0,  60.0], [25.0, 80.0]],
        [[10.0, 32.0], [30.0, 50.0]],
        [[-40.0, 10.0], [0.0, 50.0]]
    ]
    subscription_msg = {
        "APIKey": "e4786c9a683aa6cb7d494388cb21a2c96923d092",
        "BoundingBoxes": bounding_box,
        "FilterMessageTypes": ["PositionReport", "ShipStaticData", "StandardClassBPositionReport"]
    }
    
    print("Connecting...")
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps(subscription_msg))
        print("Subscribed. Waiting for messages for 10 seconds...")
        
        try:
            for _ in range(5):
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(msg)
                print(f"Received: {data.get('MessageType')}")
        except asyncio.TimeoutError:
            print("Timeout waiting for messages.")

asyncio.run(test_ais())
