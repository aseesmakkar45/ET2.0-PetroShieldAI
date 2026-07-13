'use client'

import React from 'react'
import Topbar from '@/components/layout/Topbar'
import CommandCenter from '@/components/CommandCenter'

const bayesianRiskStats = (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 10, background: 'rgba(248,250,252,0.8)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
    <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--color-text-secondary)' }}>Prior:</span><span className="mono" style={{ fontWeight: 600 }}>15.0%</span></div>
    <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--color-text-secondary)' }}>AIS Anomaly:</span><span className="mono" style={{ color: '#ef4444', fontWeight: 600 }}>+24.5%</span></div>
    <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--color-text-secondary)' }}>Policy Adj:</span><span className="mono" style={{ color: '#f59e0b', fontWeight: 600 }}>1.32x</span></div>
    <div style={{ display: 'flex', gap: 6, borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}><span style={{ fontWeight: 600 }}>Risk Score:</span><span className="mono" style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>21.5%</span></div>
  </div>
)

export default function RiskIntelligencePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar title="2. Geospatial Risk Intel" subtitle="Cabinet Secretary Taskforce Operations (NECC)" rightTitleContent={bayesianRiskStats} />
      <div style={{ flex: 1, padding: 12 }}>
        <CommandCenter view="risk-intelligence" />
      </div>
    </div>
  )
}
