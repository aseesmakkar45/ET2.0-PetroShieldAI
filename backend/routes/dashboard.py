"""
Dashboard Routes – serves the National Energy Command Center KPIs and live state.
"""
from fastapi import APIRouter
from agents.orchestrator import get_active_state, run_petroshield_pipeline
from datetime import datetime

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard():
    state = get_active_state()
    
    # If no state has run, initialize
    if not state:
        state = get_active_state()

    risk_sig = state.risk_signal
    scn_res = state.scenario_result
    proc_plan = state.procurement_plan
    spr_adv = state.spr_advisory
    exec_brief = state.executive_brief

    # Extract dynamic parameters or fall back to baseline
    risk_score = risk_sig.disruption_probability if risk_sig else 15.0
    risk_level = risk_sig.severity if risk_sig else "MONITOR"
    
    current_brent = scn_res.trigger_signal.disruption_probability * 0.15 + 82.5 if scn_res else 82.5
    expected_brent = scn_res.scenarios[1].brent_price_mean if scn_res else current_brent
    
    supply_loss = scn_res.scenarios[1].supply_shortfall_mbpd if scn_res else 0.0
    spr_days = spr_adv.optimized_runway_days if spr_adv else 9.5 * 7  # default 66 days
    cost_inc = proc_plan.total_cost_impact_usd_per_day if proc_plan else 0.0
    
    vessels_at_risk = len(risk_sig.geospatial_evidence.vessel_anomalies) if risk_sig else 0
    refineries_at_risk = len([r for r in spr_adv.refinery_demand_curves if r.shutdown_risk]) if spr_adv else 0
    
    avg_confidence = proc_plan.explainability.confidence_score * 100 if proc_plan else 95.0
    latency = sum(step["duration_ms"] for step in state.decision_trace) if state.decision_trace else 15
    
    # Compile 12 Dashboard KPIs (upgraded to Palantir/Bloomberg command center level)
    kpis = [
        {"id": "risk_level", "label": "Live Risk Level", "value": f"{risk_score:.1f}", "unit": "/100", "status": "critical" if risk_score > 55 else ("warning" if risk_score > 35 else "normal")},
        {"id": "ships_at_risk", "label": "Ships at Risk", "value": str(vessels_at_risk), "unit": "tankers", "status": "critical" if vessels_at_risk > 0 else "normal"},
        {"id": "refineries_affected", "label": "Affected Refineries", "value": str(refineries_at_risk), "unit": "facilities", "status": "critical" if refineries_at_risk > 0 else "normal"},
        {"id": "supply_loss", "label": "Supply Loss", "value": f"{supply_loss:.2f}", "unit": "mbpd", "status": "critical" if supply_loss > 0 else "normal"},
        {"id": "current_brent", "label": "Current Brent", "value": f"${current_brent:.2f}", "unit": "USD/bbl", "status": "warning" if current_brent > 90 else "normal"},
        {"id": "expected_brent", "label": "Expected Brent", "value": f"${expected_brent:.2f}", "unit": "USD/bbl", "status": "warning" if expected_brent > 90 else "normal"},
        {"id": "spr_days", "label": "SPR Runway Remaining", "value": f"{spr_days:.1f}", "unit": "days", "status": "critical" if spr_days < 15 else ("warning" if spr_days < 30 else "normal")},
        {"id": "cost_increase", "label": "Est. Cost Increase", "value": f"${cost_inc/1000000:.1f}", "unit": "M USD/day", "status": "warning" if cost_inc > 0 else "normal"},
        {"id": "active_alerts", "label": "Active Alerts", "value": "1" if risk_score > 15 else "0", "unit": "alerts", "status": "warning" if risk_score > 15 else "normal"},
        {"id": "avg_confidence", "label": "Avg Recommendation Confidence", "value": f"{avg_confidence:.1f}", "unit": "%", "status": "normal"},
        {"id": "pipeline_latency", "label": "Pipeline Compute Latency", "value": str(latency), "unit": "ms", "status": "normal"},
        {"id": "last_update", "label": "Last Analysis Time", "value": state.timestamp[11:19], "unit": "UTC", "status": "normal"}
    ]

    # Calculate resilience score
    resilience_score = 100.0 - (risk_score * 0.4) - (refineries_at_risk * 5) + (spr_days * 0.1)
    resilience_score = max(10.0, min(100.0, resilience_score))

    return {
        "energy_resilience_score": round(resilience_score, 1),
        "overall_risk_score": risk_score,
        "risk_level": risk_level,
        "brent_price_usd": round(current_brent, 2),
        "active_imports_mbd": 4.5,
        "active_vessels": 48,
        "active_alerts": 1 if risk_score > 15 else 0,
        "spr_days_cover": round(spr_days, 1),
        "kpi_cards": kpis,
        "top_risks": [risk_sig.model_dump()] if risk_sig else [],
        "latest_recommendations": [r.tradeoff_summary for r in proc_plan.recommendations] if proc_plan else [
            "Maintain baseline shipping charters.",
            "Monitor Hormuz and Red Sea corridors.",
            "Verify Cochin port offloading throughput."
        ],
        "executive_briefing": exec_brief or "All energy import corridors are operating normally. No active disruptions detected.",
        "timestamp": state.timestamp
    }


# Store active API key in memory (simplifies demo configuration without sqlite table changes)
from config import settings
_saved_ais_key = settings.AISSTREAM_API_KEY

@router.get("/settings/ais")
async def get_ais_settings():
    global _saved_ais_key
    # Mask key for display
    masked = f"{_saved_ais_key[:4]}..." if len(_saved_ais_key) > 4 else ""
    return {"has_key": bool(_saved_ais_key), "masked_key": masked}

@router.post("/settings/ais")
async def save_ais_settings(payload: dict):
    global _saved_ais_key
    key = payload.get("api_key", "").strip()
    _saved_ais_key = key
    
    from services.real_ais import update_ais_stream_key
    update_ais_stream_key(key)
    
    return {"status": "success", "message": "AISStream API key updated and stream listener started." if key else "AISStream API listener stopped."}
