import sys
import json
import requests

# Default demo headline if none is provided via command line arguments
DEFAULT_SIGNAL = "CRITICAL escalation: Geopolitical tensions trigger a blockade in the Strait of Hormuz, threatening 40% of India's crude tankers. Spot Brent surges by 18%."

def test_pipeline():
    # Parse command line argument or use default
    raw_signal = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SIGNAL
    
    print("=" * 80)
    print("                      PETROSHIELD AI: 6-AGENT PIPELINE TESTER")
    print("=" * 80)
    print(f"Ingesting Custom Signal:\n'{raw_signal}'")
    print("-" * 80)
    print("Running simulation... (Sending request to local FastAPI backend on port 8000)")
    
    url = "http://localhost:8000/api/signals/simulate"
    payload = {
        "raw_signal": raw_signal,
        "source_type": "NEWS"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        if response.status_code != 200:
            print(f"[ERROR] Request failed with status code {response.status_code}")
            print(response.text)
            return
            
        data = response.json()
        print("[SUCCESS] Simulation completed successfully!\n")
        
        # 1. AGENT 1: Risk Intelligence
        risk = data.get("risk_signal")
        if risk:
            print("=" * 60)
            print("  AGENT 1: RISK INTELLIGENCE")
            print("=" * 60)
            print(f"Risk Signal ID : {risk.get('signal_id')}")
            print(f"Event Type     : {risk.get('event_type')}")
            print(f"Severity       : {risk.get('severity')}")
            print(f"Disruption Prob: {risk.get('disruption_probability')}% (CI: {risk.get('disruption_probability_ci')})")
            print(f"Est. Impact    : {risk.get('estimated_supply_impact_mbpd')} mbpd (CI: {risk.get('estimated_supply_impact_ci')})")
            print(f"Affected Areas : Countries={risk.get('affected_countries')}, Chokepoints={risk.get('affected_chokepoints')}")
            print(f"Recommendation : {risk.get('recommended_action')}")
            print("\nExplainability (Reasoning Chain):")
            for step in risk.get("explainability", {}).get("reasoning_chain", []):
                print(f"  {step}")
            print()
            
        # 2. AGENT 2: Scenario Modeller
        scenario_res = data.get("scenario_result")
        if scenario_res:
            print("=" * 60)
            print("  AGENT 2: DISRUPTION SCENARIO MODELLER")
            print("=" * 60)
            print(f"Key Insight    : {scenario_res.get('key_insight')}")
            print(f"Urgency        : {scenario_res.get('recommendation_urgency')}")
            print("-" * 60)
            
            for s in scenario_res.get("scenarios", []):
                print(f"Scenario Name  : {s.get('name')} (Probability: {int(s.get('probability')*100)}%)")
                print(f"  - Assumptions: {s.get('assumptions')}")
                print(f"  - Brent Price: Mean ${s.get('brent_price_mean')}/bbl (Range: ${s.get('brent_price_range')[0]} - ${s.get('brent_price_range')[1]})")
                print(f"  - Supply Loss: {s.get('supply_shortfall_mbpd')} mbpd")
                print(f"  - GDP Impact : {s.get('gdp_impact_pct')}% | Inflation Impact: {s.get('inflation_impact_pct')}%")
                print(f"  - India Cost : +${s.get('india_import_cost_increase_usd_bn')} Billion Import Bill")
                print(f"  - SPR Caverns: {s.get('spr_runway_days')} days runway left")
                print("  - Refinery run-rate drops:")
                for ref in s.get("refinery_impacts", []):
                    print(f"    * {ref.get('refinery_name')}: {ref.get('current_utilization_pct')}% -> {ref.get('projected_utilization_pct')}% (Drop: {ref.get('utilization_drop_pct')}% - Shutdown Risk: {ref.get('shutdown_risk')})")
                print(f"  - Pump Prices: Petrol +{s.get('fuel_price_impact', {}).get('petrol_increase_inr_per_litre')} INR/L, Diesel +{s.get('fuel_price_impact', {}).get('diesel_increase_inr_per_litre')} INR/L")
                print(f"  - Power Grid : Cost +{s.get('power_sector_impact', {}).get('electricity_cost_increase_pct')}% | Generation Loss: {s.get('power_sector_impact', {}).get('fuel_oil_generation_loss_mw')} MW")
                print("-" * 60)
            print()
            
        # 3. AGENT 3: Procurement Orchestrator
        plan = data.get("procurement_plan")
        if plan:
            print("=" * 60)
            print("  AGENT 3: PROCUREMENT ORCHESTRATOR")
            print("=" * 60)
            print(f"Plan Summary   : {plan.get('executive_summary')}")
            print(f"Cost Impact    : ${plan.get('total_cost_impact_usd_per_day'):,} per day")
            print(f"Risk Reduction : {plan.get('total_risk_reduction_pct')}%")
            print("\nRanked Sourcing Recommendations:")
            for rec in plan.get("recommendations", []):
                print(f"  Rank {rec.get('rank')}: [{rec.get('action')}] Sourced from {rec.get('to_supplier')}")
                print(f"    * Volume     : {rec.get('volume_mbpd')} mbpd of {rec.get('crude_grade')}")
                print(f"    * Price/Bbl  : ${rec.get('cost_per_barrel')} (Premium: ${rec.get('cost_premium_vs_current')}/bbl)")
                print(f"    * Transit    : {rec.get('transit_time_days')} days via {rec.get('route', {}).get('route_name')}")
                print(f"    * Ports check: Congestion level={rec.get('destination_port_congestion', {}).get('congestion_level')} at {rec.get('destination_port_congestion', {}).get('port_name')} (Wait: {rec.get('expected_port_wait_days')} days)")
                print(f"    * Tankers    : VLCC count available={rec.get('tanker_info', {}).get('available_count')} (Positioning: {rec.get('tanker_info', {}).get('estimated_positioning_days')} days)")
                print(f"    * Feasibility: {int(rec.get('feasibility_score')*100)}% | Risk Reduction: {rec.get('risk_reduction_pct')}%")
                print(f"    * Trade-offs : {rec.get('tradeoff_summary')}")
                print()
            print()
            
        # 4. AGENT 4: Strategic Petroleum Reserves Advisor
        spr = data.get("spr_advisory")
        if spr:
            print("=" * 60)
            print("  AGENT 4: STRATEGIC PETROLEUM RESERVES ADVISORY")
            print("=" * 60)
            print(f"Total Demand   : {spr.get('total_daily_demand_mbpd')} mbpd")
            print(f"Current Volume : {spr.get('current_spr_volume_million_bbl')} Million Barrels")
            print(f"Current Runway : {spr.get('current_runway_days')} days")
            print(f"Drawdown Strategy: {spr.get('drawdown_strategy')} (Optimized runway: {spr.get('optimized_runway_days')} days)")
            print(f"Urgency Level  : {spr.get('urgency')}")
            print("\nCavern Replenishment Plan:")
            rep = spr.get("replenishment_plan", {})
            print(f"  - Earliest start: {rep.get('earliest_replenishment_date')}")
            print(f"  - Buy Ceiling   : ${rep.get('recommended_buy_price_ceiling')}/bbl ({rep.get('optimal_buy_window')})")
            print(f"  - Refill Volume : {rep.get('replenishment_volume_mbpd')} mbpd over {rep.get('refill_duration_days')} days")
            print(f"  - Estimated Cost: ${rep.get('estimated_cost_usd_bn')} Billion")
            print(f"  - Restock Source: {rep.get('replenishment_source')}")
            print("\nPolicy Recommendations:")
            for rec in spr.get("policy_recommendations", []):
                print(f"  * {rec}")
            print()
            
        # 5. AGENT 5: Executive Briefing
        brief = data.get("executive_brief")
        if brief:
            print("=" * 60)
            print("  AGENT 5: EXECUTIVE BRIEFING (POLICY SUMMARY)")
            print("=" * 60)
            print(brief)
            print()
            
        # 6. AGENT 6: Gemini Executive Auditor
        audit = data.get("gemini_audit") or data.get("gemini_risk_validation")
        if audit:
            print("=" * 60)
            print("  AGENT 6: GEMINI EXECUTIVE AUDITOR REPORT")
            print("=" * 60)
            print(f"Auditor Decision: {audit.get('decision', 'VERIFIED')}")
            print(f"Risk Adjustment : {audit.get('adjusted_risk_score', 'None')}%")
            print(f"Validation Notes:\n{audit.get('validation_logic') or audit.get('reasoning')}")
            print("\nWarnings Flagged:")
            for w in audit.get("warnings_flagged", []) or audit.get("warnings", []):
                print(f"  [WARNING] {w}")
            print("\nSupporting / Contradictory Evidence:")
            for ev in audit.get("evidence_chain", []) or audit.get("supporting_evidence", []):
                print(f"  - {ev}")
            print()
            
    except requests.exceptions.ConnectionError:
        print("[ERROR] Could not connect to the backend server. Make sure FastAPI server is running on http://localhost:8000")
    except Exception as e:
        print(f"[ERROR] An unexpected error occurred: {e}")

if __name__ == "__main__":
    test_pipeline()
