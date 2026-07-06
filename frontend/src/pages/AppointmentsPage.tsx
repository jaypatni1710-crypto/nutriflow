import { useMemo, useState } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface AppointmentSettings {
  maxPerDay: number | '';
  durationMinutes: number | '';
  workingStart: string;
  workingEnd: string;
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
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppointmentSettings>({
    maxPerDay: '',
    durationMinutes: '',
    workingStart: '',
    workingEnd: '',
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const goToPreviousMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Appointments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View and manage client appointments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {}}
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
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {MONTH_NAMES[month]} {year}
          </h3>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            const isToday = isCurrentMonth && day === today.getDate();
            return (
              <div
                key={idx}
                className={`h-16 sm:h-20 flex items-start justify-start p-2 rounded-lg text-sm ${
                  day === null
                    ? ''
                    : isToday
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                {day ?? ''}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={goToPreviousMonth}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={goToNextMonth}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          initial={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => setSettings(s)}
        />
      )}
    </div>
  );
}