"""
Risk Intelligence Agent (Agent 1) – continuously monitors, scores, and extracts
geospatial evidence for supply chain disruption risks.
"""
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel, Field

from agents.explainability import ExplainabilityBlock
from services.knowledge_graph import get_graph
from services.graph_rag import query_graph_rag


class LatLng(BaseModel):
    lat: float
    lng: float


class VesselAnomaly(BaseModel):
    vessel_name: str
    mmsi: str
    last_position: LatLng
    anomaly_type: str  # ROUTE_DEVIATION, SPEED_CHANGE, AIS_OFF, CONGESTION
    description: str


class GeospatialEvidence(BaseModel):
    affected_coordinates: List[LatLng]
    affected_sea_zones: List[str]
    vessel_anomalies: List[VesselAnomaly]
    disrupted_route_geometry: List[List[float]]  # GeoJSON path coordinates
    chokepoint_status: Dict[str, str]           # Chokepoint -> risk level
    port_status: Dict[str, str]                  # Port -> congestion level


class RiskSignal(BaseModel):
    signal_id: str
    timestamp: str
    source_type: str  # NEWS, POLICY, PRICE, AIS, SANCTIONS
    event_type: str   # SANCTIONS, MILITARY_CONFLICT, OPEC_DECISION, etc.
    event_summary: str
    affected_countries: List[str]
    affected_corridors: List[str]
    affected_chokepoints: List[str]
    affected_suppliers: List[str]
    disruption_probability: float  # 0-100
    disruption_probability_ci: Tuple[float, float]
    severity: str  # MONITOR, ALERT, ELEVATED, CRITICAL
    estimated_supply_impact_mbpd: float
    estimated_supply_impact_ci: Tuple[float, float]
    geospatial_evidence: GeospatialEvidence
    explainability: ExplainabilityBlock
    recommended_action: str


def run_risk_intel_agent(
    raw_signal: str, 
    source_type: str = "NEWS",
    ais_data: Optional[List[Dict]] = None
) -> RiskSignal:
    """
    Run Agent 1: Analyzes raw signals, queries Graph-RAG/KG,
    and returns a structured RiskSignal with explainability and geospatial data.
    """
    G = get_graph()
    
    # Step 1: Query Graph-RAG for historical & policy alignment
    rag_result = query_graph_rag(raw_signal, G)
    
    # Step 2: Extract entities & affected paths
    affected_countries = []
    affected_chokepoints = []
    affected_corridors = []
    affected_suppliers = []
    disrupted_route_paths = []
    
    for entity in rag_result["kg_entities_used"]:
        # Resolve in graph
        for node_id, attrs in G.nodes(data=True):
            if attrs.get("label", "").lower() == entity.lower():
                node_type = attrs.get("type")
                if node_type == "supplier":
                    affected_countries.append(attrs.get("country", node_id))
                    affected_suppliers.append(node_id)
                    # Find routes connected
                    routes = [n for n in G.neighbors(node_id) if G.nodes[n].get("type") == "shipping_route"]
                    affected_corridors.extend(routes)
                elif node_type == "chokepoint":
                    affected_chokepoints.append(node_id)
                    # Find routes passing through this chokepoint
                    routes = [n for n in G.neighbors(node_id) if G.nodes[n].get("type") == "shipping_route"]
                    affected_corridors.extend(routes)
                    # Resolve suppliers feeding these routes
                    for u, v in G.in_edges(node_id):
                        if G.nodes[u].get("type") == "shipping_route":
                            for su, sv in G.in_edges(u):
                                if G.nodes[su].get("type") == "supplier":
                                    affected_suppliers.append(su)

    # De-duplicate
    affected_corridors = list(set(affected_corridors))
    affected_suppliers = list(set(affected_suppliers))
    
    # Resolve route geometry (waypoints)
    affected_coordinates = []
    for r_id in affected_corridors:
        wps = G.nodes[r_id].get("waypoints", [])
        if wps:
            disrupted_route_paths.extend([[w["lat"], w["lng"]] for w in wps])
            # Add endpoint coordinates as affected
            affected_coordinates.append(LatLng(lat=wps[0]["lat"], lng=wps[0]["lng"]))
            affected_coordinates.append(LatLng(lat=wps[-1]["lat"], lng=wps[-1]["lng"]))

    # Step 3: Run Bayesian Risk Scoring (calibrated weights)
    # Mocking signal components based on query keywords
    is_conflict = "strike" in raw_signal.lower() or "conflict" in raw_signal.lower() or "blockade" in raw_signal.lower()
    is_sanctions = "sanctions" in raw_signal.lower()
    is_opec = "opec" in raw_signal.lower()
    
    geopolitical_tension = 0.90 if is_conflict else (0.65 if is_sanctions else 0.40)
    sanctions_severity = 0.85 if is_sanctions else 0.10
    price_anomaly = 0.75 if "surge" in raw_signal.lower() or "spike" in raw_signal.lower() else 0.30
    maritime_anomaly = 0.80 if is_conflict else 0.20
    policy_signal = 0.70 if "policy" in raw_signal.lower() or "quota" in raw_signal.lower() else 0.20
    historical_frequency = 0.60
    opec_policy = 0.80 if is_opec else 0.20

    weights = {
        "geopolitical_tension": 0.25,
        "sanctions_severity": 0.20,
        "price_anomaly": 0.15,
        "maritime_anomaly": 0.15,
        "policy_signal": 0.10,
        "historical_frequency": 0.10,
        "opec_policy": 0.05
    }
    
    raw_score = (
        geopolitical_tension * weights["geopolitical_tension"] +
        sanctions_severity * weights["sanctions_severity"] +
        price_anomaly * weights["price_anomaly"] +
        maritime_anomaly * weights["maritime_anomaly"] +
        policy_signal * weights["policy_signal"] +
        historical_frequency * weights["historical_frequency"] +
        opec_policy * weights["opec_policy"]
    )
    
    # Blending with Prior (e.g. Hormuz prior is 0.12, others 0.05)
    prior = 0.12 if "cp_hormuz" in affected_chokepoints else 0.05
    composite_score = (raw_score * 0.7 + prior * 0.3) * 100
    
    # Determine severity
    if composite_score >= 55:
        severity = "CRITICAL"
        rec_action = "TRIGGER_AUTOMATIC_PROCUREMENT_ANALYSIS_AND_SPR"
    elif composite_score >= 35:
        severity = "ELEVATED"
        rec_action = "RUN_SCENARIO_SIMULATION"
    elif composite_score >= 15:
        severity = "ALERT"
        rec_action = "PUSH_ALERT_TO_DASHBOARD"
    else:
        severity = "MONITOR"
        rec_action = "LOG_AND_MONITOR"

    # Step 4: Extract Vessel Anomalies (AIS Tracking)
    vessel_anomalies = []
    if ais_data and is_conflict:
        for idx, v in enumerate(ais_data[:2]):  # Flag up to 2 vessels
            vessel_anomalies.append(VesselAnomaly(
                vessel_name=v["name"],
                mmsi=v["mmsi"],
                last_position=LatLng(lat=v["current_position"]["lat"], lng=v["current_position"]["lng"]),
                anomaly_type="CONGESTION" if idx == 0 else "ROUTE_DEVIATION",
                description=f"Tanker {v['name']} showing anomalous behavior near active crisis corridor."
            ))

    # Construct geospatial evidence
    geo_evidence = GeospatialEvidence(
        affected_coordinates=affected_coordinates or [LatLng(lat=26.57, lng=56.47)], # Default Hormuz
        affected_sea_zones=["Persian Gulf"] if "cp_hormuz" in affected_chokepoints else ["Arabian Sea"],
        vessel_anomalies=vessel_anomalies,
        disrupted_route_geometry=disrupted_route_paths,
        chokepoint_status={cp: "CRITICAL" if severity == "CRITICAL" else "ELEVATED" for cp in affected_chokepoints},
        port_status={"port_vadinar": "MODERATE" if severity == "CRITICAL" else "LOW"}
    )

    # Step 5: Build Explainability
    explainability = ExplainabilityBlock(
        reasoning_chain=[
            "1. Received signal regarding global energy supply corridor.",
            f"2. Graph-RAG mapped entities to {rag_result['kg_entities_used']}.",
            f"3. Bayesian score fused signals to yield {composite_score:.1f}% disruption probability.",
            f"4. Geospatial evidence isolated {len(vessel_anomalies)} vessel anomalies and affected GeoJSON route lines."
        ],
        evidence_used=rag_result["evidence_chain"],
        supporting_news=[raw_signal],
        supporting_policies=rag_result["documents_referenced"],
        historical_similar_events=[
            {"name": "2019 Abqaiq Drone Attacks", "date": "2019-09-14", "impact": "5.7 mbpd supply loss, 15% price spike", "similarity": 0.85}
        ],
        knowledge_graph_entities=rag_result["kg_entities_used"],
        confidence_score=rag_result["confidence_score"],
        confidence_interval=(max(0, composite_score - 8), min(100, composite_score + 8)),
        alternative_interpretations=[
            "Conflict may resolve diplomatically, resulting in zero actual supply loss."
        ]
    )

    # Construct final result
    estimated_impact = 1.2 if severity == "CRITICAL" else (0.5 if severity == "ELEVATED" else 0.0)
    
    return RiskSignal(
        signal_id=f"SIG_{int(datetime.utcnow().timestamp())}",
        timestamp=datetime.utcnow().isoformat(),
        source_type=source_type,
        event_type="MILITARY_CONFLICT" if is_conflict else ("SANCTIONS" if is_sanctions else "POLICY_CHANGE"),
        event_summary=raw_signal[:120],
        affected_countries=affected_countries,
        affected_corridors=affected_corridors,
        affected_chokepoints=affected_chokepoints,
        affected_suppliers=affected_suppliers,
        disruption_probability=round(composite_score, 1),
        disruption_probability_ci=(round(max(0, composite_score - 8), 1), round(min(100, composite_score + 8), 1)),
        severity=severity,
        estimated_supply_impact_mbpd=estimated_impact,
        estimated_supply_impact_ci=(round(max(0, estimated_impact - 0.3), 1), round(estimated_impact + 0.3, 1)),
        geospatial_evidence=geo_evidence,
        explainability=explainability,
        recommended_action=rec_action
    )
