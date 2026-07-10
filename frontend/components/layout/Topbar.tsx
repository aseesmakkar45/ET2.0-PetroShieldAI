'use client'

import { useState, useEffect } from 'react'
import { Bell, RefreshCw, User, Wifi, WifiOff, Sun, Moon } from 'lucide-react'

interface TopbarProps {
  title: string
  subtitle?: string
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const [time, setTime] = useState('')
  const [connected, setConnected] = useState(true)
  const [alertCount] = useState(3)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC')
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)

    // Load theme setting
    const isDarkStored = localStorage.getItem('theme') === 'dark'
    setIsDark(isDarkStored)
    if (isDarkStored) {
      document.documentElement.classList.add('dark-theme')
    } else {
      document.documentElement.classList.remove('dark-theme')
    }

    return () => clearInterval(interval)
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark-theme')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark-theme')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(20px)',
    }}>
      {/* Page title */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{subtitle}</p>
        )}
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live clock */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: '#2563eb',
          background: 'rgba(37, 99, 235, 0.05)',
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid rgba(37, 99, 235, 0.1)',
        }}>
          {time}
        </div>

        {/* Connection status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: connected ? '#10b981' : '#ef4444',
        }}>
          {connected
            ? <Wifi size={14} color="#10b981" />
            : <WifiOff size={14} color="#ef4444" />}
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost"
          style={{ padding: '6px', borderRadius: 6 }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => window.location.reload()}
          className="btn-ghost"
          style={{ padding: '6px', borderRadius: 6 }}
          title="Refresh data"
        >
          <RefreshCw size={14} />
        </button>

        {/* Notifications */}
        <button className="btn-ghost" style={{ padding: '6px', borderRadius: 6, position: 'relative' }} title="Alerts">
          <Bell size={14} />
          {alertCount > 0 && (
            <div style={{
              position: 'absolute',
              top: 2, right: 2,
              width: 8, height: 8,
              background: '#ef4444',
              borderRadius: '50%',
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
            }}>
            </div>
          )}
        </button>

        {/* User */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px',
          background: 'rgba(37, 99, 235, 0.05)',
          border: '1px solid rgba(37, 99, 235, 0.1)',
          borderRadius: 8,
          cursor: 'pointer',
        }}>
          <div style={{
            width: 24, height: 24,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={12} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1 }}>Analyst</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}
