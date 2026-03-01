import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import {
  Truck,
  LayoutDashboard,
  Car,
  Package,
  Wrench,
  Users,
  BarChart3,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  HelpCircle,
  FileText,
  Coffee,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { id: string; label: string; href: string }[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  {
    id: 'vehicles',
    label: 'Vehicles',
    icon: Car,
    children: [
      { id: 'vehicle-list', label: 'Vehicle List', href: '/?tab=vehicles' },
      { id: 'add-vehicle', label: 'Add New', href: '/?tab=vehicles&action=add' },
    ],
  },
  { id: 'deliveries', label: 'Deliveries', icon: Package, href: '/?tab=deliveries' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, href: '/?tab=maintenance' },
  { id: 'clients', label: 'Clients', icon: Users, href: '/?tab=clients' },
  { id: 'vending', label: 'Vending', icon: Coffee, href: '/?tab=vending' },
  { id: 'reports', label: 'Reports', icon: BarChart3, href: '/?tab=reports' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  actions,
  breadcrumbs,
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['vehicles']);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const handleRouteChange = () => setSidebarOpen(false);
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setNotificationsOpen(false);
      setUserMenuOpen(false);
    };
    if (notificationsOpen || userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [notificationsOpen, userMenuOpen]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (item: NavItem) => {
    if (item.href) {
      return router.asPath === item.href || router.asPath.startsWith(item.href);
    }
    if (item.children) {
      return item.children.some((child) => router.asPath === child.href);
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200
          transform transition-transform duration-300 ease-in-out lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <Link href="/" className="flex items-center space-x-3">
            <div className="p-2 bg-blue-900 rounded-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">FleetFlow</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              const hasChildren = item.children && item.children.length > 0;
              const expanded = expandedSections.includes(item.id);

              return (
                <div key={item.id}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleSection(item.id)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                          ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {expanded && item.children && (
                        <div className="mt-1 ml-4 pl-4 border-l border-slate-200 space-y-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.id}
                              href={child.href}
                              className={`
                                block px-3 py-2 rounded-lg text-sm transition-colors
                                ${router.asPath === child.href
                                  ? 'bg-blue-50 text-blue-900 font-medium'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }
                              `}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href || '#'}
                      className={`
                        flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                      `}
                    >
                      <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Documentation Section */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Resources
            </p>
            <div className="space-y-1">
              <Link
                href="/docs"
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <FileText className="h-5 w-5 text-slate-400" />
                <span>Documentation</span>
              </Link>
              <Link
                href="/help"
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <HelpCircle className="h-5 w-5 text-slate-400" />
                <span>Help Center</span>
              </Link>
            </div>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-slate-200 p-4">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(!userMenuOpen);
              }}
              className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-blue-900 flex items-center justify-center">
                <span className="text-white font-medium">
                  {session?.user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {session?.user?.email || 'user@example.com'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                <Link
                  href="/settings"
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:ml-72 min-h-screen flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Left: Menu Button & Breadcrumbs */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <Menu className="h-5 w-5" />
              </button>

              {breadcrumbs && (
                <nav className="hidden sm:flex items-center space-x-2 text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                      {crumb.href ? (
                        <Link
                          href={crumb.href}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-slate-900 font-medium">{crumb.label}</span>
                      )}
                    </React.Fragment>
                  ))}
                </nav>
              )}
            </div>

            {/* Right: Search, Notifications, Actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Search */}
              <div className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-64 pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Mobile Search Button */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotificationsOpen(!notificationsOpen);
                  }}
                  className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <h3 className="font-medium text-slate-900">Notifications</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                        <p className="text-sm text-slate-900">Maintenance due for Truck #3</p>
                        <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
                      </div>
                      <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                        <p className="text-sm text-slate-900">New delivery assigned</p>
                        <p className="text-xs text-slate-500 mt-1">5 hours ago</p>
                      </div>
                    </div>
                    <div className="px-4 py-2 border-t border-slate-100">
                      <Link href="/notifications" className="text-sm text-blue-600 hover:text-blue-700">
                        View all notifications
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {actions && <div className="hidden sm:flex items-center space-x-2">{actions}</div>}
            </div>
          </div>

          {/* Mobile Search Bar */}
          {searchOpen && (
            <div className="md:hidden px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>
          )}
        </header>

        {/* Page Header */}
        {(title || subtitle) && (
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {title && <h1 className="text-2xl font-bold text-slate-900">{title}</h1>}
                {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
              </div>
              {actions && <div className="flex sm:hidden items-center space-x-2">{actions}</div>}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
