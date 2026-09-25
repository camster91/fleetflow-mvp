import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { SessionProvider, useSession } from '../lib/session'
import { AuthProvider } from '../context/AuthContext'
import { Toaster } from 'react-hot-toast'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmDialogProvider } from '../components/ui/ConfirmDialog'
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
        <ConfirmDialogProvider>
          <OnboardingGuard>
            <OfflineBanner />
            <Head>
              <title>Fleetvera - Fleet Operations, Organized</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta
                name="description"
                content="Fleet management dashboard — vehicles, maintenance, deliveries and analytics."
              />
              <meta name="keywords" content="fleet management, delivery, logistics, vehicles, dashboard" />

              {/* Open Graph */}
              <meta property="og:title" content="Fleetvera" />
              <meta property="og:description" content="Fleet operations, organized." />
              <meta property="og:type" content="website" />

              {/* PWA */}
              <link rel="manifest" href="/manifest.json" />
              <meta name="theme-color" content="#123C36" />
            </Head>

            <Component {...pageProps} />

            <Toaster
              position="top-right"
              gutter={10}
              toastOptions={{
                duration: 4000,
                className: 'shadow-lg',
                style: {
                  background: '#102421',
                  color: '#f4f8f7',
                  borderRadius: '0.75rem',
                  padding: '0.875rem 1rem',
                  fontSize: '0.875rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 16px 40px -24px rgb(8 43 39 / 0.45)',
                },
                success: {
                  duration: 3000,
                  style: {
                    background: '#123c36',
                    color: '#ffffff',
                    border: '1px solid rgba(66,214,164,0.35)',
                  },
                  iconTheme: {
                    primary: '#42d6a4',
                    secondary: '#123c36',
                  },
                },
                error: {
                  duration: 4500,
                  style: {
                    background: '#7f1d1d',
                    color: '#ffffff',
                  },
                  iconTheme: {
                    primary: '#ffffff',
                    secondary: '#7f1d1d',
                  },
                },
                loading: {
                  style: {
                    background: '#1e293b',
                    color: '#ffffff',
                  },
                },
              }}
            />
          </OnboardingGuard>
        </ConfirmDialogProvider>
      </AuthProvider>
    </SessionProvider>
  )
}
