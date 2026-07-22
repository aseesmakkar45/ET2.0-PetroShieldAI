"""
Reports Routes – generates, downloads, and persists dynamic PDF reports in SQLite database.
"""
from fastapi import APIRouter, Query, Response, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import re
import os

from services.pdf_generator import generate_executive_report_pdf
from agents.groq_prompt_agent import groq_prompting_agent
from agents.orchestrator import get_active_state
from database import get_db, SessionLocal, SimulatedScenario

router = APIRouter()


@router.get("/reports/history")
async def get_report_history(db: Session = Depends(get_db)):
    """Fetches all stored historic scenarios and their reports from SQLite database."""
    scenarios = db.query(SimulatedScenario).order_by(SimulatedScenario.created_at.desc()).all()
    return [s.to_dict() for s in scenarios]


@router.post("/reports/generate")
async def generate_groq_report(
    report_type: str = Query(default="Weekly Supply Chain Risk Assessment"),
    time_range: str = Query(default="Last 7 Days")
):
    """
    Stage 3: Prompts Groq to generate a structured scenario report in the required JSON format.
    """
    state = get_active_state()
    
    if state:
        st = state.to_dict()
        scenario_data = {
            "raw_signal": st.get("raw_signal"),
            "source_type": st.get("source_type"),
            "risk_signal": st.get("risk_signal"),
            "scenario_result": st.get("scenario_result"),
            "procurement_plan": st.get("procurement_plan"),
            "spr_advisory": st.get("spr_advisory"),
            "parsed_references": st.get("parsed_references")
        }
    else:
        scenario_data = {
            "active_event": "hormuz",
            "brent_price": 96.4,
            "shortfall_mbpd": 1.4,
            "spr_release_rate": 1.15
        }
    
    report_json = groq_prompting_agent.generate_scenario_report(
        scenario_data=scenario_data,
        report_type=report_type,
        time_range=time_range
    )
    return report_json


@router.get("/reports/download-pdf")
async def download_pdf_report(
    report_type: str = Query(default="Master Scenario Incident Briefing"),
    time_range: str = Query(default="Active Simulation Window"),
    db: Session = Depends(get_db)
):
    """
    Generates a dynamic PDF executive briefing based on live simulation state
    and persists the scenario execution record in SQLite database.
    """
    state = get_active_state()
    state_data = state.to_dict() if state else None

    pdf_bytes = generate_executive_report_pdf(
        report_title=report_type,
        time_range=time_range,
        state_data=state_data
    )
    
    # Safe ASCII filename for Starlette HTTP headers
    ascii_title = re.sub(r'[^\x00-\x7F]+', '_', report_type)
    safe_filename = re.sub(r'[\s/:\-]+', '_', ascii_title).strip('_') + ".pdf"
    
    # Save a record into SQLite SimulatedScenario table if state_data exists
    try:
        st = state_data or {}
        risk_sig = st.get("risk_signal") or {}
        scen_res = st.get("scenario_result") or {}
        scenarios = scen_res.get("scenarios") or []
        base_case = scenarios[1] if len(scenarios) > 1 else (scenarios[0] if scenarios else {})
        spr_adv = st.get("spr_advisory") or {}
        exec_brief = st.get("executive_brief") or {}

        scenario_record = SimulatedScenario(
            created_at=datetime.utcnow(),
            scenario_title=report_type,
            raw_signal=str(st.get("raw_signal", report_type))[:500],
            source_type=str(st.get("source_type", "SIMULATION")),
            disruption_probability=float(risk_sig.get("disruption_probability", 84.5)),
            severity=str(risk_sig.get("severity", "ELEVATED")),
            estimated_supply_impact_mbpd=float(risk_sig.get("estimated_supply_impact_mbpd", 1.40)),
            brent_price_mean=float(base_case.get("brent_price_mean", 96.40)),
            gdp_impact_pct=float(base_case.get("gdp_impact_pct", -0.45)),
            import_cost_increase_usd_bn=float(base_case.get("india_import_cost_increase_usd_bn", 14.20)),
            spr_release_rate_mbpd=float(spr_adv.get("recommended_release_rate_mbpd", 1.15)),
            spr_runway_days=int(spr_adv.get("runway_days_remaining", 34)),
            audit_verdict=str(exec_brief.get("audit_verdict", "VERIFIED AND APPROVED")),
            executive_narrative=str(exec_brief.get("narrative", "")),
            pdf_filename=safe_filename
        )
        db.add(scenario_record)
        db.commit()
        print(f"[DB] Persisted scenario '{report_type}' to petroshield.db (ID: {scenario_record.id}).")
    except Exception as e:
        db.rollback()
        print(f"[DB] Error saving scenario to DB: {e}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={safe_filename}"
        }
    )
