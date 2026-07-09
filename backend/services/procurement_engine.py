"""
Procurement Engine – ranks alternative suppliers using a composite score
optimizing cost, transit time, reliability, crude compatibility,
risk reduction, port congestion, and tanker availability.
"""
import json
import random
from datetime import datetime
from pathlib import Path
from typing import List, Dict

DATA_DIR = Path(__file__).parent.parent / "data"


def load_suppliers() -> List[Dict]:
    with open(DATA_DIR / "suppliers.json") as f:
        return json.load(f)


def generate_procurement_plan(
    scenario_type: str = None,
    total_volume_needed: float = 4.5,  # MBD
    horizon_weeks: int = 12
) -> Dict:
    """Generate ranked procurement recommendations."""
    suppliers = load_suppliers()
    
    recommendations = []
    for s in suppliers:
        # Simulate market conditions
        price = 82.5 + s["price_premium_usd"] + random.uniform(-2, 2)
        port_congestion = random.uniform(20, 70)
        tanker_avail = random.uniform(50, 95)
        
        # Risk reduction: inverse of supplier risk
        risk_reduction = max(0, 100 - s["geopolitical_risk"])
        
        # Crude compatibility (simplified scoring)
        compatibility = random.uniform(70, 99) if s["geopolitical_risk"] < 60 else random.uniform(55, 85)
        
        # Composite score: weighted sum
        composite = (
            (100 - s["geopolitical_risk"]) * 0.25 +
            s["reliability_score"] * 0.20 +
            max(0, 100 - s["avg_transit_days"] * 2) * 0.15 +
            max(0, 100 - price * 0.5) * 0.15 +
            risk_reduction * 0.10 +
            compatibility * 0.10 +
            max(0, 100 - port_congestion) * 0.05
        )
        
        # Volume allocation based on capacity
        alloc = min(s["capacity_mbd"], total_volume_needed * s["current_share_pct"] / 100 * 1.3)
        
        recommendations.append({
            "supplier_id": s["id"],
            "supplier_name": s["name"],
            "country": s["country"],
            "volume_mbd": round(alloc, 2),
            "price_usd_bbl": round(price, 2),
            "transit_days": s["avg_transit_days"],
            "reliability_score": s["reliability_score"],
            "risk_reduction_pct": round(risk_reduction, 1),
            "crude_compatibility": round(compatibility, 1),
            "port_congestion": round(port_congestion, 1),
            "tanker_availability": round(tanker_avail, 1),
            "composite_score": round(composite, 1),
            "rationale": _generate_rationale(s, composite, risk_reduction),
            "evidence": [
                f"Reliability history: {s['reliability_score']}/100 over last 24 months",
                f"Geopolitical risk assessment: {s['geopolitical_risk']}/100",
                f"Average transit time: {s['avg_transit_days']} days via current route"
            ]
        })

    # Sort by composite score descending
    recommendations.sort(key=lambda x: x["composite_score"], reverse=True)
    
    total_cost_saving = round(
        sum(r["volume_mbd"] for r in recommendations[:3]) *
        random.uniform(0.8, 2.5), 2
    )
    
    return {
        "id": f"proc_{int(datetime.utcnow().timestamp())}",
        "generated_at": datetime.utcnow().isoformat(),
        "scenario_id": None,
        "horizon_weeks": horizon_weeks,
        "total_volume_needed_mbd": total_volume_needed,
        "recommendations": recommendations,
        "cost_savings_usd_bbl": total_cost_saving,
        "risk_reduction_pct": round(
            sum(r["risk_reduction_pct"] for r in recommendations[:3]) / 3, 1
        ),
        "summary": f"Procurement plan covering {horizon_weeks} weeks for {total_volume_needed} MBD. "
                   f"Top recommendation: {recommendations[0]['supplier_name']} at ${recommendations[0]['price_usd_bbl']}/bbl.",
        "confidence": round(random.uniform(0.78, 0.92), 2)
    }


def _generate_rationale(supplier: Dict, score: float, risk_reduction: float) -> str:
    if score > 70:
        return (f"{supplier['name']} offers the best balance of reliability ({supplier['reliability_score']}/100) "
                f"and geopolitical stability. Low transit risk and proven supply track record.")
    elif score > 55:
        return (f"{supplier['name']} is a viable alternative offering competitive pricing "
                f"with manageable geopolitical risk ({supplier['geopolitical_risk']}/100).")
    else:
        return (f"{supplier['name']} provides diversification benefit despite higher risk profile. "
                f"Recommended for partial allocation only to reduce concentration risk.")
