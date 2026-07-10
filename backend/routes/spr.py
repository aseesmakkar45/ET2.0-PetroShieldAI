"""
SPR Routes – serves Strategic Petroleum Reserve drawdown and replenishment advisory.
"""
from fastapi import APIRouter
from agents.orchestrator import get_active_state

router = APIRouter()


@router.get("/spr")
async def get_spr_advisory(scenario_type: str = None, shortfall: float = 0.0):
    state = get_active_state()
    if state and state.spr_advisory:
        return state.spr_advisory.model_dump()
    return {}
