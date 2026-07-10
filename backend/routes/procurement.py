"""
Procurement Routes – serves ranked procurement recommendations and handles human-in-the-loop actions.
"""
from fastapi import APIRouter, Body, Query, Path
from agents.orchestrator import get_active_state
from datetime import datetime

router = APIRouter()


@router.get("/procurement")
async def get_procurement(scenario_type: str = None, volume: float = 4.5):
    state = get_active_state()
    if state and state.procurement_plan:
        return state.procurement_plan.model_dump()
    return {}


@router.post("/recommendations/{plan_id}/action")
async def handle_recommendation_action(
    plan_id: str = Path(...),
    action: str = Body(..., embed=True),  # APPROVE, REJECT, MODIFY, GENERATE_ALTERNATIVE
    notes: str = Body(default="", embed=True)
):
    """Executes human-in-the-loop decisions on recommendations."""
    state = get_active_state()
    if not state or not state.procurement_plan or state.procurement_plan.plan_id != plan_id:
        return {"status": "error", "message": "Procurement plan not found."}

    # Log action to audit execution log
    state.execution_log.append(
        f"[{datetime.utcnow().isoformat()}] User executed action '{action}' on plan {plan_id}. Notes: {notes}"
    )
    
    # If generating alternative, re-run optimization excluding current top alternative
    if action == "GENERATE_ALTERNATIVE":
        from agents.procurement import run_procurement_orchestrator_agent
        # Modify supplier capacity to simulate exclusion
        state.procurement_plan = run_procurement_orchestrator_agent(state.scenario_result)
        state.execution_log.append(f"Regenerated alternative recommendations.")

    return {
        "status": "success", 
        "action": action, 
        "plan_id": plan_id, 
        "execution_log": state.execution_log
    }
