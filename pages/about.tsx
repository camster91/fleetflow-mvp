import Head from 'next/head'
import Link from 'next/link'
import { Footer } from '../components/marketing/Footer'
import { Navbar } from '../components/marketing/Navbar'
import { SUPPORT_EMAIL } from '../lib/support'

const values = [
  {
    title: 'Simple by default',
    description:
      'Fleet work is complex enough. Fleetvera keeps vehicles, deliveries and maintenance in one clear place.',
  },
  {
    title: 'Honest about data',
    description: 'We show what your team has recorded and when it was last updated, never invented status or ETAs.',
  },
  {
    title: 'Built for the whole team',
    description: 'Owners, dispatchers, drivers and mechanics each get the view and permissions their role needs.',
  },
]

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Fleetvera</title>
        <meta
          name="description"
          content="Fleetvera helps fleet operators organize vehicles, deliveries, maintenance and their team in one workspace."
        />
        <meta property="og:title" content="About Fleetvera" />
        <meta
          property="og:description"
          content="Fleetvera helps fleet operators organize vehicles, deliveries, maintenance and their team in one workspace."
        />
        <meta property="og:type" content="website" />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="px-4 pb-24 pt-36 sm:px-6">
          <section className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Built for teams that move</h1>
            <p className="mt-5 text-lg text-slate-600">
              Fleetvera started with a simple observation: fleet software hasn&apos;t kept up with the small teams who
              run most fleets. We build the tools dispatchers, drivers and managers actually want to use.
            </p>
          </section>

          <section aria-labelledby="values-title" className="mx-auto mt-16 max-w-5xl">
            <h2 id="values-title" className="text-center text-2xl font-bold text-slate-950 sm:text-3xl">
              What drives us
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {values.map((value) => (
                <div key={value.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-slate-950">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="contact-title" className="mx-auto mt-16 max-w-2xl text-center">
            <h2 id="contact-title" className="text-2xl font-bold text-slate-950">
              Get in touch
            </h2>
            <p className="mt-4 text-slate-600">
              Questions, feedback or partnership ideas — we&apos;d love to hear from you.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-6 font-medium text-white hover:bg-emerald-900"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-6 text-sm text-slate-600">
              Ready to try it?{' '}
              <Link href="/auth/login" className="font-medium text-emerald-800 underline">
                Start free during the beta
              </Link>
            </p>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
