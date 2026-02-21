import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FleetFlow Pro - Fleet Management Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Modern fleet management dashboard for food truck delivery services and similar operations" />
        <meta name="keywords" content="fleet management, delivery, logistics, food truck, dashboard" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}