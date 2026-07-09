from fastapi import APIRouter
from services.spr_engine import generate_spr_advisory

router = APIRouter()


@router.get("/spr")
async def get_spr_advisory(scenario_type: str = None, shortfall: float = 0.0):
    return generate_spr_advisory(scenario_type=scenario_type, supply_shortfall_mbd=shortfall)
