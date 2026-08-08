import Head from 'next/head'
import Link from 'next/link'
import { Footer } from '../../components/marketing/Footer'
import { Navbar } from '../../components/marketing/Navbar'

const topics = [
  {
    title: 'Sign in',
    steps: ['Enter the email address associated with your invitation.', 'Open the one-time code email.', 'Enter the code; complete the 2FA challenge if your account has it enabled.'],
  },
  {
    title: 'Set up a workspace',
    steps: ['Add the first vehicle and its current operational details.', 'Create client records used by deliveries.', 'Invite teammates from Team and assign the least-privileged role they need.'],
  },
  {
    title: 'Run daily operations',
    steps: ['Create and update deliveries as work progresses.', 'Schedule maintenance tasks and record estimated costs.', 'Use Reports and Analytics to review activity; export CSV when needed.'],
  },
  {
    title: 'Protect the account',
    steps: ['Enable authenticator-based 2FA under Settings > Security.', 'Store backup codes somewhere separate from the device.', 'Review API keys and team membership regularly.'],
  },
]

export default function HelpPage() {
  return (
    <>
      <Head>
        <title>Fleetvera help</title>
        <meta name="description" content="Quick-start guidance for signing in and operating a Fleetvera workspace." />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="px-4 pb-24 pt-32 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-slate-950">Fleetvera help</h1>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600">A practical quick start for invited workspace members.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {topics.map((topic) => (
                <section key={topic.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-950">{topic.title}</h2>
                  <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    {topic.steps.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="font-semibold text-blue-700">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            <div className="mt-10 rounded-2xl bg-blue-950 p-8 text-center text-white">
              <h2 className="text-2xl font-semibold">Ready to continue?</h2>
              <p className="mt-2 text-blue-100">Sign in with the email address your workspace administrator invited.</p>
              <Link href="/auth/login" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-blue-950 hover:bg-blue-50">
                Sign in
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
