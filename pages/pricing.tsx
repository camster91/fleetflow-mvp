import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    monthlyPrice: 49,
    description: 'For small teams getting started.',
    features: [
      'Up to 10 vehicles',
      'Real-time GPS tracking',
      'Basic delivery management',
      'Standard reporting',
      'Email support',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Professional',
    monthlyPrice: 149,
    description: 'For growing teams that need more power.',
    features: [
      'Unlimited vehicles',
      'Advanced analytics & reports',
      'Maintenance scheduling',
      'Route optimization',
      'Priority support',
      'API access',
      'Team collaboration tools',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    description: 'For large fleets with custom needs.',
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      'Custom integrations',
      'SSO / SAML',
      'SLA guarantee',
      'On-premise option',
      'Custom training',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

const comparisonFeatures = [
  { name: 'Vehicles', starter: 'Up to 10', pro: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Users', starter: '5', pro: '25', enterprise: 'Unlimited' },
  { name: 'GPS tracking', starter: true, pro: true, enterprise: true },
  { name: 'Delivery management', starter: true, pro: true, enterprise: true },
  { name: 'Basic reporting', starter: true, pro: true, enterprise: true },
  { name: 'Advanced analytics', starter: false, pro: true, enterprise: true },
  { name: 'Maintenance scheduling', starter: false, pro: true, enterprise: true },
  { name: 'Route optimization', starter: false, pro: true, enterprise: true },
  { name: 'API access', starter: false, pro: true, enterprise: true },
  { name: 'SSO / SAML', starter: false, pro: false, enterprise: true },
  { name: 'Custom integrations', starter: false, pro: false, enterprise: true },
  { name: 'SLA guarantee', starter: false, pro: false, enterprise: true },
  { name: 'Support', starter: 'Email', pro: 'Priority', enterprise: 'Dedicated' },
]

const faqs = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every plan includes a 14-day free trial with full access. No credit card required to start.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Absolutely. Upgrade or downgrade at any time from your account settings. Changes take effect on your next billing cycle.',
  },
  {
    q: 'How does yearly billing work?',
    a: 'Yearly billing gives you a 20% discount. You pay once per year and can switch back to monthly at renewal.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'You keep access until the end of your billing period. Your data is retained for 30 days after cancellation, so you can reactivate without losing anything.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a full refund within the first 30 days of any paid plan. After that, you can cancel anytime but refunds are not available for partial periods.',
  },
]

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5 text-blue-600'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5 text-gray-300'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false)

  function formatPrice(monthly: number | null) {
    if (monthly === null) return null
    const price = yearly ? Math.round(monthly * 0.8) : monthly
    return `$${price}`
  }

  return (
    <>
      <Head>
        <title>Pricing — FleetFlow Fleet Management Software</title>
        <meta name="description" content="Simple, transparent pricing for FleetFlow fleet management. Start free with our 14-day trial. Plans from $49/mo." />
        <meta property="og:title" content="Pricing — FleetFlow Fleet Management Software" />
        <meta property="og:description" content="Simple, transparent pricing. Start free with our 14-day trial. Plans from $49/mo." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fleet.ashbi.ca/pricing" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Pricing — FleetFlow Fleet Management Software" />
        <meta name="twitter:description" content="Simple, transparent pricing. Start free with our 14-day trial. Plans from $49/mo." />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-blue-900">FleetFlow</Link>
            <div className="hidden sm:flex items-center gap-8">
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Home</Link>
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

        {/* Header */}
        <section className="pt-20 pb-12 text-center">
          <div className="max-w-3xl mx-auto px-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-gray-500">Start free. Upgrade when you&apos;re ready. No surprises.</p>

            {/* Toggle */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <span className={`text-sm font-medium ${!yearly ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
              <button
                onClick={() => setYearly(!yearly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${yearly ? 'bg-blue-600' : 'bg-gray-200'}`}
                aria-label="Toggle yearly billing"
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition transform ${yearly ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className={`text-sm font-medium ${yearly ? 'text-gray-900' : 'text-gray-400'}`}>
                Yearly <span className="text-green-600 font-semibold">(save 20%)</span>
              </span>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-8 flex flex-col ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    {plan.name}
                  </h3>
                  <p className="mt-2">
                    {plan.monthlyPrice !== null ? (
                      <>
                        <span className="text-4xl font-bold">{formatPrice(plan.monthlyPrice)}</span>
                        <span className={`text-sm ${plan.highlighted ? 'text-blue-200' : 'text-gray-400'}`}>
                          /{yearly ? 'mo, billed yearly' : 'mo'}
                        </span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold">Custom</span>
                    )}
                  </p>
                  <p className={`mt-2 text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                  <ul className="mt-6 space-y-3 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm">
                        <CheckIcon className={`w-4 h-4 flex-shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600'}`} />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.monthlyPrice !== null ? '/auth/login' : 'mailto:support@fleet.ashbi.ca'}
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
          </div>
        </section>

        {/* Comparison table */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">Compare plans</h2>
            <div className="mt-12 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 pr-4 text-left font-semibold text-gray-900">Feature</th>
                    <th className="py-3 px-4 text-center font-semibold text-gray-900">Starter</th>
                    <th className="py-3 px-4 text-center font-semibold text-blue-600">Professional</th>
                    <th className="py-3 pl-4 text-center font-semibold text-gray-900">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((row) => (
                    <tr key={row.name} className="border-b border-gray-100">
                      <td className="py-3 pr-4 text-gray-700">{row.name}</td>
                      {([row.starter, row.pro, row.enterprise] as (boolean | string)[]).map((val, i) => (
                        <td key={i} className="py-3 px-4 text-center">
                          {typeof val === 'boolean' ? (
                            val ? <CheckIcon className="w-5 h-5 text-blue-600 mx-auto" /> : <XIcon className="w-5 h-5 text-gray-300 mx-auto" />
                          ) : (
                            <span className="text-gray-700">{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">Frequently asked questions</h2>
            <div className="mt-12 space-y-8">
              {faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="text-base font-semibold text-gray-900">{faq.q}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-blue-600">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
            <p className="mt-4 text-lg text-blue-100">Try FleetFlow free for 14 days. No credit card required.</p>
            <Link
              href="/auth/login"
              className="mt-8 inline-block px-8 py-3 text-base font-medium bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition shadow-lg"
            >
              Start Your Free Trial
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm">© {new Date().getFullYear()} FleetFlow. All rights reserved.</p>
              <div className="flex gap-6 text-sm">
                <Link href="/" className="hover:text-white transition">Home</Link>
                <Link href="/about" className="hover:text-white transition">About</Link>
                <Link href="/auth/login" className="hover:text-white transition">Log In</Link>
                <a href="mailto:support@fleet.ashbi.ca" className="hover:text-white transition">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
