'use client'

import React from 'react'
import Topbar from '@/components/layout/Topbar'
import CommandCenter from '@/components/CommandCenter'

export default function GeospatialMapPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar title="2. Geospatial Risk Intel" subtitle="Cabinet Secretary Taskforce Operations (NECC)" />
      <div style={{ flex: 1, padding: 12 }}>
        <CommandCenter view="risk-intelligence" />
      </div>
    </div>
  )
}
