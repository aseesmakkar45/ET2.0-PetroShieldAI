'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, AlertTriangle, Map, Zap, ShoppingCart,
  Database, Share2, BarChart3, Bell, Settings, Shield,
  Globe, Eye, FileText
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',                          label: '1. Dashboard (Overview)',      icon: LayoutDashboard },
  { href: '/dashboard/risk-intelligence',        label: '2. Geospatial Risk Intel',     icon: Globe },
  { href: '/dashboard/scenario-simulator',       label: '3. Scenario & Digital Twin',   icon: Zap },
  { href: '/dashboard/procurement-orchestrator',  label: '4. Procurement & Reserves',    icon: ShoppingCart },
  { href: '/dashboard/reports-insights',          label: '5. Reports & Insights',         icon: BarChart3 },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      background: 'rgba(255, 255, 255, 0.98)',
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
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(29, 78, 216, 0.15)',
        }}>
          <Shield size={16} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '0.2px', lineHeight: 1.2 }}>
            PetroShield AI
          </div>
          <div style={{ fontSize: 9, color: '#1d4ed8', fontWeight: 700, letterSpacing: '0.8px' }}>
            DECISION ENGINE
          </div>
        </div>
      </div>

      {/* Sidebar Content Scrollable Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        
        {/* Platform Pages Navigation */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.8px', padding: '0 8px 8px', textTransform: 'uppercase' }}>
            Platform Pages
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <motion.div
                    whileHover={{ x: 2 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(29, 78, 216, 0.05)' : 'transparent',
                      border: isActive ? '1px solid rgba(29, 78, 216, 0.1)' : '1px solid transparent',
                      position: 'relative',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0, top: '25%', bottom: '25%',
                        width: 3,
                        background: '#1d4ed8',
                        borderRadius: '0 3px 3px 0',
                      }} />
                    )}
                    <Icon
                      size={14}
                      color={isActive ? '#1d4ed8' : '#334155'}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#1d4ed8' : '#1e293b',
                    }}>
                      {item.label}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </nav>
        </div>

      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--color-border)',
        fontSize: 10,
        color: 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#f8fafc'
      }}>
        <span style={{ fontWeight: 600 }}>v1.0.0</span>
        <span>© 2026 PetroShield AI</span>
      </div>
    </aside>
  )
}
