from fastapi import APIRouter, Body
from services.scenario_engine import generate_scenarios, SCENARIO_CONFIGS
from typing import Optional

router = APIRouter()

_scenario_cache = {}


@router.get("/scenarios")
async def get_scenarios():
    """Return all generated scenarios (cached)."""
    return list(_scenario_cache.values())


@router.post("/scenarios/generate")
async def generate_scenario(
    scenario_type: str = Body(..., embed=True),
    current_brent: float = Body(default=82.5, embed=True)
):
    """Generate a fresh scenario for the given type."""
    result = generate_scenarios(scenario_type, current_brent)
    _scenario_cache[scenario_type] = result
    return result


@router.get("/scenarios/{scenario_type}")
async def get_scenario(scenario_type: str):
    if scenario_type in _scenario_cache:
        return _scenario_cache[scenario_type]
    result = generate_scenarios(scenario_type)
    _scenario_cache[scenario_type] = result
    return result


@router.get("/scenarios/types/list")
async def list_scenario_types():
    return [
        {"id": k, "name": v["trigger"], "description": v["description"]}
        for k, v in SCENARIO_CONFIGS.items()
    ]
