'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapData } from '@/types'

// Custom icons using standard Leaflet class
const createIcon = (color: string) => new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
})

const vesselIcon = new L.DivIcon({
  className: 'vessel-icon',
  html: `<div style="
    width: 0; 
    height: 0; 
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 14px solid #3b82f6;
    filter: drop-shadow(0 0 4px rgba(59,130,246,0.8));
  "></div>`,
  iconSize: [12, 14],
  iconAnchor: [6, 7]
})

const chokepointIcon = createIcon('#ef4444')
const portIcon = createIcon('#10b981')
const refineryIcon = createIcon('#f59e0b')

interface Props {
  mapData?: MapData
}

export default function GlobalMap({ mapData }: Props) {
  if (!mapData) return null

  return (
    <div style={{ width: '100%', height: '100%', background: '#080c14' }}>
      <MapContainer
        center={[20.5937, 78.9629]} // Centered on India
        zoom={4}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Routes */}
        {mapData.routes?.map(route => (
          <Polyline
            key={route.id}
            positions={route.waypoints.map(w => [w.lat, w.lng])}
            color={route.risk_score > 70 ? '#ef4444' : '#3b82f6'}
            weight={2}
            opacity={0.4}
            dashArray="5, 10"
          />
        ))}

        {/* Vessels */}
        {mapData.vessels?.map(vessel => (
          <Marker
            key={vessel.mmsi}
            position={[vessel.current_position.lat, vessel.current_position.lng]}
            icon={vesselIcon}
          >
            <Popup className="dark-popup">
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#f1f5f9' }}>{vessel.name}</h3>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Type: {vessel.vessel_type}<br/>
                  Speed: {vessel.speed_knots} kn<br/>
                  Dest: {vessel.destination_port}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Chokepoints */}
        {mapData.chokepoints?.map(cp => (
          <Marker key={cp.id} position={[cp.lat, cp.lng]} icon={chokepointIcon}>
            <Popup className="dark-popup">
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#ef4444' }}>{cp.name}</h3>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Risk Score: {cp.risk_score}/100<br/>
                  Flow: {cp.daily_flow_mbd} MBD
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Ports (India) */}
        {mapData.ports?.map(port => (
          <Marker key={port.id} position={[port.coordinates.lat, port.coordinates.lng]} icon={portIcon}>
            <Popup className="dark-popup">
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#10b981' }}>{port.name}</h3>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Capacity: {port.annual_capacity_mt} MT/yr</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
