'use client'

import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'

interface Props {
  score: number
  loading?: boolean
}

export default function EnergyResilienceGauge({ score, loading }: Props) {
  // Map score (0-100) to angle (-120 to 120)
  const angle = -120 + (score / 100) * 240
  
  const getStatusColor = (s: number) => {
    if (s < 40) return '#ef4444' // critical
    if (s < 70) return '#f59e0b' // warning
    return '#10b981' // safe
  }
  
  const color = getStatusColor(score)

  return (
    <div className="glass-card" style={{ padding: '16px 20px', height: 180, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'auto' }}>
        <Activity size={13} color="#60a5fa" />
        <span className="section-title" style={{ fontSize: 11 }}>ENERGY RESILIENCE INDEX</span>
      </div>

      <div style={{ position: 'relative', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <div className="skeleton" style={{ width: 100, height: 100, borderRadius: '50%' }} />
        ) : (
          <>
            {/* SVG Gauge Background */}
            <svg width="180" height="100" viewBox="0 0 180 100" style={{ position: 'absolute', bottom: 0 }}>
              <path
                d="M 20 90 A 70 70 0 0 1 160 90"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 20 90 A 70 70 0 0 1 160 90"
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="220"
                strokeDashoffset={220 - (score / 100) * 220}
                style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 1s ease' }}
              />
            </svg>

            {/* Score Value */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 30 }}>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: color,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1,
                }}
              >
                {score}
              </motion.span>
              <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '1px', marginTop: 2 }}>
                / 100
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
