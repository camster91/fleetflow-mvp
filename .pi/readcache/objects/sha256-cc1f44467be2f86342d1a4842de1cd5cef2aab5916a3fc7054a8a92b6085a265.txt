import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import { LayoutDashboard, Car, Package, Wrench, Users, BarChart3, Settings, Search, Menu, X, ChevronDown, ChevronRight, LogOut, HelpCircle, FileText, CreditCard, MoreHorizontal } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface NavItem { id: string; label: string; icon: React.ElementType; href?: string; children?: { id: string; label: string; href: string }[]; }

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'vehicles', label: 'Vehicles', icon: Car, children: [{ id: 'vehicle-list', label: 'Vehicle List', href: '/vehicles' }, { id: 'add-vehicle', label: 'Add New', href: '/vehicles?action=add' }] },
  { id: 'deliveries', label: 'Deliveries', icon: Package, href: '/deliveries' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, href: '/maintenance' },
  { id: 'team', label: 'Team', icon: Users, href: '/team' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'billing', label: 'Billing', icon: CreditCard, href: '/billing' },
];

interface BottomTabBarProps {
  role: string | undefined;
  currentPath: string;
  onOpenSidebar: () => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ role, currentPath, onOpenSidebar }) => {
  const ROLE_TABS = {
    driver: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
      { href: '/deliveries', icon: Package, label: 'Deliveries' },
      { href: '/vehicles', icon: Car, label: 'Vehicle' },
      { href: '/maintenance', icon: Wrench, label: 'Inspect' },
      { href: '#more', icon: MoreHorizontal, label: 'More' },
    ],
    dispatch: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
      { href: '/deliveries', icon: Package, label: 'Clients' },
      { href: '/vehicles', icon: Car, label: 'Vehicles' },
      { href: '/team', icon: Users, label: 'Team' },
      { href: '#more', icon: MoreHorizontal, label: 'More' },
    ],
    maintenance: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
      { href: '/maintenance', icon: Wrench, label: 'Tasks' },
      { href: '/vehicles', icon: Car, label: 'Vehicles' },
      { href: '/analytics', icon: BarChart3, label: 'Reports' },
      { href: '#more', icon: MoreHorizontal, label: 'More' },
    ],
    finance: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
      { href: '/billing', icon: CreditCard, label: 'Billing' },
      { href: '/analytics', icon: BarChart3, label: 'Reports' },
      { href: '/team', icon: Users, label: 'Team' },
      { href: '#more', icon: MoreHorizontal, label: 'More' },
    ],
    default: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
      { href: '/vehicles', icon: Car, label: 'Vehicles' },
      { href: '/deliveries', icon: Package, label: 'Deliveries' },
      { href: '/analytics', icon: BarChart3, label: 'Analytics' },
      { href: '#more', icon: MoreHorizontal, label: 'More' },
    ],
  };

  const tabs = ROLE_TABS[role as keyof typeof ROLE_TABS] || ROLE_TABS.default;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-slate-200 shadow-lg">
      <div className="flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isTabActive = currentPath === tab.href || (tab.href !== '/dashboard' && tab.href !== '#more' && currentPath.startsWith(tab.href));

          if (tab.href === '#more') {
            return (
              <button
                key="more"
                onClick={onOpenSidebar}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors active:bg-slate-50 select-none"
                style={{ touchAction: 'manipulation' }}
                aria-label="Open menu"
              >
                <Icon className="h-5 w-5 text-slate-400" />
                <span className="text-[10px] font-medium text-slate-500">{tab.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors active:bg-slate-50 select-none"
              style={{ touchAction: 'manipulation' }}
            >
              {isTabActive ? (
                <span className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                  <span className="text-[10px] font-medium text-blue-600">{tab.label}</span>
                </span>
              ) : (
                <>
                  <Icon className="h-5 w-5 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-500">{tab.label}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, subtitle, actions, breadcrumbs }) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['vehicles']);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const h = () => setSidebarOpen(false);
    router.events.on('routeChangeComplete', h);
    return () => router.events.off('routeChangeComplete', h);
  }, [router]);

  useEffect(() => {
    const h = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener('click', h);
      return () => document.removeEventListener('click', h);
    }
  }, [userMenuOpen]);

  const toggleSection = (id: string) =>
    setExpandedSections(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const isActive = (item: NavItem) => {
    if (item.href) return router.asPath === item.href || router.asPath.startsWith(item.href);
    if (item.children) return item.children.some(c => router.asPath === c.href);
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <Link href="/dashboard">
            <img src="/brand/logo/logo-horizontal.svg" alt="FleetFlow" className="h-7 w-auto" />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isActive(item);
              const hasChildren = !!item.children?.length;
              const expanded = expandedSections.includes(item.id);
              return (
                <div key={item.id}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleSection(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && item.children && (
                        <div className="mt-1 ml-4 pl-4 border-l border-slate-200 space-y-1">
                          {item.children.map(child => (
                            <Link key={child.id} href={child.href} className={`block px-3 py-2 rounded-lg text-sm transition-colors ${router.asPath === child.href ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link href={item.href || '#'} className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                      <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resources</p>
            <div className="space-y-1">
              <Link href="/docs" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                <FileText className="h-5 w-5 text-slate-400" /><span>Documentation</span>
              </Link>
              <Link href="/help" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                <HelpCircle className="h-5 w-5 text-slate-400" /><span>Help Center</span>
              </Link>
            </div>
          </div>
        </nav>

        {/* User profile */}
        <div className="border-t border-slate-200 p-4">
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
              className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-blue-900 flex items-center justify-center">
                <span className="text-white font-medium">{session?.user?.name?.charAt(0) || 'U'}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900 truncate">{session?.user?.name || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{session?.user?.email || 'user@example.com'}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                <Link href="/settings" className="flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <Settings className="h-4 w-4" /><span>Settings</span>
                </Link>
                <button onClick={() => signOut({ callbackUrl: '/auth/login' })} className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /><span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <BottomTabBar
        role={session?.user?.role as string | undefined}
        currentPath={router.asPath}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main content */}
      <div className="lg:ml-72 min-h-screen flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-600 bg-slate-100 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              {breadcrumbs && (
                <nav className="hidden sm:flex items-center space-x-2 text-sm">
                  {breadcrumbs.map((crumb, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                      {crumb.href
                        ? <Link href={crumb.href} className="text-slate-500 hover:text-slate-700">{crumb.label}</Link>
                        : <span className="text-slate-900 font-medium">{crumb.label}</span>
                      }
                    </React.Fragment>
                  ))}
                </nav>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search..." className="w-64 pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all" />
                </div>
              </div>
              <button onClick={() => setSearchOpen(!searchOpen)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <Search className="h-5 w-5" />
              </button>
              <NotificationBell />
              {actions && <div className="hidden sm:flex items-center space-x-2">{actions}</div>}
            </div>
          </div>
          {searchOpen && (
            <div className="md:hidden px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search..." autoFocus className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-900" />
              </div>
            </div>
          )}
        </header>

        {/* Page header */}
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

        {/* Page content — pb-20 on mobile so content clears the bottom tab bar */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
