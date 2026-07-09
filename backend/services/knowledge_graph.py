"""
Knowledge Graph Service – builds and queries India's crude oil supply chain
as a NetworkX graph. Nodes include suppliers, oil fields, terminals,
shipping routes, chokepoints, ports, refineries, and SPR facilities.
"""
import json
import networkx as nx
from pathlib import Path
from typing import Dict, List, Any, Optional

DATA_DIR = Path(__file__).parent.parent / "data"


def load_json(filename: str) -> Any:
    with open(DATA_DIR / filename) as f:
        return json.load(f)


def build_knowledge_graph() -> nx.DiGraph:
    """Build the supply chain knowledge graph."""
    G = nx.DiGraph()

    suppliers = load_json("suppliers.json")
    refineries = load_json("refineries.json")
    ports = load_json("ports.json")
    chokepoints = load_json("chokepoints.json")
    oil_fields = load_json("oil_fields.json")
    routes = load_json("routes.json")

    # Add supplier nodes
    for s in suppliers:
        G.add_node(s["id"], label=s["name"], type="supplier",
                   country=s["country"], risk_score=s["geopolitical_risk"],
                   lat=s["location"]["lat"], lng=s["location"]["lng"])

    # Add oil field nodes
    for f in oil_fields:
        G.add_node(f["id"], label=f["name"], type="oil_field",
                   country=f["country"], risk_score=f["risk_score"],
                   lat=f["coordinates"]["lat"], lng=f["coordinates"]["lng"])

    # Add chokepoint nodes
    for c in chokepoints:
        G.add_node(c["id"], label=c["name"], type="chokepoint",
                   risk_score=c["risk_score"],
                   lat=c["lat"], lng=c["lng"])

    # Add port nodes
    for p in ports:
        G.add_node(p["id"], label=p["name"], type="import_port",
                   congestion=p["congestion_level"],
                   lat=p["coordinates"]["lat"], lng=p["coordinates"]["lng"])

    # Add refinery nodes
    for r in refineries:
        G.add_node(r["id"], label=r["name"], type="refinery",
                   capacity=r["capacity_mbpd"], utilization=r["current_utilization_pct"],
                   lat=r["coordinates"]["lat"], lng=r["coordinates"]["lng"])

    # Add route nodes
    for route in routes:
        G.add_node(route["id"], label=route["name"], type="shipping_route",
                   risk_score=route["risk_score"])

    # Add SPR facilities
    spr_facilities = [
        {"id": "spr_vizag", "name": "Visakhapatnam SPR", "lat": 17.68, "lng": 83.21},
        {"id": "spr_mangaluru", "name": "Mangaluru SPR", "lat": 12.91, "lng": 74.86},
        {"id": "spr_padur", "name": "Padur SPR", "lat": 12.97, "lng": 74.78}
    ]
    for spr in spr_facilities:
        G.add_node(spr["id"], label=spr["name"], type="spr_facility",
                   lat=spr["lat"], lng=spr["lng"])

    # ─── Edges (relationships) ────────────────────────────────────────────────

    # Oil fields → Suppliers (Produces)
    field_supplier_map = {
        "field_ghawar": "sa_saudi",
        "field_rumaila": "sa_iraq",
        "field_west_qurna": "sa_iraq",
        "field_vankor": "sa_russia",
        "field_murban": "sa_uae",
        "field_zakum": "sa_uae",
        "field_bonny": "sa_nigeria",
        "field_permian": "sa_usa"
    }
    for field_id, supplier_id in field_supplier_map.items():
        G.add_edge(field_id, supplier_id, relationship="Produces", weight=1.0)

    # Suppliers → Routes (Ships To)
    supplier_route_map = {
        "sa_saudi": "route_hormuz_india",
        "sa_iraq": "route_hormuz_india",
        "sa_uae": "route_hormuz_india",
        "sa_kuwait": "route_hormuz_india",
        "sa_russia": "route_russia_india_direct",
        "sa_nigeria": "route_west_africa_india",
        "sa_angola": "route_west_africa_india",
        "sa_usa": "route_usa_india"
    }
    for supplier_id, route_id in supplier_route_map.items():
        G.add_edge(supplier_id, route_id, relationship="Ships To", weight=1.0)

    # Routes → Chokepoints (Passes Through)
    for route in routes:
        for cp_id in route["chokepoints"]:
            G.add_edge(route["id"], cp_id, relationship="Passes Through", weight=0.8)

    # Routes → Ports (Imports To)
    route_port_map = {
        "route_hormuz_india": ["port_vadinar", "port_mundra"],
        "route_redsea_india": ["port_mumbai", "port_kochi"],
        "route_russia_india_direct": ["port_vadinar", "port_paradip"],
        "route_west_africa_india": ["port_mumbai", "port_kochi"],
        "route_cape_india": ["port_kochi", "port_mumbai"],
        "route_usa_india": ["port_vizag", "port_paradip"]
    }
    for route_id, port_list in route_port_map.items():
        for port_id in port_list:
            G.add_edge(route_id, port_id, relationship="Imports To", weight=1.0)

    # Ports → Refineries (Feeds)
    port_refinery_map = {
        "port_vadinar": ["ref_jamnagar", "ref_vadinar"],
        "port_mundra": ["ref_jamnagar"],
        "port_mumbai": ["ref_kochi"],
        "port_kochi": ["ref_kochi", "ref_mangalore"],
        "port_paradip": ["ref_panipat", "ref_barauni"],
        "port_vizag": ["ref_vishaka"]
    }
    for port_id, ref_list in port_refinery_map.items():
        for ref_id in ref_list:
            G.add_edge(port_id, ref_id, relationship="Feeds", weight=1.0)

    # Refineries → SPR (Supports)
    G.add_edge("ref_vishaka", "spr_vizag", relationship="Supports", weight=0.5)
    G.add_edge("ref_mangalore", "spr_mangaluru", relationship="Supports", weight=0.5)
    G.add_edge("ref_mangalore", "spr_padur", relationship="Supports", weight=0.5)

    # Chokepoints threaten routes
    for route in routes:
        for cp_id in route["chokepoints"]:
            G.add_edge(cp_id, route["id"], relationship="Threatens", weight=0.9)

    return G


def graph_to_json(G: nx.DiGraph) -> Dict:
    """Convert NetworkX graph to JSON-serializable format."""
    TYPE_COLORS = {
        "supplier": "#f59e0b",
        "oil_field": "#10b981",
        "export_terminal": "#6366f1",
        "shipping_route": "#3b82f6",
        "chokepoint": "#ef4444",
        "import_port": "#8b5cf6",
        "refinery": "#06b6d4",
        "distribution_depot": "#84cc16",
        "demand_zone": "#ec4899",
        "spr_facility": "#f97316",
        "crude_grade": "#a78bfa"
    }

    nodes = []
    for node_id, attrs in G.nodes(data=True):
        node_type = attrs.get("type", "unknown")
        nodes.append({
            "id": node_id,
            "label": attrs.get("label", node_id),
            "type": node_type,
            "color": TYPE_COLORS.get(node_type, "#64748b"),
            "risk_score": attrs.get("risk_score"),
            "metadata": {k: v for k, v in attrs.items() if k not in ("label", "type", "risk_score")},
            "coordinates": {
                "lat": attrs.get("lat"),
                "lng": attrs.get("lng")
            } if attrs.get("lat") else None
        })

    edges = []
    for src, tgt, attrs in G.edges(data=True):
        edges.append({
            "source": src,
            "target": tgt,
            "relationship": attrs.get("relationship", "Connected"),
            "weight": attrs.get("weight", 1.0),
            "metadata": {k: v for k, v in attrs.items() if k not in ("relationship", "weight")}
        })

    return {"nodes": nodes, "edges": edges}


# Singleton graph instance
_graph: Optional[nx.DiGraph] = None


def get_graph() -> nx.DiGraph:
    global _graph
    if _graph is None:
        _graph = build_knowledge_graph()
    return _graph
