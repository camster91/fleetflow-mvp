import Head from 'next/head'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Footer } from '../components/marketing/Footer'
import { Navbar } from '../components/marketing/Navbar'

const features = [
  'Unlimited vehicle and delivery records',
  'Maintenance scheduling and task sharing',
  'Client and SOP management',
  'Team workspaces and role-based access',
  'Fleet, delivery, and maintenance reports',
  'CSV exports and API-key management',
]

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>Fleetvera pricing</title>
        <meta name="description" content="Fleetvera is free during the beta. Planned pricing after the beta is $49 monthly or $490 yearly." />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="px-4 pb-24 pt-36 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Free during the beta</h1>
            <p className="mt-5 text-lg text-slate-600">Every beta workspace gets the full product at no cost. We will give beta workspaces advance notice before paid plans start.</p>
          </div>

          <section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Fleetvera Pro</h2>
                <p className="mt-2 text-slate-600">The complete currently available Fleetvera workspace.</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-3xl font-bold text-slate-950">Free <span className="text-base font-normal text-slate-500">during beta</span></p>
                <p className="mt-1 text-sm text-slate-500">Planned after beta: $49 USD/month or $490 USD/year</p>
              </div>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm text-slate-700">
                  <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl bg-blue-50 p-5 text-sm text-blue-950">
              Beta access is currently invitation-only. No payment details are needed during the beta.
            </div>
            <Link href="/auth/login" className="mt-6 inline-flex rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800">
              Sign in to Fleetvera
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
