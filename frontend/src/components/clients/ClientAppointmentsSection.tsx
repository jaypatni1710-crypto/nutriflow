import { useEffect, useMemo, useState } from 'react';
import { appointmentApi, ApiAppointmentSettings } from '../../lib/appointment.api';
import { Toast } from './Toast';
import {
  Appointment,
  apiToAppt,
  apptToApiBody,
  tagLabel,
  AddAppointmentModal,
  ViewAppointmentModal,
} from '../../pages/AppointmentsPage';

interface Settings {
  maxPerDay: number | '';
  durationMinutes: number | '';
  workingStart: string;
  workingEnd: string;
}

function apiToSettings(s: ApiAppointmentSettings): Settings {
  return {
    maxPerDay: s.max_per_day ?? '',
    durationMinutes: s.duration_minutes ?? '',
    workingStart: s.working_start ?? '',
    workingEnd: s.working_end ?? '',
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ClientAppointmentsSection({ clientId, clientName }: { clientId: string; clientName: string }) {
  // We fetch ALL of the dietitian's appointments (not just this client's)
  // because the Add/Edit modal needs the full schedule to check for
  // time-overlaps and the daily appointment limit across every client.
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<Settings>({ maxPerDay: '', durationMinutes: '', workingStart: '', workingEnd: '' });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [viewingAppt, setViewingAppt] = useState<Appointment | null>(null);

  const load = async () => {
    try {
      const [apptRes, settingsRes] = await Promise.all([
        appointmentApi.list(),
        appointmentApi.getSettings(),
      ]);
      setAllAppointments(apptRes.data.map(apiToAppt));
      setSettings(apiToSettings(settingsRes.data));
    } catch (err) {
      console.error(err);
      setToast('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clientAppointments = useMemo(
    () =>
      allAppointments
        .filter((a) => a.clientId === clientId)
        .sort((a, b) => (a.date + a.timeFrom).localeCompare(b.date + b.timeFrom)),
    [allAppointments, clientId]
  );

  const handleSave = async (data: Omit<Appointment, 'id'>) => {
    try {
      if (editingAppt) {
        const res = await appointmentApi.update(editingAppt.id, apptToApiBody(data));
        const updated = apiToAppt(res.data);
        setAllAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setToast('Appointment updated');
      } else {
        const res = await appointmentApi.create(apptToApiBody(data));
        const created = apiToAppt(res.data);
        setAllAppointments((prev) => [...prev, created]);
        setToast('Appointment created');
      }
    } catch (err) {
      console.error(err);
      setToast('Failed to save appointment');
    }
    setEditingAppt(null);
  };

  const handleDelete = async (apptId: string) => {
    try {
      await appointmentApi.remove(apptId);
      setAllAppointments((prev) => prev.filter((a) => a.id !== apptId));
      setToast('Appointment deleted');
    } catch (err) {
      console.error(err);
      setToast('Failed to delete appointment');
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading appointments…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Appointments</h4>
        <button
          onClick={() => { setEditingAppt(null); setShowAdd(true); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700"
        >
          Add Appointment
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Created At</th>
              <th className="px-4 py-3">Appointment Date</th>
              <th className="px-4 py-3">Start Time</th>
              <th className="px-4 py-3">End Time</th>
              <th className="px-4 py-3">Tag</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clientAppointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No appointments yet.
                </td>
              </tr>
            ) : (
              clientAppointments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-100 font-medium whitespace-nowrap">{a.clientName}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatDate(a.date)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">{a.timeFrom}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">{a.timeTo}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">{a.tag ? tagLabel(a.tag, a.tagOther) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setViewingAppt(a)}
                        title="View"
                        aria-label="View"
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setEditingAppt(a); setShowAdd(true); }}
                        title="Edit"
                        aria-label="Edit"
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        title="Delete"
                        aria-label="Delete"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddAppointmentModal
          date={null}
          initial={editingAppt}
          presetClient={{ id: clientId, name: clientName }}
          allAppointments={allAppointments}
          durationMinutes={settings.durationMinutes}
          workingStart={settings.workingStart}
          workingEnd={settings.workingEnd}
          maxPerDay={settings.maxPerDay}
          onClose={() => { setShowAdd(false); setEditingAppt(null); }}
          onSave={handleSave}
        />
      )}

      {viewingAppt && (
        <ViewAppointmentModal
          appt={viewingAppt}
          onClose={() => setViewingAppt(null)}
          onEdit={() => { setEditingAppt(viewingAppt); setViewingAppt(null); setShowAdd(true); }}
          onDelete={() => { handleDelete(viewingAppt.id); setViewingAppt(null); }}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}