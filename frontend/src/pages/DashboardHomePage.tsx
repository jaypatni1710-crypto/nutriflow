import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../lib/client.api';
import { appointmentApi, ApiAppointment } from '../lib/appointment.api';
import { dietPlanApi } from '../lib/diet-plan.api';
import { ClientListItem } from '../types/client.types';
import { StatusBadge } from '../components/clients/Enhancements';

// Minimal shape used on this page — avoids depending on the diet-plan types
// module import path used elsewhere, since we only need a few fields here.
interface DietPlan {
  id: string;
  client_id: string;
  client_name: string;
  created_at: string;
  closure_status: string | null;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}

function todayDateKey() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// For each client, "Sent" means at least one of their diet plans was closed
// with closure_status "sent" — purely plan-based, no appointment tag involved.
function computeSentByClient(plans: DietPlan[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  plans.forEach((p) => {
    if (p.closure_status === 'sent') result[p.client_id] = true;
  });
  return result;
}

interface ActivityItem {
  id: string;
  icon: 'appointment' | 'diet_plan' | 'client';
  label: string;
  timeLabel: string;
  createdAt: string;
  onClick: () => void;
}

function ActivityIcon({ type }: { type: ActivityItem['icon'] }) {
  const common = 'w-4 h-4';
  if (type === 'appointment') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }
  if (type === 'diet_plan') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

const ICON_STYLES: Record<ActivityItem['icon'], string> = {
  appointment: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  diet_plan: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
  client: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

function formatRelativeOrDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function TemporaryAccessBanner({ expiryDate, onDismiss }: { expiryDate: Date; onDismiss: () => void }) {
  const formatted = expiryDate.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return (
    <div className="mb-6 rounded-xl bg-amber-50 border border-amber-300 px-5 py-4 flex items-start gap-3">
      <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-amber-800 text-sm">⚠️ Temporary Access Enabled</p>
        <p className="text-amber-700 text-sm mt-0.5">
          Your access is valid until <strong>{formatted}</strong>. Please contact the administrator to restore your account.
        </p>
        <p className="text-amber-600 text-xs mt-1">📞 7874994587 &nbsp;|&nbsp; ✉️ jd.software2025@gmail.com</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-amber-500 hover:text-amber-700 shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function TemporaryAccessExpiredBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 rounded-xl bg-red-50 border border-red-300 px-5 py-4 flex items-start gap-3">
      <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-red-800 text-sm">❌ Temporary Access Expired</p>
        <p className="text-red-700 text-sm mt-0.5">
          Your temporary access has expired. Please contact the administrator.
        </p>
        <p className="text-red-600 text-xs mt-1">📞 7874994587 &nbsp;|&nbsp; ✉️ jd.software2025@gmail.com</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-red-500 hover:text-red-700 shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const [tempAccessEnd, setTempAccessEnd] = useState<Date | null>(null);
  const [tempAccessExpired, setTempAccessExpired] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [recentClients, setRecentClients] = useState<ClientListItem[]>([]);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('temporary_access_end');
    if (stored) {
      const d = new Date(stored);
      if (!isNaN(d.getTime())) {
        if (d > new Date()) {
          setTempAccessEnd(d);
        } else {
          setTempAccessExpired(true);
        }
      }
    }
  }, []);

  const loadStats = async (silent = false) => {
    try {
      const [activeRes, recentRes, apptRes, plansRes] = await Promise.all([
        clientApi.list({ status: 'active', limit: 1 }),
        clientApi.list({ limit: 20 }),
        appointmentApi.list(),
        dietPlanApi.list(),
      ]);
      setActiveClientsCount(activeRes.total);
      setRecentClients(recentRes.data);
      setAppointments(apptRes.data);
      setDietPlans(plansRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Refresh data every 60s so counts (diet plan sent, appointments) stay current
    const dataTimer = setInterval(() => loadStats(true), 60000);
    return () => clearInterval(dataTimer);
  }, []);

  // Ticks every 30s so "Appointments Today" re-evaluates against the current
  // time and auto-drops appointments once their end time has passed.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clockTimer);
  }, []);

  const todayKey = todayDateKey();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const appointmentsToday = useMemo(
    () => appointments.filter((a) => a.appt_date === todayKey && a.time_to > nowTimeStr).length,
    [appointments, todayKey, nowTimeStr]
  );

  const upcomingSessions = useMemo(
    () => appointments.filter((a) => a.appt_date > todayKey || (a.appt_date === todayKey && a.time_to > nowTimeStr)).length,
    [appointments, todayKey, nowTimeStr]
  );

  const sentByClient = useMemo(() => computeSentByClient(dietPlans), [dietPlans]);
  const dietPlansSentCount = useMemo(
    () => Object.values(sentByClient).filter(Boolean).length,
    [sentByClient]
  );

  const topClients = recentClients.slice(0, 5);

  const recentActivity = useMemo(() => {
    const items: ActivityItem[] = [];

    appointments.forEach((a) => {
      items.push({
        id: `appt-${a.id}`,
        icon: 'appointment',
        label: `Created appointment for ${a.client_name}`,
        timeLabel: formatRelativeOrDate(a.created_at),
        createdAt: a.created_at,
        onClick: () => navigate('/dashboard/appointments'),
      });
    });

    dietPlans.forEach((p) => {
      items.push({
        id: `plan-${p.id}`,
        icon: 'diet_plan',
        label: `Created diet plan for ${p.client_name}`,
        timeLabel: formatRelativeOrDate(p.created_at),
        createdAt: p.created_at,
        onClick: () => navigate('/dashboard/diet-plan'),
      });
    });

    recentClients.forEach((c: any) => {
      if (!c.created_at) return;
      items.push({
        id: `client-${c.id}`,
        icon: 'client',
        label: `Added new client ${c.first_name} ${c.last_name}`,
        timeLabel: formatRelativeOrDate(c.created_at),
        createdAt: c.created_at,
        onClick: () => navigate(`/dashboard/clients/${c.id}`),
      });
    });

    return items
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .slice(0, 5);
  }, [appointments, dietPlans, recentClients, navigate]);

  return (
    <div>
      {!dismissed && tempAccessEnd && (
        <TemporaryAccessBanner expiryDate={tempAccessEnd} onDismiss={() => setDismissed(true)} />
      )}
      {!dismissed && !tempAccessEnd && tempAccessExpired && (
        <TemporaryAccessExpiredBanner onDismiss={() => setDismissed(true)} />
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome back</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here&apos;s an overview of your practice.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Active Clients"
          value={loading ? '—' : String(activeClientsCount)}
          hint={activeClientsCount === 0 ? 'No active clients yet' : 'Currently active'}
        />
        <StatCard
          label="Appointments Today"
          value={loading ? '—' : String(appointmentsToday)}
          hint={appointmentsToday === 0 ? 'Nothing left today' : 'Remaining for today'}
        />
        <StatCard
          label="Upcoming Appointments"
          value={loading ? '—' : String(upcomingSessions)}
          hint={upcomingSessions === 0 ? 'Nothing scheduled' : 'From today onward'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <StatCard
          label="Diet Plans Created"
          value={loading ? '—' : String(dietPlans.length)}
          hint={dietPlans.length === 0 ? 'No plans created yet' : 'Total created'}
        />
        <StatCard
          label="No. of Clients Received Diet Plan"
          value={loading ? '—' : String(dietPlansSentCount)}
          hint={dietPlansSentCount === 0 ? 'No clients received a plan yet' : 'Clients who have received a diet plan'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
          {loading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No activity yet. Start by adding a client.</p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${ICON_STYLES[item.icon]}`}>
                    <ActivityIcon type={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-700 dark:text-slate-200 truncate">{item.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{item.timeLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top Clients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Top Clients</h3>
          {loading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
          ) : topClients.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No clients added yet.</p>
          ) : (
            <div className="space-y-1">
              {topClients.map((c) => {
                const initials = `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase();
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-bold">
                      {initials || '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {c.first_name} {c.last_name}
                      </span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{c.primary_goal || 'No goal set'}</span>
                    </span>
                    <StatusBadge status={c.status} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}