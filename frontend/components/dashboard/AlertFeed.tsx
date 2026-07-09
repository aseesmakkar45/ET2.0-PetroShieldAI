'use client'

import { motion } from 'framer-motion'
import type { RiskSignal } from '@/types'
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react'

interface Props {
  signals: RiskSignal[]
  loading?: boolean
}

const LEVEL_COLORS = {
  low: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#10b981', label: 'LOW' },
  moderate: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', label: 'MOD' },
  high: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', text: '#f97316', label: 'HIGH' },
  critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444', label: 'CRIT' },
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h ago`
  return `${m}m ago`
}

export default function AlertFeed({ signals, loading }: Props) {
  return (
    <div className="glass-card" style={{ padding: 14, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <AlertTriangle size={13} color="#f97316" />
        <span className="section-title" style={{ fontSize: 11 }}>LIVE ALERTS</span>
        {!loading && (
          <div className="pulse-dot" style={{ background: '#ef4444', marginLeft: 'auto' }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
            ))
          : signals.map((sig, i) => {
              const colors = LEVEL_COLORS[sig.risk_level] || LEVEL_COLORS.moderate
              return (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    padding: '9px 10px',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3, flex: 1 }}>
                      {sig.title}
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: colors.text,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 4,
                      padding: '2px 5px',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.5px',
                    }}>
                      {colors.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={10} color="#334155" />
                    <span style={{ fontSize: 10, color: '#475569' }}>{timeAgo(sig.timestamp)}</span>
                    <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>
                      {sig.source}
                    </span>
                  </div>
                </motion.div>
              )
            })
        }
      </div>
    </div>
  )
}
