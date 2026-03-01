import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { PageHeader } from '../PageHeader';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { getNotificationMeta, NotificationType } from '../../lib/notifications';
import {
  Check,
  Trash2,
  Filter,
  Bell,
  AlertTriangle,
  Wrench,
  Users,
  CreditCard,
  Shield,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { notify } from '../../services/notifications';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  data?: any;
}

const typeIcons: Record<NotificationType, React.ReactNode> = {
  MAINTENANCE_DUE: <Wrench className="h-5 w-5" />,
  VEHICLE_ALERT: <AlertTriangle className="h-5 w-5" />,
  TEAM_INVITE: <Users className="h-5 w-5" />,
  BILLING: <CreditCard className="h-5 w-5" />,
  SYSTEM: <Info className="h-5 w-5" />,
  SECURITY: <Shield className="h-5 w-5" />,
};

const typeLabels: Record<NotificationType, string> = {
  MAINTENANCE_DUE: 'Maintenance',
  VEHICLE_ALERT: 'Vehicle Alert',
  TEAM_INVITE: 'Team',
  BILLING: 'Billing',
  SYSTEM: 'System',
  SECURITY: 'Security',
};

export const NotificationList: React.FC = () => {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<NotificationType | 'all'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = async () => {
    if (!session?.user) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (selectedType !== 'all') params.append('type', selectedType);

      const response = await fetch(`/api/notifications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setTotalPages(data.pages);
        setTotalCount(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      notify.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [session, page, selectedType]);

  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            notificationIds.includes(n.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n
          )
        );
        setSelectedItems(new Set());
        notify.success('Marked as read');
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
      notify.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
        );
        notify.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      notify.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (notificationIds: string[]) => {
    try {
      for (const id of notificationIds) {
        await fetch(`/api/notifications?id=${id}`, {
          method: 'DELETE',
        });
      }
      
      setNotifications(prev => prev.filter(n => !notificationIds.includes(n.id)));
      setSelectedItems(new Set());
      notify.success('Notifications deleted');
    } catch (error) {
      console.error('Failed to delete notifications:', error);
      notify.error('Failed to delete notifications');
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === notifications.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(notifications.map(n => n.id)));
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Notifications' },
      ]}
    >
      <PageHeader
        title="Notifications"
        subtitle={`You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                iconLeft={<Check className="h-4 w-4" />}
              >
                Mark all read
              </Button>
            )}
          </div>
        }
      />

      <Card>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Button
              variant={selectedType === 'all' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType('all')}
            >
              All
            </Button>
            {Object.entries(typeLabels).map(([type, label]) => (
              <Button
                key={type}
                variant={selectedType === type ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedType(type as NotificationType)}
              >
                {label}
              </Button>
            ))}
          </div>

          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                {selectedItems.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAsRead(Array.from(selectedItems))}
                iconLeft={<Check className="h-4 w-4" />}
              >
                Mark read
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(Array.from(selectedItems))}
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Notifications Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No notifications</h3>
            <p className="text-slate-500">
              {selectedType === 'all' 
                ? "You're all caught up!" 
                : `No ${typeLabels[selectedType as NotificationType]} notifications found.`}
            </p>
          </div>
        ) : (
          <>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === notifications.length && notifications.length > 0}
                        onChange={selectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {notifications.map((notification) => {
                    const meta = getNotificationMeta(notification.type);
                    return (
                      <tr
                        key={notification.id}
                        className={`hover:bg-slate-50 ${!notification.read ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(notification.id)}
                            onChange={() => toggleSelection(notification.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg ${meta.bgColor} ${meta.color}`}>
                            {typeIcons[notification.type]}
                            <span className="text-sm font-medium">{typeLabels[notification.type]}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className={`font-medium ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-slate-500 line-clamp-1">
                              {notification.message}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-600">
                            {format(new Date(notification.createdAt), 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {notification.read ? (
                            <Badge variant="default" size="sm">Read</Badge>
                          ) : (
                            <Badge variant="primary" size="sm">Unread</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead([notification.id])}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete([notification.id])}
                              title="Delete"
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-slate-500">
                  Showing {notifications.length} of {totalCount} notifications
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    iconLeft={<ChevronLeft className="h-4 w-4" />}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    iconRight={<ChevronRight className="h-4 w-4" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </DashboardLayout>
  );
};

export default NotificationList;
