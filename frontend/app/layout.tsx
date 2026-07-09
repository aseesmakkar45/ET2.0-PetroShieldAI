import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PetroShield AI – Energy Supply Chain Intelligence',
  description: 'AI-Driven Energy Supply Chain Resilience Platform for India. Real-time geopolitical risk monitoring, scenario simulation, and procurement intelligence.',
  keywords: ['energy security', 'supply chain', 'crude oil', 'geopolitical risk', 'India'],
  authors: [{ name: 'PetroShield AI' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
