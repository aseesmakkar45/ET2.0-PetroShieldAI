"""
PetroShield AI — Data Layer Calculators
Contains formula-driven models for refinery impact and SPR days-of-cover.
"""
from typing import Dict, List, Any

# India's daily crude oil consumption is approx 5 million barrels per day (EIA/PPAC figure)
INDIA_DAILY_CONSUMPTION_BPD = 5000000

def calculate_spr_days_of_cover(caverns: List[Dict[str, Any]]) -> float:
    """
    Formula: days_of_cover = assumed_current_fill_barrels / india_daily_consumption_barrels
    """
    total_fill_barrels = 0
    for cavern in caverns:
        capacity = cavern.get("capacity_barrels", 0)
        fill_pct = cavern.get("assumed_fill_pct", 90)  # hackathon stated assumption
        total_fill_barrels += capacity * (fill_pct / 100.0)
    
    return round(total_fill_barrels / INDIA_DAILY_CONSUMPTION_BPD, 1)


def calculate_refinery_utilization_drop(
    refinery: Dict[str, Any], 
    suppliers: List[Dict[str, Any]], 
    hormuz_closure_severity_pct: float
) -> float:
    """
    Refinery run-rate impact model formula:
    utilization_drop = sum(supplier.volume_share_pct for supplier in connected_suppliers if Hormuz-dependent) * severity_pct
    """
    # Find suppliers connected to this refinery
    primary_supplier_id = refinery.get("primary_supplier")
    
    # Calculate how much of the refinery's crude mix is Hormuz-dependent
    hormuz_dependent_pct = 0.0
    for supplier in suppliers:
        if supplier["id"] == primary_supplier_id:
            if supplier.get("primary_route") == "Hormuz-dependent":
                hormuz_dependent_pct = supplier.get("volume_share_pct", 0.0)
                break
    
    # Drop in utilization is proportional to chokepoint closure severity
    utilization_drop = hormuz_dependent_pct * (hormuz_closure_severity_pct / 100.0)
    return round(utilization_drop, 2)
