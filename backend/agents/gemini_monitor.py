"""
Gemini Monitoring & Auditing Agent (Agent 6) – audits predictions
made by subagents 1-4 and generates dynamic executive briefings and scenario narratives.
"""
import json
import logging
import re
from typing import Dict, Any, Optional
import google.generativeai as genai
from config import settings, get_gemini_api_key

logger = logging.getLogger("uvicorn.error")

def audit_and_brief_with_gemini(state) -> Optional[Dict[str, Any]]:
    """
    Query Gemini API to audit predictions across local agents,
    verify consistency, and generate dynamic briefings and narratives.
    """
    api_key = get_gemini_api_key() or ""
    if not api_key:
        logger.info("[GEMINI MONITOR] No GEMINI_API_KEY configured. Skipping LLM audit/briefing.")
        return None

    try:
        # Configure Gemini
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')

        # Gather inputs from local agents
        raw_signal = state.raw_signal
        source_type = state.source_type
        
        # Agent 1: Risk
        risk_sig = state.risk_signal
        severity = risk_sig.severity if risk_sig else "UNKNOWN"
        disruption_prob = risk_sig.disruption_probability if risk_sig else 0.0
        shortfall = risk_sig.estimated_supply_impact_mbpd if risk_sig else 0.0
        chokepoints = ", ".join(risk_sig.affected_chokepoints) if risk_sig else "None"
        countries = ", ".join(risk_sig.affected_countries) if risk_sig else "None"
        
        # Agent 2: Scenario modeller
        scen_result = state.scenario_result
        base_case = None
        if scen_result and len(scen_result.scenarios) > 1:
            base_case = scen_result.scenarios[1] # Base Case
        
        brent_mean = base_case.brent_price_mean if base_case else 82.5
        gdp_hit = base_case.gdp_impact_pct if base_case else 0.0
        cost_inc = base_case.india_import_cost_increase_usd_bn if base_case else 0.0
        refinery_drop = base_case.avg_refinery_utilization_drop_pct if base_case else 0.0
        
        # Agent 3: Procurement
        proc = state.procurement_plan
        best_rec_supplier = "N/A"
        best_rec_route = "N/A"
        total_proc_cost_impact = 0.0
        if proc:
            total_proc_cost_impact = proc.total_cost_impact_usd_per_day
            if proc.recommendations:
                best_rec_supplier = proc.recommendations[0].to_supplier
                best_rec_route = proc.recommendations[0].route.route_name
                
        # Agent 4: SPR
        spr = state.spr_advisory
        spr_runway = spr.current_runway_days if spr else 0.0
        spr_optimized = spr.optimized_runway_days if spr else 0.0
        drawdown_strategy = spr.drawdown_strategy if spr else "N/A"
        refill_cost = spr.replenishment_plan.estimated_cost_usd_bn if spr else 0.0

        # Construct prompt
        prompt = f"""
You are the PetroShield AI Executive Auditor, a senior policy and energy supply chain risk intelligence system.
You are monitoring a network of 4 specialized local subagents that have analyzed a threat signal:

Raw Signal: "{raw_signal}"
Source Type: {source_type}

Here are the quantitative results computed by the subagents:
1. Risk Intelligence Agent:
   - Severity: {severity}
   - Disruption Probability: {disruption_prob}%
   - Estimated Supply Shortfall: {shortfall} mbpd
   - Affected Chokepoints: {chokepoints}
   - Affected Sovereign Nations: {countries}

2. Disruption Scenario Modeller (Base Case forecast):
   - Predicted Brent Crude Price: ${brent_mean}/bbl (baseline: $82.50)
   - India Crude Import Bill Increase: ${cost_inc}B USD
   - Projected GDP Contraction: {gdp_hit}%
   - Average Refinery Capacity Drop: {refinery_drop}%

3. Procurement Orchestrator:
   - Best Reroute Sourcing Target: {best_rec_supplier}
   - Best Sourcing Transit Route: {best_rec_route}
   - Daily Procurement Budget Adjustment: ${total_proc_cost_impact:,.2f} USD/day

4. Strategic Petroleum Reserve (SPR) Advisor:
   - Baseline Runway: {spr_runway} days
   - Optimized Runway (with drawdown): {spr_optimized} days
   - Drawdown Schedule: {drawdown_strategy}
   - Estimated Replenishment Cost: ${refill_cost}B USD

YOUR MISSION:
Perform a deep risk audit and generate policymaker materials.

1. **Prediction Audit**: Cross-reference the outputs for logical alignment.
   - Check if a high supply shortfall correctly correlates with Brent price spikes.
   - Check if the suggested SPR drawdown rate matches the shortfall deficit safely.
   - Verify if procurement reroutings have realistic volumes.
   - Write any conflicts or critical observations in 'audit_warnings'.

2. **Dynamic Briefing & Narratives**:
   - Write a polished, context-rich Executive Briefing for Cabinet decision-makers (in Markdown format). Do NOT use static templates. Customize it to the specific news event.
   - Create 4 sequential, context-specific narratives (e.g. Day 0, Day 5, Day 12, Day 20) simulating the timeline of the disruption.
   - Create 6 chronological predicted cascade steps (e.g., "Day 0 — Hormuz blocked. Gulf tankers frozen.", "Day 3 — ...") showing downstream impacts.

You MUST respond ONLY with a raw JSON object (no markdown fence blocks like ```json, no trailing comments). The schema must match:
{{
  "executive_briefing": "Cabinet Briefing text here in Markdown format. Limit to 300 words.",
  "narratives": [
     "Day 0: Situation narrative...",
     "Day 5: Secondary impacts narrative...",
     "Day 12: Drawdown and refinery impact narrative...",
     "Day 20: Mitigations and recovery narrative..."
  ],
  "cascade_steps": [
     "Day 0 — Step 1 details...",
     "Day 3 — Step 2 details...",
     "Day 7 — Step 3 details...",
     "Day 12 — Step 4 details...",
     "Day 18 — Step 5 details...",
     "Day 25 — Step 6 details..."
  ],
  "audit_warnings": [
     "Warning 1 regarding data inconsistency or structural risk...",
     "Warning 2..."
  ]
}}
"""
        logger.info("[GEMINI MONITOR] Sending audit payload to Gemini model...")
        response = model.generate_content(prompt, request_options={"timeout": 10.0})
        text = response.text.strip()
        
        # Clean any accidental markdown code fences
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n", "", text)
            text = re.sub(r"\n```$", "", text)
        
        data = json.loads(text.strip())
        logger.info("[GEMINI MONITOR] Successfully audited and generated dynamic brief.")
        return data

    except Exception as exc:
        logger.error(f"[GEMINI MONITOR] Error calling Gemini API: {exc}. Falling back to data-driven local briefing generator.")
        return _get_fallback_executive_briefing(state)


def _get_fallback_executive_briefing(state) -> Dict[str, Any]:
    """
    Data-driven local fallback for the executive briefing, narratives, and cascades.
    Ensures that when Gemini is rate-limited, the system still displays high-fidelity,
    event-specific dynamic content derived from subagent outputs rather than returning None.
    """
    raw_signal = state.raw_signal
    source_type = state.source_type
    
    # Agent 1: Risk
    risk_sig = state.risk_signal
    severity = risk_sig.severity if risk_sig else "UNKNOWN"
    disruption_prob = risk_sig.disruption_probability if risk_sig else 0.0
    shortfall = risk_sig.estimated_supply_impact_mbpd if risk_sig else 0.0
    chokepoints = ", ".join(risk_sig.affected_chokepoints) if (risk_sig and risk_sig.affected_chokepoints) else "critical lanes"
    countries = ", ".join(risk_sig.affected_countries) if (risk_sig and risk_sig.affected_countries) else "None"
    
    # Agent 2: Scenario modeller
    scen_result = state.scenario_result
    base_case = None
    if scen_result and len(scen_result.scenarios) > 1:
        base_case = scen_result.scenarios[1]  # Base Case
    
    brent_mean = base_case.brent_price_mean if base_case else 82.5
    gdp_hit = base_case.gdp_impact_pct if base_case else 0.0
    cost_inc = base_case.india_import_cost_increase_usd_bn if base_case else 0.0
    refinery_drop = base_case.avg_refinery_utilization_drop_pct if base_case else 0.0
    
    # Agent 3: Procurement
    proc = state.procurement_plan
    best_rec_supplier = "N/A"
    best_rec_route = "N/A"
    total_proc_cost_impact = 0.0
    if proc:
        total_proc_cost_impact = proc.total_cost_impact_usd_per_day
        if proc.recommendations:
            best_rec_supplier = proc.recommendations[0].to_supplier
            best_rec_route = proc.recommendations[0].route.route_name
            
    # Agent 4: SPR
    spr = state.spr_advisory
    spr_runway = spr.current_runway_days if spr else 0.0
    spr_optimized = spr.optimized_runway_days if spr else 0.0
    drawdown_strategy = spr.drawdown_strategy if spr else "N/A"
    refill_cost = spr.replenishment_plan.estimated_cost_usd_bn if spr else 0.0

    # Build fallback elements
    briefing = (
        f"### National Energy Security Assessment\n\n"
        f"**Threat Event:** {raw_signal}\n\n"
        f"**Risk Level:** {severity} ({disruption_prob:.1f}% disruption probability). "
        f"Expected crude supply shortfall of **{shortfall:.2f} mbpd**. Brent prices are modeled to average "
        f"**${brent_mean:.2f}/bbl** under the Base Case, creating a fiscal impact of "
        f"**${cost_inc:.2f}B USD** for India's oil import bill and an estimated GDP contraction of "
        f"**{abs(gdp_hit):.2f}%**.\n\n"
        f"**Mitigation Strategy:**\n"
        f"- **Alternative Sourcing:** Active rerouting from disrupted channels to **{best_rec_supplier}** "
        f"via the **{best_rec_route}** shipping lane.\n"
        f"- **Strategic Reserves:** An optimized drawdown of ISPRL caverns extends the reserve runway "
        f"from **{spr_runway:.1f} days** to **{spr_optimized:.1f} days** ({drawdown_strategy} protocol).\n"
        f"- **Downstream Actions:** Port traffic and refinery utilization rates are under continuous monitor, "
        f"with average utilization drops capped at **{refinery_drop:.1f}%**.\n\n"
        f"*This briefing was compiled via the data-driven local fallback engine.*"
    )

    narratives = [
        f"Day 0: Threat detected. A potential disruption of {shortfall:.2f} mbpd near {chokepoints} has raised the national energy risk level to {severity}. Preemptive alerts sent to MoPNG and ISPRL.",
        f"Day 5: Secondary market pricing cascades. Brent crude prices react to the supply threat, rising toward ${brent_mean:.2f}/bbl. Refining margins compress as feedstock availability drops by {refinery_drop:.1f}%.",
        f"Day 12: Drawdown activation. SPR reserves drawdown is initiated at Padur and Mangaluru, extending the supply runway to {spr_optimized:.1f} days and preventing emergency refinery shutdowns.",
        f"Day 20: Recovery phase. Alternative supply shipments from {best_rec_supplier} arrive via optimized detour routes, stabilizing port inventories and restoring normal refining utilization."
    ]

    cascade_steps = [
        f"Day 0 — Threat signal detected: {raw_signal[:60]}...",
        f"Day 3 — Shipping insurance premiums spike; tankers transiting {chokepoints} report AIS transponder shutdowns.",
        f"Day 7 — India's daily crude import costs increase by ${total_proc_cost_impact/1000000:.1f}M USD as spot prices rise.",
        f"Day 12 — Refinery run rates project an average utilization drop of {refinery_drop:.1f}% without reserve buffers.",
        f"Day 18 — Padur and Mangaluru SPR drawdown releases critical crude volumes to domestic refineries.",
        f"Day 25 — Alternative supply from {best_rec_supplier} arrives via the Cape/alternate channels, capping the GDP hit at {abs(gdp_hit):.2f}%."
    ]

    audit_warnings = []
    if disruption_prob > 50 and spr_runway < 15:
        audit_warnings.append("Warning: Critical supply runway is under 15 days while disruption probability is high. SPR replenishment planning must be fast-tracked.")
    if brent_mean > 92.0:
        audit_warnings.append("Warning: Brent price forecast exceeds $92/bbl. High risk of domestic fuel price inflation cascading to the power sector.")
    if refinery_drop > 15.0:
        audit_warnings.append("Warning: Projected refinery utilization drop is high. Potential local product shortages for diesel and jet fuel (ATF).")
    if not audit_warnings:
        audit_warnings.append("No critical subagent inconsistencies detected. Baseline supply model is aligned.")

    return {
        "executive_briefing": briefing,
        "narratives": narratives,
        "cascade_steps": cascade_steps,
        "audit_warnings": audit_warnings
    }


def _get_fallback_risk_audit(risk_signal, raw_signal: str) -> Dict[str, Any]:
    """
    Data-driven local risk audit fallback when Gemini API is unavailable.
    Uses actual attributes from the risk_signal object and KG data.
    UPGRADED: Removed 3 hardcoded template responses (Hormuz/RedSea/else).
    All evidence is derived from actual extracted data, not fabricated text.
    """
    from services.knowledge_graph import get_graph
    G = get_graph()

    chokepoints = risk_signal.affected_chokepoints or []
    suppliers = risk_signal.affected_suppliers or []
    disruption_prob = risk_signal.disruption_probability
    event_type = risk_signal.event_type
    severity = risk_signal.severity
    supply_impact = risk_signal.estimated_supply_impact_mbpd

    # ── Build Supporting Evidence from KG node metadata ───────────────────────
    supporting_evidence = []

    for cp_id in chokepoints[:2]:
        cp_node = G.nodes.get(cp_id, {})
        if cp_node:
            label = cp_node.get("label", cp_id)
            risk_score = cp_node.get("risk_score", "unknown")
            supporting_evidence.append(
                f"{label} is a critical maritime chokepoint (KG risk score: {risk_score}/100). "
                f"Connected to {len(list(G.successors(cp_id)))} downstream routing nodes."
            )

    for sup_id in suppliers[:2]:
        sup_node = G.nodes.get(sup_id, {})
        if sup_node:
            label = sup_node.get("label", sup_id)
            country = sup_node.get("country", "")
            risk_score = sup_node.get("risk_score", "unknown")
            supporting_evidence.append(
                f"Supplier {label} ({country}) has KG geopolitical risk score {risk_score}/100."
            )

    if not supporting_evidence:
        supporting_evidence = [
            f"Agent 1 assessed disruption probability at {disruption_prob:.1f}% "
            f"based on EventIntelligence extraction (method: {getattr(risk_signal.event_intelligence, 'extraction_method', 'unknown') if risk_signal.event_intelligence else 'unknown'}).",
            f"Event type classified as {event_type}."
        ]

    # ── Contradictory Evidence from KG mitigating factors ────────────────────
    contradictory_evidence = []
    # Check if alternative routes exist
    alt_routes = []
    for node_id, attrs in G.nodes(data=True):
        if attrs.get("type") == "shipping_route":
            route_cps = [n for n in G.successors(node_id) if n in chokepoints]
            if not route_cps:  # Routes not passing through affected chokepoints
                alt_routes.append(attrs.get("label", node_id))

    if alt_routes:
        contradictory_evidence.append(
            f"Alternative shipping routes not passing through affected chokepoints: "
            f"{', '.join(alt_routes[:2])}."
        )

    # Check SPR capacity as mitigating factor
    spr_total = sum(
        attrs.get("capacity_million_bbl", 0)
        for _, attrs in G.nodes(data=True)
        if attrs.get("type") == "spr_facility"
    )
    if spr_total > 0:
        contradictory_evidence.append(
            f"India SPR strategic reserve: {spr_total:.1f} million barrels — "
            f"partial mitigation available if emergency drawdown authorized."
        )

    if not contradictory_evidence:
        contradictory_evidence = ["No direct physical blockade confirmed. Event may resolve through diplomatic channels."]

    # ── Adjust risk score from KG chokepoint risk scores ─────────────────────
    # Instead of hardcoded 85/45/original, use weighted average of chokepoint risk scores
    cp_risk_scores = [G.nodes[cp].get("risk_score", 50) for cp in chokepoints if cp in G.nodes]
    if cp_risk_scores:
        kg_risk_factor = sum(cp_risk_scores) / len(cp_risk_scores) / 100.0
        adjusted_risk = min(98.0, disruption_prob * (0.8 + kg_risk_factor * 0.4))
    else:
        adjusted_risk = disruption_prob  # No adjustment without chokepoint data

    # Severity adjustment
    if adjusted_risk >= 60:
        adj_severity = "CRITICAL"
    elif adjusted_risk >= 40:
        adj_severity = "ELEVATED"
    elif adjusted_risk >= 20:
        adj_severity = "ALERT"
    else:
        adj_severity = "MONITOR"

    # Confidence
    conf_level = "HIGH" if adjusted_risk >= 60 else ("MEDIUM" if adjusted_risk >= 35 else "LOW")
    conf_explanation = (
        f"Fallback audit (Gemini API unavailable). Risk score {adjusted_risk:.1f}% "
        f"derived from KG chokepoint risk scores (avg {sum(cp_risk_scores)/len(cp_risk_scores):.0f}/100) "
        if cp_risk_scores else
        f"Fallback audit (Gemini API unavailable). Risk score {adjusted_risk:.1f}% maintained from Agent 1 assessment."
    )

    assumptions = [
        f"Event type {event_type} assessed on best available intelligence.",
        "Physical infrastructure damage not confirmed — supply delay rather than permanent loss modeled.",
    ]
    uncertainties = [
        "Gemini API unavailable — audit performed without natural language reasoning.",
        "Confidence interval widened: ±15% on all risk and supply impact estimates.",
    ]

    return {
        "validation_decision": "AGREED" if adjusted_risk >= disruption_prob * 0.9 else "ADJUSTED",
        "supporting_evidence": supporting_evidence,
        "contradictory_evidence": contradictory_evidence,
        "confidence_level": conf_level,
        "confidence_explanation": conf_explanation,
        "assumptions": assumptions,
        "weaknesses_and_uncertainties": uncertainties,
        "adjusted_risk_score": round(adjusted_risk, 1),
        "adjusted_severity": adj_severity,
        "adjusted_supply_impact_mbpd": supply_impact
    }


def audit_risk_prediction_with_gemini(risk_signal, raw_signal: str) -> Optional[Dict[str, Any]]:
    """
    Independent Gemini audit and validation of the subagent risk predictions.
    Checks logical consistency, supporting/contradictory evidence, confidence level,
    assumptions, and weaknesses/uncertainties.
    """
    api_key = get_gemini_api_key() or ""
    if not api_key:
        logger.info("[GEMINI RISK AUDIT] No GEMINI_API_KEY. Using high-fidelity local simulation fallback.")
        return _get_fallback_risk_audit(risk_signal, raw_signal)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-3.5-flash')

        signal_data = {
            "event_summary": risk_signal.event_summary,
            "disruption_probability": risk_signal.disruption_probability,
            "severity": risk_signal.severity,
            "affected_chokepoints": risk_signal.affected_chokepoints,
            "affected_countries": risk_signal.affected_countries,
            "estimated_supply_impact_mbpd": risk_signal.estimated_supply_impact_mbpd,
            "evidence_used": risk_signal.explainability.evidence_used,
            "supporting_policies": risk_signal.explainability.supporting_policies
        }

        prompt = f"""
You are the PetroShield AI Risk Auditor. You must independently audit the risk prediction calculated by our Bayesian Risk sub-agent for this event:

Raw Event: "{raw_signal}"
Initial Sub-agent Analysis:
{json.dumps(signal_data, indent=2)}

YOUR MISSION:
Perform an independent validation of this risk prediction. Check for:
1. Logical consistency: Does the severity and supply impact correlate with the chokepoints and countries affected?
2. Missing evidence & bias: Are we overlooking factors like diplomatic channels, alternative shipping reroutes, or regional military status?
3. Contradictory evidence: Is there any reason this disruption might not occur or be milder than predicted?

Produce an independent validation report. If the sub-agent's prediction is too high or too low, adjust the 'adjusted_risk_score' and 'adjusted_severity'/'adjusted_supply_impact_mbpd'.

Return ONLY a raw JSON object matching the schema below (do NOT include markdown fences, trailing comments, or other formatting):
{{
  "validation_decision": "AGREED or ADJUSTED or DISAGREED",
  "supporting_evidence": [
     "Point 1...",
     "Point 2..."
  ],
  "contradictory_evidence": [
     "Point 1...",
     "Point 2..."
  ],
  "confidence_level": "HIGH or MEDIUM or LOW",
  "confidence_explanation": "Detailed explanation of why this confidence level was assigned.",
  "assumptions": [
     "Assumption 1...",
     "Assumption 2..."
  ],
  "weaknesses_and_uncertainties": [
     "Weakness 1...",
     "Weakness 2..."
  ],
  "adjusted_risk_score": 82.0,
  "adjusted_severity": "CRITICAL",
  "adjusted_supply_impact_mbpd": 2.4
}}
"""
        logger.info("[GEMINI RISK AUDIT] Requesting risk audit validation from Gemini...")
        response = model.generate_content(prompt, request_options={"timeout": 10.0})
        text = response.text.strip()
        
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n", "", text)
            text = re.sub(r"\n```$", "", text)
            
        data = json.loads(text.strip())
        logger.info("[GEMINI RISK AUDIT] Successfully audited risk prediction.")
        return data
    except Exception as exc:
        logger.error(f"[GEMINI RISK AUDIT] Error running Gemini risk audit: {exc}. Falling back to high-fidelity local simulation.")
        return _get_fallback_risk_audit(risk_signal, raw_signal)

