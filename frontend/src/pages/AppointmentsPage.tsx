import { useEffect, useMemo, useRef, useState } from 'react';
import { clientApi } from '../lib/client.api';
import { ClientListItem } from '../types/client.types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type AppointmentStatus = 'new' | 'ongoing' | 'follow_up' | 'completed' | 'cancelled';

const STATUS_META: Record<AppointmentStatus, { label: string; dot: string; badge: string; desc: string }> = {
  new: { label: 'New', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', desc: 'First-time / newly booked client' },
  ongoing: { label: 'Ongoing', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', desc: 'Diet plan currently in progress' },
  follow_up: { label: 'Follow-up', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', desc: 'Review / progress check-in' },
  completed: { label: 'Completed', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', desc: 'Appointment done' },
  cancelled: { label: 'Cancelled', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', desc: 'Appointment cancelled / no-show' },
};

interface AppointmentSettings {
  maxPerDay: number | '';
  durationMinutes: number | '';
  workingStart: string;
  workingEnd: string;
}

interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  status: AppointmentStatus;
  date: string;
  timeFrom: string;
  timeTo: string;
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayDateKey() {
  const t = new Date();
  return toDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function SettingsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: AppointmentSettings;
  onClose: () => void;
  onSave: (settings: AppointmentSettings) => void;
}) {
  const [maxPerDay, setMaxPerDay] = useState<number | ''>(initial.maxPerDay);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(initial.durationMinutes);
  const [workingStart, setWorkingStart] = useState(initial.workingStart);
  const [workingEnd, setWorkingEnd] = useState(initial.workingEnd);

  const handleSave = () => {
    onSave({ maxPerDay, durationMinutes, workingStart, workingEnd });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Appointment Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Total Number of Appointments Per Day
            </label>
            <input
              type="number"
              min={0}
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Appointment Duration (minutes) <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min={0}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 30"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Working Hours <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={workingStart}
                onChange={(e) => setWorkingStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-slate-400 text-sm shrink-0">to</span>
              <input
                type="time"
                value={workingEnd}
                onChange={(e) => setWorkingEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              You can only create appointments within this time range.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAppointmentModal({
  date,
  initial,
  onClose,
  onSave,
}: {
  date: Date | null;
  initial: Appointment | null;
  onClose: () => void;
  onSave: (appt: Omit<Appointment, 'id'>) => void;
}) {
  const todayKey = todayDateKey();

  const [clientQuery, setClientQuery] = useState(initial?.clientName || '');
  const [clientId, setClientId] = useState(initial?.clientId || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [status, setStatus] = useState<AppointmentStatus>(initial?.status || 'new');
  const [apptDate, setApptDate] = useState(
    initial?.date || (date ? toDateKey(date.getFullYear(), date.getMonth(), date.getDate()) : '')
  );
  const [timeFrom, setTimeFrom] = useState(initial?.timeFrom || '');
  const [timeTo, setTimeTo] = useState(initial?.timeTo || '');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = clientQuery.trim();
    if (!q) { setClients([]); return; }
    const t = setTimeout(() => {
      clientApi.list({ search: q, limit: 8 }).then((res) => setClients(res.data)).catch(() => setClients([]));
    }, 250);
    return () => clearTimeout(t);
  }, [clientQuery]);

  const handleSelectClient = (c: ClientListItem) => {
    setClientId(c.id);
    setClientQuery(`${c.first_name} ${c.last_name}`);
    setShowDropdown(false);
  };

  const isPastDate = apptDate !== '' && apptDate < todayKey;
  const canSave = clientId && apptDate && !isPastDate && timeFrom && timeTo;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ clientId, clientName: clientQuery, status, date: apptDate, timeFrom, timeTo });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          {initial ? 'Edit Appointment' : 'Add Appointment'}
        </h3>

        <div className="space-y-4">
          <div className="relative" ref={wrapperRef}>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Select Client</label>
            <input
              type="text"
              value={clientQuery}
              onChange={(e) => { setClientQuery(e.target.value); setClientId(''); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type client name..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {showDropdown && clients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {c.first_name} {c.last_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {(Object.keys(STATUS_META) as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            <div className="mt-2 space-y-1">
              {(Object.keys(STATUS_META) as AppointmentStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />
                  <span className="font-medium">{STATUS_META[s].label}:</span>
                  <span>{STATUS_META[s].desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Appointment Date</label>
            <input
              type="date"
              value={apptDate}
              min={todayKey}
              onChange={(e) => setApptDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {isPastDate && <p className="mt-1 text-xs text-red-500">Cannot create an appointment in the past.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Appointment Time</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-slate-400 text-sm shrink-0">to</span>
              <input
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewAppointmentModal({
  appt,
  onClose,
  onEdit,
}: {
  appt: Appointment;
  onClose: () => void;
  onEdit: () => void;
}) {
  const meta = STATUS_META[appt.status];
  const dateLabel = new Date(appt.date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md relative">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <button onClick={onEdit} title="Edit" aria-label="Edit appointment" className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button onClick={onClose} title="Close" aria-label="Close" className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 pr-16">Appointment Details</h3>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Client</p>
            <p className="text-slate-800 dark:text-slate-100 font-medium">{appt.clientName}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Status</p>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Date</p>
            <p className="text-slate-800 dark:text-slate-100">{dateLabel}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Time</p>
            <p className="text-slate-800 dark:text-slate-100">{appt.timeFrom} – {appt.timeTo}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const today = new Date();
  const todayKey = todayDateKey();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppointmentSettings>({
    maxPerDay: '',
    durationMinutes: '',
    workingStart: '',
    workingEnd: '',
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewingAppt, setViewingAppt] = useState<Appointment | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const goToPreviousMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const openAddAppointment = (day: number | null) => {
    if (day !== null && toDateKey(year, month, day) < todayKey) return;
    setEditingAppt(null);
    setSelectedDate(day ? new Date(year, month, day) : null);
    setShowAddAppointment(true);
  };

  const handleSaveAppointment = (data: Omit<Appointment, 'id'>) => {
    if (editingAppt) {
      setAppointments((prev) => prev.map((a) => (a.id === editingAppt.id ? { ...data, id: editingAppt.id } : a)));
    } else {
      setAppointments((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
    }
    setEditingAppt(null);
  };

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Appointments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View and manage client appointments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAddAppointment(null)}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Add Appointment
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
            className="p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{MONTH_NAMES[month]} {year}</h3>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">{wd}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            const isToday = isCurrentMonth && day === today.getDate();
            const dateKey = day ? toDateKey(year, month, day) : '';
            const dayAppts = day ? appointmentsByDate[dateKey] || [] : [];
            const isPast = day !== null && dateKey < todayKey;
            return (
              <div
                key={idx}
                onClick={() => day !== null && !isPast && dayAppts.length === 0 && openAddAppointment(day)}
                className={`h-16 sm:h-20 flex flex-col items-start justify-start p-2 rounded-lg text-sm overflow-hidden ${
                  day === null
                    ? ''
                    : isPast
                    ? 'bg-slate-50 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isToday
                    ? 'bg-teal-600 text-white font-semibold cursor-pointer hover:bg-teal-700'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{day ?? ''}</span>
                <div className="mt-1 w-full space-y-0.5">
                  {dayAppts.slice(0, 2).map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); setViewingAppt(a); }}
                      className={`text-[10px] leading-tight truncate px-1 py-0.5 rounded ${STATUS_META[a.status].badge}`}
                      title={a.clientName}
                    >
                      {a.clientName}
                    </div>
                  ))}
                  {dayAppts.length > 2 && <div className="text-[10px] text-slate-400">+{dayAppts.length - 2} more</div>}
                  {day !== null && !isPast && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddAppointment(day); }}
                      className={`text-[10px] mt-0.5 ${isToday ? 'text-white/80 hover:text-white' : 'text-teal-600 dark:text-teal-400 hover:underline'}`}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button onClick={goToPreviousMonth} className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Previous
          </button>
          <button onClick={goToNextMonth} className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Next
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal initial={settings} onClose={() => setShowSettings(false)} onSave={(s) => setSettings(s)} />
      )}

      {showAddAppointment && (
        <AddAppointmentModal
          date={selectedDate}
          initial={editingAppt}
          onClose={() => { setShowAddAppointment(false); setEditingAppt(null); }}
          onSave={handleSaveAppointment}
        />
      )}

      {viewingAppt && (
        <ViewAppointmentModal
          appt={viewingAppt}
          onClose={() => setViewingAppt(null)}
          onEdit={() => {
            setEditingAppt(viewingAppt);
            setSelectedDate(new Date(viewingAppt.date + 'T00:00:00'));
            setViewingAppt(null);
            setShowAddAppointment(true);
          }}
        />
      )}
    </div>
  );
}