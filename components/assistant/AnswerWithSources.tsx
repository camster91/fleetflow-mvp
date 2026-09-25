import Link from 'next/link'
import type { AssistantClaim, AssistantSource } from '@/lib/ai/answerCitations'
import { validateAnswerCitations } from '@/lib/ai/answerCitations'

export function AnswerWithSources({ claims, sources }: { claims: AssistantClaim[]; sources: AssistantSource[] }) {
  const byId = new Map(sources.map((item) => [item.id, item]))
  const visibleClaims = claims.filter((item) => validateAnswerCitations({ claims: [item] }, sources))
  return (
    <section aria-live="polite" aria-label="Fleetvera answer" className="space-y-4">
      {visibleClaims.map((item, index) => (
        <article key={`${index}:${item.text}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-slate-800">{item.text}</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Sources">
            {item.citationIds.map((id) => {
              const itemSource = byId.get(id)
              if (!itemSource?.href.startsWith('/')) return null
              return (
                <Link
                  key={id}
                  href={itemSource.href}
                  aria-label={`Source: ${itemSource.label}`}
                  className="inline-flex min-h-11 items-center rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  Source: {itemSource.label}
                </Link>
              )
            })}
          </div>
        </article>
      ))}
    </section>
  )
}
