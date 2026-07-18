"""
Quick pipeline validation test — runs the upgraded 6-agent pipeline
and verifies outputs are non-hardcoded and event-specific.
Usage: python test_pipeline.py "your signal text here"
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Load env
from dotenv import load_dotenv
load_dotenv()

def test_pipeline(signal: str):
    print(f"\n{'='*70}")
    print(f"TEST SIGNAL: {signal[:100]}")
    print(f"{'='*70}")

    # ── Agent 1: Event Understanding + Risk Intel ─────────────────────────────
    from services.event_intel import extract_event_intelligence
    from agents.risk_intel import run_risk_intel_agent
    from config import settings, get_gemini_api_key

    api_key = get_gemini_api_key() or ""
    intel = extract_event_intelligence(signal, api_key)
    print(f"\n[Milestone 2] EventIntelligence ({intel.extraction_method}):")
    print(f"  event_type             = {intel.event_type}")
    print(f"  conflict_level         = {intel.conflict_level}")
    print(f"  chokepoints            = {intel.chokepoints}")
    print(f"  suppliers              = {intel.suppliers}")
    print(f"  expected_duration_days = {intel.expected_duration_days}")
    print(f"  predicted_supply_loss  = {intel.predicted_supply_loss_mbpd} mbpd")
    print(f"  confidence             = {intel.confidence}")

    risk_signal = run_risk_intel_agent(signal, "NEWS", None)
    print(f"\n[Agent 1] RiskSignal:")
    print(f"  event_type              = {risk_signal.event_type}")
    print(f"  severity                = {risk_signal.severity}")
    print(f"  disruption_probability  = {risk_signal.disruption_probability}%")
    print(f"  affected_chokepoints    = {risk_signal.affected_chokepoints}")
    print(f"  affected_suppliers      = {risk_signal.affected_suppliers}")
    print(f"  supply_impact_mbpd      = {risk_signal.estimated_supply_impact_mbpd}")
    print(f"  reasoning[0]            = {risk_signal.explainability.reasoning_chain[0][:120]}")

    # ── Agent 2: Dynamic Scenario Modeller ───────────────────────────────────
    from agents.scenario_modeller import run_scenario_modeller_agent
    scenario_result = run_scenario_modeller_agent(risk_signal)
    print(f"\n[Agent 2] ScenarioResult:")
    for s in scenario_result.scenarios:
        print(f"  {s.name:12s}: P={s.probability:.0%}, dur={s.duration_days}d, "
              f"Brent p50=${s.brent_price_mean:.2f}, shortfall={s.supply_shortfall_mbpd:.2f} mbpd")
        print(f"    assumption[0] = {s.assumptions[0][:95]}")
    print(f"\n  key_insight = {scenario_result.key_insight[:160]}")

    # ── Agent 3: Procurement ─────────────────────────────────────────────────
    try:
        from agents.procurement import run_procurement_orchestrator_agent
        proc_result = run_procurement_orchestrator_agent(scenario_result)
        print(f"\n[Agent 3] Procurement — {len(proc_result.recommendations)} recommendations")
        for r in proc_result.recommendations[:2]:
            print(f"  Rank {r.rank}: {r.to_supplier:<30} score={r.optimization_score}")
        print(f"  from_supplier (dynamic) = {proc_result.recommendations[0].from_supplier if proc_result.recommendations else 'N/A'}")
    except Exception as e:
        print(f"\n[Agent 3] Procurement error: {e}")

    # ── Agent 4: SPR ─────────────────────────────────────────────────────────
    try:
        from agents.spr_advisor import run_spr_advisor_agent
        spr_result = run_spr_advisor_agent(scenario_result)
        print(f"\n[Agent 4] SPR Advisor:")
        rp = spr_result.replenishment_plan
        print(f"  replenishment_source = {rp.replenishment_source[:90]}")
        print(f"  buy_price_ceiling    = ${rp.recommended_buy_price_ceiling:.2f}")
        print(f"  refill_duration_days = {rp.refill_duration_days}")
    except Exception as e:
        print(f"\n[Agent 4] SPR error: {e}")

    # ── Agent 5 & 6 via Orchestrator Pipeline ──────────────────────────────────
    try:
        from agents.orchestrator import run_petroshield_pipeline
        print(f"\n[Orchestrator] Running full state machine...")
        state = run_petroshield_pipeline(signal, "NEWS")
        print(f"\n[Agent 5] Executive Briefing:")
        brief = getattr(state, "executive_brief", "") or ""
        print(f"  {brief[:220]}...")
        if getattr(state, "gemini_audit", None):
            print(f"\n[Agent 6] Gemini Audit Warnings:")
            for w in state.gemini_audit.get("audit_warnings", []):
                print(f"  - {w}")
            print(f"  First Narrative Step: {state.gemini_audit.get('narratives', [''])[0][:120]}...")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n[Orchestrator] Pipeline run error: {e}")

    print(f"\n{'='*70}")
    print("VERIFICATION CHECKS:")
    print(f"  EventIntelligence method = {intel.extraction_method}")
    probs = [s.probability for s in scenario_result.scenarios]
    is_fixed = probs[0] == 0.20 and probs[1] == 0.55 and probs[2] == 0.25
    print(f"  Probabilities = {[f'{p:.0%}' for p in probs]}  {'FAIL (still hardcoded!)' if is_fixed else 'PASS (dynamic)'}")
    durations = [s.duration_days for s in scenario_result.scenarios]
    is_fixed_dur = durations == [15, 45, 90]
    print(f"  Durations     = {durations} days  {'FAIL (still hardcoded!)' if is_fixed_dur else 'PASS (dynamic)'}")
    sups = risk_signal.affected_suppliers
    is_fixed_sup = sups == ["sa_iraq"]
    print(f"  Suppliers     = {sups}  {'FAIL (still sa_iraq only)' if is_fixed_sup else 'PASS (event-specific)'}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) == 1 and os.path.exists(args[0]):
        print(f"[test_pipeline] Input points to local file: {args[0]}. Reading content...")
        with open(args[0], "r", encoding="utf-8") as f:
            signal = f.read()
    else:
        signal = " ".join(args) if args else (
            "US military conducts airstrikes on Iranian nuclear facilities near the Strait of Hormuz. "
            "Iran threatens full closure. Saudi Arabia and Iraq halt tanker departures."
        )
    test_pipeline(signal)
