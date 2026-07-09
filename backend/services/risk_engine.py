"""
Risk Engine – computes composite risk scores from geopolitical signals,
AIS anomalies, weather, market volatility, and sanction events.
All logic uses synthetic/demo data in demo mode.
"""
import json
import random
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any

DATA_DIR = Path(__file__).parent.parent / "data"


def load_json(filename: str) -> Any:
    with open(DATA_DIR / filename) as f:
        return json.load(f)


# ─── Synthetic News Templates ──────────────────────────────────────────────────

NEWS_TEMPLATES = [
    {
        "headline": "Iran Conducts Naval Exercises Near Strait of Hormuz",
        "category": "geopolitical",
        "risk_delta": 12,
        "affected_chokepoints": ["cp_hormuz"],
        "affected_countries": ["Iran", "Saudi Arabia"],
        "tags": ["hormuz", "iran", "naval"]
    },
    {
        "headline": "Houthi Forces Launch Missile Strike on Cargo Vessel in Red Sea",
        "category": "geopolitical",
        "risk_delta": 18,
        "affected_chokepoints": ["cp_bab_el_mandeb"],
        "affected_countries": ["Yemen", "Saudi Arabia"],
        "tags": ["houthi", "red_sea", "attack"]
    },
    {
        "headline": "US Expands Sanctions on Russian Oil Tanker Fleet",
        "category": "sanctions",
        "risk_delta": 15,
        "affected_chokepoints": [],
        "affected_countries": ["Russia", "USA"],
        "tags": ["russia", "sanctions", "tanker"]
    },
    {
        "headline": "Brent Crude Surges 4% on OPEC+ Production Cut Announcement",
        "category": "market",
        "risk_delta": 8,
        "affected_chokepoints": [],
        "affected_countries": ["Saudi Arabia", "UAE"],
        "tags": ["opec", "price", "production"]
    },
    {
        "headline": "Iraq Declares Force Majeure at Basra Terminal Due to Protests",
        "category": "infrastructure",
        "risk_delta": 10,
        "affected_chokepoints": [],
        "affected_countries": ["Iraq"],
        "tags": ["iraq", "force_majeure", "terminal"]
    },
    {
        "headline": "Cyclone Biparjoy Threatens Western India Ports",
        "category": "weather",
        "risk_delta": 14,
        "affected_chokepoints": [],
        "affected_countries": ["India"],
        "tags": ["cyclone", "weather", "port"]
    },
    {
        "headline": "ONGC Reports Decline in Domestic Production",
        "category": "infrastructure",
        "risk_delta": 5,
        "affected_chokepoints": [],
        "affected_countries": ["India"],
        "tags": ["india", "domestic", "production"]
    },
    {
        "headline": "Saudi Arabia and Russia Extend OPEC+ Output Cuts to Q2",
        "category": "market",
        "risk_delta": 9,
        "affected_chokepoints": [],
        "affected_countries": ["Saudi Arabia", "Russia"],
        "tags": ["opec", "production_cut"]
    },
    {
        "headline": "Piracy Alert Issued for Gulf of Aden Shipping Corridor",
        "category": "geopolitical",
        "risk_delta": 7,
        "affected_chokepoints": ["cp_bab_el_mandeb"],
        "affected_countries": ["Somalia", "Yemen"],
        "tags": ["piracy", "aden", "security"]
    },
    {
        "headline": "India Boosts Strategic Reserve as Geopolitical Tensions Rise",
        "category": "geopolitical",
        "risk_delta": -5,
        "affected_chokepoints": [],
        "affected_countries": ["India"],
        "tags": ["india", "spr", "resilience"]
    }
]

SOURCES = ["Reuters", "Bloomberg", "S&P Global Platts", "Argus Media", "OPEC Monthly", "EIA", "MarineTraffic AIS"]


def generate_risk_signals(count: int = 8) -> List[Dict]:
    """Generate synthetic risk signals."""
    signals = []
    base_time = datetime.utcnow()

    for i in range(count):
        template = random.choice(NEWS_TEMPLATES)
        hours_ago = random.randint(0, 72)
        score = max(0, min(100, 50 + template["risk_delta"] + random.uniform(-10, 10)))
        
        if score >= 75:
            risk_level = "critical"
        elif score >= 55:
            risk_level = "high"
        elif score >= 35:
            risk_level = "moderate"
        else:
            risk_level = "low"

        signals.append({
            "id": f"sig_{i}_{int(base_time.timestamp())}",
            "title": template["headline"],
            "description": f"Intelligence assessment: {template['headline']}. Analysis based on satellite imagery, AIS data, and open-source intelligence (OSINT) aggregation.",
            "risk_level": risk_level,
            "risk_score": round(score, 1),
            "affected_countries": template["affected_countries"],
            "affected_chokepoints": template["affected_chokepoints"],
            "affected_suppliers": random.sample(
                ["sa_iraq", "sa_russia", "sa_saudi", "sa_uae"], 
                k=random.randint(1, 2)
            ),
            "source": random.choice(SOURCES),
            "timestamp": (base_time - timedelta(hours=hours_ago)).isoformat(),
            "confidence": round(random.uniform(0.55, 0.95), 2),
            "evidence": [
                f"AIS transponder anomaly detected ({random.randint(2,12)} vessels)",
                f"Satellite imagery analysis confirmed activity at {random.randint(1,3)} location(s)",
                f"OSINT signals corroborated by {random.randint(2,5)} independent sources"
            ],
            "category": template["category"],
            "tags": template["tags"]
        })

    return sorted(signals, key=lambda x: x["timestamp"], reverse=True)


def compute_overall_risk_score(signals: List[Dict]) -> float:
    """Compute weighted composite risk score from signals."""
    if not signals:
        return 35.0
    
    weights = {"critical": 1.0, "high": 0.7, "moderate": 0.4, "low": 0.2}
    total_weight = 0
    weighted_sum = 0
    
    for i, sig in enumerate(signals[:10]):  # top 10 most recent
        decay = math.exp(-i * 0.15)  # recency decay
        w = weights.get(sig["risk_level"], 0.3) * decay
        weighted_sum += sig["risk_score"] * w
        total_weight += w

    if total_weight == 0:
        return 35.0

    return min(100, round(weighted_sum / total_weight, 1))


def compute_energy_resilience_score(
    supplier_diversity: float,
    risk_score: float,
    spr_level: float,
    shipping_delay_factor: float,
    price_volatility: float,
    inventory_level: float
) -> float:
    """
    Energy Resilience Score (0-100).
    Higher = more resilient.
    """
    weights = {
        "supplier_diversity": 0.25,
        "risk_inverse": 0.20,
        "spr": 0.20,
        "shipping": 0.15,
        "price_stability": 0.10,
        "inventory": 0.10
    }

    components = {
        "supplier_diversity": supplier_diversity,
        "risk_inverse": max(0, 100 - risk_score),
        "spr": spr_level,
        "shipping": max(0, 100 - shipping_delay_factor),
        "price_stability": max(0, 100 - price_volatility),
        "inventory": inventory_level
    }

    score = sum(components[k] * weights[k] for k in weights)
    return round(score, 1)


def generate_price_history(days: int = 90) -> List[Dict]:
    """Generate synthetic Brent price history."""
    points = []
    base_date = datetime.utcnow() - timedelta(days=days)
    brent = 82.5
    wti = brent - 3.5
    india_basket = brent - 1.8

    for d in range(days):
        dt = base_date + timedelta(days=d)
        # Add some realistic volatility
        shock = 0.0
        if d in [15, 32, 55, 70]:  # Simulated shock events
            shock = random.uniform(3, 8) * random.choice([-1, 1])
        
        brent += random.gauss(0, 0.8) + shock * 0.3
        brent = max(60, min(130, brent))
        wti = brent - random.uniform(2.5, 4.5)
        india_basket = brent - random.uniform(0.5, 2.5)

        points.append({
            "timestamp": dt.isoformat(),
            "brent_usd": round(brent, 2),
            "wti_usd": round(wti, 2),
            "india_basket_usd": round(india_basket, 2)
        })

    return points
