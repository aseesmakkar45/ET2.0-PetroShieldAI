"""
Executive Briefing Agent (Agent 5) – compiles clear, actionable briefs
suitable for national-level policymakers.
"""
from agents.risk_intel import RiskSignal
from agents.scenario_modeller import ScenarioResult
from agents.procurement import ProcurementPlan
from agents.spr_advisor import SPRAdvisory


def run_executive_briefing_agent(
    risk_signal: RiskSignal,
    scenario_result: ScenarioResult,
    procurement_plan: ProcurementPlan,
    spr_advisory: SPRAdvisory
) -> str:
    """
    Run Agent 5: Synthesizes high-level policymaker summaries
    based on raw and structured data across all agents.
    """
    # Extract key values
    event_type = risk_signal.event_type.replace("_", " ").lower()
    chokepoints = ", ".join(risk_signal.affected_chokepoints) or "shipping corridors"
    prob = risk_signal.disruption_probability
    severity = risk_signal.severity
    
    base_case = scenario_result.scenarios[1]
    expected_price = base_case.brent_price_mean
    gdp_hit = abs(base_case.gdp_impact_pct)
    
    # Count shutdown risk refineries
    shutdown_refineries = [r.refinery_name for r in spr_advisory.refinery_demand_curves if r.shutdown_risk]
    
    # Rerouting details
    best_rec = procurement_plan.recommendations[0] if procurement_plan.recommendations else None
    
    # Compile brief
    if best_rec:
        brief = (
            f"A {event_type} disruption detected near {chokepoints} has raised India's energy import risk to "
            f"{prob:.1f}% ({severity}). Under the Base Case scenario, Brent is projected to rise to ${expected_price:.1f}/bbl, "
            f"resulting in a ${base_case.india_import_cost_increase_usd_bn:.1f}B import bill increase and a {gdp_hit:.2f}% GDP contraction. "
            f"Recommended immediate action is to reroute {best_rec.volume_mbpd:.2f} mbpd to {best_rec.to_supplier} via {best_rec.route.route_name} "
            f"(confidence: {best_rec.optimization_score}%) while authorizing a controlled {spr_advisory.drawdown_strategy.lower()} SPR drawdown "
            f"extending reserve runway to {spr_advisory.optimized_runway_days:.1f} days."
        )
    else:
        brief = (
            f"A {event_type} disruption near {chokepoints} has raised India's energy import risk to "
            f"{prob:.1f}% ({severity}). Base case forecasts project Brent rising to ${expected_price:.1f}/bbl, "
            f"and SPR reserves depleted within {spr_advisory.current_runway_days:.1f} days. "
            f"Immediate emergency meetings should be called with MoPNG and ISPRL to coordinate alternate supply charters "
            f"and enforce conservation mandates."
        )
        
    return brief
