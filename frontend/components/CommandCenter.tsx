'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { 
  Activity, ShieldAlert, Sliders, Settings, CheckCircle, HelpCircle, 
  BookOpen, Terminal, ChevronRight, Copy, Check, Play, RefreshCw,
  TrendingUp, Truck, Compass, Server, Info, Shield, Layers, Cpu, Globe,
  BarChart2, AlertTriangle, Link, Zap, Share2, ShoppingCart, Database
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'
import { getDashboard, getMapData, getMaritimeWeather, api, API_BASE_URL } from '@/services/api'

// Dynamically import Leaflet Map to avoid SSR errors
const GlobalMap = dynamic(() => import('@/components/map/GlobalMap'), { ssr: false })
import NationalEnergyTwin from './NationalEnergyTwin'

export default function CommandCenter({ view }: { view?: string }) {
  const queryClient = useQueryClient()
  const [currentHash, setCurrentHash] = useState('')
  const [reportFilter, setReportFilter] = useState('ALL')
  const [selectedReportType, setSelectedReportType] = useState('Weekly Supply Chain Risk Assessment')
  const [selectedTimeRange, setSelectedTimeRange] = useState('Last 7 Days')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<any>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [simulationPrompt, setSimulationPrompt] = useState(
    "CRITICAL conflict, OPEC quota anxiety, and sanctions blockade: Iran blockades the Strait of Hormuz, shutting down 100% of tanker transits. Brent crude spikes by +$24/bbl."
  )
  const [selectedScenarioType, setSelectedScenarioType] = useState('hormuz')
  const [copied, setCopied] = useState(false)
  const [decisionActionStatus, setDecisionActionStatus] = useState<Record<string, string>>({})

  // Sliders state (Scenario Modeling)
  const [shortfallSlider, setShortfallSlider] = useState(1.2)
  const [opecSlider, setOpecSlider] = useState(1.65)
  const [volatilitySlider, setVolatilitySlider] = useState(30)

  const [toastAlerts, setToastAlerts] = useState<any[]>([])

  // Digital Twin interactive state
  const [selectedTwinNode, setSelectedTwinNode] = useState<string | null>(null)
  const [disruptedTwinNodes, setDisruptedTwinNodes] = useState<Set<string>>(new Set(['hormuz']))

  // Map Layer visibility state
  const [mapLayers, setMapLayers] = useState<Record<string, boolean>>({
    routes: true,
    ports: true,
    incidents: true,
    chokepoints: true,
    suppliers: true,
    storage: true,
    weather: false
  })

  const toggleMapLayer = (id: string) => setMapLayers(prev => ({ ...prev, [id]: !prev[id] }))

  // Real-time AIS stream state variables
  const [aisKeyInput, setAisKeyInput] = useState('')
  const [hasRealAisKey, setHasRealAisKey] = useState(false)
  const [aisSaveStatus, setAisSaveStatus] = useState('')

  // Live system logs state
  const [systemLogs, setSystemLogs] = useState<string[]>([])
  const terminalEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wsProto = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
    const cleanHost = API_BASE_URL.replace(/^https?:\/\//, '')
    const wsUrl = `${wsProto}://${cleanHost}/ws/logs`
    const ws = new WebSocket(wsUrl)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'log_line') {
          setSystemLogs(prev => {
            const updated = [...prev, data.message]
            return updated.slice(-150)
          })
        }
      } catch (err) {
        console.error('Error parsing WS log:', err)
      }
    }
    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [systemLogs])

  useEffect(() => {
    // Fetch initial AIS key status
    api.get('/api/settings/ais')
      .then(res => {
        if (res.data.has_key) {
          setHasRealAisKey(true)
          setAisKeyInput(res.data.masked_key)
        }
      })
      .catch(err => console.error("Error loading settings:", err))
  }, [])

  const saveAisKey = () => {
    setAisSaveStatus('Saving...')
    api.post('/api/settings/ais', { api_key: aisKeyInput })
      .then(res => {
        setAisSaveStatus('Saved!')
        setHasRealAisKey(!!aisKeyInput)
        queryClient.invalidateQueries({ queryKey: ['map'] })
        setTimeout(() => setAisSaveStatus(''), 2000)
      })
      .catch(err => {
        setAisSaveStatus('Error saving key')
        setTimeout(() => setAisSaveStatus(''), 2000)
      })
  }

  useEffect(() => {
    // Listen to hash change
    const syncHash = () => {
      setCurrentHash(window.location.hash || '')
    }
    window.addEventListener('hashchange', syncHash)
    syncHash()
    
    // Setup WS toast alerts
    const cleanHost = API_BASE_URL.replace(/^https?:\/\//, '')
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${wsProto}://${cleanHost}/ws/alerts`
    const ws = new WebSocket(wsUrl)
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setToastAlerts(prev => [data, ...prev].slice(0, 3))
      } catch (err) {
        console.error("Error parsing websocket alert:", err)
      }
    }
    
    return () => {
      window.removeEventListener('hashchange', syncHash)
      ws.close()
    }
  }, [])

  // 1. Fetch dashboard state
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 5000,
  })

  // 2. Fetch Map coordinates
  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['map'],
    queryFn: getMapData,
    refetchInterval: 5000,
  })

  // 2b. Fetch maritime weather (live, 1hr cache on backend)
  const { data: weatherData } = useQuery({
    queryKey: ['maritime-weather'],
    queryFn: getMaritimeWeather,
    refetchInterval: 60 * 60 * 1000, // Re-fetch every hour (matches backend cache)
    staleTime: 55 * 60 * 1000,
  })

  // 3. Fetch decision replay trace
  const { data: replayData } = useQuery({
    queryKey: ['decision-replay'],
    queryFn: () => api.get('/api/decision-replay').then(r => r.data),
    refetchInterval: 5000,
  })

  // 4. Fetch persistent database scenario history
  const { data: reportHistory = [] } = useQuery({
    queryKey: ['reports-history'],
    queryFn: () => api.get('/api/reports/history').then(r => r.data),
    refetchInterval: 5000,
  })

  // 4. Mutation to trigger pipeline simulation
  const simulateMutation = useMutation({
    mutationFn: (payload: { raw_signal: string; source_type: string }) => 
      api.post('/api/signals/simulate', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['map'] })
      queryClient.invalidateQueries({ queryKey: ['decision-replay'] })
    }
  })

  // 5. Mutation to trigger manual slider recalculation
  const whatIfMutation = useMutation({
    mutationFn: (payload: { scenario_type: string; current_brent: number }) =>
      api.post('/api/scenarios/generate', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['map'] })
      queryClient.invalidateQueries({ queryKey: ['decision-replay'] })
    }
  })

  // Trigger default simulation run
  const triggerSimulation = (promptText = simulationPrompt) => {
    simulateMutation.mutate({
      raw_signal: promptText,
      source_type: "NEWS"
    })
  }

  const triggerWhatIf = (type: string) => {
    setSelectedScenarioType(type)
    whatIfMutation.mutate({
      scenario_type: type,
      current_brent: 82.5 + (type === 'hormuz' ? 10.0 : (type === 'redsea' ? 5.0 : -3.0))
    })
  }

  // Handle human-in-the-loop action
  const handleProcurementAction = (planId: string, action: string) => {
    setDecisionActionStatus(prev => ({ ...prev, [planId]: action }))
    api.post(`/api/recommendations/${planId}/action`, { action, notes: "Approved by National Energy Command Center Board." })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['decision-replay'] })
      })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Parse Monte Carlo GBM data for the charts
  const getGbmChartData = () => {
    if (!dashboard?.top_risks?.[0]) return []
    const base = dashboard.brent_price_usd;
    const dataPoints = [];
    for (let day = 1; day <= 45; day++) {
      const noise = Math.sin(day/5) * 2;
      dataPoints.push({
        day: `Day ${day}`,
        "Optimistic": parseFloat((base - day * 0.15 + noise).toFixed(2)),
        "Base Case": parseFloat((base + day * 0.2 + noise * 1.5).toFixed(2)),
        "Severe Case": parseFloat((base + day * 0.45 + noise * 2.2).toFixed(2))
      })
    }
    return dataPoints;
  }

  const chartData = getGbmChartData()

  // ────────────── HOISTED SUB-VIEW  // 1. DASHBOARD (OVERVIEW) GRID RENDERER (Replicates the mockup prototype layout)
  function renderOverview() {
    const overallRisk = dashboard?.overall_risk_score ?? 59
    const riskColor = overallRisk > 50 ? 'var(--color-risk-critical)' : (overallRisk > 25 ? 'var(--color-risk-moderate)' : 'var(--color-risk-low)')
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPI Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {/* Brent Price Card */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>BRENT CRUDE OIL</span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                ${(dashboard?.brent_price_usd ?? 82.49).toFixed(2)}
              </span>
              <span style={{ fontSize: 9.5, color: '#10b981', fontWeight: 600 }}>▲ +2.4% (24h trend)</span>
            </div>
            <TrendingUp size={24} color="#10b981" />
          </div>

          {/* Overall Risk Card */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>OVERALL CORRIDOR RISK</span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: riskColor }}>
                {overallRisk}%
              </span>
              <span style={{ fontSize: 9.5, color: riskColor, fontWeight: 600 }}>Level: {dashboard?.risk_level || 'MONITOR'}</span>
            </div>
            <ShieldAlert size={24} color={riskColor} />
          </div>

          {/* Strategic Reserves Card */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>STRATEGIC RESERVES BUFFER</span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-amber)' }}>
                34 Days cover
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Padur & Mangaluru active</span>
            </div>
            <Activity size={24} color="var(--color-amber)" />
          </div>

          {/* Alternative Suppliers Card */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>OPTIMIZATION POOL</span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>
                14 VLCC pool
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Baltic Urals Rank 1 reroute</span>
            </div>
            <Settings size={24} color="#3b82f6" />
          </div>
        </div>

        {/* Main Grid Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Left Column (Graphs + AI Agent Console) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {renderSourcingCountriesChart()}
              {renderPortThroughputChart()}
            </div>
            {renderAIAgentConsoleCard()}
            {renderLiveTerminalLogsCard()}
          </div>

          {/* Right Column (Briefing + Alerts) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {renderBriefingCard(false)}
            {renderLiveAlertsRecommendationsCard()}
          </div>
        </div>
      </div>
    )
  }

  // India's Crude Oil Sourcing by Country (Pie Chart)
  function renderSourcingCountriesChart() {
    const data = [
      { name: 'Russia', value: 37.5, color: '#3b82f6' },
      { name: 'Iraq', value: 22.1, color: '#f59e0b' },
      { name: 'Saudi Arabia', value: 18.2, color: '#10b981' },
      { name: 'UAE', value: 6.4, color: '#8b5cf6' },
      { name: 'Kuwait', value: 3.2, color: '#ec4899' },
      { name: 'Nigeria', value: 5.1, color: '#f97316' },
      { name: 'USA', value: 4.5, color: '#64748b' }
    ]

    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={16} color="var(--color-blue-500)" />
          <span className="section-title" style={{ fontSize: 11 }}>India's Crude Sourcing by Country (Volume % Share)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ height: 230, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} contentStyle={{ background: '#0d1421', border: '1px solid var(--color-border)', fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 230, overflowY: 'auto', paddingRight: 4 }}>
            {data.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
                </div>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Indian Port Crude Imports Throughput and Capacity (Bar Chart)
  function renderPortThroughputChart() {
    const data = [
      { name: 'Mundra', Actual: 95, Capacity: 120 },
      { name: 'Vadinar', Actual: 82, Capacity: 100 },
      { name: 'Mumbai', Actual: 48, Capacity: 62 },
      { name: 'Paradip', Actual: 38, Capacity: 45 },
      { name: 'Visakhapatnam', Actual: 22, Capacity: 30 },
      { name: 'Kochi', Actual: 18, Capacity: 22 }
    ]

    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={16} color="var(--color-blue-500)" />
          <span className="section-title" style={{ fontSize: 11 }}>Indian Port Crude Imports & Capacity (Million Tonnes/Year)</span>
        </div>

        <div style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#475569" style={{ fontSize: 9 }} />
              <YAxis stroke="#475569" style={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid var(--color-border)', fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: 9, marginTop: 4 }} />
              <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual Throughput" />
              <Bar dataKey="Capacity" fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" strokeWidth={1} radius={[4, 4, 0, 0]} name="Design Capacity" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // ────────────── SHARED PROTOTYPE PANEL RENDERER ──────────────
  function renderPrototypePanel(num: number, name: string, content: React.ReactNode) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: 8 }}>
        {/* Banner header */}
        <div style={{
          background: '#1d4ed8',
          color: '#ffffff',
          fontSize: 9.5,
          fontWeight: 800,
          padding: '6px 12px',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ opacity: 0.8 }}>{num}.</span>
          <span>{name}</span>
        </div>
        
        {/* Card Body */}
        <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-bg-card)' }}>
          {content}
        </div>
      </div>
    )
  }

  // ────────────── PANEL CONTENT RENDERERS ──────────────

  // Content 1: Dashboard Overview Content
  function renderPanelOverviewContent() {
    const brent = dashboard?.brent_price_usd ?? 82.49
    const overallRisk = dashboard?.overall_risk_score ?? 72
    const riskLevel = dashboard?.risk_level ?? 'High Risk'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* KPIs row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {[
            { label: 'Overall Risk', val: `${overallRisk}`, sub: riskLevel, color: 'var(--color-risk-critical)' },
            { label: 'Disruption Prob.', val: '68%', sub: 'High', color: 'var(--color-risk-high)' },
            { label: 'Supply Gap (90d)', val: '18.6%', sub: 'Medium', color: 'var(--color-risk-moderate)' },
            { label: 'Avg. Response', val: '4.2d', sub: 'Good', color: 'var(--color-risk-low)' },
            { label: 'Resilience Score', val: '63/100', sub: 'Medium', color: 'var(--color-risk-moderate)' }
          ].map((k, i) => (
            <div key={i} style={{ padding: '6px 8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 7.5, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k.color, margin: '2px 0' }}>{k.val}</div>
              <div style={{ fontSize: 8, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Heatmap & Risk drivers row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
          {/* Heatmap mini placeholder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Risk Heatmap (Global)</span>
            <div style={{ flex: 1, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, position: 'relative', overflow: 'hidden' }}>
              <div style={{ opacity: 0.15, transform: 'scale(1.1)' }}>
                <Globe size={70} color="#1d4ed8" />
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Indian Ocean Corridor</span>
                <span style={{ fontSize: 8, color: '#dc2626', fontWeight: 600 }}>Active Threat Zone (Red Sea)</span>
              </div>
            </div>
          </div>

          {/* Risk Drivers list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Top Risk Drivers</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 8.5 }}>
              {[
                { name: 'Geopolitical Instability', val: 90, color: 'var(--color-risk-critical)' },
                { name: 'Shipping Disruptions', val: 75, color: 'var(--color-risk-high)' },
                { name: 'Commodity Volatility', val: 55, color: 'var(--color-risk-moderate)' }
              ].map((dr, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-primary)', fontSize: 8 }}>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%' }}>{dr.name}</span>
                    <span style={{ fontWeight: 700 }}>{dr.val}%</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'var(--color-bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${dr.val}%`, height: '100%', background: dr.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Supply exposure & Recent alerts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10, fontSize: 8.5 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Supply Exposure</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1d4ed8', borderRightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 8.5 }}>41%</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 8.5 }}>Crude Oil</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 7.5 }}>Primary exposure</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Recent Alerts</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 6, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-primary)' }}>
                <span>• Red Sea escalation</span>
                <span style={{ color: 'var(--color-text-muted)' }}>10 May</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-primary)' }}>
                <span>• Russian fleet sanctions</span>
                <span style={{ color: 'var(--color-text-muted)' }}>09 May</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Content 2: Risk Intelligence Content
  function renderPanelRiskIntelligenceContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 8.5 }}>
        {/* Geo-risk badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {[
            { label: 'Geopolitical', val: 'High', count: 12, color: 'var(--color-risk-critical)' },
            { label: 'Logistics', val: 'High', count: 8, color: 'var(--color-risk-high)' },
            { label: 'Market', val: 'Medium', count: 7, color: 'var(--color-risk-moderate)' },
            { label: 'Environ.', val: 'Low', count: 3, color: 'var(--color-risk-low)' },
            { label: 'Regul.', val: 'Medium', count: 5, color: 'var(--color-risk-moderate)' }
          ].map((cat, i) => (
            <div key={i} style={{ padding: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{cat.label}</div>
              <div style={{ fontWeight: 800, color: cat.color, margin: '2px 0' }}>{cat.val}</div>
              <div style={{ fontSize: 7, color: 'var(--color-text-secondary)' }}>{cat.count} Alerts</div>
            </div>
          ))}
        </div>

        {/* Signal Feed Mini Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Risk Signal Feed</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 6 }}>
            {[
              { desc: 'US sanctions on Russian shadow fleet expanded', type: 'Geopolitical', date: '10 May 2026' },
              { desc: 'Houthi attacks on commercial vessels in Red Sea', type: 'Geopolitical', date: '10 May 2026' },
              { desc: 'Strait of Hormuz – Increased military activity', type: 'Geopolitical', date: '09 May 2026' }
            ].map((feed, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < 2 ? '1px solid var(--color-border)' : 'none', paddingBottom: idx < 2 ? 4 : 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 8 }}>{feed.desc}</span>
                <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 8 }}>{feed.type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Commodities horizontal bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Top Affected Commodities</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            {[
              { name: 'Crude Oil', val: 85, color: '#dc2626' },
              { name: 'LNG', val: 72, color: '#ea580c' },
              { name: 'Coal', val: 48, color: '#d97706' }
            ].map((comm, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8 }}>
                <span style={{ width: 45, color: 'var(--color-text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{comm.name}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${comm.val}%`, height: '100%', background: comm.color }} />
                </div>
                <span style={{ width: 15, textAlign: 'right', fontWeight: 700 }}>{comm.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Content 3: Geospatial Map Content
  function renderPanelMapContent() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 180 }}>
        {/* Layer checkboxes row */}
        <div style={{ display: 'flex', gap: 8, fontSize: 8, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
          {['Routes', 'Ports', 'Incidents', 'Chokepoints', 'Suppliers'].map((lbl, idx) => (
            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ width: 10, height: 10 }} />
              <span>{lbl}</span>
            </label>
          ))}
        </div>

        {/* Global Map element */}
        <div style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', background: '#060d1a', minHeight: 140 }}>
          {mapLoading ? (
            <div className="skeleton" style={{ height: '100%' }} />
          ) : (
            <GlobalMap key="mini-map" mapData={mapData} weatherData={weatherData} />
          )}
        </div>
      </div>
    )
  }

  // Content 4: Scenario Simulator Content
  function renderPanelScenarioSimulatorContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 8.5 }}>
        {/* Form controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 7.5 }}>SCENARIO TYPE</label>
          <select 
            value={selectedScenarioType}
            onChange={(e) => triggerWhatIf(e.target.value)}
            style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: 4, borderRadius: 4, color: 'var(--color-text-primary)', fontSize: 9 }}
          >
            <option value="hormuz">Closure of Strait of Hormuz</option>
            <option value="redsea">Red Sea Shipping Crisis</option>
            <option value="opec">OPEC Voluntary Cuts</option>
          </select>
        </div>

        {/* Run simulation button */}
        <button 
          onClick={() => triggerSimulation()}
          className="btn-primary" 
          style={{ padding: '4px 10px', fontSize: 9, alignSelf: 'start', borderRadius: 4, boxShadow: 'none' }}
        >
          {simulateMutation.isPending ? <RefreshCw size={10} className="animate-spin" /> : "Run Simulation"}
        </button>

        {/* Scenario impact stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Scenario Impact Summary</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>SUPPLY GAP</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-risk-critical)' }}>23.4%</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>PRICE IMPACT</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-risk-high)' }}>+18.7%</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2 }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>AFFECTED IMPORTS</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-risk-critical)' }}>78%</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2 }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>RECOVERY TIME</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-blue-500)' }}>34 Days</span>
            </div>
          </div>
        </div>

        {/* AI Recommendation */}
        <div style={{ padding: 6, background: 'rgba(37,99,235,0.04)', borderLeft: '2px solid #2563eb', borderRadius: 4, fontSize: 7.5, lineHeight: 1.3 }}>
          <strong>AI recommendation:</strong> Diversify suppliers from West Africa and increase strategic reserves.
        </div>
      </div>
    )
  }

  // Content 5: Procurement Content
  function renderPanelProcurementContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 8.5 }}>
        {/* Table representation */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 8 }}>
                <th style={{ paddingBottom: 4 }}>Supplier</th>
                <th style={{ paddingBottom: 4 }}>Reliability</th>
                <th style={{ paddingBottom: 4 }}>Risk</th>
                <th style={{ paddingBottom: 4 }}>Rec</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Saudi Aramco', rel: 92, risk: 'Low', rec: 'Preferred', color: '#10b981' },
                { name: 'ADNOC (UAE)', rel: 88, risk: 'Low', rec: 'Preferred', color: '#10b981' },
                { name: 'ExxonMobil', rel: 75, risk: 'Med', rec: 'Alternative', color: '#d97706' },
                { name: 'Rosneft (RUS)', rel: 45, risk: 'High', rec: 'Block', color: '#dc2626' }
              ].map((sup, idx) => (
                <tr key={idx} style={{ borderBottom: idx < 3 ? '1px solid var(--color-border)' : 'none', fontSize: 8 }}>
                  <td style={{ padding: '4px 0', fontWeight: 600, color: 'var(--color-text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sup.name}</td>
                  <td style={{ padding: '4px 0' }} className="mono">{sup.rel}%</td>
                  <td style={{ padding: '4px 0', color: sup.color, fontWeight: 700 }}>{sup.risk}</td>
                  <td style={{ padding: '4px 0', color: sup.color, fontWeight: 700 }}>{sup.rec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action summary link */}
        <a href="#procurement-orchestrator" style={{ fontSize: 8, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none', alignSelf: 'end' }}>
          Download All Reports &gt;
        </a>
      </div>
    )
  }

  // Content 6: Strategic Reserves Content
  function renderPanelReservesContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 8 }}>
        {/* Reserve indicators */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 4 }}>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>TOTAL COVERAGE</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-amber)' }}>67 Days</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>TARGET</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-primary)' }}>90 Days</div>
          </div>
        </div>

        {/* Caverns status meters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { name: 'Padur Cavern', val: 72, color: 'linear-gradient(90deg, var(--color-amber), var(--color-orange))' },
            { name: 'Mangaluru', val: 45, color: 'linear-gradient(90deg, var(--color-orange), var(--color-risk-critical))' },
            { name: 'Visakhapatnam', val: 90, color: 'linear-gradient(90deg, var(--color-risk-low), #059669)' }
          ].map((cav, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7.5 }}>
                <span style={{ fontWeight: 600 }}>{cav.name}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{cav.val}%</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'var(--color-bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${cav.val}%`, height: '100%', background: cav.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Content 7: Supply Chain Digital Twin Content
  function renderPanelDigitalTwinContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 8 }}>
        {/* Network status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Operational Nodes:</span>
            <span style={{ color: '#10b981', fontWeight: 700 }} className="mono">132</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>At Risk Nodes:</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }} className="mono">18</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Disrupted Nodes:</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }} className="mono">4</span>
          </div>
        </div>

        {/* Circular metric */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800 }}>86%</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 8.5 }}>Flow Status</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 7 }}>Corridors stable</div>
          </div>
        </div>
      </div>
    )
  }

  // Content 8: Reports & Insights Content
  function renderPanelReportsContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 8 }}>
        {/* Key insights bullet list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
          <div style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}>• Geopolitical risks elevated in Middle East.</div>
          <div style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}>• LNG volatility expected to continue.</div>
          <div style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}>• Diversification mitigates gap by 18%.</div>
        </div>

        {/* Download links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
          <span style={{ fontSize: 7.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>RECENT REPORTS</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', background: 'var(--color-bg-primary)', borderRadius: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>Weekly Risk Report</span>
            <span style={{ color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>PDF</span>
          </div>
        </div>
      </div>
    )
  }

  // Content 9: Alerts & Signal Center Content
  function renderPanelAlertsContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 8 }}>
        {/* Severity stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
          {[
            { lbl: 'Crit', val: 12, color: 'var(--color-risk-critical)' },
            { lbl: 'High', val: 26, color: 'var(--color-risk-high)' },
            { lbl: 'Med', val: 18, color: 'var(--color-risk-moderate)' },
            { lbl: 'Low', val: 9, color: 'var(--color-risk-low)' }
          ].map((al, idx) => (
            <div key={idx} style={{ padding: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 6.5, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{al.lbl}</div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: al.color, marginTop: 1 }}>{al.val}</div>
            </div>
          ))}
        </div>

        {/* Simple alerts list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 600 }}>
            <span>Red Sea escalation</span>
            <span>Critical</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', fontWeight: 600 }}>
            <span>OFAC Russian tankers</span>
            <span>High</span>
          </div>
        </div>
      </div>
    )
  }

  // Content 10: Settings Content
  function renderPanelSettingsContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 8 }}>
        {/* Toggle preference */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Email & SMS Notifications:</span>
          <span style={{ padding: '1px 6px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: 4, color: '#10b981', fontWeight: 700 }}>ACTIVE</span>
        </div>

        {/* Key status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>AISstream.io key config:</span>
          <span style={{ fontWeight: 700, color: hasRealAisKey ? '#10b981' : '#475569' }}>
            {hasRealAisKey ? "✓ Connected & Streaming" : "⚠ Fallback Simulator"}
          </span>
        </div>
      </div>
    )
  }

  // 3. GEOSPATIAL MAP VIEW
  function renderGeospatialMap() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: 'calc(100vh - var(--topbar-height) - 40px)', alignItems: 'stretch' }}>
        {/* Layer controls */}
        <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.5px' }}>MAP LAYERS</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
            {([
              { id: 'routes',      label: 'Trade Routes',        color: '#3b82f6' },
              { id: 'ports',       label: 'Ports & Terminals',   color: '#10b981' },
              { id: 'incidents',   label: 'Incidents & Alerts',  color: '#ef4444' },
              { id: 'chokepoints', label: 'Chokepoint Overlays', color: '#ef4444' },
              { id: 'suppliers',   label: 'Supplier Hubs',       color: '#f59e0b' },
              { id: 'storage',     label: 'Storage Facilities',  color: '#eab308' },
              { id: 'weather',     label: 'Weather & Cyclones',  color: '#6366f1' }
            ] as const).map(layer => (
              <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={mapLayers[layer.id]}
                  onChange={() => toggleMapLayer(layer.id)}
                  style={{ cursor: 'pointer', accentColor: layer.color }}
                />
                <span style={{ color: mapLayers[layer.id] ? 'var(--color-text-primary)' : 'var(--color-text-muted)', transition: 'color 0.2s' }}>
                  {layer.label}
                </span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Legend</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, fontSize: 10.5, color: 'var(--color-text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626' }} />
                <span>High-Risk Corridor</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                <span>Normal Route</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                <span>Bypass Route</span>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        {renderMapCard(650, mapLayers)}
      </div>
    )
  }

  // 3. SCENARIO SIMULATOR & DIGITAL TWIN VIEW (Combined)
  function renderScenarioSimulator() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Scenario Simulator Section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Zap size={16} color="var(--color-blue-500)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Scenario Simulator</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1.2fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Column 1: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderSimulationSlidersCard()}
              {renderCommandInputCard()}
            </div>

            {/* Column 2: Price Projections & Refinery Impact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderMonteCarloChartCard()}
              {renderSimulatedRefineryDeficitChart()}
            </div>

            {/* Column 3: Economic Cost & Grid Stress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderSimulatedEconomicCostChart()}
              {renderGridStressCard()}
            </div>
          </div>
        </div>

        {/* ── Section Divider ── */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

        {/* ── Supply Chain Digital Twin Section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Share2 size={16} color="var(--color-purple)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Supply Chain Digital Twin</span>
          </div>
          {renderSupplyChainDigitalTwin()}
        </div>
      </div>
    )
  }

  // Simulated Refinery Feedstock Deficit Chart
  function renderSimulatedRefineryDeficitChart() {
    const sikka = parseFloat((shortfallSlider * 0.45).toFixed(2))
    const kochi = parseFloat((shortfallSlider * 0.35 + opecSlider * 0.15).toFixed(2))
    const mangaluru = parseFloat((shortfallSlider * 0.2 + opecSlider * 0.08).toFixed(2))

    const data = [
      { name: 'Sikka Ref', Deficit: sikka, Normal: Math.max(0, 1.24 - sikka) },
      { name: 'Kochi Ref', Deficit: kochi, Normal: Math.max(0, 0.31 - kochi) },
      { name: 'Mangalore', Deficit: mangaluru, Normal: Math.max(0, 0.30 - mangaluru) }
    ]

    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={15} color="var(--color-risk-critical)" />
          <span className="section-title" style={{ fontSize: 11 }}>Simulated Refinery Feedstock Deficit (mbpd)</span>
        </div>

        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" stroke="#475569" style={{ fontSize: 8.5 }} />
              <YAxis dataKey="name" type="category" stroke="#475569" style={{ fontSize: 8.5 }} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid var(--color-border)', fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="Deficit" stackId="a" fill="#ef4444" name="Supply Shortfall (Deficit)" />
              <Bar dataKey="Normal" stackId="a" fill="#10b981" name="Active Run rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Simulated Economic Cost Impact Breakdown Chart
  function renderSimulatedEconomicCostChart() {
    const transitPremium = parseFloat((shortfallSlider * 1.85).toFixed(2)) // million USD
    const pricePremium = parseFloat((opecSlider * (volatilitySlider / 18)).toFixed(2)) // million USD
    const totalCost = parseFloat((transitPremium + pricePremium).toFixed(2))

    const data = [
      { name: 'Transit Premium', Cost: transitPremium, fill: '#f59e0b' },
      { name: 'Crude Premium', Cost: pricePremium, fill: '#ef4444' }
    ]

    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} color="var(--color-risk-critical)" />
            <span className="section-title" style={{ fontSize: 11 }}>Simulated Economic Loss (Million USD/Day)</span>
          </div>
          <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>
            ${totalCost}M/day
          </span>
        </div>

        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#475569" style={{ fontSize: 8.5 }} />
              <YAxis stroke="#475569" style={{ fontSize: 8.5 }} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid var(--color-border)', fontSize: 10 }} />
              <Bar dataKey="Cost" radius={[3, 3, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // 4. PROCUREMENT & STRATEGIC RESERVES VIEW (Combined)
  function renderProcurementOptimizer() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Procurement Orchestrator Section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ShoppingCart size={16} color="var(--color-blue-500)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Procurement Orchestrator</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {renderDetailedProcurementCard()}
            {renderSupplierComplianceCard()}
          </div>
        </div>

        {/* ── Section Divider ── */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

        {/* ── Strategic Reserves Section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Database size={16} color="var(--color-emerald)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Strategic Petroleum Reserves</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {renderSPRAffectionCard()}
              {renderRefineryImpactSummaryCard()}
            </div>
            <div>
              {renderCavernsStatusCard()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Keep standalone for dispatcher backward compat
  function renderStrategicReserve() {
    return renderProcurementOptimizer()
  }

  // 7. SUPPLY CHAIN DIGITAL TWIN VIEW — Comprehensive Interactive Overhaul
  function renderSupplyChainDigitalTwin() {
    const TWIN_NODES: Record<string, {
      id: string; label: string; sublabel: string; cx: number; cy: number; r: number;
      type: 'supplier' | 'chokepoint' | 'port' | 'refinery' | 'storage';
      baseStatus: 'ok' | 'warn' | 'risk' | 'block';
      downstreamOf?: string[];
      specs: { label: string; value: string }[];
      canDisrupt: boolean;
    }> = {
      rasTanura:   { id: 'rasTanura',   label: 'Ras Tanura (KSA)', sublabel: 'SUPPLIER', cx: 80,  cy: 110, r: 22, type: 'supplier',    baseStatus: 'risk',  specs: [{ label: 'Daily Output', value: '6.4 mbpd' }, { label: 'Export Share', value: '18.2% India' }, { label: 'Last Inspection', value: 'May 2026' }, { label: 'Risk Factor', value: 'Geopolitical' }], canDisrupt: true },
      yanbu:       { id: 'yanbu',       label: 'Yanbu Terminal',   sublabel: 'SUPPLIER', cx: 80,  cy: 330, r: 20, type: 'supplier',    baseStatus: 'ok',    specs: [{ label: 'Daily Output', value: '1.2 mbpd' }, { label: 'Export Share', value: 'Bypass route' }, { label: 'Pipe Status', value: 'East-West active' }, { label: 'Risk Factor', value: 'Low' }], canDisrupt: true },
      hormuz:      { id: 'hormuz',      label: 'Strait of Hormuz', sublabel: 'CHOKEPOINT', cx: 250, cy: 110, r: 24, type: 'chokepoint', baseStatus: 'block', downstreamOf: ['rasTanura'], specs: [{ label: 'Daily Transit', value: '21 mbpd' }, { label: 'Corridor Width', value: '3.2 km nav. lane' }, { label: 'Current Status', value: '↑ Tension — Patrol' }, { label: 'Alt. Route', value: 'Yanbu pipeline' }], canDisrupt: true },
      mandeb:      { id: 'mandeb',      label: 'Bab-el-Mandeb',   sublabel: 'CHOKEPOINT', cx: 250, cy: 250, r: 20, type: 'chokepoint', baseStatus: 'warn',  downstreamOf: ['yanbu'], specs: [{ label: 'Daily Transit', value: '5.8 mbpd' }, { label: 'Status', value: 'Houthi threat active' }, { label: 'Diversions', value: '17 VLCCs/week' }, { label: 'Alt. Route', value: 'Cape of Good Hope' }], canDisrupt: true },
      sikka:       { id: 'sikka',       label: 'Sikka Port',       sublabel: 'PORT — HUB', cx: 450, cy: 220, r: 26, type: 'port',       baseStatus: 'ok',    downstreamOf: ['hormuz', 'mandeb'], specs: [{ label: 'Throughput', value: '95 MT/yr' }, { label: 'Capacity', value: '120 MT/yr' }, { label: 'Berths Active', value: '12 / 14' }, { label: 'Queue Vessels', value: '4 VLCCs' }], canDisrupt: false },
      jamnagar:    { id: 'jamnagar',    label: 'Jamnagar Refinery', sublabel: 'REFINERY', cx: 640, cy: 110, r: 22, type: 'refinery',   baseStatus: 'ok',    downstreamOf: ['sikka'], specs: [{ label: 'Run Rate', value: '98% utilisation' }, { label: 'Capacity', value: '1.24 mbpd' }, { label: 'Feedstock Days', value: '18 days buffer' }, { label: 'Operator', value: 'Reliance Ind.' }], canDisrupt: false },
      padur:       { id: 'padur',       label: 'Padur SPR Cavern', sublabel: 'STORAGE', cx: 640, cy: 340, r: 20, type: 'storage',    baseStatus: 'ok',    downstreamOf: ['sikka'], specs: [{ label: 'Fill Level', value: '72% (11.83 MMT)' }, { label: 'Drawdown Rate', value: '1.5 MT/day max' }, { label: 'Days Cover', value: '34 days' }, { label: 'Authority', value: 'ISPRL / MoPNG' }], canDisrupt: false },
    }

    const EDGES = [
      { from: 'rasTanura', to: 'hormuz' },
      { from: 'yanbu',     to: 'mandeb' },
      { from: 'hormuz',    to: 'sikka'  },
      { from: 'mandeb',    to: 'sikka'  },
      { from: 'sikka',     to: 'jamnagar' },
      { from: 'sikka',     to: 'padur' },
    ]

    function getNodeStatus(nodeId: string): 'ok' | 'warn' | 'risk' | 'block' {
      if (disruptedTwinNodes.has(nodeId)) return 'block'
      const node = TWIN_NODES[nodeId]
      if (node.downstreamOf?.some(parentId => disruptedTwinNodes.has(parentId))) return 'risk'
      return node.baseStatus
    }

    const STATUS_COLORS = { ok: '#10b981', warn: '#f59e0b', risk: '#ef4444', block: '#dc2626' }
    const STATUS_LABELS = { ok: 'NORMAL', warn: 'WARN', risk: 'DISRUPTED', block: 'BLOCKED' }

    function toggleDisruption(nodeId: string) {
      setDisruptedTwinNodes(prev => {
        const next = new Set(prev)
        next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId)
        return next
      })
    }

    const selected = selectedTwinNode ? TWIN_NODES[selectedTwinNode] : null
    const selectedStatus = selectedTwinNode ? getNodeStatus(selectedTwinNode) : 'ok'

    const disrupted = [...disruptedTwinNodes].length
    const atRisk = Object.keys(TWIN_NODES).filter(id => getNodeStatus(id) === 'risk').length
    const healthy = Object.keys(TWIN_NODES).length - disrupted - atRisk
    const networkHealth = Math.round((healthy / Object.keys(TWIN_NODES).length) * 100)

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16, height: 'calc(100vh - var(--topbar-height) - 40px)' }}>

        {/* ── Main SVG Graph ── */}
        <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 700 }}>SUPPLY CHAIN DIGITAL TWIN — INTERACTIVE NODE MAP</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 9.5, color: 'var(--color-text-muted)' }}>
              {(['ok','warn','risk','block'] as const).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[s] }} />
                  <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 760 430" style={{ overflow: 'visible' }}>
              <defs>
                {(['ok','warn','risk','block'] as const).map(s => (
                  <marker key={s} id={`arrow-${s}`} viewBox="0 0 10 10" refX="20" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={STATUS_COLORS[s]} />
                  </marker>
                ))}
              </defs>

              {/* ── Edges ── */}
              {EDGES.map((edge, i) => {
                const from = TWIN_NODES[edge.from]
                const to   = TWIN_NODES[edge.to]
                const fromStatus = getNodeStatus(edge.from)
                const toStatus   = getNodeStatus(edge.to)
                const status = (fromStatus === 'block' || toStatus === 'block') ? 'block'
                             : (fromStatus === 'risk'  || toStatus === 'risk')  ? 'risk'
                             : (fromStatus === 'warn'  || toStatus === 'warn')  ? 'warn' : 'ok'
                const col = STATUS_COLORS[status]
                return (
                  <line key={i}
                    x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                    stroke={col}
                    strokeWidth={status === 'block' ? 2.5 : 1.8}
                    strokeDasharray={status === 'block' ? '6,4' : status === 'risk' ? '4,3' : '0'}
                    strokeOpacity={0.7}
                    markerEnd={`url(#arrow-${status})`}
                  />
                )
              })}

              {/* ── Animated flow dots (only on healthy edges) ── */}
              {EDGES.filter(e => getNodeStatus(e.from) === 'ok' && getNodeStatus(e.to) === 'ok').map((edge, i) => {
                const from = TWIN_NODES[edge.from]
                const to   = TWIN_NODES[edge.to]
                return (
                  <circle key={`dot-${i}`} r="3.5" fill="#10b981" opacity="0.9">
                    <animateMotion dur={`${4 + i * 1.2}s`} repeatCount="indefinite"
                      path={`M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`} />
                  </circle>
                )
              })}

              {/* ── Nodes ── */}
              {Object.values(TWIN_NODES).map(node => {
                const status = getNodeStatus(node.id)
                const col = STATUS_COLORS[status]
                const isSelected = selectedTwinNode === node.id

                return (
                  <g key={node.id} transform={`translate(${node.cx}, ${node.cy})`}
                    cursor="pointer"
                    onClick={() => setSelectedTwinNode(isSelected ? null : node.id)}
                  >
                    {/* Outer selection ring */}
                    {isSelected && (
                      <circle r={node.r + 9} fill="none" stroke={col} strokeWidth="1.5" opacity="0.6" strokeDasharray="4,3">
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Glow aura on risk/block */}
                    {(status === 'block' || status === 'risk') && (
                      <circle r={node.r + 5} fill={col} opacity="0.08" />
                    )}

                    {/* Node body */}
                    <circle r={node.r} fill={`${col}18`} stroke={col}
                      strokeWidth={isSelected ? 2.5 : 1.8} />

                    {/* Type icon text */}
                    <text textAnchor="middle" dominantBaseline="middle" fill={col}
                      fontSize={status === 'block' ? 8 : 7.5} fontWeight="800" y={-2}>
                      {STATUS_LABELS[status]}
                    </text>

                    {/* Node label below */}
                    <text y={node.r + 12} textAnchor="middle" fill="var(--color-text-primary)" fontSize="9" fontWeight="600">
                      {node.label}
                    </text>
                    <text y={node.r + 22} textAnchor="middle" fill="var(--color-text-muted)" fontSize="7.5">
                      {node.sublabel}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Bottom legend bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            <Info size={10} />
            <span>Click any node to inspect live specs. Use <strong style={{ color: 'var(--color-text-secondary)' }}>Trigger Blockade</strong> in the inspector to simulate disruptions.</span>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Network Health */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Network Health Index</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: networkHealth > 70 ? '#10b981' : networkHealth > 45 ? '#f59e0b' : '#ef4444' }}>
                {networkHealth}%
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>chain integrity</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 9.5 }}>
              <span style={{ color: '#10b981' }}>✓ {healthy} Normal</span>
              <span style={{ color: '#f59e0b' }}>⚠ {atRisk} At Risk</span>
              <span style={{ color: '#ef4444' }}>✕ {disrupted} Blocked</span>
            </div>
            {disruptedTwinNodes.size > 0 && (
              <button onClick={() => setDisruptedTwinNodes(new Set(['hormuz']))}
                style={{ marginTop: 4, padding: '4px 10px', fontSize: 9.5, background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: 5, cursor: 'pointer', fontWeight: 700 }}>
                ↺ Reset to Baseline
              </button>
            )}
          </div>

          {/* Node Inspector Panel */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Node Inspector</span>
                  <button onClick={() => setSelectedTwinNode(null)}
                    style={{ fontSize: 9, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Close</button>
                </div>

                <div style={{ borderLeft: `3px solid ${STATUS_COLORS[selectedStatus]}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-text-primary)' }}>{selected.label}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{selected.sublabel}</div>
                  <div style={{ marginTop: 4, display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                    background: `${STATUS_COLORS[selectedStatus]}22`, color: STATUS_COLORS[selectedStatus],
                    fontSize: 9, fontWeight: 800 }}>
                    {STATUS_LABELS[selectedStatus]}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 10.5 }}>
                  {selected.specs.map((spec, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 8px', background: 'var(--color-bg-primary)', borderRadius: 5 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 9.5 }}>{spec.label}</span>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 10 }}>{spec.value}</span>
                    </div>
                  ))}
                </div>

                {selected.canDisrupt && (
                  <button
                    onClick={() => toggleDisruption(selected.id)}
                    style={{
                      marginTop: 6, padding: '7px 12px', fontSize: 10, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${disruptedTwinNodes.has(selected.id) ? '#10b981' : '#ef4444'}`,
                      background: disruptedTwinNodes.has(selected.id) ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: disruptedTwinNodes.has(selected.id) ? '#10b981' : '#ef4444',
                    }}>
                    {disruptedTwinNodes.has(selected.id) ? '✓ Restore Node — Clear Blockade' : '⚡ Simulate Blockade at This Node'}
                  </button>
                )}

                {selected.downstreamOf && selected.downstreamOf.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 9, color: 'var(--color-text-muted)' }}>
                    <span style={{ fontWeight: 700 }}>Cascade from: </span>
                    {selected.downstreamOf.map(id => TWIN_NODES[id]?.label).join(', ')}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: 'var(--color-text-muted)', textAlign: 'center', padding: 20 }}>
                <Cpu size={28} color="var(--color-text-muted)" opacity={0.4} />
                <span style={{ fontSize: 10.5, lineHeight: 1.5 }}>Click any node on the schematic to inspect live specifications and simulate disruptions.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 8. REPORTS & INSIGHTS VIEW — Refined Executive Operations Suite
  function renderReportsInsights() {
    const [selectedReportType, setSelectedReportType] = useState('Weekly Supply Chain Risk Assessment')
    const [selectedTimeRange, setSelectedTimeRange] = useState('Last 7 Days')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedReport, setGeneratedReport] = useState<any>(null)
    const [showPreviewModal, setShowPreviewModal] = useState(false)

    const handleGenerateReport = async () => {
      setIsGenerating(true)
      setTimeout(() => {
        setIsGenerating(false)
        setGeneratedReport({
          title: selectedReportType,
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          timeRange: selectedTimeRange,
          author: 'PetroShield AI — Autonomous Taskforce Intelligence Engine',
          status: 'GEMINI AUDITED & APPROVED',
          keyTakeaways: [
            'Geopolitical maritime disruption score currently elevated at 84% in Arabian Sea / Bab-el-Mandeb threat corridors.',
            'SciPy Linear Programming optimizer recommends allocating 0.7 mbpd Russian Urals crude via Cape bypass to secure Sikka Port supply continuity.',
            'ISPRL Padur and Mangaluru caverns have 34 days of reserve buffer cover under active drawdown mandate.'
          ],
          tableData: [
            { indicator: 'Brent Crude Benchmark', baseline: '$82.50/bbl', current: '$96.40/bbl', delta: '+16.8%' },
            { indicator: 'National Import Deficit', baseline: '0.0 mbpd', current: '1.4 mbpd', delta: '-1.4 mbpd' },
            { indicator: 'Refinery Run Rate (Sikka/Vadinar)', baseline: '98.5%', current: '88.2%', delta: '-10.3%' },
            { indicator: 'Grid Sector Power Deficit', baseline: '0 MW', current: '3,200 MW', delta: 'Elevated' }
          ]
        })
        setShowPreviewModal(true)
      }, 1400)
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, height: 'calc(100vh - var(--topbar-height) - 40px)', alignItems: 'stretch' }}>
        {/* Left pane: Executive Intelligence Briefs */}
        <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} color="var(--color-blue-500)" />
            <span style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 800, letterSpacing: '0.5px' }}>EXECUTIVE INTELLIGENCE BRIEFS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, borderLeft: '4px solid #ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', letterSpacing: '1px', marginBottom: 4 }}>GEOPOLITICAL RISK ALERT</div>
              <strong>Maritime Chokepoint Lockout:</strong> Tensions in Bab-el-Mandeb and Strait of Hormuz adding <strong>+2.3 days</strong> to Sikka delivery schedules. Diverted crude pool total: 1.8 mbpd.
            </div>

            <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.05)', borderRadius: 8, borderLeft: '4px solid #f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', letterSpacing: '1px', marginBottom: 4 }}>MARKET VOLATILITY FORECAST</div>
              <strong>Monte Carlo Price Jump:</strong> Brent crude GBM projection indicates a 78% probability of price testing <strong>$98.50/bbl</strong> within 14 days if Hormuz blockade persists.
            </div>

            <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 8, borderLeft: '4px solid #10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#10b981', letterSpacing: '1px', marginBottom: 4 }}>SPR ADVISORY DIRECTIVE</div>
              <strong>ISPRL Cavern Coverage:</strong> Strategic reserves stored at <strong>78% capacity (23.4M barrels)</strong>. Emergency release mandate authorized under Cabinet Taskforce Guidelines.
            </div>
          </div>
        </div>

        {/* Right pane: AI Reports Generator */}
        <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="var(--color-purple)" />
              <span style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 800, letterSpacing: '0.5px' }}>AUTONOMOUS REPORT OPERATIONS</span>
            </div>
            <span style={{ fontSize: 9, color: 'var(--color-emerald)', fontWeight: 700, padding: '3px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>
              GEMINI 1.5 PRO READY
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>REPORT TYPE</label>
              <select 
                value={selectedReportType}
                onChange={e => setSelectedReportType(e.target.value)}
                style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: 9, borderRadius: 6, color: 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 600 }}
              >
                <option>Weekly Supply Chain Risk Assessment</option>
                <option>Procurement Route Optimization Plan</option>
                <option>SPR Drawdown Feasibility Study</option>
                <option>Geopolitical Scenario Impact Report</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>TIME RANGE</label>
              <select 
                value={selectedTimeRange}
                onChange={e => setSelectedTimeRange(e.target.value)}
                style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: 9, borderRadius: 6, color: 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 600 }}
              >
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>Last 90 Days</option>
                <option>Custom Range</option>
              </select>
            </div>
          </div>

          <button 
            onClick={handleGenerateReport} 
            disabled={isGenerating}
            className="btn-primary" 
            style={{ alignSelf: 'start', padding: '8px 18px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {isGenerating ? "Synthesizing AI Report..." : "Generate Executive AI Report"}
          </button>

          {/* Generated Report Preview Modal */}
          {showPreviewModal && generatedReport && (
            <div style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-blue-500)',
              borderRadius: 8,
              padding: 16,
              marginTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)' }}>{generatedReport.title}</h4>
                  <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Generated: {generatedReport.date} • {generatedReport.timeRange}</span>
                </div>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '3px 8px', borderRadius: 4 }}>
                  {generatedReport.status}
                </span>
              </div>

              <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong>KEY AUDIT TAKEAWAYS:</strong>
                {generatedReport.keyTakeaways.map((t: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ color: '#2563eb' }}>•</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 10 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontSize: 8.5 }}>
                    <th style={{ padding: 6, textAlign: 'left' }}>Indicator</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Baseline</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Current</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedReport.tableData.map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 6, color: 'var(--color-text-primary)', fontWeight: 600 }}>{row.indicator}</td>
                      <td style={{ padding: 6, textAlign: 'right', color: 'var(--color-text-muted)' }}>{row.baseline}</td>
                      <td style={{ padding: 6, textAlign: 'right', color: 'var(--color-text-primary)', fontWeight: 700 }}>{row.current}</td>
                      <td style={{ padding: 6, textAlign: 'right', color: row.delta.startsWith('+') ? '#dc2626' : '#10b981', fontWeight: 800 }}>{row.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <a 
                  href={`${API_BASE_URL}/api/reports/download-pdf?report_type=${encodeURIComponent(selectedReportType)}&time_range=${encodeURIComponent(selectedTimeRange)}`} 
                  download={`Master_Scenario_Incident_Briefing_${selectedReportType.replace(/ /g, '_')}.pdf`}
                  className="btn-primary" 
                  style={{ textDecoration: 'none', padding: '6px 14px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Copy size={12} /> Download Master 4-in-1 PDF Report
                </a>
                <button onClick={() => setShowPreviewModal(false)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 10.5 }}>
                  Close Preview
                </button>
              </div>
            </div>
          )}

          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 12 }}>
            Master Scenario Incident Reports
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(reportHistory.length > 0 ? reportHistory : [
              { pdf_filename: 'Master_Hormuz_Blockade_Incident_Report.pdf', scenario_title: 'Strait of Hormuz Blockade — Master Incident Briefing', date_display: '10 May 2026', severity: 'CRITICAL', disruption_probability: 84.5 },
              { pdf_filename: 'Master_RedSea_Attack_Incident_Report.pdf', scenario_title: 'Red Sea Bab-el-Mandeb Attack — Master Incident Briefing', date_display: '09 May 2026', severity: 'ELEVATED', disruption_probability: 74.0 },
              { pdf_filename: 'Master_OPEC_Supply_Cut_Incident_Report.pdf', scenario_title: 'OPEC+ Emergency Supply Cut — Master Incident Briefing', date_display: '08 May 2026', severity: 'MODERATE', disruption_probability: 62.0 }
            ]).map((rep: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--color-bg-primary)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {rep.pdf_filename || `${rep.scenario_title.replace(/ /g, '_')}.pdf`}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: rep.severity === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'rgba(37,99,235,0.15)', color: rep.severity === 'CRITICAL' ? '#ef4444' : '#2563eb' }}>
                      {rep.severity || 'ELEVATED'} ({rep.disruption_probability ? rep.disruption_probability.toFixed(1) : '84.5'}%)
                    </span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    <b>Executed:</b> {rep.date_display || rep.created_at || 'Just now'} &nbsp;•&nbsp; <b>Title:</b> {rep.scenario_title}
                  </div>
                </div>
                <a 
                  href={`${API_BASE_URL}/api/reports/download-pdf?report_type=${encodeURIComponent(rep.scenario_title)}`} 
                  download={rep.pdf_filename || 'Master_Incident_Briefing.pdf'} 
                  className="btn-ghost" 
                  style={{ padding: '5px 10px', fontSize: 10, textDecoration: 'none', color: 'var(--color-text-primary)', fontWeight: 600 }}
                >
                  Download Master PDF
                </a>
              </div>
            ))}
          </div>

          {/* REAL-TIME PYTHON ENGINE TELEMETRY TERMINAL */}
          <div style={{ marginTop: 16, background: '#090d16', borderRadius: 8, border: '1px solid #1e293b', padding: '12px 16px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #1e293b', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                  LIVE REAL-TIME PYTHON ENGINE EXECUTION TERMINAL (ws://localhost:8000/ws/logs)
                </span>
              </div>
              <span style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>STDOUT RUNTIME TELEMETRY</span>
            </div>
            <div style={{ height: 170, overflowY: 'auto', fontSize: 10.5, lineHeight: '1.45', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {systemLogs.length === 0 ? (
                <div style={{ color: '#475569', fontStyle: 'italic' }}>
                  [SYSTEM] Connected to Python backend WebSocket stream. Click "Generate Executive AI Report" or "Download Master PDF" to view live interpreter execution logs.
                </div>
              ) : (
                systemLogs.map((log: string, idx: number) => (
                  <div key={idx} style={{ 
                    color: log.includes('ERROR') ? '#ef4444' : (log.includes('OK') || log.includes('INITIATED') ? '#10b981' : (log.includes('[PDF GENERATOR]') ? '#38bdf8' : '#94a3b8')),
                    fontWeight: log.includes('[PDF GENERATOR]') ? 700 : 400
                  }}>
                    {log}
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 9. ALERTS & SIGNAL CENTER VIEW
  function renderAlertsSignalCenter() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, height: 'calc(100vh - var(--topbar-height) - 40px)', overflowY: 'auto' }}>
        {/* Severity count Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'CRITICAL ALERTS', count: 12, color: 'var(--color-risk-critical)', bg: 'rgba(239, 68, 68, 0.08)' },
            { label: 'HIGH ALERTS', count: 26, color: 'var(--color-risk-high)', bg: 'rgba(249, 115, 22, 0.08)' },
            { label: 'MEDIUM ALERTS', count: 18, color: 'var(--color-risk-moderate)', bg: 'rgba(245, 158, 11, 0.08)' },
            { label: 'LOW ALERTS', count: 9, color: 'var(--color-risk-low)', bg: 'rgba(16, 185, 129, 0.08)' }
          ].map((sev, idx) => (
            <div key={idx} style={{ background: sev.bg, border: `1px solid ${sev.color}`, borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: sev.color, letterSpacing: '0.5px' }}>{sev.label}</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: sev.color }}>{sev.count}</span>
            </div>
          ))}
        </div>

        {/* Live Signal Feed */}
        <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 700 }}>LIVE CORRIDOR SIGNAL FEED</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { type: 'Critical', source: 'GEOPOLITICAL', text: 'Red Sea shipping disruption escalated. Houthi forces launch fresh strikes in Bab-el-Mandeb corridor.', time: '10 May 2026 10:20 AM' },
              { type: 'High', source: 'REGULATORY', text: 'US OFAC expands sanctions shadow fleet listings. 14 new tankers flagged under export ban.', time: '10 May 2026 09:15 AM' },
              { type: 'Medium', source: 'MARKET', text: 'LNG price volatility reaches 3-month high on European supply anxiety.', time: '09 May 2026 08:45 AM' },
              { type: 'Medium', source: 'ENVIRONMENTAL', text: 'Cyclone warning issued for Mozambique coast near LNG loading terminals.', time: '08 May 2026 07:30 AM' }
            ].map((al, idx) => {
              const badgeColor = al.type === 'Critical' ? '#dc2626' : (al.type === 'High' ? '#ea580c' : '#d97706')
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--color-bg-primary)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, background: `${badgeColor}15`, padding: '2px 6px', borderRadius: 4 }}>{al.type.toUpperCase()}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)' }}>{al.source}</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--color-text-primary)', marginTop: 6, lineHeight: 1.4 }}>{al.text}</p>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>{al.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // 10. SYSTEM SETTINGS VIEW
  function renderSettingsView() {
    return (
      <div className="glass-card" style={{ padding: 18, maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 700 }}>NECC SYSTEM SETTINGS</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--color-text-primary)' }}>FRED API Data Feed Endpoint</label>
            <input type="text" readOnly value="https://api.stlouisfed.org/fred/series/observations?series_id=DCOILBRENTEU" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: '6px 10px', borderRadius: 6, color: '#2563eb', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--color-text-primary)' }}>Orchestration Model Temperature</label>
            <input type="text" readOnly value="0.0 (Deterministic)" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: '6px 10px', borderRadius: 6, color: 'var(--color-text-secondary)', outline: 'none' }} />
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>REAL-TIME AIS VESSEL STREAM CONNECTION</label>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
              Connect live global ship coordinates. Enter your free key from <strong>aisstream.io</strong>. If empty, the system falls back to the high-fidelity simulator.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                placeholder="Enter AISStream.io API Key..." 
                value={aisKeyInput}
                onChange={(e) => setAisKeyInput(e.target.value)}
                style={{ 
                  flex: 1, 
                  background: 'var(--color-bg-primary)', 
                  border: '1px solid var(--color-border)', 
                  padding: '6px 10px', 
                  borderRadius: 6, 
                  color: 'var(--color-text-primary)', 
                  outline: 'none' 
                }} 
              />
              <button 
                onClick={saveAisKey}
                className="btn-primary"
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 11 }}
              >
                {aisSaveStatus || "Save Key"}
              </button>
            </div>
            {hasRealAisKey && (
              <span style={{ fontSize: 9, color: 'var(--color-risk-low)', fontWeight: 600 }}>
                ✓ Real-time AIS stream listener is active.
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // SVG Gauge Card (Energy Resilience Index)
  function renderEnergyResilienceIndexCard(score: number) {
    const radius = 60
    const circumference = Math.PI * radius
    const strokeDashoffset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference

    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} color="#2563eb" />
          <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>ENERGY RESILIENCE INDEX</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
          <svg width="180" height="95" viewBox="0 0 180 95">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--color-risk-critical)" />
                <stop offset="50%" stopColor="var(--color-risk-moderate)" />
                <stop offset="100%" stopColor="var(--color-risk-low)" />
              </linearGradient>
            </defs>
            {/* Background track */}
            <path
              d="M 25 85 A 65 65 0 0 1 155 85"
              fill="none"
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Active track */}
            <path
              d="M 25 85 A 65 65 0 0 1 155 85"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div style={{ marginTop: -32, textAlign: 'center' }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text-primary)' }}>{score.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4 }}>/ 100</span>
          </div>
        </div>
      </div>
    )
  }

  // AI Agent System Status Console
  function renderAIAgentConsoleCard() {
    const hasActiveThreat = (dashboard?.top_risks?.length ?? 0) > 0
    const brent = dashboard?.brent_price_usd ?? 82.49
    const overallRisk = dashboard?.overall_risk_score ?? 59

    const agents = [
      {
        name: "Geopolitical Risk Intel",
        status: hasActiveThreat ? "ACTIVE // Bayesian Net" : "MONITORING",
        desc: `Evaluated ${overallRisk}% corridor disruption probability score for Sikka.`
      },
      {
        name: "Disruption Scenario Modeller",
        status: hasActiveThreat ? "ACTIVE // Monte Carlo" : "STANDBY",
        desc: `Simulated 10k price paths. Brent: $${brent.toFixed(2)}/bbl. Surcharges: +₹8.40/L.`
      },
      {
        name: "Adaptive Procurement",
        status: hasActiveThreat ? "ACTIVE // SciPy LP" : "STANDBY",
        desc: `Solved LP: Moscow Baltic Urals rerouting approved to bypass disruption.`
      },
      {
        name: "Strategic Reserve Advisor",
        status: hasActiveThreat ? "ACTIVE // Cavern Model" : "STANDBY",
        desc: "Allocated 34 days covers. Drawdown: 1.15 MBD. Padur fill: 72%."
      },
      {
        name: "Executive Briefing Agent",
        status: hasActiveThreat ? "ACTIVE // LLM RAG" : "STANDBY",
        desc: "Synthesized policy directives & Abqaiq history into Cabinet brief."
      }
    ]

    return (
      <div className="glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={14} color="var(--color-purple)" />
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>COGNITIVE AGENT CONSOLE STATUS</span>
          </div>
          <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>5 Agent Instances Online</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {agents.map((agent, idx) => {
            const isStandby = agent.status === "STANDBY" || agent.status === "MONITORING"
            return (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 6
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>{agent.name}</span>
                  </div>
                  <p style={{ fontSize: 9, color: 'var(--color-text-secondary)', lineHeight: 1.25, marginTop: 4 }}>{agent.desc}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ 
                      fontSize: 8, 
                      fontWeight: 700, 
                      color: isStandby ? 'var(--color-text-muted)' : 'var(--color-risk-low)',
                      background: isStandby ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 4px',
                      borderRadius: 3,
                      display: 'inline-block'
                    }}>
                      {agent.status.split(' // ')[0]}
                    </span>
                    <span style={{ fontSize: 7.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {agent.status.split(' // ')[1]}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Live System Terminal Card
  function renderLiveTerminalLogsCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={14} color="#10b981" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.5px' }}>
                AI AGENT COGNITIVE CONSOLE
              </span>
              <span style={{ fontSize: 8, color: 'var(--color-text-muted)', letterSpacing: '0.3px' }}>
                Live: Graph-RAG · Keyword Extraction · Bayesian Scoring · Severity Evaluation
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {systemLogs.length > 0 && (
              <span style={{ fontSize: 8, color: '#64748b', background: 'rgba(100,116,139,0.1)', padding: '1px 6px', borderRadius: 10 }}>
                {systemLogs.length} lines
              </span>
            )}
            <button 
              onClick={() => setSystemLogs([])}
              style={{
                background: 'none',
                color: 'var(--color-text-muted)',
                fontSize: 9,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid var(--color-border)'
              }}
            >
              Clear
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#10b981', fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%' }} className="animate-pulse" />
              LIVE
            </div>
          </div>
        </div>

        {/* Color Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 8, color: '#475569' }}>
          <span style={{ color: '#34d399' }}>■ Agent 1 (RiskIntel)</span>
          <span style={{ color: '#60a5fa' }}>■ Agent 2-5</span>
          <span style={{ color: '#a78bfa' }}>■ Bayesian Math</span>
          <span style={{ color: '#67e8f9' }}>■ Keywords/RAG</span>
          <span style={{ color: '#fbbf24' }}>■ Warning</span>
          <span style={{ color: '#f87171' }}>■ Critical/Error</span>
          <span style={{ color: '#f59e0b' }}>■ AIS/Vessel</span>
        </div>

        <div style={{
          background: '#020712',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 6,
          padding: '10px 12px',
          height: 280,
          overflowY: 'auto',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.9)'
        }}>
          {systemLogs.filter(l => l.trim().length > 0).length > 0 ? (
            systemLogs.filter(l => l.trim().length > 0).map((log, idx) => {
              // Color-code log lines by prefix
              const isAgent1     = log.includes('[AGENT 1')
              const isAgent2to5  = /\[AGENT [2-5]/.test(log)
              const isCritical   = log.includes('CRITICAL') || log.includes('✗') || log.includes('ERROR')
              const isWarning    = log.includes('ELEVATED') || log.includes('WARN') || log.includes('WARNING')
              const isSeparator  = log.startsWith('====') || log.startsWith('----')
              const isAIS        = log.includes('[AIS]')
              const isSuccess    = log.includes('✔') || log.includes('Successfully') || log.includes('complete')
              const isBayesian   = log.includes('Scoring') || log.includes('Bayesian') || log.includes('raw_score') || log.includes('composite_score')
              const isKeyword    = log.includes('keywords') || log.includes('conflict=') || log.includes('Graph-RAG')

              let color = '#34d399'  // default green
              if (isSeparator)  color = '#1e3a2e'
              else if (isCritical)   color = '#f87171'
              else if (isWarning)    color = '#fbbf24'
              else if (isBayesian)   color = '#a78bfa'
              else if (isKeyword)    color = '#67e8f9'
              else if (isAgent2to5)  color = '#60a5fa'
              else if (isAIS)        color = '#f59e0b'
              else if (isSuccess)    color = '#86efac'

              return (
                <div key={idx} style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap', color, lineHeight: 1.5, opacity: isSeparator ? 0.3 : 1 }}>
                  {!isSeparator && <span style={{ color: '#1e3a2e', marginRight: 4 }}>&gt;</span>}
                  {log}
                </div>
              )
            })
          ) : (
            <div style={{ color: '#1e3a2e', fontStyle: 'italic', paddingTop: 8 }}>
              <div style={{ color: '#34d399', opacity: 0.5 }}>$ petroshield-agent --watch --live</div>
              <div style={{ marginTop: 6, opacity: 0.5 }}>Waiting for news cycle... Agent will log its Graph-RAG entity extraction,</div>
              <div style={{ opacity: 0.5 }}>keyword scoring, and Bayesian disruption probability computation here.</div>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    )
  }


  // Live Alerts / Recommendations Card
  function renderLiveAlertsRecommendationsCard() {
    const recs = [
      "Accelerate diversification away from Hormuz-dependent routes",
      "Increase SPR buffer by 15 days before Q3 monsoon season",
      "Qualify US Permian crude for Jamnagar refinery"
    ]

    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={14} color="var(--color-risk-critical)" />
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>LIVE ALERTS & RECOMMENDATIONS</span>
          </div>
          <div style={{ width: 8, height: 8, background: 'var(--color-risk-critical)', borderRadius: '50%' }} className="animate-pulse" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recs.map((rec, idx) => (
            <div key={idx} style={{
              padding: '10px 12px',
              background: 'rgba(37, 99, 235, 0.03)',
              borderRadius: 6,
              borderLeft: '3px solid var(--color-blue-500)',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.4
            }}>
              {rec}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Map Card
  function renderMapCard(height: number | string = 580, layers?: Record<string, boolean>) {
    const vesselsCount = mapData?.vessels?.length ?? 45
    return (
      <div className="glass-card" style={{ height: typeof height === 'number' ? `${height}px` : height, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 12, left: 12,
          zIndex: 1000,
          background: 'rgba(8, 12, 20, 0.85)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 10,
          color: '#60a5fa',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <Activity size={10} className="animate-pulse" />
          LIVE AIS TRACKING — {vesselsCount} VESSELS
        </div>
        
        {mapLoading ? (
          <div className="skeleton" style={{ height: '100%' }} />
        ) : (
          <GlobalMap key="full-map" mapData={mapData} layers={layers} weatherData={weatherData} />
        )}
      </div>
    )
  }

  // Briefing Card
  function renderBriefingCard(fullWidth = false) {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="#8b5cf6" />
            <span className="section-title" style={{ fontSize: 11 }}>Executive Ministerial Briefing</span>
          </div>
          <button 
            onClick={() => copyToClipboard(dashboard?.executive_briefing || '')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          </button>
        </div>
        <div style={{
          background: 'rgba(139, 92, 246, 0.03)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          padding: fullWidth ? 20 : 12,
          borderRadius: 8,
          fontSize: fullWidth ? 13 : 11,
          color: '#cbd5e1',
          lineHeight: 1.6,
          maxHeight: fullWidth ? 400 : 180,
          overflowY: 'auto'
        }}>
          {dashboard?.executive_briefing || "All systems operational. No active brief."}
        </div>
        {fullWidth && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
            <span>Classification: <strong>SECRET // India MoPNG</strong></span>
            <span>Confidence: <strong style={{ color: '#10b981' }}>95% (Bayes Weighted)</strong></span>
          </div>
        )}
      </div>
    )
  }

  // Risk Feed Summary Card
  function renderRiskFeedSummaryCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={16} className="text-red-500 animate-pulse" />
            <span className="section-title" style={{ fontSize: 11 }}>Threat Corridors Summary</span>
          </div>
          <span className={`badge ${(dashboard?.overall_risk_score ?? 0) > 35 ? 'risk-bg-critical risk-critical' : 'risk-bg-low risk-low'}`} style={{ fontSize: 9 }}>
            {dashboard?.risk_level || 'MONITOR'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#e2e8f0' }}>
          Active disruption score: <strong style={{ fontSize: 16, color: '#ef4444' }}>{dashboard?.overall_risk_score ?? 21}%</strong>
        </div>
        {dashboard?.top_risks?.[0] ? (
          <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.04)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)', fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: '#f87171' }}>{dashboard.top_risks[0].event_type}</span>
            <p style={{ color: '#cbd5e1', marginTop: 4 }}>{dashboard.top_risks[0].event_summary}</p>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: '10px 0' }}>
            No active threats detected.
          </div>
        )}
      </div>
    )
  }

  // Detailed Risk Feed Card
  function renderDetailedRiskFeedCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} className="text-red-500 animate-pulse" />
          <span className="section-title" style={{ fontSize: 11 }}>Live Geopolitical Risk Feed</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
          {dashboard?.top_risks?.map((risk: any) => (
            <div key={risk.signal_id} style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.04)',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>{risk.event_type}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {risk.severity && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: risk.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' :
                                  risk.severity === 'ELEVATED' ? 'rgba(245,158,11,0.2)' :
                                  risk.severity === 'ALERT'    ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.2)',
                      color: risk.severity === 'CRITICAL' ? '#f87171' :
                             risk.severity === 'ELEVATED' ? '#fbbf24' :
                             risk.severity === 'ALERT'    ? '#60a5fa' : '#94a3b8'
                    }}>
                      {risk.severity}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                    {(risk.timestamp || '').length >= 16 ? risk.timestamp.slice(11, 16) + ' UTC' : 'LIVE'}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{risk.event_summary}</p>
              
              {/* Only render link when article_url is a real external HTTP URL */}
              {risk.article_url && typeof risk.article_url === 'string' && risk.article_url.startsWith('http') && (
                <a 
                  href={risk.article_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{
                    fontSize: 10,
                    color: '#3b82f6',
                    textDecoration: 'none',
                    alignSelf: 'flex-start',
                    marginTop: 2,
                    marginBottom: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    background: 'rgba(59,130,246,0.1)',
                    borderRadius: 4,
                    border: '1px solid rgba(59,130,246,0.3)',
                    fontWeight: 600
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗ Read Source Article
                </a>
              )}
              
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                <span>AI Risk Score: <strong style={{ color: '#ef4444' }}>{typeof risk.disruption_probability === 'number' ? risk.disruption_probability.toFixed(1) : risk.disruption_probability}%</strong></span>
                <span>Supply Impact: <strong style={{ color: 'var(--color-text-primary)' }}>{risk.estimated_supply_impact_mbpd} mbpd</strong></span>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {(risk.affected_chokepoints || []).map((cp: string) => (
                  <span key={cp} style={{ padding: '2px 6px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: 4, fontSize: 9, color: '#f87171' }}>{cp}</span>
                ))}
                {(risk.affected_countries || []).map((c: string) => (
                  <span key={c} style={{ padding: '2px 6px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: 4, fontSize: 9, color: '#60a5fa' }}>{c}</span>
                ))}
              </div>
            </div>
          ))}
          {!dashboard?.top_risks?.length && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
              No active threat corridors detected. Shipping routes clear.
            </div>
          )}
        </div>
      </div>
    )
  }

  // Bayesian Probability Statistics Card
  function renderBayesianProbCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-primary)', fontWeight: 700, letterSpacing: '0.5px' }}>BAYESIAN RISK DISTRIBUTION</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: 'var(--color-text-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Prior Disruption Prob:</span>
            <span className="mono" style={{ fontWeight: 600 }}>15.0%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>AIS Correlated Vessel Anomaly:</span>
            <span className="mono" style={{ color: '#ef4444', fontWeight: 700 }}>+24.5%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Policy Keyword Weight multiplier:</span>
            <span className="mono" style={{ color: '#f59e0b', fontWeight: 700 }}>1.32x</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 4 }}>
            <span>Posterior Bayesian Score:</span>
            <span className="mono" style={{ color: '#ef4444', fontSize: 13 }}>{dashboard?.overall_risk_score ?? 21.5}%</span>
          </div>
        </div>
      </div>
    )
  }

  // Command Input Card
  function renderCommandInputCard() {
    return (
      <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={14} color="#8b5cf6" />
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>AI ORCHESTRATOR COGNITIVE COMMANDS</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea 
            value={simulationPrompt}
            onChange={(e) => setSimulationPrompt(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(8,12,20,0.8)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 6,
              padding: '6px 8px',
              fontSize: 10,
              color: '#fff',
              height: 48,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button 
            onClick={() => triggerSimulation()}
            disabled={simulateMutation.isPending}
            style={{
              width: 40,
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            {simulateMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
        </div>
      </div>
    )
  }

  // Simulation Sliders Card
  function renderSimulationSlidersCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={16} color="#60a5fa" />
          <span className="section-title" style={{ fontSize: 11 }}>Geopolitical Scenario Simulator</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>DISRUPTION THREAT TRIGGERS</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <button 
              onClick={() => triggerWhatIf('hormuz')}
              className={`btn-ghost ${selectedScenarioType === 'hormuz' ? 'active' : ''}`}
              style={{ padding: '6px 4px', fontSize: 10, borderColor: selectedScenarioType === 'hormuz' ? '#ef4444' : '' }}
            >
              Hormuz Block
            </button>
            <button 
              onClick={() => triggerWhatIf('redsea')}
              className={`btn-ghost ${selectedScenarioType === 'redsea' ? 'active' : ''}`}
              style={{ padding: '6px 4px', fontSize: 10, borderColor: selectedScenarioType === 'redsea' ? '#f97316' : '' }}
            >
              Red Sea Attack
            </button>
            <button 
              onClick={() => triggerWhatIf('opec')}
              className={`btn-ghost ${selectedScenarioType === 'opec' ? 'active' : ''}`}
              style={{ padding: '6px 4px', fontSize: 10, borderColor: selectedScenarioType === 'opec' ? '#3b82f6' : '' }}
            >
              OPEC cuts
            </button>
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(15, 23, 42, 0.4)', padding: 10, borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: '#94a3b8' }}>Geopolitical Shortfall Target</span>
              <span className="mono" style={{ color: '#f43f5e', fontWeight: 700 }}>{shortfallSlider.toFixed(1)} mbpd</span>
            </div>
            <input 
              type="range" min="0.0" max="3.0" step="0.1" 
              value={shortfallSlider} 
              onChange={(e) => {
                setShortfallSlider(parseFloat(e.target.value))
                triggerSimulation(`Simulation what-if: Custom geopolitical shortfall calibrated to ${e.target.value} mbpd.`)
              }}
              style={{ width: '100%', height: 4, background: '#1e293b', appearance: 'none', borderRadius: 2, outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: '#94a3b8' }}>OPEC+ Restrictive Cut</span>
              <span className="mono" style={{ color: '#3b82f6', fontWeight: 700 }}>{opecSlider.toFixed(2)} mbpd</span>
            </div>
            <input 
              type="range" min="0.0" max="4.0" step="0.05" 
              value={opecSlider}
              onChange={(e) => {
                setOpecSlider(parseFloat(e.target.value))
                triggerSimulation(`Simulation what-if: OPEC+ emergency policy production cut set to ${e.target.value} mbpd.`)
              }}
              style={{ width: '100%', height: 4, background: '#1e293b', appearance: 'none', borderRadius: 2, outline: 'none' }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Monte Carlo Chart Card
  function renderMonteCarloChartCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>MONTE CARLO GBM PRICE PROJECTIONS (45-DAY FORECAST)</span>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#475569" style={{ fontSize: 9 }} />
              <YAxis domain={['auto', 'auto']} stroke="#475569" style={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid rgba(59,130,246,0.2)', fontSize: 10 }} />
              <Line type="monotone" dataKey="Optimistic" stroke="#10b981" strokeWidth={1.5} dot={false} name="Optimistic (Refill Window)" />
              <Line type="monotone" dataKey="Base Case" stroke="#3b82f6" strokeWidth={2} dot={false} name="Base (Market Mean)" />
              <Line type="monotone" dataKey="Severe Case" stroke="#ef4444" strokeWidth={2} dot={false} name="Severe (Crisis Spike)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Grid / Retail Stress Card
  function renderGridStressCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.04)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>POWER GENERATION GAP</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>3,200 MW</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Grid capacity deficit simulated</div>
        </div>
        <div style={{ padding: 10, background: 'rgba(245, 158, 11, 0.04)', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.15)' }}>
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>RETAIL PUMP SURCHARGE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>+ ₹8.40/L</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Est. pass-through consumer tax</div>
        </div>
      </div>
    )
  }

  // Procurement Summary Card (Overview Column)
  function renderProcurementSummaryCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>NEXT PROCUREMENT ROUTE</span>
        {dashboard?.top_risks?.[0] ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#34d399' }}>
              <span>Russian Urals (Reroute)</span>
              <span>Rank 1</span>
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1' }}>
              Volume: 0.3 mbpd | compatibility: 98%
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', padding: '5px 0' }}>
            Contracts healthy.
          </div>
        )}
      </div>
    )
  }

  // Detailed Procurement Optimizer Card
  function renderDetailedProcurementCard() {
    const firstRiskId = dashboard?.top_risks?.[0]?.signal_id || "gdelt_default";
    return (
      <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={16} color="#10b981" />
          <span className="section-title" style={{ fontSize: 11 }}>Alternative Procurement Optimization</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dashboard?.top_risks?.[0] ? (
            <>
              <div style={{
                padding: 12,
                background: 'rgba(16, 185, 129, 0.04)',
                borderRadius: 8,
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-emerald)' }}>Reroute Option: Russian Urals (Baltic Route)</span>
                  <span className="badge risk-bg-low risk-low" style={{ fontSize: 9 }}>Rank 1</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Optimal linear optimization solution. Diverts heavy crude tanker pool from Baltic terminals to India West Coast (Sikka/Vadinar).
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 11, color: 'var(--color-text-primary)', marginTop: 6, padding: '6px 0', borderTop: '1px solid rgba(128,128,128,0.1)' }}>
                  <div>Allocated Volume: <strong>0.3 mbpd</strong></div>
                  <div>Freight Discount: <strong style={{ color: 'var(--color-emerald)' }}>-$2.00/bbl</strong></div>
                  <div>Transit Duration: <strong>11 days</strong></div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button 
                    onClick={() => handleProcurementAction(firstRiskId, "APPROVE")}
                    disabled={decisionActionStatus[firstRiskId] === "APPROVE"}
                    className="btn-primary" 
                    style={{ flex: 1, padding: '6px 12px', fontSize: 11, background: '#10b981', boxShadow: 'none' }}
                  >
                    {decisionActionStatus[firstRiskId] === "APPROVE" ? <Check size={12} style={{ margin: '0 auto' }} /> : "Approve Cargo rerouting"}
                  </button>
                  <button 
                    onClick={() => handleProcurementAction(firstRiskId, "REJECT")}
                    className="btn-ghost" 
                    style={{ padding: '6px 12px', fontSize: 11 }}
                  >
                    Reject allocation
                  </button>
                </div>
              </div>

              {/* Option 2 */}
              <div style={{
                padding: 12,
                background: 'var(--color-bg-secondary)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>Reroute Option: Saudi KSA Direct (Yanbu Bypass)</span>
                  <span className="badge risk-bg-moderate risk-moderate" style={{ fontSize: 8 }}>Rank 2</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Reroutes East-West pipeline flow to bypass Bab-el-Mandeb. Volume: <strong>0.8 mbpd</strong>. Compatibility: 94%. Freight premium: +$1.20/bbl.
                </p>
              </div>
            </>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 11, color: '#475569' }}>
              All active procurement pipelines operating within baseline contracts.
            </div>
          )}
        </div>
      </div>
    )
  }

  // Supplier Compliance / Metrics Card
  function renderSupplierComplianceCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>OPTIMIZATION CRITERIA WEIGHTS</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: 'var(--color-text-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: 6 }}>
            <span>Grade Compatibility Match:</span>
            <span style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>98.2%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: 6 }}>
            <span>VLCC Tanker Pool Capacity:</span>
            <span>14/15 Available</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: 6 }}>
            <span>Sikka Port Congestion wait:</span>
            <span style={{ color: '#ef4444' }}>1.4 Days</span>
          </div>
        </div>
      </div>
    )
  }

  // SPR Affection Card
  function renderSPRAffectionCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--color-amber)" />
          <span className="section-title" style={{ fontSize: 11 }}>SPR Drawdown Optimization</span>
        </div>

        {dashboard?.top_risks?.[0] ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--color-bg-primary)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>DRAWDOWN RATE</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-amber)', marginTop: 2 }}>1.15 mbpd</div>
              </div>
              <div style={{ background: 'var(--color-bg-primary)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>REPLENISH BUDGET</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-blue-500)', marginTop: 2 }}>$3.26 Billion</div>
              </div>
            </div>
            
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5, background: 'rgba(217, 119, 6, 0.04)', padding: 10, borderRadius: 6, borderLeft: '3px solid var(--color-amber)' }}>
              <strong>Cabinet Directive Release:</strong> Padur cavern and Mangaluru cavern release configured for 34 days cover buffer.
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 11, color: '#475569' }}>
            No active emergency reserve drawdowns active. Strategic coverage: <strong>64 Days Buffer</strong>.
          </div>
        )}
      </div>
    )
  }

  // Refinery Impact Summary Card
  function renderRefineryImpactSummaryCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>REFINERY RUN-RATE METRICS</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Sikka (Reliance):</span>
            <span>100% capacity (Normal)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Kochi Refineries (BPCL):</span>
            <span style={{ color: 'var(--color-risk-critical)' }}>85% run rate (Restricted)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Mangalore (MRPL):</span>
            <span>98% capacity (Normal)</span>
          </div>
        </div>
      </div>
    )
  }

  // Caverns Status Card
  function renderCavernsStatusCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>ISPRL STORAGE CAVERN METRICS</span>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
          {/* Cavern 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-primary)' }}>
              <span><strong>Padur Cavern</strong> (Karnataka)</span>
              <span>72% Filled (10.8M barrels)</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, var(--color-amber), var(--color-orange))', borderRadius: 4 }} />
            </div>
          </div>

          {/* Cavern 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-primary)' }}>
              <span><strong>Mangaluru Cavern</strong> (Karnataka)</span>
              <span>45% Filled (4.5M barrels)</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: '45%', height: '100%', background: 'linear-gradient(90deg, var(--color-orange), var(--color-risk-critical))', borderRadius: 4 }} />
            </div>
          </div>

          {/* Cavern 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-primary)' }}>
              <span><strong>Visakhapatnam Cavern</strong> (Andhra Pradesh)</span>
              <span>90% Filled (8.1M barrels)</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: '90%', height: '100%', background: 'linear-gradient(90deg, var(--color-risk-low), #059669)', borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Explainability Card
  function renderExplainabilityCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HelpCircle size={16} color="var(--color-blue-500)" />
          <span className="section-title" style={{ fontSize: 11 }}>RAG Explainability & Policy Corpus</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {replayData?.decision_trace?.[0] ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-primary)' }}>
                <span>Fitted Risk Calibration:</span>
                <span style={{ color: 'var(--color-risk-low)', fontWeight: 700 }}>95% Confidence</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 700 }}>RETRIEVED CABINET POLICY DIRECTIVES:</span>
                <div style={{
                  padding: 10,
                  background: 'var(--color-bg-primary)',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  fontSize: 10,
                  color: '#2563eb',
                  fontFamily: 'monospace',
                  lineHeight: 1.4
                }}>
                  • mopng_spr_guideline_2026.txt (Section 4A: Drawdown Triggers)<br/>
                  • us_ofac_sanctions_2026.txt (Section 12: Russian Cargo Exemptions)
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 700 }}>SIMILAR HISTORICAL CRISIS ANCHORS:</span>
                <div style={{
                  padding: 10,
                  background: 'var(--color-bg-primary)',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.4
                }}>
                  • <strong>2019 Abqaiq Drone Strike</strong> (global impact: 5.7 mbpd shortfall, 15% price spike, Sikka compatibility similarity: 85%)
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 11, color: '#475569' }}>
              RAG index idle. Submit a threat command signal to pull directives.
            </div>
          )}
        </div>
      </div>
    )
  }

  // Decision Replay timeline Card
  function renderDecisionReplayCard() {
    return (
      <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={16} color="var(--color-purple)" />
          <span className="section-title" style={{ fontSize: 11 }}>Agent Execution Replay Timeline (LangGraph logs)</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
          {replayData?.decision_trace?.map((step: any) => (
            <div key={step.step_index} style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr',
              gap: 12,
              position: 'relative'
            }}>
              {step.step_index < replayData.decision_trace.length && (
                <div style={{
                  position: 'absolute',
                  left: 20,
                  top: 40,
                  bottom: -20,
                  width: 2,
                  background: 'rgba(124, 58, 237, 0.15)'
                }} />
              )}
              
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(124, 58, 237, 0.06)',
                border: '1px solid rgba(124, 58, 237, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-purple)'
              }}>
                0{step.step_index}
              </div>

              <div style={{
                padding: 12,
                background: 'var(--color-bg-secondary)',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>{step.agent_name}</h4>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{step.duration_ms}ms</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{step.reasoning}</p>
                <div style={{
                  padding: '6px 8px',
                  background: 'rgba(37, 99, 235, 0.03)',
                  borderRadius: 6,
                  borderLeft: '2px solid var(--color-blue-500)',
                  fontSize: 10,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'monospace'
                }}>
                  {step.output_summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Cabinet Taskforce Directives Card
  function renderTaskforceDirectivesCard() {
    return (
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>CABINET CORRIDOR RISK DIRECTIVES</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: '#cbd5e1' }}>
          <p>1. <strong>Diversion Protocols</strong>: Any corridor risk exceeding 50% Bayesian score triggers automatic LP alternative supplier optimization.</p>
          <p>2. <strong>SPR Safeguards</strong>: Drawdowns are authorized solely when refinery capacity run rates are projected to fall below 90%.</p>
          <p>3. <strong>Replenishment Cap</strong>: Cavern refilling budget allocations are set up when daily Brent prices drop under $83.70/bbl.</p>
        </div>
      </div>
    )
  }

  // 2. RISK & GEOSPATIAL INTELLIGENCE VIEW (Consolidated Pages 2, 3, 9)
  function renderRiskIntelligence() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, height: 'calc(100vh - var(--topbar-height) - 40px)', alignItems: 'stretch' }}>
        {/* Left Side: Controls, Alerts & Risk Feeds */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4 }}>
          {/* Map Layer checklist and Compact Alerts Grid */}
          <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.5px' }}>MAP LAYERS & ALERTS</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10.5, color: 'var(--color-text-secondary)', flex: 1 }}>
                {([
                  { id: 'routes',      label: 'Trade Routes',        color: '#3b82f6' },
                  { id: 'ports',       label: 'Ports & Terminals',   color: '#10b981' },
                  { id: 'incidents',   label: 'Incidents & Alerts',  color: '#ef4444' },
                  { id: 'chokepoints', label: 'Chokepoint Overlays', color: '#ef4444' },
                  { id: 'suppliers',   label: 'Supplier Hubs',       color: '#f59e0b' },
                  { id: 'storage',     label: 'Storage Facilities',  color: '#eab308' },
                  { id: 'weather',     label: 'Weather & Cyclones',  color: '#6366f1' }
                ] as const).map(layer => (
                  <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={mapLayers[layer.id]}
                      onChange={() => toggleMapLayer(layer.id)}
                      style={{ cursor: 'pointer', accentColor: layer.color }}
                    />
                    <span style={{ color: mapLayers[layer.id] ? 'var(--color-text-primary)' : 'var(--color-text-muted)', transition: 'color 0.2s', whiteSpace: 'nowrap' }}>
                      {layer.label}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'CRITICAL', count: 12, color: 'var(--color-risk-critical)', bg: 'rgba(239, 68, 68, 0.08)' },
                  { label: 'HIGH', count: 26, color: 'var(--color-risk-high)', bg: 'rgba(249, 115, 22, 0.08)' },
                  { label: 'MEDIUM', count: 18, color: 'var(--color-risk-moderate)', bg: 'rgba(245, 158, 11, 0.08)' },
                  { label: 'LOW', count: 9, color: 'var(--color-risk-low)', bg: 'rgba(16, 185, 129, 0.08)' }
                ].map((sev, idx) => (
                  <div key={idx} style={{ background: sev.bg, border: `1px solid ${sev.color}`, borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: sev.color, letterSpacing: '0.5px' }}>{sev.label}</span>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: sev.color }}>{sev.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Risk Feed Card */}
          {renderDetailedRiskFeedCard()}
        </div>

        {/* Right Side: Map (Central Focus) + Live System Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            {renderMapCard('100%', mapLayers)}
          </div>
          {renderLiveTerminalLogsCard()}
        </div>
      </div>
    )
  }

  // ────────────── MAIN VIEW DISPATCHER ──────────────
  const renderActiveView = () => {
    const active = view || currentHash
    switch (active) {
      case 'risk-intelligence':
      case '#risk-intelligence':
      case 'geospatial-map':
      case '#geospatial-map':
      case 'alerts-signal-center':
      case '#alerts-signal-center':
        return renderRiskIntelligence()
      case 'scenario-simulator':
      case '#scenario-simulator':
      case 'supply-chain-digital-twin':
      case '#supply-chain-digital-twin':
        return <NationalEnergyTwin />
      case 'procurement-orchestrator':
      case '#procurement-orchestrator':
      case 'strategic-reserves':
      case '#strategic-reserves':
        return renderProcurementOptimizer()
      case 'reports-insights':
      case '#reports-insights':
        return renderReportsInsights()
      case 'settings':
      case '#settings':
        return renderSettingsView()
      default:
        return renderOverview()
    }
  }

  const active = view || currentHash
  const isFullscreenView = active === 'scenario-simulator' || active === '#scenario-simulator' ||
    active === 'supply-chain-digital-twin' || active === '#supply-chain-digital-twin'

  if (isFullscreenView) {
    return (
      <>
        <NationalEnergyTwin />
        {/* Real-time Toast Notifications */}
        {toastAlerts.length > 0 && (
          <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 5000,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none'
          }}>
            {toastAlerts.map((alert, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(13, 20, 33, 0.95)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)',
                  color: '#fff',
                  fontSize: 11,
                  minWidth: 280,
                  maxWidth: 360,
                  backdropFilter: 'blur(8px)',
                  pointerEvents: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, color: '#ef4444' }}>⚠️ LIVE SIGNAL ALERT</span>
                  <span style={{ fontSize: 9, color: '#94a3b8' }}>{alert.source || "STREAM"}</span>
                </div>
                <div>{alert.description || alert.title || alert.message || "Threat corridor anomaly flagged."}</div>
              </motion.div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ padding: '4px 12px', minHeight: 'calc(100vh - var(--topbar-height) - 40px)' }}>
      {renderActiveView()}
      
      {/* Real-time Toast Notifications */}
      {toastAlerts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 5000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none'
        }}>
          {toastAlerts.map((alert, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              style={{
                padding: '12px 16px',
                background: 'rgba(13, 20, 33, 0.95)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)',
                color: '#fff',
                fontSize: 11,
                minWidth: 280,
                maxWidth: 360,
                backdropFilter: 'blur(8px)',
                pointerEvents: 'auto'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, color: '#ef4444' }}>⚠️ LIVE SIGNAL ALERT</span>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{alert.source || "STREAM"}</span>
              </div>
              <div>{alert.description || alert.title || alert.message || "Threat corridor anomaly flagged."}</div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
