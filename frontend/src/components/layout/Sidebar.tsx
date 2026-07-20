import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navConfig';
import { NutriFlowLogoIcon } from '../Logo';
import { Toast } from '../clients/Toast';
import { useState } from 'react';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  clientCount: number | null;
}

const LOCKED_PATHS = ['/dashboard/diet-plan', '/dashboard/appointments'];

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse, clientCount }: SidebarProps) {
  const [showLockedToast, setShowLockedToast] = useState(false);
  const isLocked = clientCount === 0;
  return (
    <>
      <div onClick={onCloseMobile} aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`} />

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out
          ${collapsed ? 'md:w-20' : 'md:w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Header with Logo and Hamburger */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <NutriFlowLogoIcon size={28} />
            {!collapsed && (
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                NutriFlow
              </span>
            )}
          </div>
          <button onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors">
            {collapsed ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const itemLocked = isLocked && LOCKED_PATHS.includes(item.path);
            return (
              <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'}
                onClick={(e) => {
                  if (itemLocked) {
                    e.preventDefault();
                    setShowLockedToast(true);
                    return;
                  }
                  onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                  ${collapsed ? 'md:justify-center md:px-0' : ''}
                  ${isActive ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`
                }>
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {showLockedToast && (
        <Toast message="Add a client first to unlock this section" onClose={() => setShowLockedToast(false)} />
      )}
    </>
  );
}