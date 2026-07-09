'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, AlertTriangle, Zap, ShoppingCart,
  Database, Share2, BarChart3, Settings, Shield, Activity
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { href: '/dashboard/risk', label: 'Risk Intelligence', icon: AlertTriangle },
  { href: '/dashboard/scenarios', label: 'Scenario Simulator', icon: Zap },
  { href: '/dashboard/procurement', label: 'Procurement', icon: ShoppingCart },
  { href: '/dashboard/spr', label: 'Strategic Reserve', icon: Database },
  { href: '/dashboard/knowledge-graph', label: 'Knowledge Graph', icon: Share2 },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      background: 'rgba(8, 12, 20, 0.98)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(20px)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 36, height: 36,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
        }}>
          <Shield size={18} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
            PetroShield
          </div>
          <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600, letterSpacing: '0.5px' }}>
            AI PLATFORM
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div style={{
        margin: '12px 12px 4px',
        padding: '8px 12px',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div className="pulse-dot" style={{ background: '#10b981' }} />
        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, letterSpacing: '0.5px' }}>
          DEMO MODE ACTIVE
        </span>
        <Activity size={11} color="#10b981" style={{ marginLeft: 'auto' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <motion.div
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  marginBottom: 2,
                  cursor: 'pointer',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(139, 92, 246, 0.1))'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(59, 130, 246, 0.25)'
                    : '1px solid transparent',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0, top: '20%', bottom: '20%',
                    width: 3,
                    background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)',
                    borderRadius: '0 3px 3px 0',
                  }} />
                )}
                <Icon
                  size={16}
                  color={isActive ? '#60a5fa' : '#475569'}
                  strokeWidth={2}
                />
                <span style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#f1f5f9' : '#64748b',
                  transition: 'color 200ms',
                }}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        fontSize: 11,
        color: '#334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>v1.0.0</span>
        <span style={{ color: '#1e3a5f' }}>© 2024 PetroShield AI</span>
      </div>
    </aside>
  )
}
