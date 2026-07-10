"""
Power Sector and Fuel Price Impact Engine.
Calculates cascading economic impacts on domestic fuel prices and power grid stress.
"""
from typing import Dict, Any, List

def calculate_power_sector_stress(
    brent_price_increase_pct: float,
    supply_shortfall_mbpd: float
) -> Dict[str, Any]:
    """
    Calculate electricity cost surges, MW losses, and gas price cascades
    based on petroleum-to-utility correlations.
    """
    base_fuel_oil_gen_mw = 3200.0  # India's total oil-fired capacity
    
    # Direct generation loss matches shortfall proportion (max 100%)
    generation_loss_pct = min(supply_shortfall_mbpd / 0.15, 1.0)
    oil_generation_loss = base_fuel_oil_gen_mw * generation_loss_pct
    
    # Cascade to LNG spot prices (historical correlation: 0.65)
    gas_cascade_pct = brent_price_increase_pct * 0.65
    
    # Composite electricity cost surge across:
    # - Direct oil-gen cost increase (2% share)
    # - Indirect gas-gen cost increase (8% share)
    # - Indirect coal freight fuel surcharge (2% impact)
    electricity_cost_increase = (
        0.02 * brent_price_increase_pct +
        0.08 * gas_cascade_pct +
        0.02 * brent_price_increase_pct * 0.30
    )
    
    return {
        "electricity_cost_increase_pct": round(electricity_cost_increase, 2),
        "fuel_oil_generation_loss_mw": round(oil_generation_loss, 1),
        "cascade_to_gas_prices_pct": round(gas_cascade_pct, 2),
        "industrial_power_cost_impact_pct": round(electricity_cost_increase * 1.25, 2),
        "affected_states": ["Gujarat", "Maharashtra", "Tamil Nadu", "West Bengal", "Andhra Pradesh"]
    }


def calculate_fuel_prices(brent_price_increase_pct: float) -> Dict[str, float]:
    """Calculate domestic Indian pump fuel price additions (in INR per litre/cylinder)."""
    # Dynamic pump pricing formula matching oil price pass-through elasticity
    petrol_delta = brent_price_increase_pct * 0.25  # e.g. 20% spike -> +5 INR
    diesel_delta = brent_price_increase_pct * 0.22
    atf_pct = brent_price_increase_pct * 0.85
    lpg_cylinder_delta = brent_price_increase_pct * 3.50  # e.g. 20% spike -> +70 INR
    
    return {
        "petrol_increase_inr_per_litre": round(petrol_delta, 2),
        "diesel_increase_inr_per_litre": round(diesel_delta, 2),
        "atf_increase_pct": round(atf_pct, 2),
        "lpg_increase_inr_per_cylinder": round(lpg_cylinder_delta, 2)
    }
