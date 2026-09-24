import * as templates from '@/services/emailTemplates'

const xss = '<script>alert(1)</script>'
const attr = '" onmouseover="alert(1)'

function expectEscaped(html: string) {
  expect(html).not.toContain('<script>')
  expect(html).not.toContain('" onmouseover="')
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
}

describe('email template escaping', () => {
  it('escapes delivery assignment fields', () => {
    const { html, text } = templates.deliveryAssignedEmail(
      { id: 'd1', customer: xss, address: attr, items: 2, scheduledTime: null },
      xss,
      attr,
    )
    expectEscaped(html)
    expect(html).toContain('&quot; onmouseover=&quot;alert(1)')
    // Plain-text version shows the original characters, not entities.
    expect(text).toContain(xss)
  })

  it('escapes status update fields and never interpolates an unknown status into style', () => {
    const { html } = templates.deliveryStatusUpdateEmail(
      { id: '"><script>x</script>', customer: xss, status: 'red;}</style><script>alert(1)</script>', progress: 10, driver: attr },
      'customer',
    )
    expectEscaped(html)
    expect(html).toContain('border-left-color: #6B7280;')
    expect(html).toContain('/track/%22%3E%3Cscript%3Ex%3C%2Fscript%3E"')
    expect(html).not.toContain('</style><script>')
  })

  it('uses the allow-listed colour for known statuses', () => {
    const { html } = templates.deliveryStatusUpdateEmail(
      { id: 'd1', customer: 'Acme', status: 'delivered', progress: 100, driver: null },
      'admin',
    )
    expect(html).toContain('border-left-color: #10B981;')
    expect(html).toContain('Status: DELIVERED')
  })

  it('escapes vehicle, maintenance, announcement, report and vending values', () => {
    const outputs = [
      templates.vehicleAddedEmail({ name: xss, type: xss, driver: attr, licensePlate: xss }, xss),
      templates.maintenanceDueEmail({ name: xss, nextService: attr }, [xss]),
      templates.maintenanceTaskCreatedEmail({ vehicle: xss, type: attr, dueDate: '2026-01-01', priority: 'x" onclick="' }, xss),
      templates.maintenanceOverdueEmail([{ vehicle: xss, type: attr, dueDate: '2026-01-01', daysOverdue: 2 }]),
      templates.clientWelcomeEmail(xss, attr),
      templates.announcementEmail({ message: `${xss}\nline two`, priority: 'normal', sentBy: attr }, xss),
      templates.dailyReportEmail({ date: '2026-01-01', totalDeliveries: 1, completedDeliveries: 1, pendingDeliveries: 0, activeVehicles: 1, maintenanceTasks: 0, alerts: [xss] }),
      templates.vendingMachineAlertEmail({ name: xss, location: attr, status: 'offline', openNotes: 1 }),
      templates.weeklySummaryEmail({ weekOf: '2026-01-01', deliveriesCompleted: 1, newClients: 0, maintenanceCompleted: 0, topDriver: xss, fleetUtilization: 50 }),
      templates.welcomeEmail(xss, 'https://fleet.example.com/login'),
    ]
    for (const { html } of outputs) {
      expect(html).not.toContain('<script>')
      expect(html).not.toContain('" onmouseover="')
      expect(html.toLowerCase()).not.toContain('" onclick="')
    }
    // Line breaks in announcements still render as <br> after escaping.
    expect(outputs[5].html).toContain('&lt;/script&gt;<br>line two')
  })

  it('neutralises non-http links and escapes URLs in attributes', () => {
    const reset = templates.passwordResetEmail('javascript:alert(1)')
    expect(reset.html).not.toContain('href="javascript:')
    expect(reset.html).toContain('href="#"')

    const photo = templates.deliveryCompletedEmail(
      { customer: xss, address: xss, driver: xss },
      'https://cdn.example.com/p.jpg?a=1&b="x"',
    )
    expectEscaped(photo.html)
    expect(photo.html).toContain('src="https://cdn.example.com/p.jpg?a=1&amp;b=&quot;x&quot;"')
  })
})
