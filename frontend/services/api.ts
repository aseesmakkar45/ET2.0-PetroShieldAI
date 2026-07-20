import axios from 'axios'
import type {
  DashboardSummary, RiskSignal, ScenarioResult, ProcurementPlan,
  SPRAdvisory, KnowledgeGraphData, MapData, PriceHistory, NewsItem
} from '@/types'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = (): Promise<DashboardSummary> =>
  api.get('/api/dashboard').then(r => r.data)

// ─── Risk Signals ──────────────────────────────────────────────────────────────
export const getSignals = (count = 10): Promise<RiskSignal[]> =>
  api.get('/api/signals', { params: { count } }).then(r => r.data)

// ─── Prices ───────────────────────────────────────────────────────────────────
export const getPriceHistory = (days = 90): Promise<PriceHistory> =>
  api.get('/api/prices', { params: { days } }).then(r => r.data)

// ─── News ─────────────────────────────────────────────────────────────────────
export const getNews = (): Promise<NewsItem[]> =>
  api.get('/api/news').then(r => r.data)

// ─── Scenarios ────────────────────────────────────────────────────────────────
export const getScenarios = (): Promise<ScenarioResult[]> =>
  api.get('/api/scenarios').then(r => r.data)

export const generateScenario = (scenario_type: string, current_brent = 82.5): Promise<ScenarioResult> =>
  api.post('/api/scenarios/generate', { scenario_type, current_brent }).then(r => r.data)

export const getScenarioTypes = () =>
  api.get('/api/scenarios/types/list').then(r => r.data)

// ─── Procurement ──────────────────────────────────────────────────────────────
export const getProcurement = (scenario_type?: string, volume = 4.5): Promise<ProcurementPlan> =>
  api.get('/api/procurement', { params: { scenario_type, volume } }).then(r => r.data)

// ─── SPR ──────────────────────────────────────────────────────────────────────
export const getSPR = (scenario_type?: string, shortfall = 0): Promise<SPRAdvisory> =>
  api.get('/api/spr', { params: { scenario_type, shortfall } }).then(r => r.data)

// ─── Knowledge Graph ──────────────────────────────────────────────────────────
export const getKnowledgeGraph = (): Promise<KnowledgeGraphData> =>
  api.get('/api/knowledge-graph').then(r => r.data)

// ─── Map ──────────────────────────────────────────────────────────────────────
export const getMapData = (): Promise<MapData> =>
  api.get('/api/map').then(r => r.data)
