import { readFileSync } from 'fs'
import { join } from 'path'

describe('document review state integrity', () => {
  const source = readFileSync(
    join(process.cwd(), 'pages/api/documents/[id]/extract.ts'),
    'utf8',
  )

  it('only saves drafts for extracted or already-reviewed documents', () => {
    const saveDraftBlock = source.slice(
      source.indexOf("if (parsed.data.action === 'save_draft')"),
      source.indexOf("if (parsed.data.action === 'preview')"),
    )

    expect(saveDraftBlock).toContain(
      "status: { in: ['EXTRACTED', 'REVIEWED'] }",
    )
    expect(saveDraftBlock).not.toContain("'CONFIRMED'")
  })

  it('keeps confirmation idempotent after a document reaches its terminal state', () => {
    expect(source).toContain(
      "const prior = await tx.documentExecution.findUnique({ where: { nonce: payload.nonce } })",
    )
    expect(source).toContain(
      "await tx.documentUpload.update({ where: { id: doc.id }, data: { status: 'CONFIRMED' } })",
    )
  })
})
