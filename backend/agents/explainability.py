"""
Explainability Models and Helpers for PetroShield AI.
Shared across all agents to guarantee auditability and structured reasoning.
"""
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple, Optional


class EvidenceItem(BaseModel):
    source: str
    content: str
    timestamp: str


class HistoricalEvent(BaseModel):
    name: str
    date: str
    impact_summary: str
    similarity_score: float


class ExplainabilityBlock(BaseModel):
    reasoning_chain: List[str]
    evidence_used: List[str]
    supporting_news: List[str]
    supporting_policies: List[str]
    historical_similar_events: List[Dict[str, Any]]
    knowledge_graph_entities: List[str]
    confidence_score: float
    confidence_interval: Optional[Tuple[float, float]] = None
    alternative_interpretations: List[str]
    optimization_reasoning: Optional[str] = None
    expected_risk_reduction: Optional[float] = None
