"""
Decision Replay Routes – serves the step-by-step trace of agent executions.
"""
from fastapi import APIRouter
from agents.orchestrator import get_active_state

router = APIRouter()


@router.get("/decision-replay")
async def get_decision_replay():
    state = get_active_state()
    if state:
        return {
            "raw_signal": state.raw_signal,
            "timestamp": state.timestamp,
            "decision_trace": state.decision_trace,
            "execution_log": state.execution_log,
            "gemini_audit": state.gemini_audit,
            "gemini_risk_validation": state.gemini_risk_validation
        }
    return {"decision_trace": []}
