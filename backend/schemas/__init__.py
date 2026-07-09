from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class ScenarioType(str, Enum):
    HORMUZ_CLOSURE = "hormuz_closure"
    RED_SEA_ATTACK = "red_sea_attack"
    SANCTIONS = "sanctions"
    PORT_STRIKE = "port_strike"
    CYCLONE = "cyclone"
    PIPELINE_FAILURE = "pipeline_failure"


class ScenarioCaseName(str, Enum):
    OPTIMISTIC = "optimistic"
    BASE = "base"
    SEVERE = "severe"


class NodeType(str, Enum):
    SUPPLIER = "supplier"
    OIL_FIELD = "oil_field"
    EXPORT_TERMINAL = "export_terminal"
    SHIPPING_ROUTE = "shipping_route"
    CHOKEPOINT = "chokepoint"
    IMPORT_PORT = "import_port"
    REFINERY = "refinery"
    DISTRIBUTION_DEPOT = "distribution_depot"
    DEMAND_ZONE = "demand_zone"
    SPR_FACILITY = "spr_facility"
    CRUDE_GRADE = "crude_grade"


# ─── Geo ─────────────────────────────────────────────────────────────────────

class GeoPoint(BaseModel):
    lat: float
    lng: float


# ─── Risk Signal ──────────────────────────────────────────────────────────────

class RiskSignal(BaseModel):
    id: str
    title: str
    description: str
    risk_level: RiskLevel
    risk_score: float = Field(ge=0, le=100)
    affected_countries: List[str]
    affected_chokepoints: List[str]
    affected_suppliers: List[str]
    source: str
    timestamp: datetime
    confidence: float = Field(ge=0, le=1)
    evidence: List[str]
    category: str  # geopolitical | weather | sanctions | market | infrastructure
    tags: List[str] = []


# ─── Scenario ─────────────────────────────────────────────────────────────────

class ScenarioCase(BaseModel):
    case: ScenarioCaseName
    supply_shortfall_mbd: float          # million barrels per day
    brent_price_trajectory: List[float]  # 12-week forecast
    fuel_price_change_pct: float
    gdp_impact_pct: float
    inflation_impact_pct: float
    power_sector_stress: float           # 0-100
    refinery_utilization_pct: float
    spr_depletion_weeks: float
    affected_refineries: List[str]
    probability: float


class ScenarioResult(BaseModel):
    id: str
    scenario_type: ScenarioType
    trigger: str
    generated_at: datetime
    cases: List[ScenarioCase]            # optimistic, base, severe
    summary: str
    recommended_action: str
    confidence: float
    evidence: List[str]


# ─── Supplier ─────────────────────────────────────────────────────────────────

class Supplier(BaseModel):
    id: str
    name: str
    country: str
    region: str
    crude_grades: List[str]
    current_share_pct: float
    reliability_score: float             # 0-100
    geopolitical_risk: float             # 0-100
    avg_transit_days: int
    price_premium_usd: float             # vs Brent benchmark
    capacity_mbd: float
    active_routes: List[str]
    location: GeoPoint


# ─── Route ────────────────────────────────────────────────────────────────────

class RouteWaypoint(BaseModel):
    lat: float
    lng: float
    name: Optional[str] = None


class Route(BaseModel):
    id: str
    name: str
    from_location: str
    to_location: str
    chokepoints: List[str]
    waypoints: List[RouteWaypoint]
    distance_nm: int                     # nautical miles
    avg_transit_days: float
    risk_score: float
    active_vessels: int
    is_active: bool = True
    alternative_to: Optional[str] = None


# ─── Refinery ─────────────────────────────────────────────────────────────────

class Refinery(BaseModel):
    id: str
    name: str
    location: str
    state: str
    capacity_mbpd: float                 # thousand barrels per day
    current_utilization_pct: float
    crude_grades_compatible: List[str]
    primary_supplier: str
    operator: str
    coordinates: GeoPoint


# ─── Port ─────────────────────────────────────────────────────────────────────

class Port(BaseModel):
    id: str
    name: str
    location: str
    state: str
    annual_capacity_mt: float            # million tonnes
    current_throughput_mt: float
    berths: int
    max_vessel_dwt: int
    coordinates: GeoPoint
    congestion_level: float              # 0-100


# ─── AIS Vessel ───────────────────────────────────────────────────────────────

class AISVessel(BaseModel):
    mmsi: str
    name: str
    vessel_type: str
    flag: str
    dwt: int
    current_position: GeoPoint
    speed_knots: float
    heading: float
    origin_port: str
    destination_port: str
    cargo: str
    eta: Optional[str] = None
    route_id: Optional[str] = None


# ─── Oil Field ────────────────────────────────────────────────────────────────

class OilField(BaseModel):
    id: str
    name: str
    country: str
    operator: str
    production_mbd: float
    crude_grade: str
    coordinates: GeoPoint
    risk_score: float


# ─── Procurement Recommendation ───────────────────────────────────────────────

class ProcurementOption(BaseModel):
    supplier_id: str
    supplier_name: str
    country: str
    volume_mbd: float
    price_usd_bbl: float
    transit_days: int
    reliability_score: float
    risk_reduction_pct: float
    crude_compatibility: float
    port_congestion: float
    tanker_availability: float
    composite_score: float
    rationale: str
    evidence: List[str]


class ProcurementPlan(BaseModel):
    id: str
    generated_at: datetime
    scenario_id: Optional[str]
    horizon_weeks: int
    total_volume_needed_mbd: float
    recommendations: List[ProcurementOption]
    cost_savings_usd_bbl: float
    risk_reduction_pct: float
    summary: str
    confidence: float


# ─── SPR ──────────────────────────────────────────────────────────────────────

class SPRDrawdownSchedule(BaseModel):
    week: int
    drawdown_mbd: float
    remaining_days: float


class SPRAdvisory(BaseModel):
    id: str
    generated_at: datetime
    current_reserves_mb: float           # million barrels
    strategic_days_cover: float
    minimum_required_days: float
    status: str                          # safe | warning | critical
    drawdown_schedule: List[SPRDrawdownSchedule]
    replenishment_plan: str
    runway_days: float
    policy_recommendations: List[str]
    confidence: float


# ─── Knowledge Graph ──────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    label: str
    type: NodeType
    risk_score: Optional[float] = None
    metadata: Dict[str, Any] = {}
    coordinates: Optional[GeoPoint] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str   # Ships To, Produces, Imports, Processes, Feeds, Passes Through, Threatens, etc.
    weight: float = 1.0
    metadata: Dict[str, Any] = {}


class KnowledgeGraph(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# ─── Dashboard ────────────────────────────────────────────────────────────────

class KPICard(BaseModel):
    id: str
    label: str
    value: str
    unit: str
    change_pct: Optional[float] = None
    trend: str  # up | down | stable
    status: str  # normal | warning | critical


class DashboardSummary(BaseModel):
    energy_resilience_score: float
    overall_risk_score: float
    risk_level: RiskLevel
    brent_price_usd: float
    brent_change_pct: float
    active_imports_mbd: float
    active_vessels: int
    active_alerts: int
    spr_days_cover: float
    kpi_cards: List[KPICard]
    top_risks: List[RiskSignal]
    latest_recommendations: List[str]
    timestamp: datetime


# ─── News Item ────────────────────────────────────────────────────────────────

class NewsItem(BaseModel):
    id: str
    headline: str
    summary: str
    source: str
    published_at: datetime
    risk_score: float
    affected_countries: List[str]
    tags: List[str]
    url: Optional[str] = None


# ─── Price History ────────────────────────────────────────────────────────────

class PricePoint(BaseModel):
    timestamp: datetime
    brent_usd: float
    wti_usd: float
    india_basket_usd: float


class PriceHistory(BaseModel):
    points: List[PricePoint]
    current_brent: float
    change_24h_pct: float
    change_7d_pct: float
    volatility_index: float
