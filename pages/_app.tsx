import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { SessionProvider, useSession } from '../lib/session'
import { AuthProvider } from '../context/AuthContext'
import { Toaster } from 'react-hot-toast'
import { OfflineBanner } from '../components/OfflineBanner'
import '../styles/globals.css'

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return
    const path = router.pathname
    // Skip redirect for onboarding page itself, auth pages, and API routes
    if (path === '/onboarding' || path.startsWith('/auth') || path.startsWith('/api')) return
    if (session.user.onboardingCompleted === false) {
      router.replace('/onboarding')
    }
  }, [status, session, router])

  return <>{children}</>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider>
      <AuthProvider>
        <OnboardingGuard>
        <OfflineBanner />
        <Head>
          <title>Fleet Manager - Fleet Management Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="Fleet management dashboard — vehicles, maintenance, deliveries and analytics." />
          <meta name="keywords" content="fleet management, delivery, logistics, vehicles, dashboard" />

          {/* Open Graph */}
          <meta property="og:title" content="Fleet Manager" />
          <meta property="og:description" content="Streamline your fleet operations with Fleet Manager" />
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
      </OnboardingGuard>
      </AuthProvider>
    </SessionProvider>
  )
}
