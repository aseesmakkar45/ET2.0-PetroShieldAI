'use client'

import React from 'react'
import Topbar from '@/components/layout/Topbar'
import CommandCenter from '@/components/CommandCenter'

export default function ScenarioSimulatorPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar title="3. Scenario & Digital Twin" subtitle="Cabinet Secretary Taskforce Operations (NECC)" />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CommandCenter view="scenario-simulator" />
      </div>
    </div>
  )
}
