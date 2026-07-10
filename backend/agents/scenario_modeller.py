"""
Scenario Modeller Agent (Agent 2) – simulates downstream supply, refinery,
fuel price, power sector, SPR, and macroeconomic impacts across 3 scenarios.
"""
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel
from datetime import datetime

from agents.explainability import ExplainabilityBlock
from agents.risk_intel import RiskSignal
from services.knowledge_graph import get_graph
from services.monte_carlo import run_gbm_price_simulation
from services.power_sector import calculate_power_sector_stress, calculate_fuel_prices


class PowerSectorImpact(BaseModel):
    electricity_cost_increase_pct: float
    electricity_cost_increase_ci: Tuple[float, float]
    fuel_oil_generation_loss_mw: float
    cascade_to_gas_prices_pct: float
    industrial_power_cost_impact_pct: float
    affected_states: List[str]
    narrative: str


class FuelPriceImpact(BaseModel):
    petrol_increase_inr_per_litre: float
    diesel_increase_inr_per_litre: float
    atf_increase_pct: float
    lpg_increase_inr_per_cylinder: float


class RefineryImpact(BaseModel):
    refinery_name: str
    operator: str
    current_utilization_pct: float
    projected_utilization_pct: float
    utilization_drop_pct: float
    affected_crude_grades: List[str]
    can_substitute: bool
    substitute_grade: Optional[str]
    min_economic_run_pct: float
    shutdown_risk: bool


class Scenario(BaseModel):
    name: str  # Optimistic, Base Case, Severe
    probability: float
    probability_ci: Tuple[float, float]
    assumptions: List[str]  # EXPLICIT and TESTABLE
    duration_days: int
    supply_shortfall_mbpd: float
    supply_shortfall_ci: Tuple[float, float]
    brent_price_range: Tuple[float, float]
    brent_price_mean: float
    refinery_impacts: List[RefineryImpact]
    avg_refinery_utilization_drop_pct: float
    fuel_price_impact: FuelPriceImpact
    power_sector_impact: PowerSectorImpact
    india_import_cost_increase_usd_bn: float
    spr_runway_days: float
    gdp_impact_pct: float
    gdp_impact_ci: Tuple[float, float]
    inflation_impact_pct: float
    historical_precedent: str
    explainability: ExplainabilityBlock


class ScenarioResult(BaseModel):
    scenario_id: str
    trigger_signal: RiskSignal
    scenarios: List[Scenario]  # Always 3
    recommendation_urgency: str
    key_insight: str


def run_scenario_modeller_agent(risk_signal: RiskSignal) -> ScenarioResult:
    """
    Run Agent 2: Models three distinct scenarios, runs Monte Carlo pricing
    and power grid cascades, and returns a structured ScenarioResult.
    """
    G = get_graph()
    current_brent = 82.50
    supply_loss = risk_signal.estimated_supply_impact_mbpd
    
    # Check chokepoint exposure
    chokepoint_ids = risk_signal.affected_chokepoints
    is_hormuz = "cp_hormuz" in chokepoint_ids
    
    # ─── Define Scenarios & Assumptions ─────────────────────────────────────────
    # We specify explicit, testable assumptions for each of the 3 scenarios
    scenario_configs = [
        {
            "name": "Optimistic",
            "prob": 0.20,
            "duration": 15,
            "shock_factor": 0.05,  # 5% price shock
            "vol_mult": 1.1,       # Slight volatility elevation
            "shortfall_mult": 0.4,
            "gdp_impact": -0.05,
            "inflation": 0.15,
            "assumptions": [
                "Disruption resolved diplomatically within 15 days.",
                "OPEC+ activates spare capacity (0.5 mbpd) to mitigate shortages.",
                "No physical damage to shipping vessels or terminal loading bays."
            ],
            "precedent": "2019 Abqaiq Drone Attack (rapid capacity recovery)"
        },
        {
            "name": "Base Case",
            "prob": 0.55,
            "duration": 45,
            "shock_factor": 0.15,  # 15% price shock
            "vol_mult": 1.5,       # High volatility
            "shortfall_mult": 1.0,
            "gdp_impact": -0.18,
            "inflation": 0.45,
            "assumptions": [
                "Shipping lane chokepoint closed or restricted for 45 days.",
                "OPEC+ maintains production targets; no extra volumes released.",
                "Insurance premium surcharge (+150%) on crude tankers transiting regional zones."
            ],
            "precedent": "2023 Houthi Red Sea Shipping Attacks (extended diversions)"
        },
        {
            "name": "Severe",
            "prob": 0.25,
            "duration": 90,
            "shock_factor": 0.35,  # 35% price shock
            "vol_mult": 2.2,       # Volatility spike
            "shortfall_mult": 1.8,
            "gdp_impact": -0.42,
            "inflation": 1.10,
            "assumptions": [
                "Military conflict results in total chokepoint closure for 90 days.",
                "Multiple crude tankers damaged, leading to temporary insurance suspension.",
                "SPR drawdown initiated under emergency protocols."
            ],
            "precedent": "1990 Gulf War Supply Disruption"
        }
    ]

    scenarios = []
    for cfg in scenario_configs:
        # Run Monte Carlo Pricing Sim
        sim = run_gbm_price_simulation(
            current_price=current_brent,
            days=cfg["duration"],
            n_sims=5000,  # 5k paths for speed
            disruption_shock=cfg["shock_factor"],
            stress_volatility_multiplier=cfg["vol_mult"]
        )
        
        # Calculate pricing increase percentage
        price_inc_pct = ((sim["p50"] - current_brent) / current_brent) * 100
        
        # Calculate Power Sector Stress
        power = calculate_power_sector_stress(
            brent_price_increase_pct=price_inc_pct,
            supply_shortfall_mbpd=supply_loss * cfg["shortfall_mult"]
        )
        
        # Calculate Domestic Fuel Price Increase
        fuel = calculate_fuel_prices(brent_price_increase_pct=price_inc_pct)
        
        # Calculate Refinery run rate drops
        refinery_impacts = []
        for node_id, attrs in G.nodes(data=True):
            if attrs.get("type") == "refinery":
                # Jamnagar/Vadinar more exposed to Hormuz closures
                exposure_mult = 1.8 if is_hormuz and node_id in ("ref_jamnagar", "ref_vadinar") else 0.8
                drop_pct = min(40.0, price_inc_pct * 0.4 * exposure_mult * cfg["shortfall_mult"])
                proj_util = max(50.0, attrs["utilization"] - drop_pct)
                
                shutdown = proj_util < attrs.get("min_economic_run_pct", 70.0)
                
                refinery_impacts.append(RefineryImpact(
                    refinery_name=attrs.get("label", node_id),
                    operator=attrs.get("operator", "Unknown"),
                    current_utilization_pct=attrs["utilization"],
                    projected_utilization_pct=round(proj_util, 1),
                    utilization_drop_pct=round(drop_pct, 1),
                    affected_crude_grades=attrs.get("processable_grades", [])[:2],
                    can_substitute=proj_util > attrs.get("min_economic_run_pct", 70.0),
                    substitute_grade=attrs.get("processable_grades", [])[-1] if len(attrs.get("processable_grades", [])) > 1 else None,
                    min_economic_run_pct=attrs.get("min_economic_run_pct", 70.0),
                    shutdown_risk=shutdown
                ))

        # SPR Runway (Base SPR holds ~39 million barrels. Total India consumption ~4.5 mbpd)
        shortfall_vol = supply_loss * cfg["shortfall_mult"]
        spr_runway = 39.0 / shortfall_vol if shortfall_vol > 0 else 999.0
        
        # India cost increase: volume * price diff * duration
        volume_bbl_day = 4.5 * 1000000  # 4.5 mbpd
        cost_inc_usd_bn = (volume_bbl_day * (sim["p50"] - current_brent) * cfg["duration"]) / 1000000000.0
        
        # Build Explainability Block
        explainability = ExplainabilityBlock(
            reasoning_chain=[
                f"1. Fired Monte Carlo pricing simulation with volatility parameter sigma={sim['sigma']}.",
                f"2. Evaluated refinery run rate degradation (average drop: {round(sum(r.utilization_drop_pct for r in refinery_impacts)/len(refinery_impacts), 1)}%).",
                f"3. Modeled power grid cascading cost of {power['electricity_cost_increase_pct']}% via fuel and LNG correlations.",
                f"4. Checked Strategic Petroleum Reserve drawdown runway: {round(spr_runway, 1)} days."
            ],
            evidence_used=risk_signal.explainability.evidence_used,
            supporting_news=risk_signal.explainability.supporting_news,
            supporting_policies=risk_signal.explainability.supporting_policies,
            historical_similar_events=[
                {"name": cfg["precedent"], "similarity": 0.85, "impact_summary": f"Duration: {cfg['duration']} days. Prices: {sim['p50']}"}
            ],
            knowledge_graph_entities=risk_signal.explainability.knowledge_graph_entities,
            confidence_score=risk_signal.explainability.confidence_score,
            alternative_interpretations=[
                "Global inventories could cover the gap if IEA initiates a coordinated stock release."
            ]
        )

        scenarios.append(Scenario(
            name=cfg["name"],
            probability=cfg["prob"],
            probability_ci=(round(max(0, cfg["prob"] - 0.05), 2), round(min(1.0, cfg["prob"] + 0.05), 2)),
            assumptions=cfg["assumptions"],
            duration_days=cfg["duration"],
            supply_shortfall_mbpd=round(shortfall_vol, 2),
            supply_shortfall_ci=(round(max(0, shortfall_vol - 0.2), 2), round(shortfall_vol + 0.2, 2)),
            brent_price_range=sim["confidence_interval"],
            brent_price_mean=sim["p50"],
            refinery_impacts=refinery_impacts,
            avg_refinery_utilization_drop_pct=round(sum(r.utilization_drop_pct for r in refinery_impacts)/len(refinery_impacts), 1),
            fuel_price_impact=FuelPriceImpact(**fuel),
            power_sector_impact=PowerSectorImpact(
                electricity_cost_increase_pct=power["electricity_cost_increase_pct"],
                electricity_cost_increase_ci=(round(max(0, power["electricity_cost_increase_pct"] - 0.5), 2), 
                                              round(power["electricity_cost_increase_pct"] + 0.5, 2)),
                fuel_oil_generation_loss_mw=power["fuel_oil_generation_loss_mw"],
                cascade_to_gas_prices_pct=power["cascade_to_gas_prices_pct"],
                industrial_power_cost_impact_pct=power["industrial_power_cost_impact_pct"],
                affected_states=power["affected_states"],
                narrative=f"Price increase of {price_inc_pct:.1f}% yields electricity cost hike of {power['electricity_cost_increase_pct']}%."
            ),
            india_import_cost_increase_usd_bn=round(cost_inc_usd_bn, 2),
            spr_runway_days=round(spr_runway, 1),
            gdp_impact_pct=cfg["gdp_impact"],
            gdp_impact_ci=(round(cfg["gdp_impact"] - 0.1, 2), round(cfg["gdp_impact"] + 0.1, 2)),
            inflation_impact_pct=cfg["inflation"],
            historical_precedent=cfg["precedent"],
            explainability=explainability
        ))

    # Compile result
    return ScenarioResult(
        scenario_id=f"SCN_{int(datetime.utcnow().timestamp())}",
        trigger_signal=risk_signal,
        scenarios=scenarios,
        recommendation_urgency="IMMEDIATE" if any(s.spr_runway_days < 15 for s in scenarios) else "WITHIN_48H",
        key_insight=f"Severe scenario projects Brent climbing to ${scenarios[2].brent_price_mean} and SPR reserves depleted in {scenarios[2].spr_runway_days} days."
    )
