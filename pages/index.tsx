import Head from 'next/head'
import Link from 'next/link'

const features = [
  {
    title: 'Vehicle Tracking',
    description: 'Real-time GPS tracking for your entire fleet. Know where every vehicle is, at all times.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    title: 'Delivery Management',
    description: 'Assign, track, and optimize deliveries from dispatch to doorstep with live status updates.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25V3.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v11.25m-18 0h18m-18 0H2.25m18 0h1.5" />
      </svg>
    ),
  },
  {
    title: 'Maintenance Scheduling',
    description: 'Automated reminders and service logs keep your vehicles road-ready and compliant.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.25 5.25a2.121 2.121 0 01-3-3l5.25-5.25m0 0L15.17 4.42a2.121 2.121 0 013 3l-7.75 7.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.25l1.5 1.5" />
      </svg>
    ),
  },
  {
    title: 'Team Collaboration',
    description: 'Role-based dashboards for dispatchers, drivers, and managers — everyone on the same page.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
]

const steps = [
  { number: '1', title: 'Sign Up', description: 'Create your free account in under a minute.' },
  { number: '2', title: 'Add Your Fleet', description: 'Import vehicles, assign drivers, and set routes.' },
  { number: '3', title: 'Manage Deliveries', description: 'Dispatch, track, and optimize — all from one dashboard.' },
]

const testimonials = [
  {
    quote: 'FleetFlow cut our dispatch time in half. The real-time tracking alone paid for itself in the first month.',
    name: 'Sarah Chen',
    role: 'Operations Manager',
    company: 'QuickShip Logistics',
  },
  {
    quote: 'We went from spreadsheets to a fully automated fleet in two weeks. The onboarding was incredibly smooth.',
    name: 'Marcus Johnson',
    role: 'Fleet Director',
    company: 'Metro Couriers',
  },
  {
    quote: 'Maintenance alerts have saved us thousands in preventable breakdowns. It just works.',
    name: 'Elena Rodriguez',
    role: 'CEO',
    company: 'GreenMile Delivery',
  },
]

const plans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/mo',
    description: 'For small teams getting started with fleet management.',
    features: ['Up to 10 vehicles', 'Real-time tracking', 'Basic reporting', 'Email support'],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$149',
    period: '/mo',
    description: 'For growing teams that need advanced features.',
    features: ['Unlimited vehicles', 'Advanced analytics', 'Maintenance scheduling', 'Priority support', 'API access'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
]

export default function HomePage() {
  return (
    <>
      <Head>
        <title>FleetFlow — Fleet Management for Modern Teams</title>
        <meta name="description" content="FleetFlow is fleet management software for modern teams. Track vehicles, manage deliveries, schedule maintenance, and collaborate — all in one platform." />
        <meta property="og:title" content="FleetFlow — Fleet Management for Modern Teams" />
        <meta property="og:description" content="Track vehicles, manage deliveries, schedule maintenance, and collaborate — all in one platform." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fleet.ashbi.ca" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FleetFlow — Fleet Management for Modern Teams" />
        <meta name="twitter:description" content="Track vehicles, manage deliveries, schedule maintenance, and collaborate — all in one platform." />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-blue-900">FleetFlow</Link>
            <div className="hidden sm:flex items-center gap-8">
              <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
              <Link href="/about" className="text-sm text-gray-600 hover:text-gray-900">About</Link>
              <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">Log In</Link>
              <Link href="/auth/login" className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                Get Started
              </Link>
            </div>
            <Link href="/auth/login" className="sm:hidden text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
              Fleet Management for{' '}
              <span className="text-blue-600">Modern Teams</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-500">
              Track vehicles, manage deliveries, and schedule maintenance — all from one dashboard.
              Built for teams that move fast.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/login"
                className="w-full sm:w-auto px-8 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/25"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                See Demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">No credit card required · Free 14-day trial</p>
          </div>
          <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-50 opacity-60" />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-50 opacity-40" />
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-gray-50" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything you need to run your fleet</h2>
              <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
                From real-time tracking to predictive maintenance, FleetFlow gives your team the tools to stay ahead.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((f) => (
                <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    {f.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Up and running in minutes</h2>
              <p className="mt-4 text-lg text-gray-500">Three steps to a fully managed fleet.</p>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
              {steps.map((s) => (
                <div key={s.number} className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                    {s.number}
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section className="py-20 bg-gray-50" id="pricing">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Simple, transparent pricing</h2>
              <p className="mt-4 text-lg text-gray-500">Start free. Upgrade when you&apos;re ready.</p>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-8 ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    {plan.name}
                  </h3>
                  <p className="mt-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className={`text-sm ${plan.highlighted ? 'text-blue-200' : 'text-gray-400'}`}>{plan.period}</span>
                  </p>
                  <p className={`mt-2 text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm">
                        <svg className={`w-4 h-4 flex-shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/login"
                    className={`mt-8 block text-center px-6 py-3 rounded-lg text-sm font-medium transition ${
                      plan.highlighted
                        ? 'bg-white text-blue-600 hover:bg-blue-50'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link href="/pricing" className="text-sm text-blue-600 font-medium hover:underline">
                Compare all plans →
              </Link>
            </p>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center">Trusted by fleet teams everywhere</h2>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((t) => (
                <div key={t.name} className="bg-gray-50 rounded-xl p-6">
                  <p className="text-gray-700 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-6">
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.role}, {t.company}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-blue-600">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to streamline your fleet?</h2>
            <p className="mt-4 text-lg text-blue-100">Join hundreds of teams already using FleetFlow.</p>
            <Link
              href="/auth/login"
              className="mt-8 inline-block px-8 py-3 text-base font-medium bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition shadow-lg"
            >
              Get Started Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="col-span-2 md:col-span-1">
                <p className="text-lg font-bold text-white">FleetFlow</p>
                <p className="mt-2 text-sm">Fleet management for modern teams.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Product</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                  <li><Link href="/about" className="hover:text-white transition">About</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Account</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li><Link href="/auth/login" className="hover:text-white transition">Log In</Link></li>
                  <li><Link href="/auth/login" className="hover:text-white transition">Sign Up</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Support</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li><a href="mailto:support@fleet.ashbi.ca" className="hover:text-white transition">support@fleet.ashbi.ca</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-center">
              © {new Date().getFullYear()} FleetFlow. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
