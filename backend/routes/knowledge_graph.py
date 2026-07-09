from fastapi import APIRouter
from services.knowledge_graph import get_graph, graph_to_json

router = APIRouter()


@router.get("/knowledge-graph")
async def get_knowledge_graph():
    G = get_graph()
    return graph_to_json(G)
