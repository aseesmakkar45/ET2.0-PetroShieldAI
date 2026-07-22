'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/services/api'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type ZoomLevel = 'world' | 'mideast' | 'arabian' | 'india' | 'port'
type SimMode = 'LIVE' | 'SIMULATION'
type EventId = 'none' | 'hormuz' | 'redsea' | 'opec' | 'cyclone'

interface TankerState {
  id: string
  name: string
  cargo: string
  origin: string
  dest: string
  route: RouteId
  progress: number
  speed: number
  status: 'transit' | 'stopped' | 'rerouting' | 'docked'
  eta: number
}

type RouteId = 'hormuz_sikka' | 'basrah_vadinar' | 'russia_suez' | 'uae_kochi' | 'cape_bypass' | 'nigeria_cape'

interface PortNode { id: string; name: string; x: number; y: number; inventory: number; waiting: number; capacity: number }
interface RefineryNode { id: string; name: string; x: number; y: number; runRate: number; throughput: number }
interface SPRNode { id: string; name: string; x: number; y: number; fillLevel: number; releasing: boolean }
interface ConsoleLog { ts: string; level: 'INFO' | 'WARN' | 'CRIT' | 'ACT'; msg: string }

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const ROUTES: Record<RouteId, [number, number][]> = {
  hormuz_sikka:  [[410,248],[450,258],[492,268],[530,295],[570,290],[600,272],[618,258]],
  basrah_vadinar:[[385,215],[420,235],[460,255],[492,268],[530,295],[570,290],[600,272],[622,268]],
  russia_suez:   [[305,82],[298,130],[292,175],[290,205],[310,240],[340,285],[380,308],[430,320],[490,330],[560,330],[605,318],[625,290],[626,278]],
  uae_kochi:     [[488,278],[510,295],[540,315],[570,335],[600,360],[620,390],[632,415]],
  cape_bypass:   [[305,82],[298,130],[270,220],[252,330],[250,440],[255,530],[310,565],[400,555],[510,535],[590,510],[640,480],[636,430],[632,415]],
  nigeria_cape:  [[208,335],[228,400],[244,460],[250,530],[310,565],[400,555],[510,535],[590,510],[640,480],[636,430],[632,415]],
}

function lerpPoint(pts: [number, number][], t: number): [number, number] {
  if (t <= 0) return pts[0]
  if (t >= 1) return pts[pts.length - 1]
  const seg = t * (pts.length - 1)
  const i = Math.floor(seg)
  const f = seg - i
  const a = pts[Math.min(i, pts.length - 1)]
  const b = pts[Math.min(i + 1, pts.length - 1)]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

function routeToPath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC NODE POSITIONS — spread apart to reduce label clustering
// ─────────────────────────────────────────────────────────────────────────────
const BASE_PORTS: PortNode[] = [
  { id: 'sikka',    name: 'Sikka Port',    x: 614, y: 250, inventory: 82, waiting: 1, capacity: 100 },
  { id: 'vadinar',  name: 'Vadinar Port',  x: 625, y: 264, inventory: 78, waiting: 2, capacity: 100 },
  { id: 'kochi',    name: 'Kochi Port',    x: 636, y: 418, inventory: 85, waiting: 0, capacity: 100 },
  { id: 'mangaluru',name: 'Mangaluru',     x: 632, y: 392, inventory: 74, waiting: 1, capacity: 100 },
  { id: 'vizag',    name: 'Vizag Port',    x: 698, y: 332, inventory: 68, waiting: 0, capacity: 100 },
]

const BASE_REFINERIES: RefineryNode[] = [
  { id: 'jamnagar', name: 'Jamnagar (RIL)', x: 630, y: 278, runRate: 98, throughput: 1.24 },
  { id: 'bpcl_kochi', name: 'BPCL Kochi',  x: 644, y: 430, runRate: 94, throughput: 0.31 },
  { id: 'mrpl',     name: 'MRPL Mangaluru', x: 640, y: 402, runRate: 92, throughput: 0.30 },
  { id: 'hpcl_mum', name: 'HPCL Mumbai',   x: 616, y: 326, runRate: 96, throughput: 0.75 },
]

const BASE_SPRS: SPRNode[] = [
  { id: 'padur',    name: 'Padur SPR',     x: 650, y: 412, fillLevel: 94, releasing: false },
  { id: 'mangSPR',  name: 'Mangaluru SPR', x: 622, y: 384, fillLevel: 88, releasing: false },
  { id: 'vizagSPR', name: 'Vizag SPR',     x: 706, y: 324, fillLevel: 75, releasing: false },
]

const BASE_TANKERS: TankerState[] = [
  { id: 't1', name: 'Ghawar Pioneer',       cargo: '2.2M Bbls Arab Light',   origin: 'Ras Tanura',    dest: 'Sikka',    route: 'hormuz_sikka',  progress: 0.42, speed: 0.004, status: 'transit',  eta: 4 },
  { id: 't2', name: 'Mesopotamia',          cargo: '1.8M Bbls Basrah Light', origin: 'Basrah',        dest: 'Vadinar',  route: 'basrah_vadinar',progress: 0.65, speed: 0.005, status: 'transit',  eta: 2 },
  { id: 't3', name: 'Siberian Star',        cargo: '2.0M Bbls Urals',        origin: 'Novorossiysk',  dest: 'Kochi',    route: 'russia_suez',   progress: 0.28, speed: 0.003, status: 'transit',  eta: 9 },
  { id: 't4', name: 'Zayed Al-Khair',       cargo: '1.5M Bbls Murban',       origin: 'Fujairah',      dest: 'Kochi',    route: 'uae_kochi',     progress: 0.55, speed: 0.006, status: 'transit',  eta: 3 },
  { id: 't5', name: 'Burgan Carrier',       cargo: '1.6M Bbls KSL',          origin: 'Ahmadi',        dest: 'Mangaluru',route: 'hormuz_sikka',  progress: 0.18, speed: 0.004, status: 'transit',  eta: 6 },
]

// ─────────────────────────────────────────────────────────────────────────────
// ZOOM CONFIGS
// ─────────────────────────────────────────────────────────────────────────────
const ZOOM_CONFIGS: Record<ZoomLevel, { scale: number; tx: number; ty: number; label: string }> = {
  world:    { scale: 1.0,  tx: 0,     ty: 0,    label: '🌍 World' },
  mideast:  { scale: 2.2,  tx: -780,  ty: -380, label: '🗺️ Mid East' },
  arabian:  { scale: 3.0,  tx: -1200, ty: -580, label: '🌊 Arabian Sea' },
  india:    { scale: 2.8,  tx: -1480, ty: -510, label: '🇮🇳 India' },
  port:     { scale: 6.0,  tx: -3420, ty: -1380,label: '⚓ Port' },
}

// Labels visible at each zoom level — always preserve critical labels
const LABEL_ZOOM: Record<ZoomLevel, string[]> = {
  world:   ['supplier_labels', 'chokepoints', 'port_names', 'refinery_names', 'spr_names'],
  mideast: ['supplier_labels', 'chokepoints', 'tanker_names', 'port_names', 'refinery_names', 'spr_names'],
  arabian: ['chokepoints', 'tanker_names', 'port_names', 'refinery_names', 'spr_names'],
  india:   ['port_names', 'refinery_names', 'spr_names', 'tanker_names'],
  port:    ['port_names', 'refinery_names', 'spr_names', 'tanker_names', 'inventory_detail'],
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE — warm military satellite-imagery theme
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:           '#040811',
  ocean:        '#081022',
  land:         '#0e1b30',
  landBorder:   'rgba(255,255,255,0.07)',
  indiaLand:    '#112c3f',
  indiaBorder:  'rgba(16,185,129,0.6)',
  primary:      '#eab308',
  primaryGlow:  'rgba(234,179,8,0.4)',
  secondary:    '#10b981',
  secondaryGlow:'rgba(16,185,129,0.35)',
  danger:       '#ef4444',
  dangerGlow:   'rgba(239,68,68,0.4)',
  warning:      '#f59e0b',
  safe:         '#10b981',
  text:         '#f8fafc',
  textDim:      'rgba(248,250,252,0.65)',
  textFaint:    'rgba(248,250,252,0.4)',
  gridLine:     'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.12)',
  borderFaint:  'rgba(255,255,255,0.06)',
  consoleGreen: '#10b981',
  consoleWarn:  '#f59e0b',
  consoleCrit:  '#ef4444',
  consoleAct:   '#eab308',
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function NationalEnergyTwin() {
  const [backendMap, setBackendMap] = useState<any>(null)
  const [backendScenarios, setBackendScenarios] = useState<any>(null)
  const [backendAudit, setBackendAudit] = useState<any>(null)
  const [recentSignals, setRecentSignals] = useState<any[]>([])
  const [loadingState, setLoadingState] = useState(false)

  const refreshBackendData = useCallback(async () => {
    try {
      const [mRes, sRes, drRes, dRes] = await Promise.all([
        api.get('/api/map'),
        api.get('/api/scenarios'),
        api.get('/api/decision-replay'),
        api.get('/api/dashboard')
      ])
      setBackendMap(mRes.data)
      setBackendScenarios(sRes.data)
      setBackendAudit(drRes.data)
      if (dRes.data?.top_risks) {
        setRecentSignals(dRes.data.top_risks)
      }
    } catch (e) {
      console.error("Error refreshing backend data:", e)
    }
  }, [])

  useEffect(() => {
    refreshBackendData()
    const iv = setInterval(refreshBackendData, 8000)
    return () => clearInterval(iv)
  }, [refreshBackendData])
  const [mode, setMode] = useState<SimMode>('LIVE')
  const [activeEvent, setActiveEvent] = useState<EventId>('none')
  const [simDay, setSimDay] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [approvedActions, setApprovedActions] = useState<Set<string>>(new Set())
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('world')
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set([
    'flow', 'tankers', 'ports', 'refineries', 'inventory', 'pipelines', 'demand', 'georisk'
  ]))
  const [scanlineActive, setScanlineActive] = useState(false)
  const [narrativeIdx, setNarrativeIdx] = useState(0)
  const [tankers, setTankers] = useState<TankerState[]>(BASE_TANKERS)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [showConsole, setShowConsole] = useState(true)
  const animRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const simTimerRef = useRef<NodeJS.Timeout | null>(null)
  const consoleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const consoleRef = useRef<HTMLDivElement | null>(null)

  const t = simDay
  const isHormuz = activeEvent === 'hormuz'
  const isRedSea = activeEvent === 'redsea'
  const isOPEC = activeEvent === 'opec'
  const isCyclone = activeEvent === 'cyclone'
  const spr = approvedActions.has('spr')
  const russianBoost = approvedActions.has('russian')
  const capeReroute = approvedActions.has('cape')

  const backendBaseScenario = backendScenarios && backendScenarios[0]?.scenarios ? backendScenarios[0].scenarios[1] : null
  const backendShortfall = backendBaseScenario?.supply_shortfall_mbpd || (isHormuz ? 2.4 : isRedSea ? 0.9 : isOPEC ? 1.2 : isCyclone ? 1.8 : 0)
  const backendBrentMean = backendBaseScenario?.brent_price_mean || (isHormuz ? 115 : isRedSea ? 94 : isOPEC ? 102 : 82.5)
  const backendGridStress = backendBaseScenario?.power_sector_impact?.electricity_cost_increase_pct ? (40 + backendBaseScenario.power_sector_impact.electricity_cost_increase_pct * 3.5) : (isHormuz ? 90 : 60)

  const importDeficit = mode === 'LIVE' ? 0 : backendShortfall * (t / 30) - (spr ? 0.9 : 0) - (russianBoost ? 0.7 : 0)
  const brent = mode === 'LIVE' ? 82.5 : 82.5 + (backendBrentMean - 82.5) * (t / 30) - (spr ? 3.5 : 0)
  const demandSat = Math.max(65, 100 - Math.abs(importDeficit) * 14 - t * 0.3)
  const gridStress = mode === 'LIVE' ? 40 : Math.min(95, 40 + (backendGridStress - 40) * (t / 30))

  const ports: PortNode[] = BASE_PORTS.map(p => {
    const backendPort = backendMap?.ports?.find((bp: any) => bp.id === p.id)
    let inv = backendPort ? backendPort.inventory : p.inventory
    if (mode === 'SIMULATION') {
      const isSikkaVadinar = p.id === 'sikka' || p.id === 'vadinar'
      if (isHormuz && isSikkaVadinar) inv = Math.max(20, inv - t * 0.8 + (spr ? 0.6 * t : 0))
      else if (isCyclone && isSikkaVadinar) inv = Math.max(15, inv - t * 1.2)
      else if (isHormuz) inv = Math.max(35, inv - t * 0.3)
    }
    return { ...p, inventory: Math.round(inv) }
  })

  const refineries: RefineryNode[] = BASE_REFINERIES.map(r => {
    const backendRefinery = backendMap?.refineries?.find((br: any) => br.id === r.id)
    let rr = backendRefinery ? backendRefinery.utilization : r.runRate
    if (mode === 'SIMULATION') {
      if (isHormuz) rr = Math.max(65, rr - t * 0.9 + (spr ? 0.5 * t : 0) + (russianBoost ? 0.3 * t : 0))
      else if (isCyclone && r.id === 'jamnagar') rr = Math.max(20, rr - t * 3)
    }
    return { ...r, runRate: Math.round(Math.min(r.runRate, rr)) }
  })

  const sprs: SPRNode[] = BASE_SPRS.map(s => {
    const backendSPR = backendMap?.spr_facilities?.find((bs: any) => bs.id === (s.id === 'mangSPR' ? 'spr_mangaluru' : s.id === 'padur' ? 'spr_padur' : 'spr_vizag'))
    let fill = backendSPR ? backendSPR.fill_pct : s.fillLevel
    if (mode === 'SIMULATION') {
      const releasing = spr && (s.id === 'padur' || s.id === 'mangSPR')
      fill = releasing ? Math.max(0, fill - t * 1.1) : fill
    }
    return { ...s, fillLevel: Math.round(fill), releasing: spr && (s.id === 'padur' || s.id === 'mangSPR') }
  })

  // ── Tanker animation loop ──
  const animate = useCallback((ts: number) => {
    if (ts - lastTickRef.current > 180) {
      lastTickRef.current = ts
      setTankers(prev => prev.map(tk => {
        if (tk.status === 'stopped') return tk
        if (mode === 'SIMULATION') {
          const isGulfRoute = tk.route === 'hormuz_sikka' || tk.route === 'basrah_vadinar'
          if (isHormuz && isGulfRoute && tk.progress > 0.35 && tk.progress < 0.7)
            return { ...tk, status: 'stopped' }
          if (isRedSea && tk.route === 'russia_suez' && tk.progress > 0.45 && tk.progress < 0.72)
            return capeReroute ? { ...tk, route: 'cape_bypass', progress: 0.1, status: 'rerouting' } : { ...tk, status: 'stopped' }
          if (isCyclone && (tk.route === 'hormuz_sikka' || tk.route === 'basrah_vadinar') && tk.progress > 0.82)
            return { ...tk, status: 'stopped' }
        }
        const newProg = Math.min(1, tk.progress + tk.speed)
        if (newProg >= 1) return { ...tk, progress: 0.05, status: 'transit' }
        return { ...tk, progress: newProg, status: tk.status === 'rerouting' ? 'rerouting' : 'transit' }
      }))
    }
    animRef.current = requestAnimationFrame(animate)
  }, [mode, isHormuz, isRedSea, isCyclone, capeReroute])

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [animate])

  // ── Simulation timer ──
  useEffect(() => {
    if (isPlaying && mode === 'SIMULATION') {
      simTimerRef.current = setInterval(() => {
        setSimDay(d => {
          if (d >= 30) { setIsPlaying(false); return 30 }
          return d + 1
        })
        setNarrativeIdx(i => {
          let max = backendAudit?.groq_audit?.narratives?.length ?? 1
          if (backendAudit && backendAudit.decision_trace && backendAudit.decision_trace.length > 0) {
            max = backendAudit.decision_trace.length
          }
          return Math.min(i + 1, max - 1)
        })
      }, 1800)
    }
    return () => { if (simTimerRef.current) clearInterval(simTimerRef.current) }
  }, [isPlaying, mode, activeEvent, backendAudit])

  // ── Console log streamer — types out AI reasoning step-by-step ──
  useEffect(() => {
    if (mode !== 'SIMULATION' || activeEvent === 'none') return
    
    let sourceLogs: string[] = []
    if (backendAudit && backendAudit.decision_trace && backendAudit.decision_trace.length > 0) {
      sourceLogs = backendAudit.decision_trace.map((step: any) => `[${step.agent_name}] ${step.reasoning} (${step.duration_ms}ms)`)
      if (backendAudit.execution_log) {
        sourceLogs = [...sourceLogs, ...backendAudit.execution_log]
      }
    } else {
      sourceLogs = ["Awaiting orchestrator execution log..."]
    }

    setConsoleLogs([])
    let idx = 0
    consoleTimerRef.current = setInterval(() => {
      if (idx >= sourceLogs.length) {
        if (consoleTimerRef.current) clearInterval(consoleTimerRef.current)
        return
      }
      const now = new Date().toISOString().slice(11, 19)
      const msg = sourceLogs[idx]
      const level: ConsoleLog['level'] = (msg.includes('CRITICAL') || msg.includes('ALERT')) ? 'CRIT'
        : msg.includes('WARN') ? 'WARN'
        : msg.includes('RECOMMEND') ? 'ACT'
        : 'INFO'
      setConsoleLogs(prev => [...prev, { ts: now, level, msg }])
      idx++
    }, 850)
    return () => { if (consoleTimerRef.current) clearInterval(consoleTimerRef.current) }
  }, [mode, activeEvent, backendAudit?.timestamp])

  // ── Auto-scroll console to bottom ──
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [consoleLogs])

// ── REAL NEWS ARTICLE URLS LINKED TO SCENARIO BUTTONS FOR LIVE SCRAPING & REAL-TIME NLP SIMULATION ──
const SCENARIO_NEWS_ARTICLES: Record<EventId, string> = {
  none: '',
  hormuz: 'https://www.seatrade-maritime.com/security/iran-declares-the-strait-of-hormuz-closed https://www.thehindu.com/news/international/iran-closes-strait-of-hormuz-us-israel-ceasefire-violations/article71126114.ece https://www.lemonde.fr/en/international/article/2026/06/20/iran-says-strait-of-hormuz-closed-again-after-israel-strikes-lebanon_6754700_4.html?srsltid=AfmBOoqjANxviE39KZhDGmihsy0o2V4Zv_yJwTh-jkRV7RlS-GEVQ-Dx',
  redsea: 'https://economictimes.indiatimes.com/news/international/world-news/how-a-houthi-blockade-in-the-red-sea-tightens-irans-grip-on-global-energy-supplies/articleshow/132517509.cms?from=mdr https://www.thehindu.com/news/international/yemens-iranian-backed-houthis-say-they-will-block-saudi-shipping-at-red-sea-gateway/article71246685.ece',
  opec: 'https://www.aljazeera.com/news/2022/10/6/why-is-opec-cutting-global-oil-production',
  cyclone: 'https://www.aljazeera.com/news/2021/5/17/cyclone-tauktae-barrels-towards-indias-gujarat-state'
}

  const fireEvent = async (evtId: EventId) => {
    if (evtId === 'none') return
    setScanlineActive(true)
    setLoadingState(true)
    setTimeout(() => setScanlineActive(false), 1200)
    try {
      const articleUrl = SCENARIO_NEWS_ARTICLES[evtId]
      // Submit live news URL to backend web scraper & Agent 1 (Risk Intel) for real-time URL parsing & simulation
      await api.post('/api/signals/simulate', {
        raw_signal: articleUrl,
        source_type: "URL"
      })
      await refreshBackendData()
      setActiveEvent(evtId)
      setMode('SIMULATION')
      setSimDay(0)
      setIsPlaying(true)
      setApprovedActions(new Set())
      setNarrativeIdx(0)
      setConsoleLogs([])
    } catch (e) {
      console.error("Failed to run real-time URL NLP simulation:", e)
    } finally {
      setLoadingState(false)
    }
  }

  const resetToLive = async () => {
    setLoadingState(true)
    try {
      await api.post('/api/signals/simulate', {
        raw_signal: "CRITICAL conflict: Normal maritime shipping lanes active. Baseline crude supplies flow normally.",
        source_type: "POLICY"
      })
      await refreshBackendData()
      setMode('LIVE')
      setActiveEvent('none')
      setSimDay(0)
      setIsPlaying(false)
      setApprovedActions(new Set())
      setNarrativeIdx(0)
      setConsoleLogs([])
    } catch (e) {
      console.error("Failed to reset live mode:", e)
    } finally {
      setLoadingState(false)
    }
  }

  const fireLiveSignal = async (sig: any) => {
    setScanlineActive(true)
    setLoadingState(true)
    setTimeout(() => setScanlineActive(false), 1200)
    try {
      await api.post('/api/signals/simulate', {
        raw_signal: sig.event_summary,
        source_type: sig.source_type
      })
      await refreshBackendData()
      let matchedEvent: EventId = 'none'
      const summary = sig.event_summary.toLowerCase()
      if (summary.includes('hormuz') || summary.includes('gulf') || (sig.affected_chokepoints && sig.affected_chokepoints.includes('cp_hormuz'))) {
        matchedEvent = 'hormuz'
      } else if (summary.includes('red sea') || summary.includes('suez') || summary.includes('bab') || (sig.affected_chokepoints && sig.affected_chokepoints.includes('cp_bab'))) {
        matchedEvent = 'redsea'
      } else if (summary.includes('opec') || summary.includes('cut') || summary.includes('quota')) {
        matchedEvent = 'opec'
      } else {
        matchedEvent = 'cyclone'
      }
      setActiveEvent(matchedEvent)
      setMode('SIMULATION')
      setSimDay(0)
      setIsPlaying(true)
      setApprovedActions(new Set())
      setNarrativeIdx(0)
      setConsoleLogs([])
    } catch (e) {
      console.error("Failed to run live signal:", e)
    } finally {
      setLoadingState(false)
    }
  }

  const toggleLayer = (l: string) => {
    setActiveLayers(prev => {
      const n = new Set(prev)
      if (n.has(l)) n.delete(l); else n.add(l)
      return n
    })
  }

  const L = activeLayers
  const vis = LABEL_ZOOM[zoomLevel]
  const canShow = (type: string) => vis.includes(type)

  const { scale, tx, ty } = ZOOM_CONFIGS[zoomLevel]
  const svgTransform = `scale(${scale}) translate(${tx / scale},${ty / scale})`

  // Zoom-aware font sizes and bar dimensions to prevent giant cluttered text at 6.0x port zoom
  const nameFz = scale > 4 ? 4.0 : (scale > 2.5 ? 5.5 : 7.5)
  const detailFz = scale > 4 ? 3.3 : (scale > 2.5 ? 4.8 : 6.5)
  const subFz = scale > 4 ? 2.8 : (scale > 2.5 ? 4.2 : 6.0)
  const barW = scale > 4 ? 14 : (scale > 2.5 ? 20 : 26)
  const barH = scale > 4 ? 1.2 : (scale > 2.5 ? 1.8 : 2.5)

  // Zoom-aware vertical line spacing offsets
  const portYName = scale > 4 ? -4.5 : -5
  const portYDetail = scale > 4 ? 1.5 : 4
  const portYBar = scale > 4 ? 3.5 : 7
  const portYWaiting = scale > 4 ? 8.5 : 16

  const refYName = scale > 4 ? -5.5 : -8
  const refYRR = scale > 4 ? 0.5 : 1
  const refYThroughput = scale > 4 ? 6.5 : 10

  const sprYName = scale > 4 ? -4.5 : -4
  const sprYFill = scale > 4 ? 1.5 : 5
  const sprYRelease = scale > 4 ? 7.5 : 14

  const dynamicTitle = backendAudit?.raw_signal ? (backendAudit.raw_signal.length > 60 ? backendAudit.raw_signal.substring(0, 60) + '...' : backendAudit.raw_signal) : 'Awaiting Live Threat Signal...'
  const dynamicSeverity = backendAudit?.groq_risk_validation?.adjusted_severity || backendScenarios?.severity || 'ANALYZING'

  const routeColor = (rid: RouteId): string => {
    if (mode === 'LIVE') return C.primary
    if (isHormuz && (rid === 'hormuz_sikka' || rid === 'basrah_vadinar')) return C.danger
    if (isRedSea && rid === 'russia_suez') return C.warning
    if (capeReroute && rid === 'cape_bypass') return C.secondary
    return C.primary
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.bg,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      color: C.text,
      position: 'relative',
    }}>
      <style>{`
        @keyframes flowAnim { from { stroke-dashoffset: 60; } to { stroke-dashoffset: 0; } }
        @keyframes flowAnimSlow { from { stroke-dashoffset: 80; } to { stroke-dashoffset: 0; } }
        @keyframes pulseRing { 0%,100% { opacity:0.25; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.2); } }
        @keyframes scanline { 0% { top:-4px; opacity:0.9; } 100% { top:110%; opacity:0; } }
        @keyframes chopPulse { 0%,100% { r:12; opacity:0.15; } 50% { r:20; opacity:0.55; } }
        @keyframes supplierPulse { 0%,100%{opacity:0.05;} 50%{opacity:0.14;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        .flow-route { animation: flowAnim 2.5s linear infinite; }
        .flow-route-slow { animation: flowAnimSlow 4s linear infinite; }
        .pulse-ring { animation: pulseRing 2.5s ease-in-out infinite; }
        .pulse-ring-fast { animation: pulseRing 1s ease-in-out infinite; }
        .chop-pulse { animation: chopPulse 1.8s ease-in-out infinite; }
        .supplier-pulse { animation: supplierPulse 3.5s ease-in-out infinite; }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .btn-layer { cursor:pointer; user-select:none; transition: all 0.2s; }
        .btn-layer:hover { filter: brightness(1.25); }
        .console-cursor { animation: cursorBlink 1s step-end infinite; }
        input[type=range]::-webkit-slider-thumb { background:${C.primary}; width:13px; height:13px; border-radius:50%; cursor:pointer; }
        input[type=range]::-webkit-slider-runnable-track { background:rgba(212,168,71,0.12); height:3px; border-radius:2px; }
      `}</style>

      {/* Scanline flash on event fire */}
      {scanlineActive && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          background: 'linear-gradient(transparent, rgba(224,92,58,0.9), transparent)',
          zIndex: 9999, animation: 'scanline 1.1s ease-in forwards', pointerEvents: 'none',
        }} />
      )}

      {/* ══ TOP COMMAND BAR ══ */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', zIndex: 100,
      }}>
        {/* Left: mode + scenario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: mode === 'LIVE' ? '#059669' : '#dc2626',
              boxShadow: mode === 'LIVE' ? '0 0 8px rgba(5,150,105,0.4)' : '0 0 8px rgba(220,38,38,0.4)',
            }} className={mode === 'SIMULATION' ? 'pulse-ring-fast' : ''} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px',
              color: mode === 'LIVE' ? '#059669' : '#dc2626' }}>{mode}</span>
          </div>
          <div style={{ width: 1, height: 18, background: '#cbd5e1' }} />
          <div>
            <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '1px', fontWeight: 700 }}>ACTIVE SCENARIO</div>
            <div style={{ fontSize: 12, fontWeight: 800,
              color: activeEvent === 'none' ? '#0f172a' : '#d97706' }}>
              {activeEvent === 'none' ? 'All Systems Normal — Live Feeds' : dynamicTitle}
            </div>
          </div>
          {mode === 'SIMULATION' && (
            <>
              <div style={{ width: 1, height: 18, background: '#cbd5e1' }} />
              <div>
                <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '1px', fontWeight: 700 }}>SIM CLOCK</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>DAY {t} / 30</div>
              </div>
            </>
          )}
        </div>

        {/* Center: live KPIs */}
        <div style={{ display: 'flex', gap: 28 }}>
          {[
            { label: 'BRENT CRUDE', value: `$${brent.toFixed(1)}/bbl`, color: brent > 95 ? '#dc2626' : '#d97706' },
            { label: 'IMPORT DEFICIT', value: `${importDeficit < 0 ? importDeficit.toFixed(1) : '0.0'} mbpd`, color: importDeficit < -0.5 ? '#dc2626' : '#059669' },
            { label: 'DEMAND SAT.', value: `${demandSat.toFixed(0)}%`, color: demandSat < 80 ? '#d97706' : '#059669' },
            { label: 'GRID STRESS', value: `${gridStress.toFixed(0)}/100`, color: gridStress > 70 ? '#dc2626' : '#2563eb' },
          ].map(kpi => (
            <div key={kpi.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '1.5px', fontWeight: 700 }}>{kpi.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          {mode === 'SIMULATION' && (
            <button onClick={() => setShowConsole(v => !v)} style={btnStyle(showConsole ? '#059669' : '#475569')}>
              {showConsole ? '⬛ Console' : '▶ Console'}
            </button>
          )}
          {mode === 'SIMULATION' && (
            <>
              <button onClick={() => setIsPlaying(!isPlaying)} style={btnStyle(isPlaying ? '#dc2626' : '#059669')}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button onClick={() => setSimDay(0)} style={btnStyle('#d97706')}>↺ Restart</button>
            </>
          )}
          <button onClick={resetToLive} style={btnStyle(mode === 'LIVE' ? '#94a3b8' : '#2563eb')} disabled={mode === 'LIVE'}>
            ⬤ Live
          </button>
        </div>
      </div>

      {/* ══ MAIN BODY ══ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── LEFT STRIP ── */}
        <div style={{
          width: 68, background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          padding: '10px 5px', gap: 5, overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ fontSize: 7.5, color: '#64748b', letterSpacing: '1.5px', textAlign: 'center', marginBottom: 3, fontWeight: 800 }}>ZOOM</div>
          {(Object.keys(ZOOM_CONFIGS) as ZoomLevel[]).map(z => (
            <button key={z} onClick={() => setZoomLevel(z)} className="btn-layer" style={{
              background: zoomLevel === z ? '#fef3c7' : '#ffffff',
              border: zoomLevel === z ? '1px solid #f59e0b' : '1px solid #e2e8f0',
              borderRadius: 5, padding: '5px 2px',
              color: zoomLevel === z ? '#b45309' : '#475569',
              fontSize: 8.5, textAlign: 'center', lineHeight: 1.35, fontWeight: zoomLevel === z ? 800 : 600,
              boxShadow: zoomLevel === z ? '0 1px 3px rgba(217,119,6,0.15)' : 'none',
            }}>
              {ZOOM_CONFIGS[z].label}
            </button>
          ))}
          <div style={{ height: 1, background: '#e2e8f0', margin: '5px 0' }} />
          <div style={{ fontSize: 7.5, color: '#64748b', letterSpacing: '1.5px', textAlign: 'center', marginBottom: 3, fontWeight: 800 }}>LAYERS</div>
          {[
            { id: 'flow', icon: '〰', label: 'Flow' },
            { id: 'tankers', icon: '🚢', label: 'Ships' },
            { id: 'ports', icon: '⚓', label: 'Ports' },
            { id: 'refineries', icon: '🏭', label: 'Refine' },
            { id: 'inventory', icon: '📊', label: 'Inv.' },
            { id: 'pipelines', icon: '⚡', label: 'Pipes' },
            { id: 'demand', icon: '🌡', label: 'Demand' },
            { id: 'georisk', icon: '⚠', label: 'Risk' },
            { id: 'weather', icon: '🌀', label: 'Weath.' },
          ].map(layer => (
            <button key={layer.id} onClick={() => toggleLayer(layer.id)} className="btn-layer" style={{
              background: L.has(layer.id) ? '#eff6ff' : '#ffffff',
              border: L.has(layer.id) ? '1px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: 5, padding: '4px 2px',
              color: L.has(layer.id) ? '#1d4ed8' : '#64748b',
              fontSize: 8, textAlign: 'center', lineHeight: 1.4, fontWeight: L.has(layer.id) ? 700 : 500,
            }}>
              <div>{layer.icon}</div>
              <div>{layer.label}</div>
            </button>
          ))}
        </div>

        {/* ── OPERATIONAL CANVAS ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          <svg viewBox="0 0 1100 620" style={{ width: '100%', height: '100%', display: 'block' }}
            preserveAspectRatio="xMidYMid slice">
            <defs>
              <filter id="glow-amber"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="glow-danger"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="glow-green"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="glow-warm"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>

              <radialGradient id="oceanGrad" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#0d1a18"/>
                <stop offset="100%" stopColor={C.ocean}/>
              </radialGradient>
              <radialGradient id="hotspot" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e05c3a" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#e05c3a" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="heatRed" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#e05c3a" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="#e05c3a" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="heatAmber" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#c8933a" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="#c8933a" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="heatGreen" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#5aa068" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#5aa068" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="indiaGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d4a847" stopOpacity="0.07"/>
                <stop offset="100%" stopColor="#d4a847" stopOpacity="0"/>
              </radialGradient>
            </defs>

            {/* Ocean */}
            <rect width="1100" height="620" fill="url(#oceanGrad)"/>

            {/* Tactical grid */}
            {Array.from({length: 44}).map((_,i) => (
              <line key={`vg${i}`} x1={i*25} y1={0} x2={i*25} y2={620} stroke={C.gridLine} strokeWidth="0.5"/>
            ))}
            {Array.from({length: 25}).map((_,i) => (
              <line key={`hg${i}`} x1={0} y1={i*25} x2={1100} y2={i*25} stroke={C.gridLine} strokeWidth="0.5"/>
            ))}

            {/* ── Zoom group ── */}
            <g style={{ transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }} transform={svgTransform}>

              {/* ── GEOGRAPHY — warm olive landmasses ── */}
              <path d="M 290,200 L 298,230 L 305,260 L 310,295 L 308,330 L 300,370 L 288,415 L 272,460 L 260,505 L 255,545 L 248,575 L 240,580 L 230,560 L 225,520 L 228,480 L 232,440 L 238,400 L 244,360 L 246,325 L 242,295 L 235,268 L 238,248 L 248,230 L 262,220 L 275,208 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1.2"/>
              <path d="M 305,295 L 330,285 L 355,300 L 360,320 L 340,335 L 318,332 L 308,315 Z"
                fill="#0e1912" stroke={C.landBorder} strokeWidth="1"/>
              <path d="M 368,185 L 395,178 L 425,180 L 455,190 L 478,200 L 492,220 L 495,250 L 490,272 L 478,292 L 460,308 L 440,320 L 415,325 L 398,318 L 385,305 L 378,285 L 372,260 L 368,235 L 365,210 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1.3"/>
              <path d="M 440,165 L 475,158 L 508,162 L 535,172 L 545,190 L 538,210 L 520,220 L 498,225 L 478,215 L 460,200 L 445,185 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1"/>
              <path d="M 372,168 L 395,158 L 418,162 L 430,172 L 435,188 L 425,200 L 408,210 L 390,212 L 374,200 L 368,185 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1"/>
              <path d="M 545,210 L 575,198 L 605,200 L 620,218 L 618,235 L 600,240 L 578,235 L 558,225 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1"/>
              {/* INDIA */}
              <path d="M 615,225 L 638,215 L 662,215 L 690,220 L 718,228 L 740,242 L 752,262 L 755,285 L 748,305 L 755,325 L 748,350 L 740,375 L 726,400 L 710,430 L 698,458 L 688,480 L 680,495 L 670,480 L 658,455 L 645,430 L 632,408 L 622,385 L 614,360 L 608,335 L 604,308 L 604,285 L 606,262 L 610,242 Z"
                fill={C.indiaLand} stroke={C.indiaBorder} strokeWidth="1.8"/>
              <ellipse cx="660" cy="360" rx="85" ry="140" fill="url(#indiaGlow)"/>
              <path d="M 694,488 L 702,484 L 708,498 L 704,510 L 694,508 L 690,498 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="0.8"/>
              <path d="M 270,55 L 330,48 L 380,60 L 400,80 L 360,88 L 310,85 L 278,75 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1"/>
              <path d="M 185,310 L 220,300 L 248,308 L 255,330 L 240,348 L 215,352 L 190,342 L 182,325 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1"/>
              <path d="M 232,545 L 256,538 L 268,548 L 270,565 L 256,578 L 238,572 L 228,558 Z"
                fill={C.land} stroke={C.landBorder} strokeWidth="1"/>

              {/* ── GEORISK GLOWS ── */}
              {L.has('georisk') && (
                <>
                  <circle cx="420" cy="258" r="55" fill={isHormuz ? 'url(#hotspot)' : 'rgba(212,168,71,0.05)'} className="supplier-pulse"/>
                  <circle cx="325" cy="70" r="40" fill="rgba(212,168,71,0.04)" className="supplier-pulse"/>
                  <circle cx="215" cy="328" r="35" fill="rgba(125,191,140,0.04)" className="supplier-pulse"/>
                  {isHormuz && <circle cx="498" cy="200" r="45" fill="rgba(224,92,58,0.1)" className="supplier-pulse"/>}
                </>
              )}

              {/* ── DEMAND HEATMAP ── */}
              {L.has('demand') && (
                <>
                  <circle cx="622" cy="252" r="48" fill={demandSat < 75 ? 'url(#heatRed)' : demandSat < 88 ? 'url(#heatAmber)' : 'url(#heatGreen)'} opacity="0.85"/>
                  <circle cx="628" cy="320" r="52" fill={demandSat < 80 ? 'url(#heatAmber)' : 'url(#heatGreen)'} opacity="0.65"/>
                  <circle cx="636" cy="400" r="45" fill={demandSat < 85 ? 'url(#heatAmber)' : 'url(#heatGreen)'} opacity="0.75"/>
                  <circle cx="665" cy="248" r="38" fill={demandSat < 72 ? 'url(#heatRed)' : 'url(#heatGreen)'} opacity="0.55"/>
                </>
              )}

              {/* ── SHIPPING ROUTES ── */}
              {L.has('flow') && (
                <>
                  {(Object.keys(ROUTES) as RouteId[]).map(rid => (
                    <path key={`base-${rid}`} d={routeToPath(ROUTES[rid])} fill="none"
                      stroke={routeColor(rid)} strokeWidth="1.5" opacity="0.18"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  ))}
                  {!capeReroute && !isRedSea && (
                    <path d={routeToPath(ROUTES.cape_bypass)} fill="none"
                      stroke="rgba(212,168,71,0.07)" strokeWidth="1" strokeDasharray="4 8"/>
                  )}
                  {(Object.keys(ROUTES) as RouteId[]).map(rid => {
                    const isBlocked = (isHormuz && (rid === 'hormuz_sikka' || rid === 'basrah_vadinar') && t > 1)
                      || (isRedSea && rid === 'russia_suez' && t > 0)
                    const isBypass = rid === 'cape_bypass' && (capeReroute || isRedSea)
                    if (rid === 'cape_bypass' && !isBypass) return null
                    if (rid === 'nigeria_cape' && mode !== 'SIMULATION') return null
                    return (
                      <path key={`flow-${rid}`} d={routeToPath(ROUTES[rid])} fill="none"
                        stroke={isBlocked ? C.danger : isBypass ? C.secondary : routeColor(rid)}
                        strokeWidth={isBypass ? 2.5 : 2}
                        strokeDasharray={isBlocked ? '8 8' : isBypass ? '10 5' : '12 6'}
                        className={isBlocked ? '' : 'flow-route'}
                        opacity={isBlocked ? 0.7 : 0.85}
                        filter={isBypass ? 'url(#glow-green)' : isBlocked ? 'url(#glow-danger)' : 'url(#glow-amber)'}
                        strokeLinecap="round" strokeLinejoin="round"/>
                    )
                  })}
                </>
              )}

              {/* ── CHOKEPOINTS ── */}
              {[
                { id: 'hormuz', label: 'HORMUZ', x: 492, y: 268, active: isHormuz },
                { id: 'mandeb', label: 'BAB-EL-MANDEB', x: 318, y: 335, active: isRedSea },
                { id: 'suez',   label: 'SUEZ', x: 292, y: 205, active: isRedSea },
                { id: 'malacca',label: 'MALACCA', x: 780, y: 420, active: false },
              ].map(cp => (
                <g key={cp.id} transform={`translate(${cp.x},${cp.y})`}>
                  <circle r="18" fill={cp.active ? 'rgba(224,92,58,0.12)' : 'rgba(212,168,71,0.05)'} className="chop-pulse"/>
                  <circle r="7" fill={cp.active ? 'rgba(224,92,58,0.75)' : 'rgba(212,168,71,0.55)'}
                    filter={cp.active ? 'url(#glow-danger)' : 'url(#glow-amber)'}/>
                  <circle r="2.5" fill={cp.active ? C.danger : C.primary}/>
                  {canShow('chokepoints') && (
                    <>
                      <text x="10" y="-8" fontSize="7.5" fontWeight="800"
                        fill={cp.active ? C.danger : C.primary}
                        style={{ letterSpacing: '0.8px' }}>{cp.label}</text>
                      {cp.active && <text x="10" y="3" fontSize="6.5" fill={C.danger} fontWeight="700">● BLOCKED</text>}
                    </>
                  )}
                </g>
              ))}

              {/* ── TANKERS ── */}
              {L.has('tankers') && tankers.map(tk => {
                const pts = ROUTES[tk.route]
                if (!pts) return null
                const [vx, vy] = lerpPoint(pts, tk.progress)
                const prevPts = lerpPoint(pts, Math.max(0, tk.progress - 0.02))
                const angle = Math.atan2(vy - prevPts[1], vx - prevPts[0]) * 180 / Math.PI
                const isStopped = tk.status === 'stopped'
                const isRerouting = tk.status === 'rerouting'
                const ringColor = isStopped ? C.danger : isRerouting ? C.secondary : C.primary
                return (
                  <g key={tk.id} transform={`translate(${vx},${vy})`}>
                    <circle r="9" fill="none" stroke={ringColor} strokeWidth="1.5" opacity="0.35"
                      className={isStopped ? 'pulse-ring-fast' : 'pulse-ring'}/>
                    <g transform={`rotate(${angle + 90})`} filter={isStopped ? 'url(#glow-danger)' : 'url(#glow-amber)'}>
                      <polygon points="0,-6 3.5,4.5 0,2.5 -3.5,4.5" fill={ringColor}/>
                    </g>
                    {canShow('tanker_names') && (
                      <>
                        <text x="7" y="-4" fontSize="6.5" fontWeight="700" fill={ringColor}
                          style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.95))' }}>
                          {tk.name}
                        </text>
                        {isStopped && <text x="7" y="4" fontSize="5.5" fill={C.danger}>BLOCKED</text>}
                        {isRerouting && <text x="7" y="4" fontSize="5.5" fill={C.secondary}>REROUTING</text>}
                      </>
                    )}
                  </g>
                )
              })}

              {/* ── INDIA PIPELINES ── */}
              {L.has('pipelines') && (
                <>
                  {[
                    'M 614,250 L 628,268 L 630,278',
                    'M 625,264 L 628,270 L 630,278',
                    'M 630,278 L 633,305 L 628,326 L 618,336',
                    'M 636,418 L 644,430',
                    'M 632,392 L 640,402',
                    'M 640,402 L 650,412',
                    'M 698,332 L 706,324',
                  ].map((d, i) => (
                    <path key={`pipe${i}`} d={d} fill="none"
                      stroke={C.secondary} strokeWidth="1.8" strokeDasharray="5 3"
                      className="flow-route-slow" opacity="0.55" filter="url(#glow-green)" strokeLinecap="round"/>
                  ))}
                </>
              )}

              {/* ── PORT NODES ── */}
              {L.has('ports') && ports.map(p => {
                const isCritical = p.inventory < 40
                const isLow = p.inventory < 65
                const color = isCritical ? C.danger : isLow ? C.warning : C.primary

                // Alternating layout side based on ID to avoid overlaps with close neighbors
                const isLeft = p.id === 'sikka' || p.id === 'kochi'
                const xOff = isLeft ? -9 : 9
                const anchor = isLeft ? 'end' : 'start'

                return (
                  <g key={p.id} transform={`translate(${p.x},${p.y})`}>
                    <circle r="13" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" className="pulse-ring"/>
                    <circle r="6" fill="rgba(8, 16, 28, 0.85)" stroke={color} strokeWidth="1.5"
                      filter={isCritical ? 'url(#glow-danger)' : 'url(#glow-amber)'}/>
                    <circle r="2.5" fill={color}/>
                    {canShow('port_names') && (
                      <>
                        <text x={xOff} y={portYName} fontSize={nameFz} fontWeight="700" fill={color} textAnchor={anchor}>{p.name}</text>
                        {L.has('inventory') && canShow('inventory_detail') && (
                          <>
                            <text x={xOff} y={portYDetail} fontSize={detailFz} fill={color} opacity="0.9" textAnchor={anchor}>INV: {p.inventory}%</text>
                            <rect x={isLeft ? -(barW + Math.abs(xOff)) : xOff} y={portYBar} width={barW} height={barH} rx="0.5" fill="rgba(255,255,255,0.08)"/>
                            <rect x={isLeft ? -(barW + Math.abs(xOff)) : xOff} y={portYBar} width={barW * p.inventory / 100} height={barH} rx="0.5" fill={color} opacity="0.75"/>
                            {p.waiting > 0 && <text x={xOff} y={portYWaiting} fontSize={subFz} fill={C.warning} textAnchor={anchor}>{p.waiting} WAITING</text>}
                          </>
                        )}
                        {L.has('inventory') && !canShow('inventory_detail') && (
                          <text x={xOff} y={portYDetail} fontSize={detailFz} fill={color} opacity="0.8" textAnchor={anchor}>{p.inventory}%</text>
                        )}
                      </>
                    )}
                    {!canShow('port_names') && isCritical && (
                      <text x="7" y="-3" fontSize={6} fill={C.danger}>!</text>
                    )}
                  </g>
                )
              })}

              {/* ── REFINERIES ── */}
              {L.has('refineries') && refineries.map(r => {
                const isCritical = r.runRate < 75
                const color = isCritical ? C.danger : C.warning

                // Alternating layout side based on ID to avoid overlaps with close neighbors
                const isLeft = r.id === 'jamnagar' || r.id === 'mrpl'
                const xOff = isLeft ? -10 : 10
                const anchor = isLeft ? 'end' : 'start'

                return (
                  <g key={r.id} transform={`translate(${r.x},${r.y})`}>
                    <circle r="10" fill="none" stroke={color} strokeWidth="1" opacity="0.25" className="pulse-ring"/>
                    <polygon points="0,-5.5 4.8,-2.8 4.8,2.8 0,5.5 -4.8,2.8 -4.8,-2.8"
                      fill="rgba(8, 16, 28, 0.85)" stroke={color} strokeWidth="1.5" filter="url(#glow-warm)"/>
                    {canShow('refinery_names') && (
                      <>
                        <text x={xOff} y={refYName} fontSize={nameFz} fontWeight="700" fill={color} textAnchor={anchor}>{r.name}</text>
                        <text x={xOff} y={refYRR} fontSize={detailFz} fill={color} opacity="0.8" textAnchor={anchor}>RR: {r.runRate}%</text>
                        <text x={xOff} y={refYThroughput} fontSize={subFz} fill={color} opacity="0.65" textAnchor={anchor}>{r.throughput}mbpd</text>
                      </>
                    )}
                  </g>
                )
              })}

              {/* ── SPR NODES ── */}
              {L.has('inventory') && sprs.map(s => {
                const color = s.releasing ? C.secondary : '#c8a84a'
                const fillRad = 7 * s.fillLevel / 100

                // Alternating layout side based on ID to avoid overlaps with close neighbors
                const isLeft = s.id === 'mangSPR'
                const xOff = isLeft ? -9 : 9
                const anchor = isLeft ? 'end' : 'start'

                return (
                  <g key={s.id} transform={`translate(${s.x},${s.y})`}>
                    <polygon points="0,-8 6,0 0,8 -6,0" fill="rgba(8, 16, 28, 0.9)"
                      stroke={color} strokeWidth="1.5" filter={s.releasing ? 'url(#glow-green)' : 'url(#glow-amber)'}/>
                    <polygon points={`0,-${fillRad} ${fillRad*0.75},0 0,${fillRad} -${fillRad*0.75},0`}
                      fill={color} opacity="0.6"/>
                    {canShow('spr_names') && (
                      <>
                        <text x={xOff} y={sprYName} fontSize={nameFz} fontWeight="700" fill={color} textAnchor={anchor}>{s.name}</text>
                        <text x={xOff} y={sprYFill} fontSize={detailFz} fill={color} opacity="0.8" textAnchor={anchor}>{s.fillLevel}%</text>
                        {s.releasing && <text x={xOff} y={sprYRelease} fontSize={subFz} fill={C.secondary} textAnchor={anchor}>▶ RELEASING</text>}
                      </>
                    )}
                  </g>
                )
              })}

              {/* ── SUPPLIER LABELS (world/mideast only) ── */}
              {canShow('supplier_labels') && [
                { label: 'SAUDI ARABIA', sub: '~1.8 mbpd', x: 415, y: 255, color: isHormuz && t > 0 ? C.warning : C.textDim },
                { label: 'IRAQ', sub: '~0.9 mbpd', x: 395, y: 190, color: isHormuz && t > 0 ? C.warning : C.textDim },
                { label: 'UAE/OMAN', sub: '~0.7 mbpd', x: 480, y: 305, color: C.textFaint },
                { label: 'IRAN', sub: 'Sanctioned', x: 488, y: 192, color: isHormuz ? C.danger : C.textFaint },
                { label: 'RUSSIA', sub: '~1.4 mbpd', x: 318, y: 65, color: C.textDim },
                { label: 'NIGERIA', sub: '~0.2 mbpd', x: 205, y: 325, color: C.textFaint },
                { label: 'INDIA', sub: '5.4 mbpd demand', x: 672, y: 345, color: C.text },
              ].map(lbl => (
                <g key={lbl.label}>
                  <text x={lbl.x} y={lbl.y} fontSize="8" fontWeight="800" fill={lbl.color}
                    textAnchor="middle" style={{ letterSpacing: '1px' }}>{lbl.label}</text>
                  <text x={lbl.x} y={lbl.y + 9} fontSize="6.5" fill={lbl.color} textAnchor="middle" opacity="0.65">{lbl.sub}</text>
                </g>
              ))}

              {/* ── EVENT OVERLAYS ── */}
              {isHormuz && t > 0 && (
                <ellipse cx="480" cy="268" rx="52" ry="36" fill="rgba(224,92,58,0.07)"
                  stroke="rgba(224,92,58,0.3)" strokeWidth="1" strokeDasharray="6 4" className="supplier-pulse"/>
              )}
              {isRedSea && t > 0 && (
                <ellipse cx="315" cy="315" rx="42" ry="62" fill="rgba(200,147,58,0.06)"
                  stroke="rgba(200,147,58,0.25)" strokeWidth="1" strokeDasharray="6 4" className="supplier-pulse"/>
              )}
              {isCyclone && t > 0 && (
                <>
                  <circle cx="608" cy="248" r="42" fill="rgba(80,100,200,0.06)"
                    stroke="rgba(80,100,200,0.28)" strokeWidth="1.5" strokeDasharray="6 4" className="chop-pulse"/>
                  <text x="608" y="245" fontSize="22" textAnchor="middle" opacity="0.4">🌀</text>
                </>
              )}

              {/* ── WEATHER LAYER ── */}
              {L.has('weather') && isCyclone && (
                <g transform="translate(605,240)">
                  <circle r="38" fill="none" stroke="rgba(80,100,200,0.28)" strokeWidth="1.5" strokeDasharray="5 5" className="pulse-ring"/>
                  <text textAnchor="middle" y="5" fontSize="22" opacity="0.45">🌀</text>
                  <text x="40" y="-6" fontSize="7.5" fill="rgba(80,100,200,0.8)" fontWeight="700">CAT 3</text>
                  <text x="40" y="3" fontSize="6.5" fill="rgba(80,100,200,0.6)">TAUKTAE</text>
                </g>
              )}

              {/* ── LEGEND ── */}
              <g transform="translate(12,558)">
                <rect width="200" height="50" rx="3" fill="rgba(8, 16, 28, 0.85)" stroke={C.borderFaint} strokeWidth="0.8"/>
                {[
                  { color: C.primary,   label: 'Active Supply Route', dash: '10 5' },
                  { color: C.danger,    label: 'Blocked / Disrupted', dash: '6 6' },
                  { color: C.secondary, label: 'Bypass / Reroute',    dash: '8 4' },
                ].map((l, i) => (
                  <g key={l.label} transform={`translate(8, ${13 + i * 13})`}>
                    <line x1="0" y1="0" x2="20" y2="0" stroke={l.color} strokeWidth="1.8" strokeDasharray={l.dash}/>
                    <text x="26" y="4" fontSize="7" fill={l.color} opacity="0.82">{l.label}</text>
                  </g>
                ))}
              </g>

            </g> {/* end zoom group */}
          </svg>

          {/* Vignette */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 52%, rgba(3, 7, 13, 0.75) 100%)',
          }}/>

          {/* Corner HUD */}
          {['top-left','top-right','bottom-left','bottom-right'].map(corner => (
            <div key={corner} style={{
              position: 'absolute', width: 24, height: 24,
              borderTop: corner.includes('top') ? '1.5px solid rgba(212,168,71,0.28)' : 'none',
              borderBottom: corner.includes('bottom') ? '1.5px solid rgba(212,168,71,0.28)' : 'none',
              borderLeft: corner.includes('left') ? '1.5px solid rgba(212,168,71,0.28)' : 'none',
              borderRight: corner.includes('right') ? '1.5px solid rgba(212,168,71,0.28)' : 'none',
              top: corner.includes('top') ? 6 : 'auto',
              bottom: corner.includes('bottom') ? 6 : 'auto',
              left: corner.includes('left') ? 6 : 'auto',
              right: corner.includes('right') ? 6 : 'auto',
            }}/>
          ))}

          {/* Scenario fire buttons (live, bottom of canvas) */}
          {mode === 'LIVE' && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 8, zIndex: 20,
            }}>
              {([
                { id: 'hormuz', label: '⚠ Hormuz Closure', sev: 'CRITICAL' },
                { id: 'redsea', label: '⚠ Red Sea Attack', sev: 'ELEVATED' },
                { id: 'opec',   label: '⚠ OPEC+ Cut',      sev: 'ELEVATED' },
                { id: 'cyclone',label: '🌀 Cyclone Gujarat', sev: 'MODERATE' },
              ] as { id: EventId; label: string; sev: string }[]).map(ev => (
                <button key={ev.id} onClick={() => fireEvent(ev.id)} style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6, padding: '7px 14px',
                  color: '#0f172a', fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: '0.5px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s',
                }}>
                  {ev.label}
                  <span style={{ marginLeft: 6, fontSize: 8, color: ev.sev === 'CRITICAL' ? '#dc2626' : '#d97706', letterSpacing: '1px', fontWeight: 800 }}>{ev.sev}</span>
                </button>
              ))}
            </div>
          )}

          {/* Simulation timeline bar */}
          {mode === 'SIMULATION' && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              padding: '8px 16px', zIndex: 20,
              boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 9, color: '#64748b', letterSpacing: '1px', whiteSpace: 'nowrap', fontWeight: 700 }}>DAY 0</span>
                <input type="range" min="0" max="30" value={simDay}
                  onChange={e => { setSimDay(+e.target.value); setIsPlaying(false) }}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#d97706' }}/>
                <span style={{ fontSize: 9, color: '#64748b', letterSpacing: '1px', whiteSpace: 'nowrap', fontWeight: 700 }}>DAY 30</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706', minWidth: 56 }}>DAY {simDay}</span>
              </div>
              <div style={{ position: 'relative', marginTop: 2, height: 12 }}>
                {(backendAudit?.groq_audit?.cascade_steps || []).slice(0, 7).map((step: string, i: number) => {
                  const dayStr = step.split('—')[0].replace('Day ', '').trim()
                  const day = parseInt(dayStr)
                  const pct = (day / 30) * 100
                  return (
                    <div key={i} style={{
                      position: 'absolute', left: `${pct}%`,
                      fontSize: 7, color: day <= simDay ? '#d97706' : '#94a3b8',
                      transform: 'translateX(-50%)', top: 0, whiteSpace: 'nowrap', fontWeight: 700
                    }}>▲</div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ AI AGENT CONSOLE LOG (light overlay) ══ */}
          {showConsole && mode === 'SIMULATION' && (
            <div style={{
              position: 'absolute',
              left: 76, bottom: mode === 'SIMULATION' ? 58 : 12,
              width: 420, maxHeight: 200,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              zIndex: 50,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
            }}>
              {/* Console header */}
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#f8fafc',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }}/>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }}/>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }}/>
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#0f172a', letterSpacing: '1.5px' }}>
                  AI AGENT — ANALYSIS LOG
                </span>
                <span style={{ fontSize: 8, color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>
                  {consoleLogs.length} entries
                </span>
              </div>
              {/* Console body */}
              <div ref={consoleRef} style={{
                flex: 1, overflowY: 'auto', padding: '8px 12px',
                display: 'flex', flexDirection: 'column', gap: 3, background: '#ffffff'
              }}>
                {consoleLogs.length === 0 && (
                  <span style={{ fontSize: 8.5, color: '#94a3b8' }}>
                    Initializing analysis engine...<span className="console-cursor">█</span>
                  </span>
                )}
                {consoleLogs.map((log, i) => (
                  <div key={i} className="fade-in" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 8, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>{log.ts}</span>
                    <span style={{
                      fontSize: 8, lineHeight: 1.4, fontWeight: 600,
                      color: log.level === 'CRIT' ? '#dc2626'
                        : log.level === 'WARN' ? '#d97706'
                        : log.level === 'ACT' ? '#2563eb'
                        : '#059669',
                    }}>
                      {log.level !== 'INFO' && <span style={{ fontWeight: 800, marginRight: 4 }}>[{log.level}]</span>}
                      {log.msg}
                    </span>
                  </div>
                ))}
                {consoleLogs.length > 0 && mode === 'SIMULATION' && !backendAudit && (
                  <div style={{ fontSize: 8, color: '#059669' }}>
                    <span className="console-cursor">█</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── AI DECISION CENTER PANEL ── */}
        <div style={{
          width: 340,
          background: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flexShrink: 0,
          boxShadow: '-2px 0 10px rgba(0,0,0,0.03)',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f8fafc',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', boxShadow: '0 0 8px rgba(217,119,6,0.35)' }}/>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: '#0f172a' }}>AI DECISION CENTER</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14, background: '#ffffff' }}>

            {/* Scenario selector (live) */}
            {mode === 'LIVE' && (
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: 12,
              }}>
                <div style={{ fontSize: 9.5, color: '#64748b', letterSpacing: '1.5px', marginBottom: 10, fontWeight: 800 }}>
                  SELECT DISRUPTION SCENARIO
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {([
                    { id: 'hormuz', label: 'Strait of Hormuz Closure', sev: 'CRITICAL', prob: 82 },
                    { id: 'redsea', label: 'Red Sea / Bab-el-Mandeb Attack', sev: 'ELEVATED', prob: 74 },
                    { id: 'opec',   label: 'OPEC+ Emergency Supply Cut', sev: 'ELEVATED', prob: 90 },
                    { id: 'cyclone',label: 'Cyclone Tauktae — Gujarat', sev: 'MODERATE', prob: 68 },
                  ] as { id: EventId; label: string; sev: string; prob: number }[]).map(ev => (
                    <button key={ev.id} onClick={() => fireEvent(ev.id)} disabled={loadingState} style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6, padding: '9px 11px',
                      cursor: loadingState ? 'wait' : 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      opacity: loadingState ? 0.6 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0f172a' }}>
                          {loadingState && activeEvent !== ev.id ? ev.label : loadingState ? 'PROCESSING...' : ev.label}
                        </span>
                        <span style={{ fontSize: 8, color: ev.sev === 'CRITICAL' ? '#dc2626' : '#d97706', fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: ev.sev === 'CRITICAL' ? '#fee2e2' : '#fef3c7' }}>{ev.sev}</span>
                      </div>
                      <div style={{ marginTop: 5 }}>
                        <span style={{ fontSize: 8.5, color: '#64748b' }}>AI Probability: </span>
                        <span style={{ fontSize: 8.5, color: '#2563eb', fontWeight: 800 }}>{ev.prob}%</span>
                      </div>
                    </button>
                  ))}
                </div>
                
                {recentSignals && recentSignals.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 9.5, color: '#64748b', letterSpacing: '1.5px', marginBottom: 8, fontWeight: 800 }}>
                      LIVE GEOPOLITICAL ALERTS (REAL-TIME RSS)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                      {recentSignals.map((sig, sIdx) => (
                        <button key={sIdx} onClick={() => fireLiveSignal(sig)} style={{
                          background: '#ffffff',
                          border: '1px solid #fee2e2',
                          borderRadius: 6, padding: '8px 10px',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                          width: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{sig.event_summary}</span>
                            <span style={{ fontSize: 7.5, color: '#dc2626', fontWeight: 800 }}>{sig.severity}</span>
                          </div>
                          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#64748b' }}>
                            <span>Probability: <span style={{ color: '#2563eb', fontWeight: 700 }}>{sig.disruption_probability.toFixed(0)}%</span></span>
                            <span>Impact: <span style={{ color: '#d97706', fontWeight: 700 }}>{sig.estimated_supply_impact_mbpd}M</span></span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active simulation content */}
            {mode === 'SIMULATION' && activeEvent !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Severity banner */}
                <div style={{
                  background: '#fff1f2', border: '1px solid #fecdd3',
                  borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626',
                    boxShadow: '0 0 8px rgba(220,38,38,0.4)', flexShrink: 0 }} className="pulse-ring-fast"/>
                  <div>
                    <div style={{ fontSize: 9, color: '#be123c', fontWeight: 800, letterSpacing: '1.5px' }}>
                      {dynamicSeverity} — SIMULATION ACTIVE
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
                      {dynamicTitle}
                    </div>
                  </div>
                </div>

                {/* Gemini Risk Audit Panel */}
                {backendAudit?.gemini_risk_validation && (
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 6, padding: 11, display: 'flex', flexDirection: 'column', gap: 7
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: '#dc2626', letterSpacing: '1.5px', fontWeight: 800 }}>
                        AI RISK AUDIT & VALIDATION
                      </span>
                      <span style={{
                        fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: backendAudit.gemini_risk_validation.validation_decision === 'AGREED' ? '#d1fae5' : '#fef3c7',
                        color: backendAudit.gemini_risk_validation.validation_decision === 'AGREED' ? '#059669' : '#b45309',
                        border: `1px solid ${backendAudit.gemini_risk_validation.validation_decision === 'AGREED' ? '#a7f3d0' : '#fde68a'}`
                      }}>
                        {backendAudit.gemini_risk_validation.validation_decision}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: '#475569' }}>
                      <span>Confidence: <strong style={{ color: '#0f172a' }}>{backendAudit.gemini_risk_validation.confidence_level}</strong></span>
                    </div>
                    
                    {backendAudit.gemini_risk_validation.confidence_explanation && (
                      <p style={{ fontSize: 8.5, color: '#475569', margin: '2px 0 4px 0', lineHeight: 1.4, fontStyle: 'italic' }}>
                        {backendAudit.gemini_risk_validation.confidence_explanation}
                      </p>
                    )}

                    {backendAudit.gemini_risk_validation.supporting_evidence?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 800, marginBottom: 3 }}>SUPPORTING EVIDENCE</div>
                        {backendAudit.gemini_risk_validation.supporting_evidence.slice(0, 2).map((ev: string, idx: number) => (
                          <div key={idx} style={{ fontSize: 8, color: '#0f172a', display: 'flex', gap: 4, marginTop: 1 }}>
                            <span>•</span><span>{ev}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {backendAudit.gemini_risk_validation.weaknesses_and_uncertainties?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 800, marginBottom: 3, marginTop: 4 }}>UNCERTAINTIES & WEAKNESSES</div>
                        {backendAudit.gemini_risk_validation.weaknesses_and_uncertainties.slice(0, 2).map((w: string, idx: number) => (
                          <div key={idx} style={{ fontSize: 8, color: '#475569', display: 'flex', gap: 4, marginTop: 1 }}>
                            <span>•</span><span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Narrative */}
                <div style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: 11,
                }}>
                  <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', marginBottom: 6, fontWeight: 800 }}>
                    AI ANALYST REPORT
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p key={narrativeIdx}
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ fontSize: 10, color: '#0f172a', lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
                      {backendAudit && backendAudit.decision_trace && backendAudit.decision_trace.length > 0
                        ? backendAudit.decision_trace[narrativeIdx % backendAudit.decision_trace.length]?.output_summary
                        : (backendAudit?.groq_audit?.narratives ? backendAudit.groq_audit.narratives[narrativeIdx % backendAudit.groq_audit.narratives.length] : 'Generating dynamic AI narrative. Please wait...')}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Cascade Timeline */}
                <div>
                  <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', marginBottom: 8, fontWeight: 800 }}>PREDICTED CASCADE</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(backendAudit?.groq_audit?.cascade_steps || []).map((step: string, i: number) => {
                      const dayMatch = step.match(/Day (\d+)/)
                      const day = dayMatch ? parseInt(dayMatch[1]) : 0
                      const past = simDay >= day
                      return (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: past ? 1 : 0.45 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                            background: past ? '#d97706' : '#cbd5e1',
                            boxShadow: past ? '0 0 6px rgba(217,119,6,0.3)' : 'none',
                          }}/>
                          <span style={{ fontSize: 8.5, color: past ? '#0f172a' : '#64748b', lineHeight: 1.4, fontWeight: past ? 700 : 400 }}>{step}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Risk Bars */}
                <div>
                  <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', marginBottom: 8, fontWeight: 800 }}>RISK PROPAGATION</div>
                  {[
                    { label: 'Supply Security', val: Math.min(95, Math.abs(importDeficit) * 28 + t * 1.5) },
                    { label: 'Price Stability',  val: Math.min(90, (brent - 82.5) * 2.5 + t * 0.8) },
                    { label: 'Refinery Ops',     val: Math.min(85, 100 - (refineries[0]?.runRate ?? 98)) },
                    { label: 'Energy Grid',      val: gridStress },
                    { label: 'GDP Impact',       val: Math.min(80, t * 1.8) },
                  ].map(r => (
                    <div key={r.label} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, color: '#475569', fontWeight: 600 }}>{r.label}</span>
                        <span style={{ fontSize: 8.5, fontWeight: 800,
                          color: r.val > 60 ? '#dc2626' : r.val > 35 ? '#d97706' : '#059669' }}>
                          {r.val.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', borderRadius: 2, width: `${r.val}%`,
                          background: r.val > 60 ? '#dc2626' : r.val > 35 ? '#d97706' : '#059669',
                          transition: 'width 0.5s ease',
                        }}/>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mitigations */}
                <div>
                  <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', marginBottom: 8, fontWeight: 800 }}>AI RECOMMENDED MITIGATIONS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[
                      { id: 'spr',     label: 'Release Padur SPR',       stars: '★★★★★', desc: 'Inject 0.9 mbpd reserve crude. Padur + Mangaluru caverns. Buffer: ~14 days.', impact: '+0.9 mbpd' },
                      { id: 'russian', label: 'Surge Russian Urals',      stars: '★★★★★', desc: 'Increase Siberian crude orders +0.7 mbpd. Cape-routed. +9d transit.',          impact: '+0.7 mbpd' },
                      { id: 'cape',    label: 'Activate Cape Reroute',    stars: '★★★★☆', desc: 'Divert Suez-bound tankers around Cape of Good Hope. +14d delay.',               impact: 'Transit secured' },
                      { id: 'spot',    label: 'Emergency Spot Purchases', stars: '★★★☆☆', desc: 'Buy Nigerian Bonny Light on spot market. Freight premium ~35%.',                impact: '+0.3 mbpd' },
                    ].map(action => {
                      const approved = approvedActions.has(action.id)
                      return (
                        <div key={action.id} style={{
                          background: approved ? '#ecfdf5' : '#ffffff',
                          border: approved ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                          borderRadius: 7, padding: '8px 11px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: approved ? '#059669' : '#d97706' }}>
                              {action.stars} {action.label}
                            </span>
                            {approved && <span style={{ fontSize: 7.5, color: '#059669', fontWeight: 800, padding: '1px 5px', background: '#d1fae5', borderRadius: 4 }}>APPROVED</span>}
                          </div>
                          <p style={{ fontSize: 8.5, color: '#475569', margin: '0 0 6px 0', lineHeight: 1.4 }}>{action.desc}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 8.5, color: '#2563eb', fontWeight: 700 }}>{action.impact}</span>
                            <button onClick={() => {
                              const s = new Set(approvedActions)
                              if (s.has(action.id)) s.delete(action.id); else s.add(action.id)
                              setApprovedActions(s)
                            }} style={{
                              background: approved ? '#d1fae5' : '#fef3c7',
                              border: approved ? '1px solid #6ee7b7' : '1px solid #fde68a',
                              borderRadius: 4, padding: '4px 10px',
                              color: approved ? '#047857' : '#b45309',
                              fontSize: 8.5, fontWeight: 800, cursor: 'pointer',
                            }}>
                              {approved ? '✓ Approved' : 'Approve'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Decision Log */}
                {approvedActions.size > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', marginBottom: 6, fontWeight: 800 }}>DECISION LOG</div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 9 }}>
                      {Array.from(approvedActions).map(act => (
                        <div key={act} style={{ fontSize: 8.5, color: '#059669', marginBottom: 3, display: 'flex', gap: 6, fontWeight: 600 }}>
                          <span style={{ color: '#94a3b8' }}>{new Date().toTimeString().split(' ')[0]}</span>
                          <span>✓ {act.toUpperCase()} approved — Day {simDay}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: '#ffffff',
    border: `1px solid ${color}`,
    borderRadius: 5,
    padding: '6px 13px',
    color,
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.5px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    fontFamily: "'JetBrains Mono', monospace",
  }
}
