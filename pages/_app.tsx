import type { AppProps } from 'next/app'
import Head from 'next/head'
import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from '../context/AuthContext'
import { Toaster } from 'react-hot-toast'
import '../styles/globals.css'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <AuthProvider>
        <Head>
          <title>FleetFlow Pro - Fleet Management Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="Modern fleet management dashboard for food truck delivery services and similar operations" />
          <meta name="keywords" content="fleet management, delivery, logistics, food truck, dashboard" />
          
          {/* Open Graph */}
          <meta property="og:title" content="FleetFlow Pro - Fleet Management" />
          <meta property="og:description" content="Streamline your fleet operations with FleetFlow Pro" />
          <meta property="og:type" content="website" />
          
          {/* PWA */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1e3a8a" />
        </Head>
        
        <Component {...pageProps} />
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
            success: {
              duration: 3000,
              style: {
                background: '#10b981',
                color: '#ffffff',
              },
              iconTheme: {
                primary: '#ffffff',
                secondary: '#10b981',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: '#ef4444',
                color: '#ffffff',
              },
              iconTheme: {
                primary: '#ffffff',
                secondary: '#ef4444',
              },
            },
            loading: {
              style: {
                background: '#3b82f6',
                color: '#ffffff',
              },
            },
          }}
        />
      </AuthProvider>
    </SessionProvider>
  )
}
