import { type ReactNode } from 'react';
import { Bell, BriefcaseBusiness, CalendarDays, ChevronRight, CircleDollarSign, ClipboardList, FileWarning, Home, LogOut, Menu, Settings2, Users, Wrench, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useGetSession } from '@workspace/api-client-react';

type Role = 'customer' | 'worker' | 'cooperative_admin';

const customerNav = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/services', label: 'Find a service', icon: Wrench },
  { href: '/bookings', label: 'My bookings', icon: CalendarDays },
  { href: '/complaints', label: 'Complaints', icon: FileWarning },
];
const workerNav = [
  { href: '/worker/dashboard', label: 'Overview', icon: Home },
  { href: '/worker/requests', label: 'Job requests', icon: ClipboardList },
  { href: '/worker/bookings', label: 'My jobs', icon: CalendarDays },
  { href: '/worker/availability', label: 'Availability', icon: Settings2 },
  { href: '/worker/earnings', label: 'Earnings', icon: CircleDollarSign },
];
const adminNav = [
  { href: '/admin/dashboard', label: 'Overview', icon: Home },
  { href: '/admin/workers', label: 'Workers', icon: Users },
  { href: '/admin/bookings', label: 'All bookings', icon: CalendarDays },
];

function roleLabel(role?: Role) {
  return role === 'cooperative_admin' ? 'Cooperative admin' : role === 'worker' ? 'Worker' : 'Customer';
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const sessionQuery = useGetSession();
  const session = sessionQuery.data;
  const storedRole = typeof window !== 'undefined' ? window.localStorage.getItem('coopwork-role') : null;
  const role = (storedRole || session?.role || 'customer') as Role;
  const nav = role === 'worker' ? workerNav : role === 'cooperative_admin' ? adminNav : customerNav;
  const at = (href: string) => location === href;
  const switchRole = () => {
    window.localStorage.removeItem('coopwork-role');
    setLocation('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" data-testid="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">cw</div>
          <div className="brand-name">CoopWork</div>
        </div>
        <div className="sidebar-label">{roleLabel(role)} workspace</div>
        <nav className="nav-list" aria-label="Primary navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-item ${at(href) ? 'active' : ''}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
              {at(href) && <ChevronRight size={13} className="ml-auto" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link href="/profile" className={`nav-item ${at('/profile') ? 'active' : ''}`} data-testid="link-profile">
            <Users size={16} strokeWidth={1.8} /><span>Profile</span>
          </Link>
          <button className="nav-item w-full border-0 bg-transparent text-left" onClick={switchRole} data-testid="button-switch-role">
            <LogOut size={16} strokeWidth={1.8} /><span>Switch demo role</span>
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => document.querySelector('.sidebar')?.classList.toggle('!flex')} aria-label="Open menu" data-testid="button-open-menu"><Menu size={17} /></button>
          <div className="crumb"><span className="font-mono-app">COOP /</span> {location.replace('/', '').replaceAll('/', ' / ') || 'overview'}</div>
          <div className="topbar-actions">
            <span className="role-pill">{roleLabel(role)}</span>
            <button className="icon-btn" onClick={() => window.alert('You are all caught up.')} aria-label="Notifications" data-testid="button-notifications"><Bell size={16} /></button>
            <Link href="/profile" className="avatar" data-testid="avatar-profile">{session?.name?.slice(0, 2).toUpperCase() || 'CW'}</Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function PageLoading() {
  return <main className="page" data-testid="state-loading"><div className="skeleton" style={{ height: 34, width: '35%', marginBottom: 28 }} /><div className="metric-grid">{[1, 2, 3, 4].map((n) => <div className="panel metric-card" key={n}><div className="skeleton" style={{ height: 11, width: '52%' }} /><div className="skeleton" style={{ height: 27, width: '42%', marginTop: 14 }} /></div>)}</div><div className="panel" style={{ height: 260 }} /></main>;
}

export function PageError({ message = 'We could not load this workspace.' }: { message?: string }) {
  return <main className="page"><div className="error-state" data-testid="state-error"><strong>{message}</strong><p style={{ margin: '6px 0 0' }}>Refresh the page to try again. If this keeps happening, your cooperative admin can help.</p></div></main>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`} data-testid={`status-${status}`}>{status.replaceAll('_', ' ')}</span>;
}

export function Avatar({ initials, tone = 'default' }: { initials: string; tone?: 'default' | 'dark' | 'gold' }) {
  return <div className={`avatar ${tone === 'dark' ? 'bg-primary text-primary-foreground' : tone === 'gold' ? 'bg-secondary text-secondary-foreground' : ''}`} data-testid={`avatar-${initials.toLowerCase()}`}>{initials}</div>;
}

export function EmptyState({ icon: Icon = BriefcaseBusiness, title, message, action }: { icon?: LucideIcon; title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="state-empty"><div className="empty-icon"><Icon size={21} /></div><strong>{title}</strong><p>{message}</p>{action}</div>;
}