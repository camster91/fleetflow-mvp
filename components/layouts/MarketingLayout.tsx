import Head from 'next/head';
import { Navbar } from '../marketing/Navbar';
import { Footer } from '../marketing/Footer';

interface MarketingLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  ogImage?: string;
}

export function MarketingLayout({
  children,
  title = 'FleetFlow - Fleet Management, Simplified',
  description = 'Track vehicles, schedule maintenance, and optimize your fleet operations with FleetFlow.',
  ogImage = '/og-image.jpg',
}: MarketingLayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={ogImage} />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Theme Color */}
        <meta name="theme-color" content="#1e3a8a" />
      </Head>
      
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </div>
    </>
  );
}
