import Head from 'next/head'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About FleetFlow — Fleet Management Software for Modern Teams</title>
        <meta
          name="description"
          content="FleetFlow helps fleet operators track vehicles, manage deliveries, and schedule maintenance. Learn about our mission and team."
        />
        <meta property="og:title" content="About FleetFlow — Fleet Management Software" />
        <meta
          property="og:description"
          content="Learn about FleetFlow's mission to simplify fleet management for modern teams."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fleet.ashbi.ca/about" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About FleetFlow — Fleet Management Software" />
        <meta
          name="twitter:description"
          content="Learn about FleetFlow's mission to simplify fleet management for modern teams."
        />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-blue-900">
              FleetFlow
            </Link>
            <div className="hidden sm:flex items-center gap-8">
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                Home
              </Link>
              <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
              <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">
                Log In
              </Link>
              <Link
                href="/auth/login"
                className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Get Started
              </Link>
            </div>
            <Link
              href="/auth/login"
              className="sm:hidden text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg"
            >
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-20 pb-16">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              Built for teams that move
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              FleetFlow started with a simple observation: fleet management software hasn&apos;t kept up with modern
              teams. We&apos;re building the tools that dispatchers, drivers, and managers actually want to use.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">What drives us</h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Simplicity first',
                  description:
                    "Fleet management is complex enough. Our software shouldn't add to the chaos — it should cut through it.",
                },
                {
                  title: 'Real-time or nothing',
                  description:
                    'Stale data costs money and causes missed deliveries. Every feature we build starts with live information.',
                },
                {
                  title: 'Teams over tools',
                  description:
                    'Software is only as good as the team using it. We design for collaboration across roles and skill levels.',
                },
              ].map((v) => (
                <div key={v.title} className="bg-white rounded-xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">{v.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Get in touch</h2>
            <p className="mt-4 text-gray-500">
              Questions, feedback, or partnership inquiries — we&apos;d love to hear from you.
            </p>
            <a
              href="mailto:support@fleet.ashbi.ca"
              className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              support@fleet.ashbi.ca
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm">© {new Date().getFullYear()} FleetFlow. All rights reserved.</p>
              <div className="flex gap-6 text-sm">
                <Link href="/" className="hover:text-white transition">
                  Home
                </Link>
                <Link href="/pricing" className="hover:text-white transition">
                  Pricing
                </Link>
                <Link href="/auth/login" className="hover:text-white transition">
                  Log In
                </Link>
                <a href="mailto:support@fleet.ashbi.ca" className="hover:text-white transition">
                  Support
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
