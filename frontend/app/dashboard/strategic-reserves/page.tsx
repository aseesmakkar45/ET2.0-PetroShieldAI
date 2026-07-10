'use client'

import React from 'react'
import Topbar from '@/components/layout/Topbar'
import CommandCenter from '@/components/CommandCenter'

export default function StrategicReservesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar title="6. Strategic Reserves" subtitle="Cabinet Secretary Taskforce Operations (NECC)" />
      <div style={{ flex: 1, padding: 12 }}>
        <CommandCenter view="strategic-reserves" />
      </div>
    </div>
  )
}
