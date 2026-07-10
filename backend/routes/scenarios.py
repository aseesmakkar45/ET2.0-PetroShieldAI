"""
Scenarios Routes – serves the 3 Monte Carlo scenarios.
"""
from fastapi import APIRouter, Body
from agents.orchestrator import get_active_state, run_petroshield_pipeline

router = APIRouter()


@router.get("/scenarios")
async def get_scenarios():
    """Return scenarios from the active state."""
    state = get_active_state()
    if state and state.scenario_result:
        return [state.scenario_result.model_dump()]
    return []


@router.post("/scenarios/generate")
async def generate_scenario(
    scenario_type: str = Body(..., embed=True),
    current_brent: float = Body(default=82.5, embed=True)
):
    """Triggers the pipeline for a specified threat type (demo scenario generator)."""
    trigger_prompts = {
        "hormuz": "CRITICAL conflict: Iran blockades the Strait of Hormuz, blockading crude oil tanker transits to Sikka. Brent price surges.",
        "redsea": "CRITICAL shipping crisis: Houthi forces launch missile strikes in the Bab-el-Mandeb strait, forcing Suez route diversions.",
        "opec": "POLICY change: OPEC+ announces emergency production cuts of 2.0 mbpd, causing global supply shortages."
    }
    
    prompt = trigger_prompts.get(
        scenario_type.lower(), 
        f"CRITICAL risk: Disruption trigger of type {scenario_type} affecting energy supply lanes."
    )
    
    from simulation.ais_generator import generate_vessels
    mock_vessels = generate_vessels(count=15)
    
    state = run_petroshield_pipeline(prompt, "POLICY" if "opec" in scenario_type else "NEWS", mock_vessels)
    return state.scenario_result.model_dump() if state.scenario_result else {}


@router.get("/scenarios/types/list")
async def list_scenario_types():
    return [
        {"id": "hormuz", "name": "Strait of Hormuz Blockade", "description": "Simulates 50% flow reduction through Hormuz (approx. 10 mbpd)."},
        {"id": "redsea", "name": "Bab-el-Mandeb Red Sea Threats", "description": "Simulates Houthi shipping attacks forcing Cape diversions."},
        {"id": "opec", "name": "OPEC+ Production Cuts", "description": "Simulates voluntary supply cuts across GCC members."}
    ]
