import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NAV_ITEMS } from './navConfig';

const SIDEBAR_STORAGE_KEY = 'nutriflow:sidebar-collapsed';
const MOBILE_BREAKPOINT = 768; // Tailwind's `md`

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

export function DashboardLayout({ children, pageTitle: pageTitleProp }: { children: ReactNode; pageTitle?: string }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Remember collapsed/expanded state across refreshes
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
      setMobileOpen((open) => !open);
    } else {
      setCollapsed((c) => !c);
    }
  }, []);

  const pageTitle = pageTitleProp ?? NAV_ITEMS.find((item) => location.pathname === item.path)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onToggleCollapse={toggleSidebar} />

      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          collapsed ? 'md:pl-20' : 'md:pl-[260px]'
        }`}
      >
        <Topbar pageTitle={pageTitle} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
