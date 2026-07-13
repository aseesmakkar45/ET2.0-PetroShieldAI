'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, RotateCcw, Check, ShieldAlert, AlertTriangle, Globe, Database,
  TrendingUp, Zap, Share2, Sliders, ChevronRight, Shield, RefreshCw, Send,
  Layers, Info, Thermometer, Clock, HelpCircle, Activity, ShoppingCart, ExternalLink
} from 'lucide-react'

// Types for simulation state
interface ShipState {
  id: string
  name: string
  cargo: string // e.g. "2.1M Barrels Urals"
  origin: string
  destination: string
  baseRoute: 'normal' | 'cape' | 'persian_gulf'
  speed: number
  progress: number // 0 to 100%
  status: 'normal' | 'stopped' | 'rerouting' | 'waiting'
  transitTime: number // days
  cost: number // $ millions
}

interface PortState {
  id: string
  name: string
  inventory: number // %
  berthUtilization: number // %
  shipsWaiting: number
  unloadingRate: number // mbpd
  status: 'normal' | 'congested' | 'critical'
}

interface RefineryState {
  id: string
  name: string
  inventory: number // %
  runRate: number // %
  blend: string // e.g. "Arab Light 60% / Urals 40%"
  throughput: number // mbpd
  status: 'normal' | 'reduced' | 'critical'
}

interface SPRState {
  id: string
  name: string
  fillLevel: number // %
  releaseRate: number // mbpd
  daysRemaining: number
  active: boolean
}

interface AIEvent {
  id: string
  event: string
  probability: number
  confidence: number
  duration: number
  severity: 'Critical' | 'Elevated' | 'Moderate'
  affectedSuppliers: string[]
  source: string[]
  desc: string
}

export default function FlagshipDigitalTwin() {
  // ─── STATE MANAGEMENT ──────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [simulationDay, setSimulationDay] = useState<number>(0)
  const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('LIVE')
  const [currentScenario, setCurrentScenario] = useState<string>('None')
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai')
  const [autoMode, setAutoMode] = useState<boolean>(true)
  
  // Custom user inputs for manual tab
  const [manualScenario, setManualScenario] = useState<string>('hormuz')
  const [manualDuration, setManualDuration] = useState<number>(14)
  const [manualSeverity, setManualSeverity] = useState<string>('Critical')
  const [manualProbability, setManualProbability] = useState<number>(85)

  // Geopolitical news alert state
  const [alertNotification, setAlertNotification] = useState<AIEvent | null>(null)
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false)

  // Tracking user-approved mitigation recommendations
  const [approvedMitigations, setApprovedMitigations] = useState<Set<string>>(new Set())

  // Simulation Clock
  const [clockTime, setClockTime] = useState<string>('08:34:12')
  
  // Ref for the timeline interval
  const simInterval = useRef<NodeJS.Timeout | null>(null)

  // ─── BASELINE DATA DEFINITIONS ─────────────────────────────────────────────
  const BASE_SHIPS: ShipState[] = [
    { id: 'ship_russia', name: 'Siberian Star', cargo: '2.0M Bbls Urals', origin: 'Novorossiysk', destination: 'Sikka', baseRoute: 'normal', speed: 14, progress: 35, status: 'normal', transitTime: 16, cost: 3.2 },
    { id: 'ship_iraq', name: 'Mesopotamia Sovereign', cargo: '1.8M Bbls Basrah Light', origin: 'Basrah', destination: 'Vadinar', baseRoute: 'persian_gulf', speed: 13, progress: 60, status: 'normal', transitTime: 7, cost: 1.4 },
    { id: 'ship_saudi', name: 'Ghawar Pioneer', cargo: '2.2M Bbls Arab Light', origin: 'Ras Tanura', destination: 'Sikka', baseRoute: 'persian_gulf', speed: 15, progress: 45, status: 'normal', transitTime: 6, cost: 1.2 },
    { id: 'ship_uae', name: 'Zayed Al-Khair', cargo: '1.5M Bbls Murban', origin: 'Fujairah', destination: 'Kochi', baseRoute: 'normal', speed: 14, progress: 75, status: 'normal', transitTime: 5, cost: 1.1 },
    { id: 'ship_kuwait', name: 'Burgan Carrier', cargo: '1.6M Bbls Kuwait Super Light', origin: 'Mina Al-Ahmadi', destination: 'Mangaluru', baseRoute: 'persian_gulf', speed: 13, progress: 20, status: 'normal', transitTime: 7, cost: 1.5 }
  ]

  const BASE_PORTS: PortState[] = [
    { id: 'port_sikka', name: 'Sikka Port', inventory: 82, berthUtilization: 68, shipsWaiting: 1, unloadingRate: 3.4, status: 'normal' },
    { id: 'port_vadinar', name: 'Vadinar Port', inventory: 78, berthUtilization: 72, shipsWaiting: 2, unloadingRate: 2.1, status: 'normal' },
    { id: 'port_kochi', name: 'Kochi Port', inventory: 85, berthUtilization: 55, shipsWaiting: 0, unloadingRate: 1.2, status: 'normal' },
    { id: 'port_mangaluru', name: 'Mangaluru Port', inventory: 74, berthUtilization: 60, shipsWaiting: 1, unloadingRate: 1.5, status: 'normal' }
  ]

  const BASE_REFINERIES: RefineryState[] = [
    { id: 'ref_jamnagar', name: 'Reliance Jamnagar', inventory: 76, runRate: 98, blend: 'Arab Light 55% / Urals 45%', throughput: 1.24, status: 'normal' },
    { id: 'ref_kochi', name: 'BPCL Kochi', inventory: 80, runRate: 94, blend: 'Murban 50% / Basrah 50%', throughput: 0.31, status: 'normal' },
    { id: 'ref_mangaluru', name: 'MRPL Mangaluru', inventory: 72, runRate: 92, blend: 'Kuwait Export 60% / Urals 40%', throughput: 0.30, status: 'normal' }
  ]

  const BASE_SPRS: SPRState[] = [
    { id: 'spr_padur', name: 'Padur SPR', fillLevel: 94, releaseRate: 0.0, daysRemaining: 0, active: false },
    { id: 'spr_mangaluru', name: 'Mangaluru SPR', fillLevel: 88, releaseRate: 0.0, daysRemaining: 0, active: false },
    { id: 'spr_vizag', name: 'Visakhapatnam SPR', fillLevel: 75, releaseRate: 0.0, daysRemaining: 0, active: false }
  ]

  const AI_EVENTS: AIEvent[] = [
    {
      id: 'evt_hormuz',
      event: 'Strait of Hormuz Closure',
      probability: 82,
      confidence: 91,
      duration: 14,
      severity: 'Critical',
      affectedSuppliers: ['Saudi Arabia', 'Iraq', 'UAE', 'Kuwait'],
      source: ['Reuters', 'AIS Marine Traffic', 'Sentinel-2 Satellites'],
      desc: 'Escalating regional conflict: Iran deploys naval blockades shutting down 100% of tankers crossing the Strait of Hormuz.'
    },
    {
      id: 'evt_redsea',
      event: 'Red Sea Ship Attack',
      probability: 74,
      confidence: 88,
      duration: 10,
      severity: 'Elevated',
      affectedSuppliers: ['Russia (Suez Transit)', 'Mediterranean Crude'],
      source: ['Lloyds List', 'UKMTO', 'Naval Command'],
      desc: 'Asymmetric drone attacks inside the Bab-el-Mandeb strait forcing global reroutes around the Cape of Good Hope.'
    },
    {
      id: 'evt_opec',
      event: 'OPEC+ Emergency Supply Cuts',
      probability: 90,
      confidence: 95,
      duration: 30,
      severity: 'Elevated',
      affectedSuppliers: ['OPEC Basket'],
      source: ['OPEC Secretariat', 'Platts', 'Bloomberg Energy'],
      desc: 'Voluntary OPEC quota reduction of 2.0 mbpd led by Saudi Arabia to stabilize global prices amid slowing demand forecasts.'
    }
  ]

  // ─── RUNNING SIMULATION LOGIC ──────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      simInterval.current = setInterval(() => {
        setSimulationDay(prev => {
          if (prev >= 30) {
            setIsPlaying(false)
            return 30
          }
          return prev + 1
        })
        
        const now = new Date()
        setClockTime(now.toTimeString().split(' ')[0])
      }, 1500)
    } else {
      if (simInterval.current) clearInterval(simInterval.current)
    }
    
    return () => {
      if (simInterval.current) clearInterval(simInterval.current)
    }
  }, [isPlaying])

  useEffect(() => {
    if (mode === 'LIVE') {
      const timer = setTimeout(() => {
        if (!alertDismissed) {
          setAlertNotification(AI_EVENTS[0])
        }
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [mode, alertDismissed])

  const triggerSimulation = (scenarioName: string, scenarioId: string) => {
    setMode('SIMULATION')
    setCurrentScenario(scenarioName)
    setSimulationDay(0)
    setIsPlaying(true)
    setAlertNotification(null)
    setApprovedMitigations(new Set())
  }

  const resetToLive = () => {
    setMode('LIVE')
    setCurrentScenario('None')
    setSimulationDay(0)
    setIsPlaying(false)
    setApprovedMitigations(new Set())
    setAlertDismissed(false)
  }

  const isHormuz = currentScenario === 'Strait of Hormuz Closure' || currentScenario === 'Hormuz Closure'
  const isRedSea = currentScenario === 'Red Sea Ship Attack' || currentScenario === 'Red Sea Suspension' || currentScenario === 'Bab-el-Mandeb Blockade'
  const isOPEC = currentScenario === 'OPEC+ Emergency Supply Cuts' || currentScenario === 'OPEC Cuts'

  const t = simulationDay
  const padurSPRActive = approvedMitigations.has('spr_padur')
  const basrahRedirectActive = approvedMitigations.has('basrah_redirect')
  const RussianImportsActive = approvedMitigations.has('russian_urals')
  const kochiRefineryActive = approvedMitigations.has('kochi_throughput')

  let importShortfall = 0.0
  if (mode === 'SIMULATION') {
    if (isHormuz) {
      importShortfall = -2.4
      if (RussianImportsActive) importShortfall += 0.7
      if (basrahRedirectActive) importShortfall += 0.5
      if (padurSPRActive) importShortfall += 0.9
    } else if (isRedSea) {
      importShortfall = -0.8
      if (RussianImportsActive) importShortfall += 0.4
      if (padurSPRActive) importShortfall += 0.4
    } else if (isOPEC) {
      importShortfall = -1.2
      if (RussianImportsActive) importShortfall += 0.6
    }
    
    importShortfall = parseFloat((importShortfall * Math.min(1.2, 0.6 + t * 0.02)).toFixed(2))
    if (importShortfall > 0) importShortfall = 0
  }

  let brentPrice = 82.50
  if (mode === 'SIMULATION') {
    let priceSpike = 0
    if (isHormuz) priceSpike = Math.min(30, t * 2.5)
    else if (isRedSea) priceSpike = Math.min(12, t * 1.0)
    else if (isOPEC) priceSpike = Math.min(15, t * 1.2)

    let damping = 0
    if (padurSPRActive) damping += 4.5
    if (RussianImportsActive) damping += 3.0

    brentPrice = parseFloat((82.50 + Math.max(0, priceSpike - damping)).toFixed(2))
  }

  const fuelPrice = parseFloat((96.50 + (brentPrice - 82.50) * 0.45).toFixed(2))
  const gdpImpact = mode === 'SIMULATION' ? parseFloat((Math.abs(importShortfall) * 14.5 * t).toFixed(1)) : 0.0
  const gridStress = mode === 'SIMULATION' ? Math.min(100, Math.floor(45 + Math.abs(importShortfall) * 12 + (t * 0.5) - (padurSPRActive ? 8 : 0))) : 45
  const demandSatisfaction = mode === 'SIMULATION' ? Math.max(65, Math.floor(100 - Math.abs(importShortfall) * 10 - (t * 0.4) + (padurSPRActive ? 8 : 0))) : 100

  // Vessel positions calculation
  const currentShips: ShipState[] = BASE_SHIPS.map(ship => {
    let newShip = { ...ship }
    if (isPlaying) {
      newShip.progress = Math.min(100, ship.progress + t * 1.5)
    }

    if (mode === 'SIMULATION') {
      if (isHormuz) {
        if (ship.baseRoute === 'persian_gulf') {
          newShip.status = 'stopped'
          newShip.progress = Math.min(48, ship.progress)
          newShip.cost = parseFloat((ship.cost * 1.45).toFixed(2))
        } else if (ship.id === 'ship_russia') {
          newShip.status = 'rerouting'
          newShip.transitTime = 24
          newShip.cost = parseFloat((ship.cost * 1.35).toFixed(2))
        }
      } else if (isRedSea) {
        if (ship.id === 'ship_russia') {
          newShip.status = 'rerouting'
          newShip.transitTime = 25
          newShip.cost = parseFloat((ship.cost * 1.50).toFixed(2))
        }
      }
    }
    return newShip
  })

  // Ports calculation
  const currentPorts: PortState[] = BASE_PORTS.map(port => {
    let newPort = { ...port }
    if (mode === 'SIMULATION') {
      let lossRate = isHormuz ? (port.id === 'port_sikka' || port.id === 'port_vadinar' ? 0.9 : 0.4) : 0.3
      let recovery = 0
      if (padurSPRActive && (port.id === 'port_sikka' || port.id === 'port_mangaluru')) recovery += 0.5
      if (RussianImportsActive) recovery += 0.2

      newPort.inventory = Math.max(25, Math.floor(port.inventory - (lossRate - recovery) * t))
      newPort.shipsWaiting = port.shipsWaiting + (isHormuz && (port.id === 'port_sikka') ? Math.floor(t * 0.25) : 0)
      newPort.berthUtilization = Math.min(100, Math.floor(port.berthUtilization + newPort.shipsWaiting * 2))
      newPort.unloadingRate = parseFloat(Math.max(0.4, port.unloadingRate - (isHormuz ? 0.1 * t : 0.05 * t) + recovery).toFixed(2))
      
      if (newPort.inventory < 40) newPort.status = 'critical'
      else if (newPort.inventory < 60) newPort.status = 'congested'
    }
    return newPort
  })

  // Refineries calculation
  const currentRefineries: RefineryState[] = BASE_REFINERIES.map(ref => {
    let newRef = { ...ref }
    if (mode === 'SIMULATION') {
      const linkedPort = ref.id === 'ref_jamnagar' ? currentPorts[0] : (ref.id === 'ref_kochi' ? currentPorts[2] : currentPorts[3])
      newRef.inventory = Math.max(30, Math.floor(ref.inventory - (100 - linkedPort.inventory) * 0.35))
      
      let runLoss = 0
      if (newRef.inventory < 50) runLoss = (50 - newRef.inventory) * 1.2
      newRef.runRate = Math.max(60, Math.floor(ref.runRate - runLoss))
      
      if (kochiRefineryActive && ref.id === 'ref_kochi') {
        newRef.runRate = Math.min(100, newRef.runRate + 8)
      }

      newRef.throughput = parseFloat((ref.throughput * (newRef.runRate / 100)).toFixed(2))
      
      if (newRef.inventory < 40) newRef.status = 'critical'
      else if (newRef.inventory < 60) newRef.status = 'reduced'
    }
    return newRef
  })

  // SPRs calculation
  const currentSPRs: SPRState[] = BASE_SPRS.map(spr => {
    let newSpr = { ...spr }
    if (mode === 'SIMULATION') {
      if (spr.id === 'spr_padur' && padurSPRActive) {
        newSpr.active = true
        newSpr.releaseRate = 0.9
        newSpr.fillLevel = Math.max(0, parseFloat((spr.fillLevel - t * 1.2).toFixed(1)))
        newSpr.daysRemaining = Math.max(0, Math.floor((newSpr.fillLevel / 1.2) - t))
      }
    }
    return newSpr
  })

  const statesColors = {
    gujarat: demandSatisfaction > 90 ? '#10b981' : (demandSatisfaction > 75 ? '#fbbf24' : '#ef4444'),
    maharashtra: demandSatisfaction > 88 ? '#10b981' : (demandSatisfaction > 72 ? '#fbbf24' : '#ef4444'),
    karnataka: demandSatisfaction > 92 ? '#10b981' : (demandSatisfaction > 78 ? '#fbbf24' : '#ef4444'),
    delhi: demandSatisfaction > 85 ? '#10b981' : (demandSatisfaction > 70 ? '#fbbf24' : '#ef4444'),
    kerala: demandSatisfaction > 90 ? '#10b981' : (demandSatisfaction > 75 ? '#fbbf24' : '#ef4444')
  }

  return (
    <div style={{
      background: '#040810',
      color: '#e2e8f0',
      fontFamily: "'Inter', sans-serif",
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '4px 0 8px 0',
      overflow: 'hidden'
    }}>
      
      {/* ── REGION 1: SIMULATION HEADER ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7, 12, 24, 0.95)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: mode === 'LIVE' ? '#10b981' : '#ef4444',
              boxShadow: mode === 'LIVE' ? '0 0 12px #10b981' : '0 0 12px #ef4444',
              animation: mode === 'SIMULATION' ? 'pulse 1.5s infinite' : 'none'
            }} />
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1px', color: mode === 'LIVE' ? '#10b981' : '#f87171' }}>
              {mode} MODE
            </span>
          </div>

          <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Scenario</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
              {mode === 'LIVE' ? 'Live Feeds Operational' : currentScenario}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)' }} />

          <div style={{ display: 'flex', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Simulation Clock</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {mode === 'LIVE' ? clockTime : `Day ${t} / 30`}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)', paddingRight: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>National Risk Level</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: mode === 'LIVE' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldAlert size={14} />
              {mode === 'LIVE' ? '21.5% - Low' : `${Math.floor(21.5 + Math.abs(importShortfall) * 20)}% - ${Math.abs(importShortfall) > 1.5 ? 'CRITICAL' : 'ELEVATED'}`}
            </div>
          </div>

          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)', paddingRight: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Estimated Import Deficit</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: importShortfall < 0 ? '#ef4444' : '#10b981' }}>
              {importShortfall} mbpd
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Crude Price (Brent)</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: mode === 'LIVE' ? '#3b82f6' : '#ef4444' }}>
              ${brentPrice} / bbl
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {mode === 'SIMULATION' && (
            <>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: isPlaying ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  color: isPlaying ? '#f87171' : '#34d399',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12
                }}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'Pause' : 'Resume'}
              </button>
              
              <button
                onClick={() => setSimulationDay(0)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                <RotateCcw size={14} />
                Restart
              </button>
            </>
          )}

          <button
            onClick={resetToLive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: mode === 'LIVE' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.15)',
              border: mode === 'LIVE' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(59, 130, 246, 0.4)',
              padding: '6px 12px',
              borderRadius: 6,
              color: mode === 'LIVE' ? '#94a3b8' : '#60a5fa',
              cursor: mode === 'LIVE' ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
            disabled={mode === 'LIVE'}
          >
            <RefreshCw size={14} className={isPlaying ? 'animate-spin' : ''} />
            Reset to Live
          </button>
        </div>
      </header>

      {/* ── AUTONOMOUS EVENT NOTIFICATION BANNER ── */}
      <AnimatePresence>
        {alertNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              margin: '0 16px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 0 20px rgba(220, 38, 38, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                background: 'rgba(220, 38, 38, 0.2)',
                borderRadius: '50%',
                padding: 6,
                animation: 'pulse 1s infinite'
              }}>
                <ShieldAlert size={18} color="#ef4444" />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  ⚠ Geopolitical Risk Detected by AI News Agent
                </span>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0 0', color: '#f1f5f9' }}>
                  {alertNotification.event} (Confidence: {alertNotification.confidence}%)
                </h4>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0 0 0', maxWidth: 800 }}>
                  {alertNotification.desc}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => triggerSimulation(alertNotification.event, alertNotification.id)}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
                }}
              >
                Simulate Disruption Cascade
              </button>
              <button
                onClick={() => setAlertNotification(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'var(--color-text-secondary)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid View */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 320px',
        gap: 10,
        padding: '0 12px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        
        {/* ── REGION 2: SCENARIO CONTROL PANEL ── */}
        <aside className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)'
          }}>
            <button
              onClick={() => setActiveTab('ai')}
              style={{
                padding: '10px 0',
                background: activeTab === 'ai' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'ai' ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === 'ai' ? '#60a5fa' : 'var(--color-text-secondary)',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
            >
              LIVE AI THREATS
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              style={{
                padding: '10px 0',
                background: activeTab === 'manual' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'manual' ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === 'manual' ? '#60a5fa' : 'var(--color-text-secondary)',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
            >
              MANUAL INJECTION
            </button>
          </div>

          <div style={{ padding: 14, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeTab === 'ai' ? (
              <>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Activity size={12} color="#10b981" />
                    Autonomous Mode
                  </span>
                  <input
                    type="checkbox"
                    checked={autoMode}
                    onChange={(e) => setAutoMode(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {AI_EVENTS.map(evt => (
                    <div
                      key={evt.id}
                      style={{
                        background: currentScenario === evt.event ? 'rgba(239, 68, 68, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                        border: currentScenario === evt.event ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: evt.severity === 'Critical' ? '#f87171' : '#fbbf24' }}>
                          ⚠ {evt.event}
                        </span>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '1px 6px',
                          background: evt.severity === 'Critical' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                          color: evt.severity === 'Critical' ? '#f87171' : '#fbbf24',
                          borderRadius: 4
                        }}>
                          {evt.severity}
                        </span>
                      </div>
                      
                      <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        {evt.desc}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, color: 'var(--color-text-muted)' }}>
                        <div>Prob: <strong style={{ color: '#e2e8f0' }}>{evt.probability}%</strong></div>
                        <div>Conf: <strong style={{ color: '#e2e8f0' }}>{evt.confidence}%</strong></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 8, color: 'var(--color-text-muted)' }}>
                          Sources: {evt.source.slice(0, 2).join(', ')}
                        </span>
                        
                        <button
                          onClick={() => triggerSimulation(evt.event, evt.id)}
                          disabled={currentScenario === evt.event}
                          style={{
                            background: currentScenario === evt.event ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.15)',
                            border: currentScenario === evt.event ? '1px solid transparent' : '1px solid rgba(59, 130, 246, 0.3)',
                            color: currentScenario === evt.event ? 'var(--color-text-muted)' : '#60a5fa',
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: currentScenario === evt.event ? 'default' : 'pointer'
                          }}
                        >
                          {currentScenario === evt.event ? 'Active' : 'Run Simulation'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Select Threat Vector</label>
                  <select
                    value={manualScenario}
                    onChange={(e) => setManualScenario(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0a0f1d',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6,
                      padding: 8,
                      color: '#f1f5f9',
                      outline: 'none'
                    }}
                  >
                    <option value="hormuz">Strait of Hormuz Blockade</option>
                    <option value="redsea">Bab-el-Mandeb Red Sea Attack</option>
                    <option value="opec">OPEC+ Emergency Cutbacks</option>
                    <option value="cyclone">Cyclone Sagar (Gujarat Coast)</option>
                    <option value="refinery">Refinery Power Outage (Mangaluru)</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ color: 'var(--color-text-secondary)' }}>Target Duration</label>
                    <span className="mono" style={{ color: '#60a5fa' }}>{manualDuration} Days</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={manualDuration}
                    onChange={(e) => setManualDuration(parseInt(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Disruption Severity</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {['Moderate', 'Elevated', 'Critical'].map(sev => (
                      <button
                        key={sev}
                        onClick={() => setManualSeverity(sev)}
                        style={{
                          background: manualSeverity === sev ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          border: manualSeverity === sev ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                          color: manualSeverity === sev ? '#60a5fa' : 'var(--color-text-secondary)',
                          padding: '6px 0',
                          borderRadius: 4,
                          fontSize: 10,
                          cursor: 'pointer'
                        }}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ color: 'var(--color-text-secondary)' }}>Trigger Probability</label>
                    <span className="mono" style={{ color: '#60a5fa' }}>{manualProbability}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={manualProbability}
                    onChange={(e) => setManualProbability(parseInt(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                <button
                  onClick={() => {
                    const titles: Record<string, string> = {
                      hormuz: 'Strait of Hormuz Closure',
                      redsea: 'Red Sea Ship Attack',
                      opec: 'OPEC+ Emergency Supply Cuts',
                      cyclone: 'Cyclone Coastal Interruption',
                      refinery: 'Refinery Technical Breakdown'
                    }
                    triggerSimulation(titles[manualScenario], manualScenario)
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    border: 'none',
                    borderRadius: 6,
                    padding: 10,
                    color: 'white',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 10,
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                  }}
                >
                  Inject Manual Event
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── REGION 3: THE DIGITAL TWIN (Synchronized Maps) ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'hidden' }}>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 10,
            flex: 1,
            minHeight: 0
          }}>
            
            {/* LEFT MAP: Global Supply Chain Twin */}
            <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={14} color="#3b82f6" />
                  GLOBAL SUPPLY CHAIN TWIN
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  AIS Vessel Tracking & Chokepoint Alerts
                </span>
              </div>

              {/* Cybernetic Styled SVG Map (Scaled Up & Centered) */}
              <div style={{ flex: 1, background: '#02050b', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)', position: 'relative', overflow: 'hidden' }}>
                <svg viewBox="0 0 850 550" style={{ width: '100%', height: '100%', display: 'block' }}>
                  
                  {/* Cyber Grid Lines */}
                  <defs>
                    <pattern id="map_grid_main" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#map_grid_main)" />

                  {/* HIGH-FIDELITY CYBER GEOGRAPHY OUTLINES (Centered and Enlarged) */}
                  {/* East Africa & Cape of Good Hope */}
                  <path d="M 20,250 C 60,260 80,310 90,360 C 110,400 90,460 70,520 L 10,520 Z" fill="#070e17" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* Middle East & Red Sea Basin */}
                  <path d="M 60,110 L 120,110 L 150,150 L 180,180 L 230,220 L 220,250 L 180,250 L 150,220 L 130,230 L 110,180 Z" fill="#070e17" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* Saudi Arabia & Arabian Peninsula */}
                  <path d="M 200,160 L 280,180 L 320,210 L 300,260 L 250,270 Q 220,220 200,160 Z" fill="#070e17" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                  {/* India (Enlarged & shifted to the right) */}
                  <path d="M 610,180 L 650,150 L 710,180 L 720,270 L 670,360 L 655,390 L 640,360 L 610,310 L 590,260 Z" fill="#0a1524" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

                  {/* Shipping Lanes (Polylines) */}
                  {/* Route 1: Ras Tanura -> Hormuz -> Sikka */}
                  <path
                    d="M 285,200 Q 350,205 380,220 T 630,280"
                    fill="none"
                    stroke={isHormuz ? '#ef4444' : '#3b82f6'}
                    strokeWidth={isHormuz ? 2.5 : 2}
                    strokeDasharray={isHormuz ? '5 5' : 'none'}
                    opacity={0.8}
                  />

                  {/* Route 2: Basrah -> Hormuz -> Vadinar */}
                  <path
                    d="M 270,180 Q 340,190 380,220 T 630,270"
                    fill="none"
                    stroke={isHormuz ? '#ef4444' : '#3b82f6'}
                    strokeWidth={isHormuz ? 2.5 : 2}
                    strokeDasharray={isHormuz ? '5 5' : 'none'}
                    opacity={0.8}
                  />

                  {/* Route 3: Russia (Novorossiysk) via Suez/Red Sea -> India */}
                  <path
                    d="M 120,110 L 150,150 L 220,260 Q 380,310 630,290"
                    fill="none"
                    stroke={isRedSea ? '#ef4444' : '#10b981'}
                    strokeWidth={isRedSea ? 2.5 : 2}
                    strokeDasharray={isRedSea ? '5 5' : 'none'}
                    opacity={0.8}
                  />

                  {/* Bypass Route: Russia Cape Reroute (Green glowing path) */}
                  {(isRedSea || isHormuz) && (
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      d="M 70,510 Q 200,530 400,510 T 650,380"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      opacity={0.9}
                    />
                  )}

                  {/* Animating flow particles (dash arrays that move using CSS keyframe animations) */}
                  {!isHormuz && (
                    <path
                      d="M 285,200 Q 350,205 380,220 T 630,280"
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="2.5"
                      strokeDasharray="12 150"
                      strokeDashoffset={isPlaying ? t * 18 : 0}
                      opacity="0.9"
                    />
                  )}

                  {/* Active Chokepoint Markers */}
                  {/* Strait of Hormuz */}
                  <g transform="translate(380, 220)">
                    <circle r="14" fill={isHormuz ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.12)'} />
                    <circle r="5" fill={isHormuz ? '#ef4444' : '#3b82f6'} />
                    <text x="12" y="4" fontSize="10" fontWeight="800" fill={isHormuz ? '#ef4444' : '#f1f5f9'} letterSpacing="0.5px">HORMUZ</text>
                  </g>

                  {/* Bab-el-Mandeb */}
                  <g transform="translate(220, 260)">
                    <circle r="14" fill={isRedSea ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.12)'} />
                    <circle r="5" fill={isRedSea ? '#ef4444' : '#3b82f6'} />
                    <text x="-90" y="4" fontSize="10" fontWeight="800" fill={isRedSea ? '#ef4444' : '#f1f5f9'} letterSpacing="0.5px">BAB-EL-MANDEB</text>
                  </g>

                  {/* Ships Positioning and Motion */}
                  {currentShips.map(ship => {
                    let cx = 400
                    let cy = 300
                    
                    if (ship.id === 'ship_saudi') {
                      const pct = ship.progress / 100
                      if (ship.status === 'stopped') {
                        cx = 330
                        cy = 205
                      } else {
                        // Interpolate along path M 285,200 -> 380,220 -> 630,280
                        if (pct < 0.3) {
                          const subPct = pct / 0.3
                          cx = 285 + (380 - 285) * subPct
                          cy = 200 + (220 - 200) * subPct
                        } else {
                          const subPct = (pct - 0.3) / 0.7
                          cx = 380 + (630 - 380) * subPct
                          cy = 220 + (280 - 220) * subPct
                        }
                      }
                    } else if (ship.id === 'ship_iraq') {
                      const pct = ship.progress / 100
                      if (ship.status === 'stopped') {
                        cx = 320
                        cy = 190
                      } else {
                        if (pct < 0.3) {
                          const subPct = pct / 0.3
                          cx = 270 + (380 - 270) * subPct
                          cy = 180 + (220 - 180) * subPct
                        } else {
                          const subPct = (pct - 0.3) / 0.7
                          cx = 380 + (630 - 380) * subPct
                          cy = 220 + (270 - 220) * subPct
                        }
                      }
                    } else if (ship.id === 'ship_russia') {
                      const pct = ship.progress / 100
                      if (ship.status === 'rerouting') {
                        // Reroute path Q 200,530 -> 400,510 -> 650,380
                        cx = 70 + (650 - 70) * pct
                        cy = 510 + (380 - 510) * pct
                      } else {
                        // Normal Suez route M 120,110 -> 150,150 -> 220,260 -> 630,290
                        if (pct < 0.2) {
                          cx = 120 + (150 - 120) * (pct / 0.2)
                          cy = 110 + (150 - 110) * (pct / 0.2)
                        } else if (pct < 0.5) {
                          cx = 150 + (220 - 150) * ((pct - 0.2) / 0.3)
                          cy = 150 + (260 - 150) * ((pct - 0.2) / 0.3)
                        } else {
                          cx = 220 + (630 - 220) * ((pct - 0.5) / 0.5)
                          cy = 260 + (290 - 260) * ((pct - 0.5) / 0.5)
                        }
                      }
                    } else if (ship.id === 'ship_uae') {
                      const pct = ship.progress / 100
                      cx = 395 + (640 - 395) * pct
                      cy = 230 + (360 - 230) * pct
                    } else if (ship.id === 'ship_kuwait') {
                      const pct = ship.progress / 100
                      if (ship.status === 'stopped') {
                        cx = 340
                        cy = 210
                      } else {
                        cx = 310 + (635 - 310) * pct
                        cy = 200 + (330 - 200) * pct
                      }
                    }

                    return (
                      <g key={ship.id} transform={`translate(${cx}, ${cy})`}>
                        <circle
                          r={ship.status === 'stopped' ? 9 : 7}
                          fill={ship.status === 'stopped' ? 'rgba(239, 68, 68, 0.45)' : (ship.status === 'rerouting' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.25)')}
                          className={ship.status === 'stopped' ? 'animate-ping' : ''}
                        />
                        <polygon
                          points="-5,-2 0,-9 5,-2 3,7 -3,7"
                          fill={ship.status === 'stopped' ? '#ef4444' : (ship.status === 'rerouting' ? '#10b981' : '#3b82f6')}
                        />
                        <text x="8" y="-3" fontSize="9" fontWeight="700" fill="#f1f5f9" style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}>
                          {ship.name}
                        </text>
                      </g>
                    )
                  })}

                  {/* Destination India Terminal Node */}
                  <g transform="translate(630, 280)">
                    <circle r="18" fill="rgba(59, 130, 246, 0.18)" className="animate-pulse" />
                    <circle r="7" fill="#3b82f6" />
                    <text x="12" y="4" fontSize="11" fontWeight="800" fill="#60a5fa">INDIA TERMINALS</text>
                  </g>
                </svg>

                {/* Floating Status Box inside Map */}
                <div style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  background: 'rgba(7, 12, 24, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                    <span>Normal Transit</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span>Blocked / Delayed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span>Rerouted / Safe Route</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT MAP: India Operations Twin */}
            <div className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={14} color="#10b981" />
                  INDIA OPERATIONS TWIN
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  State Heatmap & Asset Real-time Run Rates
                </span>
              </div>

              {/* Cybernetic India Infrastructure Map (Expanded to fill card) */}
              <div style={{ flex: 1, background: '#02050b', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)', position: 'relative', overflow: 'hidden' }}>
                <svg viewBox="0 0 500 550" style={{ width: '100%', height: '100%', display: 'block' }}>
                  
                  {/* Cyber Grid Lines */}
                  <rect width="100%" height="100%" fill="url(#map_grid_main)" />

                  {/* India Borders (Enlarged and Centered to fill 500x550) */}
                  <polygon
                    points="220,15 270,30 330,55 350,90 320,150 400,180 430,225 350,260 360,310 330,360 290,430 250,510 235,490 200,430 180,380 150,330 110,285 100,240 145,190 180,150 200,70"
                    fill="#070e17"
                    stroke="rgba(255, 255, 255, 0.12)"
                    strokeWidth="1.8"
                  />

                  {/* Heatmap Glow Overlays for Demand Satisfaction */}
                  {/* Northern Zone */}
                  <circle cx="250" cy="110" r="60" fill={statesColors.delhi} opacity="0.08" />
                  <circle cx="250" cy="110" r="14" fill={statesColors.delhi} opacity="0.25" />

                  {/* Western Zone (Gujarat/Maharashtra) */}
                  <circle cx="140" cy="245" r="70" fill={statesColors.gujarat} opacity="0.08" />
                  <circle cx="140" cy="245" r="15" fill={statesColors.gujarat} opacity="0.25" />
                  
                  <circle cx="170" cy="325" r="75" fill={statesColors.maharashtra} opacity="0.08" />
                  <circle cx="170" cy="325" r="18" fill={statesColors.maharashtra} opacity="0.25" />

                  {/* Southern Zone (Karnataka/Kerala) */}
                  <circle cx="195" cy="425" r="65" fill={statesColors.karnataka} opacity="0.08" />
                  <circle cx="195" cy="425" r="14" fill={statesColors.karnataka} opacity="0.25" />

                  {/* Internal Pipelines (Glowing lines connecting ports to refineries) */}
                  {/* Sikka Port to Jamnagar Refinery */}
                  <path d="M 130,240 L 155,255" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="4 4" opacity="0.9" />
                  {/* Kochi Port to Kochi Refinery */}
                  <path d="M 210,480 L 225,480" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="4 4" opacity="0.9" />
                  {/* Mangaluru Port to Mangaluru Refinery */}
                  <path d="M 185,415 L 200,425" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="4 4" opacity="0.9" />
                  {/* Padur SPR cavern pipeline link */}
                  <path d="M 175,440 L 200,425" fill="none" stroke="#eab308" strokeWidth="2.5" strokeDasharray="5 2" opacity="0.8" />

                  {/* Asset Markers */}
                  {/* Sikka / Jamnagar */}
                  <g transform="translate(140, 245)">
                    <circle r="9" fill="rgba(249, 115, 22, 0.25)" className="animate-ping" />
                    <circle r="5" fill="#f97316" />
                    <text x="10" y="3" fontSize="9" fontWeight="700" fill="#e2e8f0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>Jamnagar Ref</text>
                  </g>

                  {/* Kochi */}
                  <g transform="translate(220, 480)">
                    <circle r="5" fill="#f97316" />
                    <text x="10" y="3" fontSize="9" fontWeight="700" fill="#e2e8f0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>Kochi Ref</text>
                  </g>

                  {/* Mangaluru */}
                  <g transform="translate(195, 420)">
                    <circle r="5" fill="#f97316" />
                    <text x="-70" y="-3" fontSize="9" fontWeight="700" fill="#e2e8f0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>Mangaluru Ref</text>
                  </g>

                  {/* SPR Cavern Padur */}
                  <g transform="translate(175, 440)">
                    <rect x="-5" y="-5" width="10" height="10" fill="#eab308" />
                    <text x="-52" y="14" fontSize="9" fontWeight="800" fill="#fbbf24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>Padur SPR</text>
                  </g>
                </svg>

                {/* Live Node Statistics Hover Display */}
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(7, 12, 24, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '12px',
                  borderRadius: 6,
                  width: 190,
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <span style={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 5, color: '#f1f5f9', letterSpacing: '0.3px' }}>
                    Asset Performance Status
                  </span>
                  
                  {/* Display Refinery stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>MRPL Run Rate:</span>
                      <span className="mono" style={{ fontWeight: 700, color: currentRefineries[2].runRate < 80 ? '#ef4444' : '#10b981' }}>
                        {currentRefineries[2].runRate}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Jamnagar Inv:</span>
                      <span className="mono" style={{ fontWeight: 700, color: currentRefineries[0].inventory < 50 ? '#ef4444' : '#fbbf24' }}>
                        {currentRefineries[0].inventory}%
                      </span>
                    </div>
                  </div>

                  {/* Display Port stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Sikka Waiting:</span>
                      <span className="mono" style={{ fontWeight: 700, color: currentPorts[0].shipsWaiting > 2 ? '#ef4444' : '#f1f5f9' }}>
                        {currentPorts[0].shipsWaiting} ships
                      </span>
                    </div>
                  </div>

                  {/* Display SPR status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Padur Level:</span>
                      <span className="mono" style={{ color: '#eab308', fontWeight: 800 }}>
                        {currentSPRs[0].fillLevel}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── REGION 4: SIMULATION TIMELINE ── */}
          <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#60a5fa" />
                CRITICAL FORECAST TIMELINE
              </span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
                Day {t} of 30
              </span>
            </div>

            {/* Custom Interactive Timeline Range Slider */}
            <div style={{ position: 'relative', padding: '10px 0' }}>
              <input
                type="range"
                min="0"
                max="30"
                value={t}
                onChange={(e) => {
                  setSimulationDay(parseInt(e.target.value))
                  if (isPlaying) setIsPlaying(false) // Pause auto-play on manual scrub
                  if (mode === 'LIVE') setMode('SIMULATION')
                }}
                style={{
                  width: '100%',
                  height: 6,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 4,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none'
                }}
              />
              
              {/* Timeline Interval Labels */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--color-text-muted)',
                marginTop: 6,
                fontWeight: 600
              }}>
                <span style={{ color: t === 0 ? '#60a5fa' : 'inherit', cursor: 'pointer' }} onClick={() => setSimulationDay(0)}>Today</span>
                <span style={{ color: t === 1 ? '#60a5fa' : 'inherit', cursor: 'pointer' }} onClick={() => setSimulationDay(1)}>+1 Day</span>
                <span style={{ color: t === 3 ? '#60a5fa' : 'inherit', cursor: 'pointer' }} onClick={() => setSimulationDay(3)}>+3 Days</span>
                <span style={{ color: t === 7 ? '#60a5fa' : 'inherit', cursor: 'pointer' }} onClick={() => setSimulationDay(7)}>+7 Days</span>
                <span style={{ color: t === 14 ? '#60a5fa' : 'inherit', cursor: 'pointer' }} onClick={() => setSimulationDay(14)}>+14 Days</span>
                <span style={{ color: t === 30 ? '#60a5fa' : 'inherit', cursor: 'pointer' }} onClick={() => setSimulationDay(30)}>+30 Days</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── REGION 5: AI IMPACT & RESPONSE PANEL ── */}
        <aside className="glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto' }}>
          
          {/* Section A: Supply Chain Impact Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
              <TrendingUp size={14} color="#f87171" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Supply Chain Impact (Day {t})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>National Demand Satisfaction:</span>
                <span style={{ fontWeight: 700, color: demandSatisfaction > 85 ? '#10b981' : '#ef4444' }}>
                  {demandSatisfaction}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Refinery Avg Run Rate:</span>
                <span style={{ fontWeight: 700, color: currentRefineries[2].runRate > 80 ? '#10b981' : '#fbbf24' }}>
                  {Math.floor((currentRefineries[0].runRate + currentRefineries[1].runRate + currentRefineries[2].runRate) / 3)}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Fuel Pump Price Spike:</span>
                <span className="mono" style={{ fontWeight: 700, color: mode === 'LIVE' ? '#e2e8f0' : '#ef4444' }}>
                  {fuelPrice} INR/L
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Cumulative GDP Impact:</span>
                <span className="mono" style={{ fontWeight: 700, color: gdpImpact > 0 ? '#ef4444' : '#e2e8f0' }}>
                  -${gdpImpact}M USD
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Power Grid Stress Index:</span>
                <span className="mono" style={{ fontWeight: 700, color: gridStress > 60 ? '#ef4444' : '#10b981' }}>
                  {gridStress} / 100
                </span>
              </div>
            </div>
          </div>

          {/* Section B: AI Recommended Actions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
              <Zap size={14} color="#fbbf24" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                AI Recommended Actions
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* Recommendation 1: SPR Release */}
              <div style={{
                background: approvedMitigations.has('spr_padur') ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                border: approvedMitigations.has('spr_padur') ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                padding: 10,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>★★★★★ Release Padur SPR</span>
                  {approvedMitigations.has('spr_padur') && (
                    <span style={{ fontSize: 8, color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>Active</span>
                  )}
                </div>
                <p style={{ fontSize: 9, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                  Inject 0.9 mbpd of crude reserves to Sikka/Mangaluru pipelines. Stabilizes refinery input for 14 days.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Estimated Buffer: +6 Days</span>
                  <button
                    onClick={() => {
                      const prev = new Set(approvedMitigations)
                      if (prev.has('spr_padur')) prev.delete('spr_padur')
                      else prev.add('spr_padur')
                      setApprovedMitigations(prev)
                    }}
                    style={{
                      background: approvedMitigations.has('spr_padur') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      border: approvedMitigations.has('spr_padur') ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                      color: approvedMitigations.has('spr_padur') ? '#10b981' : '#e2e8f0',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {approvedMitigations.has('spr_padur') ? 'Approved' : 'Approve'}
                  </button>
                </div>
              </div>

              {/* Recommendation 2: Russian Urals Import */}
              <div style={{
                background: approvedMitigations.has('russian_urals') ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                border: approvedMitigations.has('russian_urals') ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                padding: 10,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>★★★★★ Increase Russian Imports</span>
                  {approvedMitigations.has('russian_urals') && (
                    <span style={{ fontSize: 8, color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>Active</span>
                  )}
                </div>
                <p style={{ fontSize: 9, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                  Increase Siberian Star & Urals imports by 0.7 mbpd. Circumvents Persian Gulf via northern sea corridors.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Savings: $4.2M USD</span>
                  <button
                    onClick={() => {
                      const prev = new Set(approvedMitigations)
                      if (prev.has('russian_urals')) prev.delete('russian_urals')
                      else prev.add('russian_urals')
                      setApprovedMitigations(prev)
                    }}
                    style={{
                      background: approvedMitigations.has('russian_urals') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      border: approvedMitigations.has('russian_urals') ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                      color: approvedMitigations.has('russian_urals') ? '#10b981' : '#e2e8f0',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {approvedMitigations.has('russian_urals') ? 'Approved' : 'Approve'}
                  </button>
                </div>
              </div>

              {/* Recommendation 3: Basrah reroute */}
              <div style={{
                background: approvedMitigations.has('basrah_redirect') ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                border: approvedMitigations.has('basrah_redirect') ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                padding: 10,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#a3a3a3' }}>★★★★☆ Increase Basrah Imports</span>
                </div>
                <p style={{ fontSize: 9, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                  Direct Iraq cargos via alternative pipeline ports in Turkey to bypass Hormuz constraints.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Flow Spike: +0.5 mbpd</span>
                  <button
                    onClick={() => {
                      const prev = new Set(approvedMitigations)
                      if (prev.has('basrah_redirect')) prev.delete('basrah_redirect')
                      else prev.add('basrah_redirect')
                      setApprovedMitigations(prev)
                    }}
                    style={{
                      background: approvedMitigations.has('basrah_redirect') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      border: approvedMitigations.has('basrah_redirect') ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                      color: approvedMitigations.has('basrah_redirect') ? '#10b981' : '#e2e8f0',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {approvedMitigations.has('basrah_redirect') ? 'Approved' : 'Approve'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </aside>

      </div>
    </div>
  )
}
