export function downloadCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const text = String(v ?? '')
    const literal = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text
    return '"' + literal.replace(/"/g, '""') + '"'
  }
  const csv = [keys.map(escape).join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}
