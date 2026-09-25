import Head from 'next/head'
import Link from 'next/link'
import { BarChart3, ClipboardList, PackageCheck, Truck, Users, Wrench } from 'lucide-react'
import { Footer } from '../components/marketing/Footer'
import { Navbar } from '../components/marketing/Navbar'

const features = [
  {
    title: 'Fleet records',
    description: 'Keep vehicles, assignments, mileage, and service details organized.',
    icon: Truck,
  },
  {
    title: 'Delivery operations',
    description: 'Create deliveries, update their status, and preserve an event history.',
    icon: PackageCheck,
  },
  {
    title: 'Maintenance scheduling',
    description: 'Plan work, track estimated costs, and share a scoped task link when needed.',
    icon: Wrench,
  },
  {
    title: 'Client management',
    description: 'Store delivery contacts, locations, access notes, and operating details.',
    icon: ClipboardList,
  },
  { title: 'Team workspaces', description: 'Invite teammates and control access with workspace roles.', icon: Users },
  {
    title: 'Reports and analytics',
    description: 'Review fleet, delivery, and maintenance summaries and export CSV reports.',
    icon: BarChart3,
  },
]

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Fleetvera | Fleet operations, organized</title>
        <meta
          name="description"
          content="Fleetvera keeps vehicles, deliveries, maintenance, clients, reports, and team access organized in one workspace."
        />
      </Head>
      <div className="min-h-screen bg-white text-slate-900">
        <Navbar />
        <main>
          <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white px-4 pb-24 pt-36 text-center sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-200/30 blur-3xl" />
            <div className="mx-auto max-w-4xl">
              <p className="relative mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
                Fleet operations software
              </p>
              <h1 className="relative text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                Fleet operations,
                <br className="hidden sm:block" /> organized.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Fleetvera brings vehicle records, deliveries, maintenance, clients, reports, and team workspaces
                together.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/auth/login"
                  className="rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  View pricing
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">New workspaces are currently created by invitation.</p>
            </div>
          </section>

          <section className="px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The operational essentials</h2>
                <p className="mt-4 text-slate-600">A focused toolset for coordinating everyday fleet work.</p>
              </div>
              <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {features.map(({ title, description, icon: Icon }) => (
                  <article
                    key={title}
                    className="rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="inline-flex rounded-xl bg-emerald-50 p-3">
                      <Icon className="h-6 w-6 text-emerald-800" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-emerald-950 px-4 py-20 text-center text-white sm:px-6">
            <h2 className="text-3xl font-bold">Already invited to Fleetvera?</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Use your email address to receive a one-time sign-in code.
            </p>
            <Link
              href="/auth/login"
              className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-100"
            >
              Continue to sign in
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
