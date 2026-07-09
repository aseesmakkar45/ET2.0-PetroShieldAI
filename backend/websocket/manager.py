"""
WebSocket Connection Manager for real-time alerts and vessel updates.
"""
import asyncio
import json
import random
from datetime import datetime
from typing import List, Set
from fastapi import WebSocket
from services.risk_engine import generate_risk_signals


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.add(ws)
        self.active_connections -= dead

    async def send_personal(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            self.disconnect(websocket)


# Singleton manager
alert_manager = ConnectionManager()
vessel_manager = ConnectionManager()


async def risk_alert_broadcaster():
    """Periodically broadcast risk alerts to all connected clients."""
    while True:
        await asyncio.sleep(random.uniform(8, 20))  # every 8-20 seconds
        if alert_manager.active_connections:
            signals = generate_risk_signals(count=1)
            if signals:
                alert = {
                    "type": "risk_alert",
                    "payload": signals[0],
                    "timestamp": datetime.utcnow().isoformat()
                }
                await alert_manager.broadcast(alert)


async def vessel_position_broadcaster():
    """Periodically broadcast vessel position updates."""
    from simulation.ais_generator import generate_vessels
    while True:
        await asyncio.sleep(5)  # every 5 seconds
        if vessel_manager.active_connections:
            vessels = generate_vessels(count=45)
            update = {
                "type": "vessel_update",
                "payload": vessels,
                "timestamp": datetime.utcnow().isoformat()
            }
            await vessel_manager.broadcast(update)
