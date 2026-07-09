'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import Topbar from '@/components/layout/Topbar'
import KPICard from '@/components/dashboard/KPICard'
import AlertFeed from '@/components/dashboard/AlertFeed'
import EnergyResilienceGauge from '@/components/dashboard/EnergyResilienceGauge'
import { getDashboard, getMapData } from '@/services/api'
import { Activity, Cpu, MapPin, TrendingUp } from 'lucide-react'

// Dynamically import map to avoid SSR issues
const GlobalMap = dynamic(() => import('@/components/map/GlobalMap'), { ssr: false })

export default function CommandCenterPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 30000,
  })

  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['map'],
    queryFn: getMapData,
    refetchInterval: 10000,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar title="Command Center" subtitle="Global Energy Supply Chain Intelligence" />
      
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px' }}>
        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />
              ))
            : dashboard?.kpi_cards.map((card, i) => (
                <KPICard key={card.id} card={card} index={i} />
              ))
          }
        </div>

        {/* Main content: Map + Right Panel */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, minHeight: 0 }}>
          {/* Map */}
          <div className="glass-card" style={{ overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 12, left: 12,
              zIndex: 1000,
              background: 'rgba(8, 12, 20, 0.85)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 11,
              color: '#60a5fa',
              fontWeight: 600,
              letterSpacing: '0.5px',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <MapPin size={11} />
              LIVE AIS TRACKING — {mapData?.vessels?.length ?? 0} VESSELS
            </div>

            {mapLoading ? (
              <div className="skeleton" style={{ height: '100%', borderRadius: 16 }} />
            ) : (
              <GlobalMap mapData={mapData} />
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
            {/* Resilience gauge */}
            <EnergyResilienceGauge score={dashboard?.energy_resilience_score ?? 62} loading={isLoading} />

            {/* Alerts feed */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <AlertFeed signals={dashboard?.top_risks ?? []} loading={isLoading} />
            </div>

            {/* Recommendations */}
            <div className="glass-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Cpu size={13} color="#60a5fa" />
                <span className="section-title" style={{ fontSize: 11 }}>AI RECOMMENDATIONS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(dashboard?.latest_recommendations ?? []).map((rec, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(59, 130, 246, 0.06)',
                      borderRadius: 7,
                      borderLeft: '2px solid #3b82f6',
                      fontSize: 11,
                      color: '#94a3b8',
                      lineHeight: 1.4,
                    }}
                  >
                    {rec}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
