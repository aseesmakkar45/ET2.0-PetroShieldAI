'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '@/services/api'
import Topbar from '@/components/layout/Topbar'
import CommandCenter from '@/components/CommandCenter'

export default function RiskIntelligencePage() {
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 5000,
  })

  const riskScore = dashboard?.overall_risk_score ?? 21.5
  const isCritical = riskScore > 50
  const isWarning = riskScore > 35 && riskScore <= 50

  const riskColor = isCritical ? '#ef4444' : (isWarning ? '#f59e0b' : '#10b981')

  const bayesianRiskStats = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 10, background: 'rgba(8, 12, 20, 0.85)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--color-text-secondary)' }}>Prior:</span><span className="mono" style={{ fontWeight: 600 }}>15.0%</span></div>
      <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--color-text-secondary)' }}>AIS Anomaly:</span><span className="mono" style={{ color: '#ef4444', fontWeight: 600 }}>+24.5%</span></div>
      <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--color-text-secondary)' }}>Policy Adj:</span><span className="mono" style={{ color: '#f59e0b', fontWeight: 600 }}>1.32x</span></div>
      <div style={{ display: 'flex', gap: 6, borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}><span style={{ fontWeight: 600 }}>Risk Score:</span><span className="mono" style={{ color: riskColor, fontSize: 12, fontWeight: 700 }}>{riskScore.toFixed(1)}%</span></div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar title="2. Geospatial Risk Intel" subtitle="Cabinet Secretary Taskforce Operations (NECC)" rightTitleContent={bayesianRiskStats} />
      <div style={{ flex: 1, padding: 12 }}>
        <CommandCenter view="risk-intelligence" />
      </div>
    </div>
  )
}
