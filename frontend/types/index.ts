// All TypeScript types for PetroShield AI

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
export type ScenarioCaseName = 'optimistic' | 'base' | 'severe'
export type NodeType =
  | 'supplier' | 'oil_field' | 'export_terminal' | 'shipping_route'
  | 'chokepoint' | 'import_port' | 'refinery' | 'distribution_depot'
  | 'demand_zone' | 'spr_facility' | 'crude_grade'

export interface GeoPoint { lat: number; lng: number }

export interface RiskSignal {
  id: string
  title: string
  description: string
  risk_level: RiskLevel
  risk_score: number
  affected_countries: string[]
  affected_chokepoints: string[]
  affected_suppliers: string[]
  source: string
  timestamp: string
  confidence: number
  evidence: string[]
  category: string
  tags: string[]
}

export interface ScenarioCase {
  case: ScenarioCaseName
  supply_shortfall_mbd: number
  brent_price_trajectory: number[]
  fuel_price_change_pct: number
  gdp_impact_pct: number
  inflation_impact_pct: number
  power_sector_stress: number
  refinery_utilization_pct: number
  spr_depletion_weeks: number
  affected_refineries: string[]
  probability: number
}

export interface ScenarioResult {
  id: string
  scenario_type: string
  trigger: string
  generated_at: string
  cases: ScenarioCase[]
  summary: string
  recommended_action: string
  confidence: number
  evidence: string[]
}

export interface Supplier {
  id: string
  name: string
  country: string
  region: string
  crude_grades: string[]
  current_share_pct: number
  reliability_score: number
  geopolitical_risk: number
  avg_transit_days: number
  price_premium_usd: number
  capacity_mbd: number
  active_routes: string[]
  location: GeoPoint
}

export interface RouteWaypoint { lat: number; lng: number; name?: string }

export interface Route {
  id: string
  name: string
  from_location: string
  to_location: string
  chokepoints: string[]
  waypoints: RouteWaypoint[]
  distance_nm: number
  avg_transit_days: number
  risk_score: number
  active_vessels: number
  is_active: boolean
}

export interface Refinery {
  id: string
  name: string
  location: string
  state: string
  capacity_mbpd: number
  current_utilization_pct: number
  crude_grades_compatible: string[]
  primary_supplier: string
  operator: string
  coordinates: GeoPoint
}

export interface Port {
  id: string
  name: string
  location: string
  state: string
  annual_capacity_mt: number
  current_throughput_mt: number
  berths: number
  max_vessel_dwt: number
  coordinates: GeoPoint
  congestion_level: number
}

export interface AISVessel {
  mmsi: string
  name: string
  vessel_type: string
  flag: string
  dwt: number
  current_position: GeoPoint
  speed_knots: number
  heading: number
  origin_port: string
  destination_port: string
  cargo: string
  eta?: string
  route_id?: string
}

export interface OilField {
  id: string
  name: string
  country: string
  operator: string
  production_mbd: number
  crude_grade: string
  coordinates: GeoPoint
  risk_score: number
}

export interface ProcurementOption {
  supplier_id: string
  supplier_name: string
  country: string
  volume_mbd: number
  price_usd_bbl: number
  transit_days: number
  reliability_score: number
  risk_reduction_pct: number
  crude_compatibility: number
  port_congestion: number
  tanker_availability: number
  composite_score: number
  rationale: string
  evidence: string[]
}

export interface ProcurementPlan {
  id: string
  generated_at: string
  scenario_id?: string
  horizon_weeks: number
  total_volume_needed_mbd: number
  recommendations: ProcurementOption[]
  cost_savings_usd_bbl: number
  risk_reduction_pct: number
  summary: string
  confidence: number
}

export interface SPRDrawdownSchedule {
  week: number
  drawdown_mbd: number
  remaining_days: number
}

export interface SPRAdvisory {
  id: string
  generated_at: string
  current_reserves_mb: number
  strategic_days_cover: number
  minimum_required_days: number
  status: 'safe' | 'warning' | 'critical'
  drawdown_schedule: SPRDrawdownSchedule[]
  replenishment_plan: string
  runway_days: number
  policy_recommendations: string[]
  confidence: number
}

export interface GraphNode {
  id: string
  label: string
  type: NodeType
  color: string
  risk_score?: number
  metadata: Record<string, unknown>
  coordinates?: GeoPoint
}

export interface GraphEdge {
  source: string
  target: string
  relationship: string
  weight: number
  metadata: Record<string, unknown>
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface KPICard {
  id: string
  label: string
  value: string
  unit: string
  change_pct?: number
  trend: 'up' | 'down' | 'stable'
  status: 'normal' | 'warning' | 'critical'
}

export interface DashboardSummary {
  energy_resilience_score: number
  overall_risk_score: number
  risk_level: RiskLevel
  brent_price_usd: number
  brent_change_pct: number
  active_imports_mbd: number
  active_vessels: number
  active_alerts: number
  spr_days_cover: number
  kpi_cards: KPICard[]
  top_risks: RiskSignal[]
  latest_recommendations: string[]
  executive_briefing?: string
  timestamp: string
}

export interface NewsItem {
  id: string
  headline: string
  summary: string
  source: string
  published_at: string
  risk_score: number
  affected_countries: string[]
  tags: string[]
  url?: string
}

export interface PricePoint {
  timestamp: string
  brent_usd: number
  wti_usd: number
  india_basket_usd: number
}

export interface PriceHistory {
  points: PricePoint[]
  current_brent: number
  change_24h_pct: number
  change_7d_pct: number
  volatility_index: number
}

export interface Chokepoint {
  id: string
  name: string
  lat: number
  lng: number
  type: string
  risk_score: number
  daily_flow_mbd: number
  description: string
  affected_routes: string[]
  threatened_by: string[]
}

export interface SPRFacility {
  id: string
  name: string
  capacity_mb: number
  fill_pct: number
  lat: number
  lng: number
}

export interface MapData {
  vessels: AISVessel[]
  routes: Route[]
  chokepoints: Chokepoint[]
  ports: Port[]
  refineries: Refinery[]
  oil_fields: OilField[]
  spr_facilities: SPRFacility[]
}
