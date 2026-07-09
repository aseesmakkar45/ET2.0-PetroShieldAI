from fastapi import APIRouter
from services.procurement_engine import generate_procurement_plan

router = APIRouter()


@router.get("/procurement")
async def get_procurement(scenario_type: str = None, volume: float = 4.5):
    return generate_procurement_plan(scenario_type=scenario_type, total_volume_needed=volume)
