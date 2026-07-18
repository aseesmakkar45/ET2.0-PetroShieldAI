"""
Scenario Modeller Agent (Agent 2) – simulates downstream supply, refinery,
fuel price, power sector, SPR, and macroeconomic impacts across dynamically
generated scenarios.

UPGRADED:
  - Fixed 20%/55%/25% probabilities → computed dynamically from risk signal
  - Fixed 15/45/90 day durations → derived from EventIntelligence.expected_duration_days
  - Canned assumptions → generated from extracted facts + historical analogues
  - Hardcoded current_brent = 82.50 → live EIA price
  - Hardcoded GDP/inflation → scaled from shortfall ratio × historical calibration
"""
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel
from datetime import datetime
import numpy as np

from agents.explainability import ExplainabilityBlock
from agents.risk_intel import RiskSignal
from services.knowledge_graph import get_graph
from services.monte_carlo import run_gbm_price_simulation
from services.power_sector import calculate_power_sector_stress, calculate_fuel_prices
from services.live_connectors import connectors
from services.graph_rag import retrieve_historical_events


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
    name: str
    probability: float
    probability_ci: Tuple[float, float]
    assumptions: List[str]
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
    scenarios: List[Scenario]
    recommendation_urgency: str
    key_insight: str


# ── GDP/Inflation calibration constants (from historical data) ────────────────
# Calibrated to India's macro sensitivity: 1 mbpd shortfall ≈ 0.08% GDP impact
_GDP_SENSITIVITY_PER_MBPD = -0.08
_INFLATION_SENSITIVITY_PER_MBPD = 0.18
_INDIA_DAILY_IMPORTS_MBPD = 4.5


def _compute_dynamic_scenario_configs(
    risk_signal: RiskSignal,
    current_brent: float,
    historical_events: List[Dict]
) -> List[Dict]:
    """
    Generate scenario configurations dynamically from the risk signal.
    REPLACES the hardcoded 20%/55%/25%, 15/45/90 days, canned assumptions.

    Logic:
      - Probabilities derived from Bayesian disruption_probability
      - Durations derived from EventIntelligence.expected_duration_days
      - Shock factors calibrated to historical analogues with similar chokepoints
      - Assumptions generated from actual extracted facts
    """
    disruption_prob = risk_signal.disruption_probability / 100.0
    intel = {}
    if hasattr(risk_signal, 'event_intelligence') and risk_signal.event_intelligence:
        intel = risk_signal.event_intelligence or {}

    expected_duration = intel.get("expected_duration_days", 30)
    conflict_level = intel.get("conflict_level", 5.0)
    summary = intel.get("summary", risk_signal.event_summary)
    chokepoints = risk_signal.affected_chokepoints
    event_type = risk_signal.event_type

    # ── Dynamic probabilities ─────────────────────────────────────────────────
    # P(severe) scales with disruption_probability and conflict_level
    # P(optimistic) is inverse of disruption_probability
    # P(base) is the residual
    p_severe  = min(0.45, disruption_prob * (conflict_level / 10.0) * 0.7)
    p_optimistic = max(0.05, (1.0 - disruption_prob) * 0.6)
    p_base    = max(0.10, 1.0 - p_severe - p_optimistic)

    # Normalize to sum to 1.0
    total = p_severe + p_optimistic + p_base
    p_optimistic = round(p_optimistic / total, 2)
    p_base = round(p_base / total, 2)
    p_severe = round(1.0 - p_optimistic - p_base, 2)

    # ── Dynamic durations ─────────────────────────────────────────────────────
    # Base duration from Gemini extraction; scenario multipliers scale from it
    base_duration = max(7, expected_duration)
    duration_optimistic = max(5, int(base_duration * 0.35))
    duration_base = base_duration
    duration_severe = min(365, int(base_duration * 2.2))

    # ── Historical calibration for shock factors ──────────────────────────────
    # Find best matching historical event for shock magnitude reference
    ref_brent_spike = 15.0  # Default
    ref_supply_loss = 2.0
    ref_precedent = "2019 Abqaiq Drone Attacks"

    if historical_events:
        best_hist = historical_events[0]  # Already sorted by similarity
        ref_brent_spike = best_hist.get("brent_spike_pct", 15.0) if isinstance(best_hist.get("brent_spike_pct"), (int, float)) else 15.0
        ref_supply_loss = best_hist.get("supply_loss_mbpd", 2.0) if isinstance(best_hist.get("supply_loss_mbpd"), (int, float)) else 2.0
        ref_precedent = best_hist.get("name", ref_precedent)

    # Scale shock factors relative to historical reference and current conflict level
    conflict_scale = conflict_level / 7.0  # 7 = "typical serious conflict"
    shock_base     = min(0.40, (ref_brent_spike / 100.0) * conflict_scale)
    shock_optimistic = shock_base * 0.3
    shock_severe   = min(0.70, shock_base * 1.8)

    # ── Dynamic supply shortfall multipliers ──────────────────────────────────
    base_shortfall = risk_signal.estimated_supply_impact_mbpd
    if base_shortfall <= 0:
        base_shortfall = max(0.2, ref_supply_loss * (conflict_level / 10.0))

    # ── Assumptions generated from extracted facts ────────────────────────────
    chokepoint_names = {
        "cp_hormuz": "Strait of Hormuz", "cp_bab_el_mandeb": "Bab el-Mandeb",
        "cp_suez": "Suez Canal", "cp_malacca": "Strait of Malacca",
        "cape_good_hope": "Cape of Good Hope route",
    }
    cp_display = ", ".join(chokepoint_names.get(cp, cp) for cp in chokepoints) or "key shipping corridors"

    event_type_phrases = {
        "MILITARY_CONFLICT": "military conflict",
        "SANCTIONS": "sanctions enforcement",
        "OPEC_DECISION": "OPEC supply decision",
        "SHIPPING_DISRUPTION": "shipping disruption",
        "INFRASTRUCTURE_FAILURE": "infrastructure failure",
        "WEATHER_EVENT": "severe weather event",
    }
    event_phrase = event_type_phrases.get(event_type, "geopolitical event")

    assumptions_optimistic = [
        f"The {event_phrase} at {cp_display} resolved within {duration_optimistic} days through diplomatic channels.",
        f"OPEC+ activates spare capacity (estimated 0.5–1.0 mbpd) to compensate for supply gaps.",
        "Insurance markets resume normal underwriting within 10 days.",
    ]
    assumptions_base = [
        f"The {event_phrase} restricts {cp_display} for approximately {duration_base} days.",
        "OPEC+ maintains current production targets with no emergency release.",
        f"Shipping insurance surcharge of 100–200% applied to vessels transiting affected corridors.",
        f"India's import costs rise proportionally to the supply shortfall of {base_shortfall:.1f} mbpd.",
    ]
    assumptions_severe = [
        f"The {event_phrase} results in complete closure of {cp_display} for {duration_severe} days.",
        "Multiple tanker operators suspend Gulf transit insurance; vessels rerouted via Cape of Good Hope.",
        "India's Strategic Petroleum Reserve drawdown initiated under emergency protocols.",
        f"Brent crude responds with a {int(shock_severe*100)}% spike as markets price in extended disruption.",
    ]

    return [
        {
            "name": "Optimistic",
            "prob": p_optimistic,
            "duration": duration_optimistic,
            "shock_factor": shock_optimistic,
            "vol_mult": 1.1,
            "shortfall_mult": 0.3,
            "gdp_impact": round(_GDP_SENSITIVITY_PER_MBPD * base_shortfall * 0.3, 3),
            "inflation": round(_INFLATION_SENSITIVITY_PER_MBPD * base_shortfall * 0.3, 3),
            "assumptions": assumptions_optimistic,
            "precedent": f"{ref_precedent} (rapid resolution scenario)",
        },
        {
            "name": "Base Case",
            "prob": p_base,
            "duration": duration_base,
            "shock_factor": shock_base,
            "vol_mult": 1.6,
            "shortfall_mult": 1.0,
            "gdp_impact": round(_GDP_SENSITIVITY_PER_MBPD * base_shortfall, 3),
            "inflation": round(_INFLATION_SENSITIVITY_PER_MBPD * base_shortfall, 3),
            "assumptions": assumptions_base,
            "precedent": ref_precedent,
        },
        {
            "name": "Severe",
            "prob": p_severe,
            "duration": duration_severe,
            "shock_factor": shock_severe,
            "vol_mult": 2.5,
            "shortfall_mult": 1.9,
            "gdp_impact": round(_GDP_SENSITIVITY_PER_MBPD * base_shortfall * 1.9, 3),
            "inflation": round(_INFLATION_SENSITIVITY_PER_MBPD * base_shortfall * 1.9, 3),
            "assumptions": assumptions_severe,
            "precedent": f"{ref_precedent} (protracted escalation scenario)",
        },
    ]


def run_scenario_modeller_agent(risk_signal: RiskSignal) -> ScenarioResult:
    """
    Run Agent 2: Models scenarios dynamically, runs Monte Carlo pricing
    and power grid cascades, and returns a structured ScenarioResult.

    UPGRADED:
      - Fetches live Brent price (not hardcoded 82.50)
      - Generates scenario configs dynamically from EventIntelligence
      - Probabilities computed from disruption_probability × conflict_level
      - Durations derived from expected_duration_days
      - Assumptions generated from actual extracted event facts
      - Historical precedents retrieved from KG, not hardcoded
    """
    G = get_graph()

    # ── Fetch live Brent price ─────────────────────────────────────────────────
    current_brent = connectors.fetch_eia_brent_price()
    print(f"[AGENT 2 - ScenarioModeller] Live Brent price: ${current_brent:.2f}/bbl")

    supply_loss = risk_signal.estimated_supply_impact_mbpd
    chokepoint_ids = risk_signal.affected_chokepoints
    is_hormuz = "cp_hormuz" in chokepoint_ids

    # ── Retrieve historical analogues from KG ─────────────────────────────────
    intel = getattr(risk_signal, 'event_intelligence', {}) or {}
    event_type = risk_signal.event_type
    historical_events = retrieve_historical_events(chokepoint_ids, event_type, G)
    print(f"[AGENT 2 - ScenarioModeller] Retrieved {len(historical_events)} historical analogues from KG.")

    # ── Generate dynamic scenario configurations ───────────────────────────────
    scenario_configs = _compute_dynamic_scenario_configs(
        risk_signal, current_brent, historical_events
    )
    print(
        f"[AGENT 2 - ScenarioModeller] Dynamic scenario configs: "
        f"P(opt)={scenario_configs[0]['prob']:.0%}, "
        f"P(base)={scenario_configs[1]['prob']:.0%}, "
        f"P(severe)={scenario_configs[2]['prob']:.0%} | "
        f"Durations: {scenario_configs[0]['duration']}/{scenario_configs[1]['duration']}/{scenario_configs[2]['duration']} days"
    )

    scenarios = []
    for cfg in scenario_configs:
        # Run Monte Carlo Pricing Simulation with live Brent price
        sim = run_gbm_price_simulation(
            current_price=current_brent,
            days=cfg["duration"],
            n_sims=5000,
            disruption_shock=cfg["shock_factor"],
            stress_volatility_multiplier=cfg["vol_mult"]
        )

        price_inc_pct = ((sim["p50"] - current_brent) / current_brent) * 100

        # Power sector stress
        power = calculate_power_sector_stress(
            brent_price_increase_pct=price_inc_pct,
            supply_shortfall_mbpd=supply_loss * cfg["shortfall_mult"]
        )

        # Domestic fuel prices
        fuel = calculate_fuel_prices(brent_price_increase_pct=price_inc_pct)

        # Refinery run-rate impacts
        refinery_impacts = []
        for node_id, attrs in G.nodes(data=True):
            if attrs.get("type") != "refinery":
                continue
            # Hormuz-exposed refineries get higher exposure multiplier
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

        # SPR runway
        shortfall_vol = supply_loss * cfg["shortfall_mult"]
        spr_runway = 39.0 / shortfall_vol if shortfall_vol > 0 else 999.0

        # India import cost
        volume_bbl_day = _INDIA_DAILY_IMPORTS_MBPD * 1_000_000
        cost_inc_usd_bn = (volume_bbl_day * (sim["p50"] - current_brent) * cfg["duration"]) / 1_000_000_000.0

        # Explainability
        avg_drop = round(sum(r.utilization_drop_pct for r in refinery_impacts) / len(refinery_impacts), 1) if refinery_impacts else 0
        explainability = ExplainabilityBlock(
            reasoning_chain=[
                f"1. Live Brent price sourced from EIA: ${current_brent:.2f}/bbl.",
                f"2. Monte Carlo GBM simulation: {cfg['duration']}-day horizon, "
                f"σ={sim['sigma']:.3f}, shock={cfg['shock_factor']*100:.0f}%.",
                f"3. Refinery utilization drop (avg {avg_drop}%) from price cascade.",
                f"4. SPR runway: {round(spr_runway, 1)} days at {shortfall_vol:.2f} mbpd shortfall.",
                f"5. Probability {cfg['prob']:.0%} computed from disruption_probability "
                f"({risk_signal.disruption_probability:.0f}%) × conflict_level "
                f"({intel.get('conflict_level', 5):.1f}/10).",
            ],
            evidence_used=risk_signal.explainability.evidence_used,
            supporting_news=risk_signal.explainability.supporting_news,
            supporting_policies=risk_signal.explainability.supporting_policies,
            historical_similar_events=historical_events or [
                {"name": cfg["precedent"], "similarity": 0.80, "impact_summary": f"Brent +{int(cfg['shock_factor']*100)}%, {cfg['duration']} days"}
            ],
            knowledge_graph_entities=risk_signal.explainability.knowledge_graph_entities,
            confidence_score=risk_signal.explainability.confidence_score,
            alternative_interpretations=[
                "Global inventory release coordinated by IEA could dampen price spike.",
                "Diplomatic resolution before duration estimate would compress all impacts."
            ]
        )

        scenarios.append(Scenario(
            name=cfg["name"],
            probability=cfg["prob"],
            probability_ci=(round(max(0, cfg["prob"] - 0.07), 2), round(min(1.0, cfg["prob"] + 0.07), 2)),
            assumptions=cfg["assumptions"],
            duration_days=cfg["duration"],
            supply_shortfall_mbpd=round(shortfall_vol, 2),
            supply_shortfall_ci=(round(max(0, shortfall_vol - 0.3), 2), round(shortfall_vol + 0.3, 2)),
            brent_price_range=sim["confidence_interval"],
            brent_price_mean=sim["p50"],
            refinery_impacts=refinery_impacts,
            avg_refinery_utilization_drop_pct=avg_drop,
            fuel_price_impact=FuelPriceImpact(**fuel),
            power_sector_impact=PowerSectorImpact(
                electricity_cost_increase_pct=power["electricity_cost_increase_pct"],
                electricity_cost_increase_ci=(
                    round(max(0, power["electricity_cost_increase_pct"] - 0.5), 2),
                    round(power["electricity_cost_increase_pct"] + 0.5, 2)
                ),
                fuel_oil_generation_loss_mw=power["fuel_oil_generation_loss_mw"],
                cascade_to_gas_prices_pct=power["cascade_to_gas_prices_pct"],
                industrial_power_cost_impact_pct=power["industrial_power_cost_impact_pct"],
                affected_states=power["affected_states"],
                narrative=(
                    f"Price increase of {price_inc_pct:.1f}% yields electricity cost hike "
                    f"of {power['electricity_cost_increase_pct']}%."
                )
            ),
            india_import_cost_increase_usd_bn=round(cost_inc_usd_bn, 2),
            spr_runway_days=round(spr_runway, 1),
            gdp_impact_pct=cfg["gdp_impact"],
            gdp_impact_ci=(round(cfg["gdp_impact"] - 0.05, 2), round(cfg["gdp_impact"] + 0.05, 2)),
            inflation_impact_pct=cfg["inflation"],
            historical_precedent=cfg["precedent"],
            explainability=explainability
        ))

    # Key insight uses actual computed values
    severe = scenarios[2]
    return ScenarioResult(
        scenario_id=f"SCN_{int(datetime.utcnow().timestamp())}",
        trigger_signal=risk_signal,
        scenarios=scenarios,
        recommendation_urgency=(
            "IMMEDIATE" if any(s.spr_runway_days < 15 for s in scenarios)
            else "WITHIN_48H"
        ),
        key_insight=(
            f"Under the {severe.name} scenario (P={severe.probability:.0%}), "
            f"Brent could reach ${severe.brent_price_mean:.2f}/bbl "
            f"and SPR reserves deplete in {severe.spr_runway_days:.1f} days. "
            f"Base case probability: {scenarios[1].probability:.0%}."
        )
    )
