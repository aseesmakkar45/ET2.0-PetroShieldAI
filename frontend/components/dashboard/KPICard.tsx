'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { KPICard as KPICardType } from '@/types'

interface Props {
  card: KPICardType
  index?: number
}

const STATUS_COLORS = {
  normal: { bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.15)', accent: '#10b981' },
  warning: { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.2)', accent: '#f59e0b' },
  critical: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', accent: '#ef4444' },
}

export default function KPICard({ card, index = 0 }: Props) {
  const colors = STATUS_COLORS[card.status] || STATUS_COLORS.normal
  const TrendIcon = card.trend === 'up' ? TrendingUp : card.trend === 'down' ? TrendingDown : Minus
  const trendColor = card.trend === 'up'
    ? (card.id === 'risk' ? '#ef4444' : '#10b981')
    : card.trend === 'down'
    ? (card.id === 'risk' ? '#10b981' : '#ef4444')
    : '#64748b'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -2 }}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 250ms',
      }}
    >
      {/* Accent line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${colors.accent}, transparent)`,
        borderRadius: '12px 12px 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {card.label}
        </span>
        {card.status === 'critical' && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              width: 6, height: 6,
              background: colors.accent,
              borderRadius: '50%',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontSize: 28,
          fontWeight: 800,
          color: colors.accent,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1,
        }}>
          {card.value}
        </span>
        <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
          {card.unit}
        </span>
      </div>

      {card.change_pct !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <TrendIcon size={12} color={trendColor} />
          <span style={{ fontSize: 11, color: trendColor, fontWeight: 600 }}>
            {card.change_pct > 0 ? '+' : ''}{card.change_pct.toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, color: '#334155' }}>24h</span>
        </div>
      )}
    </motion.div>
  )
}
