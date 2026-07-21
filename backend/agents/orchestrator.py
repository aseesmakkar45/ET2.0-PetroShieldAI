"""
Orchestration Engine – runs the 5-agent state machine, maintains
state checkpoints (memory), and records decision replay traces.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

from config import get_groq_api_key
from agents.risk_intel import run_risk_intel_agent, RiskSignal
from agents.scenario_modeller import run_scenario_modeller_agent, ScenarioResult
from agents.procurement import run_procurement_orchestrator_agent, ProcurementPlan
from agents.spr_advisor import run_spr_advisor_agent, SPRAdvisory
from agents.executive_briefing import run_executive_briefing_agent
from agents.groq_monitor import audit_and_brief_with_groq, audit_risk_prediction_with_groq


class DecisionStep(BaseModel := object):
    """Represents a single step in the Decision Replay trace."""
    def __init__(
        self,
        step_index: int,
        agent_name: str,
        timestamp: str,
        input_summary: str,
        reasoning: str,
        output_summary: str,
        duration_ms: int,
        kg_entities_accessed: List[str],
        confidence: float
    ):
        self.step_index = step_index
        self.agent_name = agent_name
        self.timestamp = timestamp
        self.input_summary = input_summary
        self.reasoning = reasoning
        self.output_summary = output_summary
        self.duration_ms = duration_ms
        self.kg_entities_accessed = kg_entities_accessed
        self.confidence = confidence

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_index": self.step_index,
            "agent_name": self.agent_name,
            "timestamp": self.timestamp,
            "input_summary": self.input_summary,
            "reasoning": self.reasoning,
            "output_summary": self.output_summary,
            "duration_ms": self.duration_ms,
            "kg_entities_accessed": self.kg_entities_accessed,
            "confidence": self.confidence
        }


class PetroShieldState:
    """The central state schema for the PetroShield agent network."""
    def __init__(self, raw_signal: str, source_type: str = "NEWS"):
        self.raw_signal: str = raw_signal
        self.source_type: str = source_type
        
        # Agent outputs
        self.risk_signal: Optional[RiskSignal] = None
        self.scenario_result: Optional[ScenarioResult] = None
        self.procurement_plan: Optional[ProcurementPlan] = None
        self.spr_advisory: Optional[SPRAdvisory] = None
        self.executive_brief: Optional[str] = None
        
        # Audit trails (Decision Replay)
        self.decision_trace: List[Dict[str, Any]] = []
        self.execution_log: List[str] = []
        
        # Gemini Auditor & Dynamic narrative data
        self.gemini_audit: Optional[Dict[str, Any]] = None
        self.gemini_risk_validation: Optional[Dict[str, Any]] = None
        
        # Cache memory
        self.timestamp: str = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "raw_signal": self.raw_signal,
            "source_type": self.source_type,
            "risk_signal": self.risk_signal.model_dump() if self.risk_signal else None,
            "scenario_result": self.scenario_result.model_dump() if self.scenario_result else None,
            "procurement_plan": self.procurement_plan.model_dump() if self.procurement_plan else None,
            "spr_advisory": self.spr_advisory.model_dump() if self.spr_advisory else None,
            "executive_brief": self.executive_brief,
            "decision_trace": self.decision_trace,
            "execution_log": self.execution_log,
            "groq_audit": self.groq_audit,
            "groq_risk_validation": self.groq_risk_validation
        }


# In-memory session checkpoint history (Memory Component)
_state_checkpointer: Dict[str, PetroShieldState] = {}


def get_state_history() -> List[Dict[str, Any]]:
    return [s.to_dict() for s in _state_checkpointer.values()]


def run_petroshield_pipeline(
    raw_signal: str, 
    source_type: str = "NEWS", 
    ais_data: Optional[List[Dict]] = None,
    fast_fallback: bool = False
) -> PetroShieldState:
    """
    Executes the 5-agent state machine and captures the decision replay trace.
    """
    state = PetroShieldState(raw_signal, source_type)
    state.execution_log.append(f"[{state.timestamp}] Initiated PetroShield state machine.")
    
    # ─── Node 1: Risk Intelligence Agent ──────────────────────────────────────
    start_time = datetime.utcnow()
    state.risk_signal = run_risk_intel_agent(raw_signal, source_type, ais_data, fast_fallback=fast_fallback)
    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    risk_step = DecisionStep(
        step_index=1,
        agent_name="Risk Intelligence Agent (Agent 1)",
        timestamp=start_time.isoformat(),
        input_summary=f"Raw text signal from {source_type}.",
        reasoning=f"Analyzed keywords and evaluated chokepoint/country exposure. Blended prior probabilities to compute composite score.",
        output_summary=f"Risk Score: {state.risk_signal.disruption_probability}%. Severity: {state.risk_signal.severity}.",
        duration_ms=duration,
        kg_entities_accessed=state.risk_signal.explainability.knowledge_graph_entities,
        confidence=state.risk_signal.explainability.confidence_score
    )
    state.decision_trace.append(risk_step.to_dict())
    state.execution_log.append(f"Node 1 finished in {duration}ms. Severity: {state.risk_signal.severity}.")

    # ─── Node 1.5: Groq Risk Prediction Auditor & Multi-Agent Validator ──────
    t0 = datetime.now()
    groq_key = get_groq_api_key()
    risk_audit_result = audit_risk_prediction_with_groq(state.risk_signal, raw_signal) if (groq_key and not fast_fallback) else None
    t1 = datetime.now()
    duration_groq_risk = int((t1 - t0).total_seconds() * 1000)
    
    if risk_audit_result:
        state.groq_risk_validation = risk_audit_result
        
        # Override with Groq's validated prediction
        state.risk_signal.disruption_probability = risk_audit_result.get("adjusted_risk_score", state.risk_signal.disruption_probability)
        state.risk_signal.severity = risk_audit_result.get("adjusted_severity", state.risk_signal.severity)
        state.risk_signal.estimated_supply_impact_mbpd = risk_audit_result.get("adjusted_supply_impact_mbpd", state.risk_signal.estimated_supply_impact_mbpd)
        
        audit_risk_step = DecisionStep(
            step_index=15,
            agent_name="Groq Risk Auditor (Agent 1.5)",
            timestamp=t0.isoformat(),
            input_summary="Initial subagent risk score and Graph-RAG context.",
            reasoning="Audited initial risk score, evaluated contradictory/supporting evidence, potential weaknesses, and validated final prediction.",
            output_summary=f"Decision: {risk_audit_result.get('validation_decision', 'UNKNOWN')}. Adjusted Risk: {risk_audit_result.get('adjusted_risk_score')}",
            duration_ms=duration_groq_risk,
            kg_entities_accessed=[],
            confidence=0.96
        )
        state.decision_trace.append(audit_risk_step.to_dict())
        state.execution_log.append(f"Node 1.5 (Groq Risk Audit) finished in {duration_groq_risk}ms. Validated severity: {state.risk_signal.severity}.")
    else:
        state.execution_log.append("Node 1.5 (Groq Risk Audit) skipped or failed. Running with initial subagent prediction.")

    # Conditional Routing: If Risk is below threshold, stop pipeline early (MONITOR / ALERT)
    if state.risk_signal.severity in ("MONITOR", "ALERT"):
        state.execution_log.append("Risk evaluated below threshold. Stopping pipeline early.")
        # Save to memory
        _state_checkpointer[state.risk_signal.signal_id] = state
        return state

    # ─── Node 2: Disruption Scenario Modeller ───────────────────────────────
    start_time = datetime.utcnow()
    state.scenario_result = run_scenario_modeller_agent(state.risk_signal)
    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    scenario_step = DecisionStep(
        step_index=2,
        agent_name="Scenario Modeller (Agent 2)",
        timestamp=start_time.isoformat(),
        input_summary=f"Risk Signal with estimated shortfall {state.risk_signal.estimated_supply_impact_mbpd} mbpd.",
        reasoning=f"Ran 5,000 Monte Carlo Geometric Brownian Motion paths to forecast Brent prices. Simulated indirect power grid stress and domestic pump price additions.",
        output_summary=f"Calculated 3 scenarios. Base case Brent: ${state.scenario_result.scenarios[1].brent_price_mean}/bbl.",
        duration_ms=duration,
        kg_entities_accessed=state.risk_signal.explainability.knowledge_graph_entities,
        confidence=0.91
    )
    state.decision_trace.append(scenario_step.to_dict())
    state.execution_log.append(f"Node 2 finished in {duration}ms.")

    # ─── Node 3: Adaptive Procurement Orchestrator ─────────────────────────
    start_time = datetime.utcnow()
    state.procurement_plan = run_procurement_orchestrator_agent(state.scenario_result)
    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    procurement_step = DecisionStep(
        step_index=3,
        agent_name="Procurement Orchestrator (Agent 3)",
        timestamp=start_time.isoformat(),
        input_summary=f"Scenario price distribution and refinery feedstock drops.",
        reasoning=f"Queried Knowledge Graph for alternative suppliers. Modeled port waiting times and tanker pools. Solved multi-objective linear program.",
        output_summary=f"Generated {len(state.procurement_plan.recommendations)} ranked rerouting options. Cost impact: ${state.procurement_plan.total_cost_impact_usd_per_day/1000000:.1f}M/day.",
        duration_ms=duration,
        kg_entities_accessed=state.procurement_plan.explainability.knowledge_graph_entities,
        confidence=state.procurement_plan.explainability.confidence_score
    )
    state.decision_trace.append(procurement_step.to_dict())
    state.execution_log.append(f"Node 3 finished in {duration}ms.")

    # ─── Node 4: Strategic Petroleum Reserve Advisor ──────────────────────────
    start_time = datetime.utcnow()
    state.spr_advisory = run_spr_advisor_agent(state.scenario_result)
    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    spr_step = DecisionStep(
        step_index=4,
        agent_name="SPR Advisor (Agent 4)",
        timestamp=start_time.isoformat(),
        input_summary=f"Base case price trajectory and supply shortfall.",
        reasoning=f"Modeled seasonal refinery demand curves. Scheduled optimal drawdown volume. Estimated post-crisis replenishment timeline and budget.",
        output_summary=f"Current SPR runway: {state.spr_advisory.current_runway_days} days. Refill cost: ${state.spr_advisory.replenishment_plan.estimated_cost_usd_bn}B.",
        duration_ms=duration,
        kg_entities_accessed=state.spr_advisory.explainability.knowledge_graph_entities,
        confidence=state.spr_advisory.explainability.confidence_score
    )
    state.decision_trace.append(spr_step.to_dict())
    state.execution_log.append(f"Node 4 finished in {duration}ms.")

    # ─── Node 5: Executive Briefing Agent ─────────────────────────────────────
    start_time = datetime.utcnow()
    state.executive_brief = run_executive_briefing_agent(
        state.risk_signal,
        state.scenario_result,
        state.procurement_plan,
        state.spr_advisory
    )
    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    brief_step = DecisionStep(
        step_index=5,
        agent_name="Executive Briefing Agent (Agent 5)",
        timestamp=start_time.isoformat(),
        input_summary=f"All agent quantitative outputs.",
        reasoning=f"Compiled plain-language paragraphs highlighting critical statistics and rerouting commands.",
        output_summary=f"Brief generated ({len(state.executive_brief)} chars).",
        duration_ms=duration,
        kg_entities_accessed=[],
        confidence=0.95
    )
    state.decision_trace.append(brief_step.to_dict())
    state.execution_log.append(f"Node 5 finished in {duration}ms.")

    # ─── Node 6: Groq Executive Auditor & Dynamic Monitor ──────────────────
    t0 = datetime.now()
    groq_data = audit_and_brief_with_groq(state) if (groq_key and not fast_fallback) else None
    t1 = datetime.now()
    duration_groq = int((t1 - t0).total_seconds() * 1000)
    
    if groq_data:
        state.executive_brief = groq_data.get("executive_briefing") or state.executive_brief
        state.groq_audit = groq_data
        
        # Log warnings
        warnings = groq_data.get("audit_warnings") or []
        for warn in warnings:
            state.execution_log.append(f"[AUDIT WARNING] {warn}")
            print(f"[AGENT 6 - GroqAuditor] [WARN] {warn}")
            
        audit_step = DecisionStep(
            step_index=6,
            agent_name="Groq Executive Auditor (Agent 6)",
            timestamp=t0.isoformat(),
            input_summary="Outputs of agents 1-4 and raw threat signal.",
            reasoning="Audited local calculations for consistency and generated dynamic contextual briefs.",
            output_summary=f"Dynamic briefing generated. Found {len(warnings)} audit warning flags.",
            duration_ms=duration_groq,
            kg_entities_accessed=[],
            confidence=0.98
        )
        state.decision_trace.append(audit_step.to_dict())
        state.execution_log.append(f"Node 6 (Groq) finished in {duration_groq}ms. State machine completed.")
    else:
        state.execution_log.append("Node 6 (Groq) skipped or failed. Using fallback template briefing. State machine completed.")

    # Save to session history memory
    _state_checkpointer[state.risk_signal.signal_id] = state
    
    global _active_state
    _active_state = state
    
    return state


# Active pipeline state (representing the National Energy Command Center state)
_active_state: Optional[PetroShieldState] = None


def get_active_state() -> Optional[PetroShieldState]:
    global _active_state
    return _active_state


def set_active_state(state: PetroShieldState):
    global _active_state
    _active_state = state

