'use client'

import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet'
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

const createVesselIcon = (color: string, heading: number = 0) => new L.DivIcon({
  className: 'vessel-icon',
  html: `<div style="
    width: 0; 
    height: 0; 
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 14px solid ${color};
    filter: drop-shadow(0 0 4px ${color});
    transform: rotate(${heading}deg);
    transition: transform 0.3s ease;
  "></div>`,
  iconSize: [12, 14],
  iconAnchor: [6, 7]
})

const chokepointIcon = createIcon('#ef4444')
const portIcon = createIcon('#10b981')
const refineryIcon = createIcon('#f97316')
const sprIcon = createIcon('#eab308')

interface WeatherLocation {
  id: string
  name: string
  lat: number
  lng: number
  type: string
  wave_height_m: number | null
  wind_speed_kmh: number | null
  wind_direction_label: string | null
  sea_surface_temp_c: number | null
  operational_risk: string
  advisory: string
  daily_flow_mbd: number
}

interface Props {
  mapData?: MapData
  layers?: Record<string, boolean>
  weatherData?: { locations: WeatherLocation[]; fleet_risk: string; fleet_advisory: string } | null
}

export default function GlobalMap({ mapData, layers, weatherData }: Props) {
  if (!mapData) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#060d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: 13, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading Live AIS & Satellite Overlay Data...
        </div>
      </div>
    )
  }

  // Default all layers to visible when no layers prop provided (e.g. mini-map on Overview)
  const L_ROUTES      = layers?.routes      ?? true
  const L_PORTS       = layers?.ports       ?? true
  const L_INCIDENTS   = layers?.incidents   ?? true
  const L_CHOKEPOINTS = layers?.chokepoints ?? true
  const L_SUPPLIERS   = layers?.suppliers   ?? true
  const L_STORAGE     = layers?.storage     ?? true
  const L_WEATHER     = layers?.weather     ?? false

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#060d1a' }}>
      <MapContainer
        center={[20.5937, 78.9629]} // Centered on India
        zoom={4}
        style={{ width: '100%', height: '100%', zIndex: 1, background: '#060d1a' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />

        {/* Routes — toggled by Trade Routes layer */}
        {L_ROUTES && mapData.routes?.map(route => {
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

        {/* Recommended reroute lines — shown with Trade Routes */}
        {L_ROUTES && (mapData as any).recommended_routes?.map((pathCoords: number[][], idx: number) => (
          <Polyline
            key={`rec_route_${idx}`}
            positions={pathCoords as [number, number][]}
            color="#10b981"
            weight={3}
            opacity={0.9}
            dashArray="1, 4"
          />
        ))}

        {/* Vessels — toggled by Incidents & Alerts layer */}
        {L_INCIDENTS && mapData.vessels?.map(vessel => {
          const isLive = vessel.data_source === 'LIVE';
          const iconColor = isLive ? '#10b981' : '#a855f7';
          const heading = (vessel as any).heading ?? 0;
          const currentIcon = createVesselIcon(iconColor, heading);
          
          return (
            <Marker
              key={vessel.mmsi}
              position={[vessel.current_position.lat, vessel.current_position.lng]}
              icon={currentIcon}
            >
              <Popup>
                <div style={{ padding: 6, minWidth: 160 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{vessel.name}</h3>
                    <span style={{ 
                      fontSize: 8.5, 
                      fontWeight: 700, 
                      padding: '2px 6px', 
                      borderRadius: 4, 
                      color: '#ffffff', 
                      background: isLive ? '#10b981' : '#a855f7' 
                    }}>
                      {isLive ? 'LIVE' : 'SIMULATED'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div><strong>Type:</strong> {vessel.vessel_type}</div>
                    <div><strong>MMSI:</strong> {vessel.mmsi}</div>
                    <div><strong>Speed:</strong> {vessel.speed_knots} kn</div>
                    {vessel.heading && <div><strong>Heading:</strong> {vessel.heading}°</div>}
                    <div><strong>Destination:</strong> {vessel.destination_port}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Chokepoints — toggled by Chokepoint Overlays layer */}
        {L_CHOKEPOINTS && mapData.chokepoints?.map(cp => (
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

        {/* Ports (India) — toggled by Ports & Terminals layer */}
        {L_PORTS && mapData.ports?.map(port => (
          <Marker key={port.id} position={[port.coordinates.lat, port.coordinates.lng]} icon={portIcon}>
            <Popup>
              <div style={{ padding: 4 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#10b981' }}>{port.name}</h3>
                <div style={{ fontSize: 11, color: '#475569' }}>Capacity: {port.annual_capacity_mt} MT/yr</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Refineries — toggled by Supplier Hubs layer */}
        {L_SUPPLIERS && mapData.refineries?.map(refinery => {
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

        {/* SPR Facilities — toggled by Storage Facilities layer */}
        {L_STORAGE && mapData.spr_facilities?.map(spr => (
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

        {/* ── LIVE WEATHER LAYER — toggled by Weather & Cyclones ── */}
        {L_WEATHER && weatherData?.locations?.map(loc => {
          const riskColor = loc.operational_risk === 'SEVERE'   ? '#ef4444'
                          : loc.operational_risk === 'ELEVATED'  ? '#f97316'
                          : loc.operational_risk === 'MODERATE'  ? '#eab308'
                          : '#10b981'

          const radius = loc.type === 'chokepoint' ? 180000 : 80000

          const weatherIcon = new L.DivIcon({
            className: 'weather-icon',
            html: `<div style="
              background: ${riskColor}22;
              border: 2px solid ${riskColor};
              border-radius: 50%;
              width: 22px; height: 22px;
              display: flex; align-items: center; justify-content: center;
              font-size: 11px;
              box-shadow: 0 0 12px ${riskColor}66;
            ">🌊</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })

          return (
            <React.Fragment key={`weather_${loc.id}`}>
              {/* Translucent risk radius */}
              <Circle
                center={[loc.lat, loc.lng]}
                radius={radius}
                color={riskColor}
                fillColor={riskColor}
                fillOpacity={0.08}
                weight={1.5}
                opacity={0.5}
              />
              {/* Weather marker with popup */}
              <Marker position={[loc.lat, loc.lng]} icon={weatherIcon}>
                <Popup>
                  <div style={{ padding: 6, minWidth: 220, fontFamily: 'system-ui' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        🌊 {loc.name}
                      </h3>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px',
                        borderRadius: 4, color: '#fff',
                        background: riskColor
                      }}>
                        {loc.operational_risk}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px' }}>
                      {loc.wave_height_m != null && <div><strong>Wave Height:</strong> {loc.wave_height_m.toFixed(1)} m</div>}
                      {loc.wind_speed_kmh != null && <div><strong>Wind:</strong> {loc.wind_speed_kmh.toFixed(0)} km/h {loc.wind_direction_label || ''}</div>}
                      {loc.sea_surface_temp_c != null && <div><strong>Sea Temp:</strong> {loc.sea_surface_temp_c.toFixed(1)}°C</div>}
                      {loc.daily_flow_mbd > 0 && <div><strong>Flow:</strong> {loc.daily_flow_mbd} MBD</div>}
                    </div>
                    <div style={{
                      marginTop: 8, fontSize: 10.5, color: loc.operational_risk === 'NORMAL' ? '#059669' : '#dc2626',
                      background: loc.operational_risk === 'NORMAL' ? '#f0fdf4' : '#fef2f2',
                      padding: '5px 8px', borderRadius: 6
                    }}>
                      {loc.advisory}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 9, color: '#94a3b8' }}>Source: Open-Meteo Marine API (live)</div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
