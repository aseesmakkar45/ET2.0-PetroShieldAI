'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Clock, AlertTriangle, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { API_BASE_URL } from '@/services/api'

interface SimulatedScenario {
  id: number;
  date_display: string;
  scenario_title: string;
  raw_signal: string;
  source_type: string;
  severity: string;
  disruption_probability: number;
  brent_price_mean: number;
  spr_runway_days: number;
  report_json?: string; // This is actually markdown text
  executive_narrative?: string;
  pdf_filename?: string;
}

export default function HistoryView() {
  const [history, setHistory] = useState<SimulatedScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<SimulatedScenario | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/reports/history`)
      .then(res => res.json())
      .then(data => {
        setHistory(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load history:", err)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%', padding: '24px', background: '#f8fafc',
      display: 'flex', flexDirection: 'column', gap: 20
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Event Simulation History
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Historical archive of all simulated scenarios, risk assessments, and generated ministry reports.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: 14 }}>Loading history...</div>
      ) : (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569' }}>DATE</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569' }}>SCENARIO / EVENT</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569' }}>SEVERITY</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569' }}>IMPACT</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569' }}>REPORT</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', cursor: 'pointer' }}
                  onClick={() => setSelectedReport(item)}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} />
                      {item.date_display}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.scenario_title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.raw_signal}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 6,
                      background: item.severity === 'CRITICAL' ? '#fee2e2' : item.severity === 'ELEVATED' ? '#fef3c7' : '#e0e7ff',
                      color: item.severity === 'CRITICAL' ? '#dc2626' : item.severity === 'ELEVATED' ? '#d97706' : '#4338ca'
                    }}>
                      {item.severity} ({item.disruption_probability}%)
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#334155' }}>
                    <div><strong>${item.brent_price_mean?.toFixed(2) || '0.00'}</strong> / bbl</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>SPR: {item.spr_runway_days} days</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button 
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                        padding: '6px 12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedReport(item)
                      }}
                    >
                      <FileText size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                    No historical events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }} onClick={() => setSelectedReport(null)}>
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            style={{
              background: '#ffffff', width: '900px', maxWidth: '100%', height: '85vh',
              borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: '#0f172a', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FileText size={20} className="text-blue-400" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>
                  {selectedReport.scenario_title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: '#f8fafc' }} className="markdown-body">
              {selectedReport.report_json ? (
                <div style={{
                  background: 'white', padding: '40px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  fontFamily: 'Inter, sans-serif', color: '#334155'
                }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedReport.report_json}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
                  <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} color="#f59e0b" />
                  <p>No detailed markdown report generated for this legacy event.</p>
                  <div style={{
                    marginTop: 20, textAlign: 'left', background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>System Fallback Narrative:</h4>
                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{selectedReport.executive_narrative}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .markdown-body h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        .markdown-body h2 { font-size: 18px; font-weight: 700; color: #1e293b; margin: 32px 0 16px 0; display: flex; align-items: center; gap: 8px; }
        .markdown-body h2::before { content: ''; display: block; width: 4px; height: 18px; background: #3b82f6; border-radius: 2px; }
        .markdown-body p { font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 16px; }
        .markdown-body strong { color: #0f172a; font-weight: 700; }
        .markdown-body ul { padding-left: 20px; margin-bottom: 16px; font-size: 14px; color: #475569; line-height: 1.7; }
        .markdown-body li { margin-bottom: 8px; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        .markdown-body th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 700; color: #334155; border: 1px solid #e2e8f0; }
        .markdown-body td { padding: 10px 12px; border: 1px solid #e2e8f0; color: #475569; }
        .markdown-body pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 16px; font-size: 13px; }
      `}} />
    </div>
  )
}
