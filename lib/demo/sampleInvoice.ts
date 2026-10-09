/** Static fictional invoice; no filesystem, uploaded data, or external service. */
export function sampleInvoicePdf(): Buffer {
  const lines = [
    'SAMPLE - Fictional service invoice',
    'Example Fleet Service',
    'Vehicle: Sprinter 01',
    'Oil and filter service: $180.00',
    'Total: $180.00',
    'SAMPLE: Oil and filter service for Sprinter 01. Total $180.',
    'Demo only. No payment is due.',
  ]
  const stream = `BT /F1 16 Tf 50 750 Td ${lines.map((line, i) => `${i ? '0 -30 Td ' : ''}(${line}) Tj`).join('\n')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [i, value] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${value}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}
