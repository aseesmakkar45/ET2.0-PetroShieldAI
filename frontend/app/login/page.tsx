'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Lock, User, Eye, EyeOff, AlertTriangle, Zap } from 'lucide-react'

const DEMO_CREDENTIALS = [
  { role: 'Admin', email: 'admin@petroshield.ai', password: 'admin123' },
  { role: 'Analyst', email: 'analyst@petroshield.ai', password: 'analyst123' },
  { role: 'Policy Maker', email: 'policy@petroshield.ai', password: 'policy123' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@petroshield.ai')
  const [password, setPassword] = useState('admin123')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 1200)) // simulate auth
    const valid = DEMO_CREDENTIALS.some(c => c.email === email && c.password === password)
    if (valid) {
      router.push('/dashboard')
    } else {
      setError('Invalid credentials. Use demo accounts below.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 60%), #080c14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 460,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(59,130,246,0.3)', '0 0 40px rgba(59,130,246,0.5)', '0 0 20px rgba(59,130,246,0.3)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 72, height: 72,
              background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Shield size={36} color="white" strokeWidth={2} />
          </motion.div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>
            PetroShield AI
          </h1>
          <p style={{ fontSize: 13, color: '#475569', letterSpacing: '1px' }}>
            ENERGY SUPPLY CHAIN INTELLIGENCE PLATFORM
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card" style={{ padding: 32 }}>
          {/* Classified banner */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 8,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
          }}>
            <AlertTriangle size={14} color="#ef4444" />
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, letterSpacing: '0.5px' }}>
              RESTRICTED ACCESS — AUTHORIZED PERSONNEL ONLY
            </span>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 36 }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 36, paddingRight: 36 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showPass ? <EyeOff size={14} color="#475569" /> : <Eye size={14} color="#475569" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#fca5a5',
                }}
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, marginTop: 4 }}
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
                  />
                  Authenticating...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Access Platform
                </>
              )}
            </motion.button>
          </form>

          <div className="divider" />

          {/* Demo accounts */}
          <div>
            <p style={{ fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 10, textAlign: 'center' }}>
              DEMO ACCOUNTS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO_CREDENTIALS.map(c => (
                <button
                  key={c.role}
                  onClick={() => { setEmail(c.email); setPassword(c.password) }}
                  style={{
                    background: 'rgba(59, 130, 246, 0.06)',
                    border: '1px solid rgba(59, 130, 246, 0.12)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 200ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.12)')}
                >
                  <span style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>{c.role}</span>
                  <span style={{ fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
