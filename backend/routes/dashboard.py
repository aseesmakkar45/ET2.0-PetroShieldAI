"""
Dashboard Routes – serves the National Energy Command Center KPIs and live state.
"""
from fastapi import APIRouter
from agents.orchestrator import get_active_state, run_petroshield_pipeline
from datetime import datetime
import json
from pathlib import Path
from services.live_connectors import connectors
from services.calculators import calculate_spr_days_of_cover, calculate_refinery_utilization_drop

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"

_gdelt_news_cache = None
_gdelt_news_last_fetched = None


@router.get("/dashboard")
async def get_dashboard():
    from fastapi.concurrency import run_in_threadpool
    state = get_active_state()
    
    # If no state has run yet, run baseline pipeline in thread pool (non-blocking)
    if not state:
        from simulation.ais_generator import generate_vessels
        state = await run_in_threadpool(
            run_petroshield_pipeline,
            "Baseline crude supplies flow normally.",
            "POLICY",
            generate_vessels(count=15),
            True  # fast_fallback=True
        )

    risk_sig = state.risk_signal if state else None
    scn_res = state.scenario_result if state else None
    proc_plan = state.procurement_plan if state else None
    spr_adv = state.spr_advisory if state else None
    exec_brief = state.executive_brief if state else None

    # Extract dynamic parameters or fall back to baseline
    risk_score = risk_sig.disruption_probability if risk_sig else 15.0
    risk_level = risk_sig.severity if risk_sig else "MONITOR"
    
    # 1. Fetch live Brent Crude Price from EIA Connector
    eia_brent = connectors.fetch_eia_brent_price()
    current_brent = eia_brent
    if risk_score > 35:
        # Scenario Price Spike adjustment
        current_brent = eia_brent * 1.15
        
    expected_brent = scn_res.scenarios[1].brent_price_mean if scn_res else current_brent
    
    # 2. Calculate Strategic Reserves Days of Cover from spr_facilities.json
    try:
        spr_path = DATA_DIR / "spr_facilities.json"
        if spr_path.exists():
            with open(spr_path, "r") as f:
                caverns = json.load(f)
            spr_days = calculate_spr_days_of_cover(caverns)
        else:
            spr_days = 64.0
    except Exception:
        spr_days = 64.0
        
    supply_loss = scn_res.scenarios[1].supply_shortfall_mbpd if scn_res else 0.0
    cost_inc = proc_plan.total_cost_impact_usd_per_day if proc_plan else 0.0
    
    vessels_at_risk = len(risk_sig.geospatial_evidence.vessel_anomalies) if risk_sig else 0
    
    # 3. Calculate connected refinery run-rate impact drop
    refineries_at_risk = 0
    try:
        ref_path = DATA_DIR / "refineries.json"
        supp_path = DATA_DIR / "suppliers.json"
        if ref_path.exists() and supp_path.exists():
            with open(ref_path, "r") as f:
                refineries = json.load(f)
            with open(supp_path, "r") as f:
                suppliers = json.load(f)
            for ref in refineries:
                drop = calculate_refinery_utilization_drop(ref, suppliers, risk_score)
                if drop > 5.0:
                    refineries_at_risk += 1
    except Exception:
        refineries_at_risk = 1 if risk_score > 35 else 0

    avg_confidence = proc_plan.explainability.confidence_score * 100 if proc_plan else 95.0
    latency = sum(step["duration_ms"] for step in state.decision_trace) if state.decision_trace else 15
    
    # Compile 12 Dashboard KPIs
    kpis = [
        {"id": "risk_level", "label": "Live Risk Level", "value": f"{risk_score:.1f}", "unit": "/100", "status": "critical" if risk_score > 55 else ("warning" if risk_score > 35 else "normal")},
        {"id": "ships_at_risk", "label": "Ships at Risk", "value": str(vessels_at_risk), "unit": "tankers", "status": "critical" if vessels_at_risk > 0 else "normal"},
        {"id": "refineries_affected", "label": "Affected Refineries", "value": str(refineries_at_risk), "unit": "facilities", "status": "critical" if refineries_at_risk > 0 else "normal"},
        {"id": "supply_loss", "label": "Supply Loss", "value": f"{supply_loss:.2f}", "unit": "mbpd", "status": "critical" if supply_loss > 0 else "normal"},
        {"id": "current_brent", "label": "Current Brent (EIA Live)", "value": f"${current_brent:.2f}", "unit": "USD/bbl", "status": "warning" if current_brent > 90 else "normal"},
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

    # 4. Serve GDELT news from cache — never block the response waiting for GDELT
    # The cache is refreshed asynchronously in the background every 15 minutes
    global _gdelt_news_cache, _gdelt_news_last_fetched
    from datetime import timedelta
    
    now = datetime.now()
    recent_risks = []

    if _gdelt_news_cache is not None:
        # Return cached data immediately
        recent_risks = list(_gdelt_news_cache)
    
    # Always inject the active risk signal at top
    if risk_sig:
        sig_dict = risk_sig.model_dump()
        raw_url = (
            risk_sig.explainability.supporting_news[0]
            if (risk_sig.explainability and risk_sig.explainability.supporting_news)
            else None
        )
        sig_dict["article_url"] = raw_url if (raw_url and raw_url.startswith("http")) else None
        if not any(r.get("signal_id") == sig_dict.get("signal_id") for r in recent_risks):
            recent_risks.insert(0, sig_dict)

    # Trigger background cache refresh if stale (non-blocking)
    cache_stale = (_gdelt_news_cache is None or _gdelt_news_last_fetched is None 
                   or (now - _gdelt_news_last_fetched) > timedelta(minutes=15))
    if cache_stale:
        import asyncio
        asyncio.create_task(_refresh_gdelt_cache(risk_sig))

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
        "top_risks": recent_risks,
        "latest_recommendations": [r.tradeoff_summary for r in proc_plan.recommendations] if proc_plan else [
            "Maintain baseline shipping charters.",
            "Monitor Hormuz and Red Sea corridors.",
            "Verify Cochin port offloading throughput."
        ],
        "executive_briefing": exec_brief or "All energy import corridors are operating normally. No active disruptions detected.",
        "timestamp": state.timestamp
    }


async def _refresh_gdelt_cache(risk_sig):
    """Background task: fetch GDELT news and score each article with the Risk Intel agent.
    Runs in a thread pool so it never blocks the event loop."""
    global _gdelt_news_cache, _gdelt_news_last_fetched
    from fastapi.concurrency import run_in_threadpool

    def _do_fetch():
        gdelt_news = connectors.fetch_gdelt_news()
        from agents.risk_intel import run_risk_intel_agent
        recent_risks = []

        for item in gdelt_news[:4]:
            title = item.get("title") or ""
            url   = item.get("url")   or ""
            source = item.get("source") or "GDELT"
            article_url = url if url.startswith("http") else None
            try:
                agent_result = run_risk_intel_agent(
                    raw_signal=title,
                    source_type="GDELT_NEWS",
                    fast_fallback=True
                )
                disruption_prob   = agent_result.disruption_probability
                affected_chokes   = agent_result.affected_chokepoints or ["Strait of Hormuz"]
                affected_countries= agent_result.affected_countries   or ["Unknown"]
                estimated_impact  = agent_result.estimated_supply_impact_mbpd
                event_type        = agent_result.event_type
                severity          = agent_result.severity
            except Exception:
                disruption_prob   = 25.0
                affected_chokes   = ["Strait of Hormuz"]
                affected_countries= ["Unknown"]
                estimated_impact  = 0.2
                event_type        = "GEOPOLITICAL_NEWS"
                severity          = "MONITOR"

            recent_risks.append({
                "signal_id": f"gdelt_{int(datetime.now().timestamp())}_{title[:8].replace(' ', '_')}",
                "source_type": "GDELT_NEWS",
                "timestamp": item.get("timestamp") or datetime.now().isoformat(),
                "event_type": event_type,
                "event_summary": f"[{source}] {title}",
                "disruption_probability": disruption_prob,
                "severity": severity,
                "affected_chokepoints": affected_chokes,
                "affected_countries": affected_countries,
                "estimated_supply_impact_mbpd": estimated_impact,
                "geospatial_evidence": {"vessel_anomalies": []},
                "article_url": article_url
            })
        return recent_risks

    try:
        result = await run_in_threadpool(_do_fetch)
        _gdelt_news_cache = result
        _gdelt_news_last_fetched = datetime.now()
    except Exception as e:
        print(f"[DASHBOARD] Background GDELT refresh failed: {e}")


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
