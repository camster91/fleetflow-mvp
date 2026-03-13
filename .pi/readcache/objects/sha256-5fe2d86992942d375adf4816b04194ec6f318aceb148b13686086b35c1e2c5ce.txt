import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Inter Font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        
        {/* Favicon */}
        <link rel="icon" type="image/x-icon" href="/brand/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/brand/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/brand/icons/favicon-16.png" />
        
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/brand/icons/apple-touch-icon.png" />
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Theme Color */}
        <meta name="theme-color" content="#1E3A5F" />
        <meta name="msapplication-TileColor" content="#1E3A5F" />
        
        {/* Open Graph / Social Media */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="FleetFlow" />
        <meta property="og:image" content="https://fleet.ashbi.ca/brand/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://fleet.ashbi.ca/brand/twitter-card.png" />
        
        {/* Description (will be overridden by page-specific meta) */}
        <meta name="description" content="Modern fleet management SaaS platform. Streamline your fleet operations with FleetFlow." />
      </Head>
      <body className="font-sans antialiased bg-slate-50">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
