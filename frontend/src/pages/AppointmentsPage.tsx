import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../lib/client.api';
import { appointmentApi, ApiAppointment, ApiAppointmentSettings } from '../lib/appointment.api';
import { ClientListItem } from '../types/client.types';
import { Toast } from '../components/clients/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type AppointmentStatus = 'new' | 'ongoing' | 'follow_up' | 'completed' | 'cancelled';

export const STATUS_META: Record<AppointmentStatus, { label: string; dot: string; badge: string; desc: string }> = {
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

// Appointment tag presets. "other" unlocks a free-text input in the popup.
const TAG_OPTIONS = [
  { value: 'discussion', label: 'Discussion' },
  { value: 'diet_plan_discussion', label: 'Diet Plan Discussion' },
  { value: 'diet_plan_sent', label: 'Diet Plan Sent' },
  { value: 'follow_up_tag', label: 'Follow-up' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'other', label: 'Other' },
] as const;

// Resolves a tag value to its display label — falls back to the free-text
// value when tag === 'other'.
export function tagLabel(tag: string, tagOther: string): string {
  if (!tag) return '—';
  if (tag === 'other') return tagOther || 'Other';
  return TAG_OPTIONS.find((t) => t.value === tag)?.label || tag;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  status: AppointmentStatus;
  date: string;
  timeFrom: string;
  timeTo: string;
  notes: string;
  tag: string;
  tagOther: string;
  createdAt: string;
}

// ---- API <-> UI mapping helpers ----
export function apiToAppt(a: ApiAppointment): Appointment {
  return {
    id: a.id,
    clientId: a.client_id,
    clientName: a.client_name,
    status: a.status,
    date: a.appt_date,
    timeFrom: a.time_from,
    timeTo: a.time_to,
    notes: a.notes ?? '',
    tag: a.tag ?? '',
    tagOther: a.tag_other ?? '',
    createdAt: a.created_at,
  };
}

export function apptToApiBody(a: Omit<Appointment, 'id' | 'createdAt'>) {
  return {
    client_id: a.clientId,
    client_name: a.clientName,
    status: a.status,
    appt_date: a.date,
    time_from: a.timeFrom,
    time_to: a.timeTo,
    notes: a.notes ? a.notes : null,
    tag: a.tag ? a.tag : null,
    tag_other: a.tag === 'other' && a.tagOther ? a.tagOther : null,
  };
}

function settingsToApiBody(s: AppointmentSettings): ApiAppointmentSettings {
  return {
    max_per_day: s.maxPerDay === '' ? null : Number(s.maxPerDay),
    duration_minutes: s.durationMinutes === '' ? null : Number(s.durationMinutes),
    working_start: s.workingStart || null,
    working_end: s.workingEnd || null,
  };
}

function apiToSettings(s: ApiAppointmentSettings): AppointmentSettings {
  return {
    maxPerDay: s.max_per_day ?? '',
    durationMinutes: s.duration_minutes ?? '',
    workingStart: s.working_start ?? '',
    workingEnd: s.working_end ?? '',
  };
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

// Sorts appointments by their start time (earliest first)
function sortByTime(appts: Appointment[]): Appointment[] {
  return [...appts].sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
}

// Returns true once the appointment's end time (date + timeTo) is in the past.
export function isAppointmentPast(date: string, timeTo: string): boolean {
  if (!date || !timeTo) return false;
  return new Date(`${date}T${timeTo}:00`) < new Date();
}

// Returns true if [aStart, aEnd) overlaps [bStart, bEnd)
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

// Adds `minutes` to a "HH:MM" time string, capped at 23:59 (same day).
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  let total = h * 60 + m + minutes;
  total = Math.min(total, 23 * 60 + 59);
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
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
              Minimum Appointment Duration (minutes) <span className="text-slate-400 font-normal">(optional)</span>
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
            <p className="mt-1 text-xs text-slate-400">
              When set, the end time will auto-fill this many minutes after the start time when creating an appointment. You can still edit it manually.
            </p>
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

export function AddAppointmentModal({
  date,
  initial,
  presetClient,
  allAppointments,
  durationMinutes,
  workingStart,
  workingEnd,
  maxPerDay,
  onClose,
  onSave,
}: {
  date: Date | null;
  initial: Appointment | null;
  presetClient?: { id: string; name: string } | null;
  allAppointments: Appointment[];
  durationMinutes: number | '';
  workingStart: string;
  workingEnd: string;
  maxPerDay: number | '';
  onClose: () => void;
  onSave: (appt: Omit<Appointment, 'id' | 'createdAt'>) => void;
}) {
  const todayKey = todayDateKey();

  const [clientQuery, setClientQuery] = useState(initial?.clientName || presetClient?.name || '');
  const [clientId, setClientId] = useState(initial?.clientId || presetClient?.id || '');
  const clientLocked = !!presetClient;
  const [showDropdown, setShowDropdown] = useState(false);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [status, setStatus] = useState<AppointmentStatus>(initial?.status || 'new');
  const [apptDate, setApptDate] = useState(
    initial?.date || (date ? toDateKey(date.getFullYear(), date.getMonth(), date.getDate()) : '')
  );
  const [timeFrom, setTimeFrom] = useState(initial?.timeFrom || '');
  const [timeTo, setTimeTo] = useState(initial?.timeTo || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [tag, setTag] = useState(initial?.tag || '');
  const [tagOther, setTagOther] = useState(initial?.tagOther || '');
  // Tracks whether the "to" time was set by hand — once it has been, we stop
  // auto-filling it from the start time + default duration. Starts false even
  // when editing an existing appointment, so changing the start time still
  // auto-adjusts the end time (until the user edits it manually).
  const [timeToTouched, setTimeToTouched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lock background page scroll while this modal is open.
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
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

  const handleTimeFromChange = (value: string) => {
    setTimeFrom(value);
    if (!timeToTouched && durationMinutes !== '' && value) {
      setTimeTo(addMinutesToTime(value, Number(durationMinutes)));
    }
  };

  const handleTimeToChange = (value: string) => {
    setTimeTo(value);
    setTimeToTouched(true);
  };

  const isPastDate = apptDate !== '' && apptDate < todayKey;

  // Find any existing appointment on the same date (excluding the one being edited)
  // whose time range overlaps with the one currently being entered.
  const overlappingAppt = useMemo(() => {
    if (!apptDate || !timeFrom || !timeTo) return null;
    return allAppointments.find(
      (a) =>
        a.date === apptDate &&
        a.id !== initial?.id &&
        timesOverlap(timeFrom, timeTo, a.timeFrom, a.timeTo)
    ) || null;
  }, [allAppointments, apptDate, timeFrom, timeTo, initial?.id]);

  const isValidTimeRange = timeFrom !== '' && timeTo !== '' && timeFrom < timeTo;
  const hasOverlap = !!overlappingAppt;
  const isPastTime = apptDate === todayDateKey() && timeFrom !== '' && timeFrom < new Date().toTimeString().slice(0, 5);

  // Working-hours check: if working hours are configured, the appointment's
  // start and end time must both fall inside [workingStart, workingEnd].
  const hasWorkingHours = !!workingStart && !!workingEnd;
  const isWithinWorkingHours =
    !hasWorkingHours || !timeFrom || !timeTo || (timeFrom >= workingStart && timeTo <= workingEnd);

  // Other appointments for this SAME client on this SAME date (excluding the one
  // being edited). This is a soft warning only — it does not block saving. The
  // hard block is `hasOverlap` above, which applies to any client's time range.
  const sameClientSameDayAppts = useMemo(() => {
    if (!clientId || !apptDate) return [];
    return allAppointments.filter(
      (a) => a.clientId === clientId && a.date === apptDate && a.id !== initial?.id
    );
  }, [allAppointments, clientId, apptDate, initial?.id]);

  const hasSameClientSameDay = sameClientSameDayAppts.length > 0;

  // All appointments on this date, any client, excluding the one being
  // edited — used only for the max-per-day warning below. This never blocks
  // saving; it's a heads-up so you know you're going over the daily target.
  const sameDayAllClientsCount = useMemo(() => {
    if (!apptDate) return 0;
    return allAppointments.filter((a) => a.date === apptDate && a.id !== initial?.id).length;
  }, [allAppointments, apptDate, initial?.id]);

  const isOverMaxPerDay = maxPerDay !== '' && apptDate !== '' && sameDayAllClientsCount + 1 > Number(maxPerDay);

  const isTagValid = tag !== '' && (tag !== 'other' || tagOther.trim() !== '');

  const canSave =
    clientId && apptDate && !isPastDate && !isPastTime && timeFrom && timeTo && isValidTimeRange && !hasOverlap && isWithinWorkingHours && isTagValid && !isOverMaxPerDay;

  const handleSave = () => {
    if (!canSave || isPastTime) return;
    onSave({
      clientId,
      clientName: clientQuery,
      status,
      date: apptDate,
      timeFrom,
      timeTo,
      notes: notes.trim(),
      tag,
      tagOther: tag === 'other' ? tagOther.trim() : '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 shrink-0">
          {initial ? 'Edit Appointment' : 'Add Appointment'}
        </h3>

        <div className="space-y-4 overflow-y-auto px-1">
          <div className="relative" ref={wrapperRef}>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Select Client</label>
            {clientLocked ? (
              <input
                type="text"
                value={clientQuery}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
              />
            ) : (
              <>
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(e) => { setClientQuery(e.target.value); setClientId(''); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type client name..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
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
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
            />
            {isPastDate && <p className="mt-1 text-xs text-red-500">Cannot create an appointment in the past.</p>}
            {hasSameClientSameDay && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {clientQuery || 'This client'} already has {sameClientSameDayAppts.length} appointment{sameClientSameDayAppts.length > 1 ? 's' : ''} on this day ({sameClientSameDayAppts.map((a) => `${a.timeFrom}–${a.timeTo}`).join(', ')}). You can still save, just make sure the time doesn't overlap.
              </p>
            )}
            {isOverMaxPerDay && (
              <p className="mt-1 text-xs text-red-500">
                This day already has {sameDayAllClientsCount} appointment{sameDayAllClientsCount > 1 ? 's' : ''} booked, which is at or above your daily limit of {maxPerDay}. You cannot save this appointment.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Appointment Time</label>
            {hasWorkingHours && (
              <p className="mb-1 text-xs text-slate-400">
                Working hours: {workingStart} – {workingEnd}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeFrom}
                min={hasWorkingHours ? workingStart : undefined}
                max={hasWorkingHours ? workingEnd : undefined}
                onChange={(e) => handleTimeFromChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
              />
              <span className="text-slate-400 text-sm shrink-0">to</span>
              <input
                type="time"
                value={timeTo}
                min={hasWorkingHours ? workingStart : undefined}
                max={hasWorkingHours ? workingEnd : undefined}
                onChange={(e) => handleTimeToChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
              />
            </div>
            {durationMinutes !== '' && !timeToTouched && (
              <p className="mt-1 text-xs text-slate-400">
                End time auto-fills {durationMinutes} min after start — feel free to adjust it.
              </p>
            )}
            {!isValidTimeRange && timeFrom && timeTo && (
              <p className="mt-1 text-xs text-red-500">End time must be after start time.</p>
            )}
            {hasOverlap && overlappingAppt && (
              <p className="mt-1 text-xs text-red-500">
                This overlaps with {overlappingAppt.clientName}'s appointment ({overlappingAppt.timeFrom} – {overlappingAppt.timeTo}).
              </p>
            )}
            {isPastTime && !hasOverlap && (
              <p className="mt-1 text-xs text-red-500">
                This time has already passed today. Please pick a later time.
              </p>
            )}
            {!isWithinWorkingHours && (
              <p className="mt-1 text-xs text-red-500">
                Appointment must be within working hours ({workingStart} – {workingEnd}).
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Appointment Tag</label>
            <select
              value={tag}
              onChange={(e) => { setTag(e.target.value); if (e.target.value !== 'other') setTagOther(''); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
            >
              <option value="">Select a tag...</option>
              {TAG_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {tag === 'other' && (
              <input
                type="text"
                value={tagOther}
                onChange={(e) => setTagOther(e.target.value)}
                placeholder="Describe the tag..."
                className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes for this appointment..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset resize-none"
            />
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

export function ViewAppointmentModal({
  appt,
  onClose,
  onEdit,
  onDelete,
}: {
  appt: Appointment;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[appt.status];
  const dateObj = new Date(appt.date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const weekdayLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });

  const initials = appt.clientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Accent tokens per status, layered on top of the shared badge palette
  const ACCENT: Record<AppointmentStatus, { ring: string; bar: string; iconBg: string; iconText: string }> = {
    new: { ring: 'ring-blue-100 dark:ring-blue-500/20', bar: 'from-blue-500 to-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10', iconText: 'text-blue-600 dark:text-blue-400' },
    ongoing: { ring: 'ring-amber-100 dark:ring-amber-500/20', bar: 'from-amber-500 to-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10', iconText: 'text-amber-600 dark:text-amber-400' },
    follow_up: { ring: 'ring-purple-100 dark:ring-purple-500/20', bar: 'from-purple-500 to-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-500/10', iconText: 'text-purple-600 dark:text-purple-400' },
    completed: { ring: 'ring-emerald-100 dark:ring-emerald-500/20', bar: 'from-emerald-500 to-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconText: 'text-emerald-600 dark:text-emerald-400' },
    cancelled: { ring: 'ring-red-100 dark:ring-red-500/20', bar: 'from-red-500 to-red-400', iconBg: 'bg-red-50 dark:bg-red-500/10', iconText: 'text-red-600 dark:text-red-400' },
  };
  const accent = ACCENT[appt.status];
  const isPast = isAppointmentPast(appt.date, appt.timeTo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md relative overflow-hidden ring-4 ${accent.ring}`}>
        {/* Status accent bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${accent.bar}`} />

        <div className="p-6">
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header: avatar + client + status */}
          <div className="flex items-center gap-3 mb-5 pr-8">
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-bold ${accent.iconBg} ${accent.iconText}`}>
              {initials || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">Appointment</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{appt.clientName}</h3>
            </div>
            <span className={`ml-auto shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>

          {/* Date & time, icon-led cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide">Date</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{dateLabel}</p>
              <p className="text-xs text-slate-400">{weekdayLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide">Time</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{appt.timeFrom} – {appt.timeTo}</p>
            </div>
          </div>

          {/* Tag */}
          {appt.tag && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 mb-4">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581c.699.699 1.83.699 2.528 0l4.318-4.318a1.788 1.788 0 000-2.528L10.905 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide">Tag</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{tagLabel(appt.tag, appt.tagOther)}</p>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide">Notes</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {appt.notes || 'No notes added for this appointment.'}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          {!isPast && (
            <button
              onClick={onEdit}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Edit
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// New: lists all appointments for a given day, sorted by start time
function DayAppointmentsModal({
  dateLabel,
  appts,
  onClose,
  onSelect,
}: {
  dateLabel: string;
  appts: Appointment[];
  onClose: () => void;
  onSelect: (appt: Appointment) => void;
}) {
  const sorted = sortByTime(appts);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md relative max-h-[80vh] flex flex-col">
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 pr-8">Appointments</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{dateLabel}</p>

        <div className="space-y-2 overflow-y-auto pr-1">
          {sorted.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.clientName}</p>
                <p className="text-xs text-slate-400">{a.timeFrom} – {a.timeTo}</p>
                {a.tag && <p className="text-xs text-teal-600 dark:text-teal-400 truncate">{tagLabel(a.tag, a.tagOther)}</p>}
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_META[a.status].badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[a.status].dot}`} />
                {STATUS_META[a.status].label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const today = new Date();
  const todayKey = todayDateKey();

  useEffect(() => {
    clientApi.list({ limit: 1 }).then((res) => {
      if (res.total === 0) navigate('/dashboard');
    }).catch(() => {});
  }, []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppointmentSettings>({
    maxPerDay: '',
    durationMinutes: '',
    workingStart: '',
    workingEnd: '',
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewingAppt, setViewingAppt] = useState<Appointment | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [viewingDayKey, setViewingDayKey] = useState<string | null>(null);
  const { isSupported: pushSupported, isEnabled: pushEnabled, loading: pushLoading, enable: enablePush, disable: disablePush } = usePushNotifications();

  // Load appointments + settings from the backend once on mount, so they
  // survive a page refresh instead of living only in local component state.
  useEffect(() => {
    (async () => {
      try {
        const [apptRes, settingsRes] = await Promise.all([
          appointmentApi.list(),
          appointmentApi.getSettings(),
        ]);
        setAppointments(apptRes.data.map(apiToAppt));
        setSettings(apiToSettings(settingsRes.data));
      } catch (err) {
        console.error(err);
        setToast('Failed to load appointments');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const handleSaveAppointment = async (data: Omit<Appointment, 'id' | 'createdAt'>) => {
    try {
      if (editingAppt) {
        const res = await appointmentApi.update(editingAppt.id, apptToApiBody(data));
        const updated = apiToAppt(res.data);
        setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setToast('Appointment updated');
      } else {
        const res = await appointmentApi.create(apptToApiBody(data));
        const created = apiToAppt(res.data);
        setAppointments((prev) => [...prev, created]);
        setToast('Appointment created');
      }
    } catch (err) {
      console.error(err);
      setToast('Failed to save appointment');
    }
    setEditingAppt(null);
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await appointmentApi.remove(id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      setToast('Appointment deleted');
    } catch (err) {
      console.error(err);
      setToast('Failed to delete appointment');
    }
  };

  const handleSaveSettings = async (s: AppointmentSettings) => {
    setSettings(s);
    try {
      await appointmentApi.saveSettings(settingsToApiBody(s));
      setToast('Settings saved');
    } catch (err) {
      console.error(err);
      setToast('Failed to save settings');
    }
  };

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  const viewingDayAppts = viewingDayKey ? appointmentsByDate[viewingDayKey] || [] : [];
  const viewingDayLabel = viewingDayKey
    ? new Date(viewingDayKey + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading appointments…</div>;
  }

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

          {pushSupported && (
            <button
              onClick={() => (pushEnabled ? disablePush() : enablePush())}
              disabled={pushLoading}
              title={pushEnabled ? 'Appointment reminders on — click to turn off' : 'Turn on appointment reminders (10 min before)'}
              aria-label="Toggle appointment reminders"
              className={`p-2.5 rounded-lg border transition-colors disabled:opacity-50 ${pushEnabled
                  ? 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </button>
          )}

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
            const dayApptsRaw = day ? appointmentsByDate[dateKey] || [] : [];
            const dayAppts = sortByTime(dayApptsRaw);
            const isPast = day !== null && dateKey < todayKey;
            const hasMore = dayAppts.length > 2;
            return (
              <div
                key={idx}
                onClick={() => day !== null && !isPast && dayAppts.length === 0 && openAddAppointment(day)}
                className={`h-24 sm:h-28 flex flex-col items-start justify-start p-2 rounded-lg text-sm overflow-hidden ${day === null
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
                      title={`${a.timeFrom} – ${a.clientName}`}
                    >
                      {a.clientName}
                    </div>
                  ))}

                  {day !== null && !isPast && (
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddAppointment(day); }}
                        className={`text-[10px] shrink-0 ${isToday ? 'text-white/80 hover:text-white' : 'text-teal-600 dark:text-teal-400 hover:underline'}`}
                      >
                        + Add
                      </button>
                      {hasMore && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingDayKey(dateKey); }}
                          className={`text-[10px] shrink-0 ${isToday ? 'text-white/80 hover:text-white' : 'text-teal-600 dark:text-teal-400 hover:underline'}`}
                        >
                          View more
                        </button>
                      )}
                    </div>
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
        <SettingsModal initial={settings} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      )}

      {showAddAppointment && (
        <AddAppointmentModal
          date={selectedDate}
          initial={editingAppt}
          allAppointments={appointments}
          durationMinutes={settings.durationMinutes}
          workingStart={settings.workingStart}
          workingEnd={settings.workingEnd}
          maxPerDay={settings.maxPerDay}
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
          onDelete={() => {
            handleDeleteAppointment(viewingAppt.id);
            setViewingAppt(null);
          }}
        />
      )}

      {viewingDayKey && (
        <DayAppointmentsModal
          dateLabel={viewingDayLabel}
          appts={viewingDayAppts}
          onClose={() => setViewingDayKey(null)}
          onSelect={(a) => {
            setViewingDayKey(null);
            setViewingAppt(a);
          }}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
