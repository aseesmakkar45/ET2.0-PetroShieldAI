"""
SPR (Strategic Petroleum Reserve) Engine.
Computes drawdown schedules, replenishment plans, runway analysis, and policy advice.
"""
import random
from datetime import datetime
from typing import Dict, List


# India's SPR facilities
SPR_FACILITIES = [
    {"name": "Visakhapatnam SPR", "capacity_mb": 9.75, "state": "Andhra Pradesh"},
    {"name": "Mangaluru SPR", "capacity_mb": 1.5, "state": "Karnataka"},
    {"name": "Padur SPR", "capacity_mb": 2.5, "state": "Karnataka"}
]

TOTAL_CAPACITY_MB = sum(f["capacity_mb"] for f in SPR_FACILITIES)  # ~13.75 MB
DAILY_CONSUMPTION_MBD = 4.5  # India's avg daily crude consumption


def generate_spr_advisory(
    scenario_type: str = None,
    supply_shortfall_mbd: float = 0.0
) -> Dict:
    """Generate a full SPR advisory with drawdown schedule."""
    
    # Current fill level: 72-88% depending on scenario
    if scenario_type in ["hormuz_closure"]:
        fill_pct = random.uniform(0.68, 0.78)
    elif scenario_type in ["sanctions", "red_sea_attack"]:
        fill_pct = random.uniform(0.74, 0.84)
    else:
        fill_pct = random.uniform(0.78, 0.88)

    current_reserves = round(TOTAL_CAPACITY_MB * fill_pct, 2)
    days_cover = round(current_reserves / DAILY_CONSUMPTION_MBD * (1 / (1 - supply_shortfall_mbd / DAILY_CONSUMPTION_MBD + 0.001)), 1)
    days_cover = min(days_cover, 90)

    # Determine status
    if days_cover < 20:
        status = "critical"
    elif days_cover < 35:
        status = "warning"
    else:
        status = "safe"

    # Generate drawdown schedule
    drawdown = _generate_drawdown_schedule(current_reserves, supply_shortfall_mbd)
    
    return {
        "id": f"spr_{int(datetime.utcnow().timestamp())}",
        "generated_at": datetime.utcnow().isoformat(),
        "current_reserves_mb": current_reserves,
        "strategic_days_cover": days_cover,
        "minimum_required_days": 30,
        "status": status,
        "drawdown_schedule": drawdown,
        "replenishment_plan": _replenishment_plan(scenario_type, fill_pct),
        "runway_days": days_cover,
        "policy_recommendations": _policy_recs(status, days_cover, supply_shortfall_mbd),
        "confidence": round(random.uniform(0.82, 0.95), 2)
    }


def _generate_drawdown_schedule(current_mb: float, shortfall_mbd: float) -> List[Dict]:
    """Generate weekly drawdown schedule."""
    schedule = []
    remaining = current_mb
    
    for week in range(1, 17):
        if shortfall_mbd > 0:
            drawdown = min(shortfall_mbd * 7, remaining)  # weekly drawdown
        else:
            drawdown = 0
        remaining -= drawdown
        remaining = max(0, remaining)
        days_left = round(remaining / max(DAILY_CONSUMPTION_MBD * 0.5, 0.1), 1)
        
        schedule.append({
            "week": week,
            "drawdown_mbd": round(drawdown / 7, 3),
            "remaining_days": days_left
        })
        
        if remaining <= 0:
            break

    return schedule


def _replenishment_plan(scenario_type: str, fill_pct: float) -> str:
    if fill_pct < 0.75:
        return ("Immediate replenishment required. Procure 2 MB from spot market. "
                "Prioritize Murban (UAE) and ESPO (Russia) grades for rapid delivery. "
                "Target 90% fill within 60 days.")
    elif fill_pct < 0.85:
        return ("Gradual replenishment over 90 days. Add 0.5 MB/month through "
                "diversified suppliers. Hedge price risk with 3-month forward contracts.")
    else:
        return ("Reserves at healthy levels. Maintain routine top-up schedule. "
                "Review grade diversity to ensure compatibility with refinery configurations.")


def _policy_recs(status: str, days_cover: float, shortfall: float) -> List[str]:
    base = [
        "Maintain minimum 45-day strategic reserve as per IEA guidelines",
        "Diversify crude grade mix to improve refinery flexibility",
        "Establish bilateral SPR sharing agreements with IEA member countries"
    ]
    
    if status == "critical":
        return [
            f"CRITICAL: Invoke IEA collective action (current cover: {days_cover:.0f} days)",
            "Immediate demand rationing for non-essential sectors",
            "Emergency tender for spot cargo procurement (1.5 MBD)",
            "Activate fuel switching for power generation"
        ] + base
    elif status == "warning":
        return [
            f"WARNING: SPR cover below 35-day threshold ({days_cover:.0f} days)",
            "Accelerate procurement from alternative suppliers",
            "Reduce non-strategic drawdowns",
            "Alert refinery operators for crude substitution planning"
        ] + base
    else:
        return base + [
            "Explore expanding underground SPR capacity (target: 30-day additional buffer)",
            "Conduct quarterly digital twin simulation drills"
        ]
