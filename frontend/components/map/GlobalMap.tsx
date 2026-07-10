'use client'

import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
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
const refineryIcon = createIcon('#f97316')
const sprIcon = createIcon('#eab308')

interface Props {
  mapData?: MapData
}

export default function GlobalMap({ mapData }: Props) {
  const [mapKey, setMapKey] = useState<string>("")
  useEffect(() => {
    setMapKey("map-" + Math.random().toString(36).substr(2, 9))
  }, [])

  if (!mapData) return null
  if (!mapKey) {
    return <div style={{ width: '100%', height: '100%', background: '#060d1a' }} />
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#f8fafc' }}>
      <MapContainer
        key={mapKey}
        center={[20.5937, 78.9629]} // Centered on India
        zoom={4}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Routes */}
        {mapData.routes?.map(route => {
          const isDisrupted = route.risk_score > 50 || (route as any).is_disrupted;
          return (
            <Polyline
              key={route.id}
              positions={route.waypoints.map(w => [w.lat, w.lng])}
              color={isDisrupted ? '#ef4444' : '#3b82f6'}
              weight={isDisrupted ? 3 : 2}
              opacity={isDisrupted ? 0.8 : 0.4}
              dashArray={isDisrupted ? "4, 6" : "5, 10"}
            />
          );
        })}

        {/* Recommended routes (Green Reroutes) */}
        {(mapData as any).recommended_routes?.map((pathCoords: number[][], idx: number) => (
          <Polyline
            key={`rec_route_${idx}`}
            positions={pathCoords}
            color="#10b981"
            weight={3}
            opacity={0.9}
            dashArray="1, 4"
          />
        ))}

        {/* Vessels */}
        {mapData.vessels?.map(vessel => (
          <Marker
            key={vessel.mmsi}
            position={[vessel.current_position.lat, vessel.current_position.lng]}
            icon={vesselIcon}
          >
            <Popup>
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#0f172a' }}>{vessel.name}</h3>
                <div style={{ fontSize: 11, color: '#475569' }}>
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
            <Popup>
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#dc2626' }}>{cp.name}</h3>
                <div style={{ fontSize: 11, color: '#475569' }}>
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
            <Popup>
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#10b981' }}>{port.name}</h3>
                <div style={{ fontSize: 11, color: '#475569' }}>Capacity: {port.annual_capacity_mt} MT/yr</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Refineries */}
        {mapData.refineries?.map(refinery => {
          const coords = refinery.coordinates;
          if (!coords) return null;
          return (
            <Marker key={refinery.id} position={[coords.lat, coords.lng]} icon={refineryIcon}>
              <Popup>
                <div style={{ padding: 4 }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#ea580c' }}>{refinery.name}</h3>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    Capacity: {refinery.capacity_mbpd} mbpd<br/>
                    Operator: {refinery.operator}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* SPR Facilities */}
        {mapData.spr_facilities?.map(spr => (
          <Marker key={spr.id} position={[spr.lat, spr.lng]} icon={sprIcon}>
            <Popup>
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#d97706' }}>{spr.name}</h3>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  Capacity: {spr.capacity_mb} Million Barrels<br/>
                  Current Fill: {spr.fill_pct}%
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
