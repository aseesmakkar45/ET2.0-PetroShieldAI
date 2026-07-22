"""
Executive Briefing Agent (Agent 5) – compiles clear, actionable briefs
suitable for national-level policymakers.
"""
import json
import logging
from agents.risk_intel import RiskSignal
from agents.scenario_modeller import ScenarioResult
from agents.procurement import ProcurementPlan
from agents.spr_advisor import SPRAdvisory
from agents.groq_prompt_agent import groq_prompting_agent

logger = logging.getLogger("uvicorn.error")

def run_executive_briefing_agent(
    risk_signal: RiskSignal,
    scenario_result: ScenarioResult,
    procurement_plan: ProcurementPlan,
    spr_advisory: SPRAdvisory
) -> str:
    """
    Run Agent 5: Synthesizes high-level policymaker summaries
    using Groq LLM based on raw and structured data across all agents.
    """
    # Extract key values for fallback and Groq prompt
    event_type = risk_signal.event_type.replace("_", " ").lower()
    chokepoints = ", ".join(risk_signal.affected_chokepoints) or "shipping corridors"
    prob = risk_signal.disruption_probability
    severity = risk_signal.severity
    
    base_case = scenario_result.scenarios[1]
    expected_price = base_case.brent_price_mean
    gdp_hit = abs(base_case.gdp_impact_pct)
    
    best_rec = procurement_plan.recommendations[0] if procurement_plan.recommendations else None
    
    # 1. Prepare data payload for Groq
    payload = {
        "event_type": event_type,
        "affected_chokepoints": chokepoints,
        "disruption_probability": prob,
        "severity": severity,
        "base_case_brent_price_mean": expected_price,
        "base_case_gdp_impact_pct": gdp_hit,
        "base_case_import_cost_increase_usd_bn": base_case.india_import_cost_increase_usd_bn,
        "procurement_recommendation": best_rec.model_dump() if best_rec else None,
        "spr_drawdown_strategy": spr_advisory.drawdown_strategy,
        "spr_optimized_runway_days": spr_advisory.optimized_runway_days,
        "spr_current_runway_days": spr_advisory.current_runway_days
    }
    
    # 2. Call Groq
    system_instruction = (
        "You are the Executive Briefing Agent for the Ministry of Petroleum and Natural Gas. "
        "Your task is to write a single, cohesive, highly professional 2-3 sentence paragraph summarizing the crisis, "
        "the macroeconomic predictions, and the recommended actions. Do not use bullet points or markdown. "
        "Write strictly in plain text. Use the provided JSON data accurately."
    )
    prompt = f"Write the executive briefing paragraph based on this real-time simulation data:\n\n{json.dumps(payload, indent=2)}"
    
    try:
        response_text = groq_prompting_agent._call_groq(prompt, system_instruction)
        if response_text:
            logger.info("[AGENT 5] Successfully generated executive briefing via Groq.")
            # Remove any stray newlines or markdown formatting Groq might have added
            return response_text.replace("\n", " ").strip()
    except Exception as e:
        logger.error(f"[AGENT 5] Error generating Groq briefing: {e}. Falling back to deterministic template.")
    
    # 3. Fallback deterministic template
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
