"""
Knowledge Graph Service – builds and queries India's crude oil supply chain
as a NetworkX graph. Nodes include suppliers, oil fields, terminals,
shipping routes, chokepoints, ports, refineries, depots, demand zones,
spr facilities, and tanker pools.
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
    
    # Load new entity datasets (Audit fix: wellhead to distribution + tanker + port congestion)
    depots = load_json("distribution_depots.json")
    demand_zones = load_json("demand_zones.json")
    tankers = load_json("tanker_pools.json")

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

    # Add port nodes (Includes congestion attributes)
    for p in ports:
        congestion_level = "LOW"
        wait_days = 1.0
        occupancy = 35.0
        if p["congestion_level"] > 50:
            congestion_level = "HIGH"
            wait_days = 3.0
            occupancy = 75.0
        elif p["congestion_level"] > 30:
            congestion_level = "MODERATE"
            wait_days = 1.5
            occupancy = 50.0
            
        G.add_node(p["id"], label=p["name"], type="import_port",
                   annual_capacity_mt=p["annual_capacity_mt"],
                   current_throughput_mt=p["current_throughput_mt"],
                   congestion_level=congestion_level,
                   avg_wait_days=wait_days,
                   berth_occupancy_pct=occupancy,
                   max_vessel_dwt=p["max_vessel_dwt"],
                   lat=p["coordinates"]["lat"], lng=p["coordinates"]["lng"])

    # Add refinery nodes
    for r in refineries:
        G.add_node(r["id"], label=r["name"], type="refinery",
                   capacity_mbpd=r["capacity_mbpd"] / 1000.0,  # Convert kbpd to mbpd
                   utilization=r["current_utilization_pct"],
                   min_economic_run_pct=70.0,  # Default threshold
                   processable_grades=r["crude_grades_compatible"],
                   lat=r["coordinates"]["lat"], lng=r["coordinates"]["lng"])

    # Add route nodes
    for route in routes:
        G.add_node(route["id"], label=route["name"], type="shipping_route",
                   risk_score=route["risk_score"],
                   transit_time_days=route.get("transit_days", 10),
                   waypoints=route.get("waypoints", []))

    # Add SPR facilities
    spr_facilities = [
        {"id": "spr_vizag", "name": "Visakhapatnam SPR", "capacity": 9.77, "lat": 17.68, "lng": 83.21},
        {"id": "spr_mangaluru", "name": "Mangaluru SPR", "capacity": 11.0, "lat": 12.91, "lng": 74.86},
        {"id": "spr_padur", "name": "Padur SPR", "capacity": 18.37, "lat": 12.97, "lng": 74.78}
    ]
    for spr in spr_facilities:
        G.add_node(spr["id"], label=spr["name"], type="spr_facility",
                   capacity_million_bbl=spr["capacity"],
                   lat=spr["lat"], lng=spr["lng"])

    # Add new depot nodes
    for d in depots:
        G.add_node(d["id"], label=d["name"], type="distribution_depot",
                   capacity_million_litres=d["capacity_million_litres"],
                   lat=d["coordinates"]["lat"], lng=d["coordinates"]["lng"])

    # Add new demand zone nodes
    for z in demand_zones:
        G.add_node(z["id"], label=z["name"], type="demand_zone",
                   daily_consumption_mbpd=z["daily_consumption_mbpd"],
                   population_millions=z["population_millions"])

    # Add new tanker pool nodes
    for t in tankers:
        G.add_node(t["id"], label=t["region"] + " Tanker Pool", type="tanker_pool",
                   available_vlcc=t["available_vlcc"],
                   available_suezmax=t["available_suezmax"],
                   available_aframax=t["available_aframax"],
                   avg_charter_rate_usd_day=t["avg_charter_rate_usd_day"],
                   estimated_positioning_days=t["estimated_positioning_days"])

    # ─── Historical Disruption Events (RAG Memory) ───────────────────────────
    # These nodes are the long-term memory of the intelligence system.
    # The RAG retrieves them to ground scenario assumptions in real precedents.
    historical_events = [
        {
            "id": "hist_1990_gulf_war",
            "name": "1990 Gulf War Oil Supply Disruption",
            "event_type": "MILITARY_CONFLICT",
            "year": 1990,
            "supply_loss_mbpd": 4.3,
            "duration_days": 180,
            "brent_spike_pct": 125,
            "chokepoints_affected": ["cp_hormuz"],
            "notes": "Iraqi invasion of Kuwait; Saudi, US SPR released. Brent nearly doubled."
        },
        {
            "id": "hist_1979_iran_revolution",
            "name": "1979 Iranian Revolution Supply Shock",
            "event_type": "MILITARY_CONFLICT",
            "year": 1979,
            "supply_loss_mbpd": 5.6,
            "duration_days": 365,
            "brent_spike_pct": 150,
            "chokepoints_affected": ["cp_hormuz"],
            "notes": "Iranian production halted; second oil crisis. Triggered IEA strategic reserves."
        },
        {
            "id": "hist_2019_abqaiq",
            "name": "2019 Abqaiq Drone Attacks",
            "event_type": "MILITARY_CONFLICT",
            "year": 2019,
            "supply_loss_mbpd": 5.7,
            "duration_days": 14,
            "brent_spike_pct": 15,
            "chokepoints_affected": ["cp_hormuz"],
            "notes": "Drone attack on Saudi Aramco Abqaiq facility; quickly restored. Short-lived spike."
        },
        {
            "id": "hist_2023_houthi_redsea",
            "name": "2023–2024 Houthi Red Sea Shipping Attacks",
            "event_type": "SHIPPING_DISRUPTION",
            "year": 2023,
            "supply_loss_mbpd": 1.2,
            "duration_days": 300,
            "brent_spike_pct": 8,
            "chokepoints_affected": ["cp_bab_el_mandeb", "cp_suez"],
            "notes": "Global shipping diverted around Cape of Good Hope. Freight rates +200%. 14 extra days transit."
        },
        {
            "id": "hist_2021_ever_given",
            "name": "2021 Ever Given Suez Canal Blockage",
            "event_type": "INFRASTRUCTURE_FAILURE",
            "year": 2021,
            "supply_loss_mbpd": 0.8,
            "duration_days": 6,
            "brent_spike_pct": 4,
            "chokepoints_affected": ["cp_suez"],
            "notes": "Container ship grounded in Suez; $9.6B/day trade impact. Cleared in 6 days."
        },
        {
            "id": "hist_2022_russia_sanctions",
            "name": "2022 Russia Sanctions Shock",
            "event_type": "SANCTIONS",
            "year": 2022,
            "supply_loss_mbpd": 2.0,
            "duration_days": 365,
            "brent_spike_pct": 40,
            "chokepoints_affected": [],
            "notes": "Western embargo on Russian oil post-Ukraine invasion. India absorbed discounted Urals."
        },
        {
            "id": "hist_2011_libya_civil_war",
            "name": "2011 Libya Civil War Supply Loss",
            "event_type": "MILITARY_CONFLICT",
            "year": 2011,
            "supply_loss_mbpd": 1.4,
            "duration_days": 270,
            "brent_spike_pct": 27,
            "chokepoints_affected": [],
            "notes": "Libyan production offline during Arab Spring; IEA released 60M barrels collectively."
        },
        {
            "id": "hist_2023_opec_cuts",
            "name": "2023 OPEC+ Voluntary Production Cuts",
            "event_type": "OPEC_DECISION",
            "year": 2023,
            "supply_loss_mbpd": 1.65,
            "duration_days": 365,
            "brent_spike_pct": 6,
            "chokepoints_affected": [],
            "notes": "Saudi Arabia, Russia extended cuts through end 2024. Brent supported above $80."
        },
        {
            "id": "hist_2012_iran_sanctions",
            "name": "2012 Iran Oil Sanctions",
            "event_type": "SANCTIONS",
            "year": 2012,
            "supply_loss_mbpd": 1.0,
            "duration_days": 730,
            "brent_spike_pct": 18,
            "chokepoints_affected": ["cp_hormuz"],
            "notes": "US/EU sanctions on Iranian oil; Iran threatened Hormuz closure multiple times."
        },
        {
            "id": "hist_2005_katrina",
            "name": "2005 Hurricane Katrina US Gulf Production Loss",
            "event_type": "WEATHER_EVENT",
            "year": 2005,
            "supply_loss_mbpd": 1.5,
            "duration_days": 60,
            "brent_spike_pct": 12,
            "chokepoints_affected": [],
            "notes": "Major hurricanes damaged US Gulf Coast infrastructure; IEA released 60M barrels."
        },
    ]
    for event in historical_events:
        G.add_node(
            event["id"],
            label=event["name"],
            type="historical_event",
            event_type=event["event_type"],
            year=event["year"],
            supply_loss_mbpd=event["supply_loss_mbpd"],
            duration_days=event["duration_days"],
            brent_spike_pct=event["brent_spike_pct"],
            chokepoints_affected=event["chokepoints_affected"],
            notes=event["notes"]
        )

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

    # New Downstream relationships (Refinery → distributes_to → Depot)
    for d in depots:
        for ref_id in d["connected_refineries"]:
            G.add_edge(ref_id, d["id"], relationship="Distributes To", weight=1.0)

    # Depot → serves → Demand Zone
    for z in demand_zones:
        for depot_id in z["depots"]:
            G.add_edge(depot_id, z["id"], relationship="Serves", weight=1.0)

    # Tanker Pool → serves → Route
    pool_route_map = {
        "pool_persian_gulf": ["route_hormuz_india"],
        "pool_west_africa": ["route_west_africa_india"],
        "pool_us_gulf": ["route_usa_india"],
        "pool_baltic_blacksea": ["route_russia_india_direct", "route_redsea_india"]
    }
    for pool_id, route_list in pool_route_map.items():
        for route_id in route_list:
            G.add_edge(pool_id, route_id, relationship="Serves Route", weight=1.0)

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
        "tanker_pool": "#a78bfa"
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
