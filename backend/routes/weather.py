"""
Weather Routes – real-time maritime conditions for energy chokepoints and ports.
Uses Open-Meteo Marine API (free, no API key required).
"""
from fastapi import APIRouter
from services.weather import fetch_maritime_weather

router = APIRouter()


@router.get("/weather/maritime")
async def get_maritime_weather():
    """
    Returns live marine weather conditions for all key energy chokepoints
    (Hormuz, Bab-el-Mandeb, Suez, Malacca, Cape of Good Hope) and
    major Indian ports (Sikka, Visakhapatnam, Kochi, JNPT).

    Data: wave height, wind speed/direction, sea surface temp, operational risk level.
    Source: Open-Meteo Marine API (free, no key required).
    Cache: 1 hour.
    """
    return fetch_maritime_weather()
