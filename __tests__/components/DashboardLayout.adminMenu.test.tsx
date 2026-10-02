import { fireEvent, render, screen, within } from '@testing-library/react'

let mockRole = 'user'
let mockPath = '/dashboard'
jest.mock('@/lib/session', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: { name: 'Sam', email: 'sam@example.com', role: mockRole } },
  }),
  signOut: jest.fn(),
}))
jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: mockPath,
    pathname: mockPath,
    push: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))
jest.mock('next/image', () => ({ __esModule: true, default: (props: { alt: string }) => <span>{props.alt}</span> }))
jest.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => null }))
jest.mock('@/components/PlanBanner', () => ({ PlanBanner: () => null }))
jest.mock('@/components/WorkspaceSwitcher', () => ({ WorkspaceSwitcher: () => null }))

import { DashboardLayout } from '@/components/layouts/DashboardLayout'

const renderLayout = () =>
  render(
    <DashboardLayout>
      <p>Page</p>
    </DashboardLayout>
  )

beforeEach(() => {
  mockRole = 'user'
  mockPath = '/dashboard'
})

test('platform admins get an Admin section linking every admin page', () => {
  mockRole = 'admin'
  renderLayout()
  const nav = screen.getByRole('navigation')
  fireEvent.click(within(nav).getByRole('button', { name: 'Admin' }))
  const links = [
    ['Launch readiness', '/admin/launch'],
    ['Customers & users', '/admin/users'],
    ['Platform settings', '/admin/settings'],
    ['Email delivery', '/admin/email-delivery'],
    ['AI health', '/admin/ai-health'],
    ['Pilot', '/admin/pilot'],
  ]
  for (const [name, href] of links) expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href)
})

test('the Admin section starts open on an admin page', () => {
  mockRole = 'admin'
  mockPath = '/admin/settings'
  renderLayout()
  expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Platform settings' })).toBeInTheDocument()
})

test.each(['user', 'fleet_manager', undefined])('role %p sees no Admin section', (role) => {
  mockRole = role as string
  renderLayout()
  expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
})
