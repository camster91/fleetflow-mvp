import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsPage from '@/pages/notifications'

jest.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
jest.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))
jest.mock('@/components/ui/Skeleton', () => ({ SkeletonTable: () => <div>Loading</div> }))
jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}))

const response = (body: unknown) => Promise.resolve({
  ok: true,
  json: async () => body,
})

describe('notifications pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
      .mockImplementationOnce(() => response({
        notifications: [{ id: 'n1', type: 'SYSTEM', title: 'First', message: 'One', createdAt: new Date().toISOString(), read: false }],
        hasMore: true,
        nextCursor: 'cursor-1',
      }))
      .mockImplementationOnce(() => response({
        notifications: [{ id: 'n2', type: 'SYSTEM', title: 'Second', message: 'Two', createdAt: new Date().toISOString(), read: true }],
        hasMore: false,
      }))
      .mockImplementationOnce(() => response({ notifications: [], hasMore: false })) as jest.Mock
  })

  it('uses the server cursor for more results and resets it when the filter changes', async () => {
    render(<NotificationsPage />)
    expect(await screen.findByText('First')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('Second')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('cursor=cursor-1')
    )

    await userEvent.click(screen.getByRole('button', { name: /Unread/ }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3))
    const filteredUrl = (global.fetch as jest.Mock).mock.calls[2][0] as string
    expect(filteredUrl).toContain('unreadOnly=true')
    expect(filteredUrl).not.toContain('cursor=')
  })
})
