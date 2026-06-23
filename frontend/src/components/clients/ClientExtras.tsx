import { DuplicateMatch, ClientFullProfile } from '../../types/client.types';
import { calcCompletion } from '../../lib/completion';
import { TagPill } from './ClientTags';

// ─── Feature 4: Duplicate Modal ────────────────────────────────────────
interface DuplicateModalProps {
  matches: DuplicateMatch[];
  onViewExisting: (id: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function DuplicateModal({ matches, onViewExisting, onContinue, onCancel }: DuplicateModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Possible Duplicate Client Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">We found {matches.length} existing client(s) with similar contact info.</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <div className="text-sm">
                <p className="font-semibold text-slate-900 dark:text-white">{m.first_name} {m.last_name}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{m.phone_number}{m.email ? ` · ${m.email}` : ''}</p>
              </div>
              <button onClick={() => onViewExisting(m.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-500/10">
                View
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={onContinue}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors">
            Continue Anyway
          </button>
          <button onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Feature 2: Assessment Completion Indicator ────────────────────────
export function AssessmentCompletionBar({ profile }: { profile: ClientFullProfile }) {
  const { percent, missing } = calcCompletion(profile);
  const color = percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Assessment Completion</span>
        <span className={`text-xs font-bold ${percent >= 80 ? 'text-emerald-600' : percent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
          {percent}% Complete
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-1.5">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-slate-400">
          Missing: {missing.join(', ')}
        </p>
      )}
    </div>
  );
}

// ─── Feature 6: Enhanced Client Summary Card ───────────────────────────
const CONDITION_BADGE_COLORS: Record<string, string> = {
  Diabetes:       'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  PCOS:           'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400',
  Thyroid:        'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  Hypertension:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  'High Cholesterol': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
};

const HIGHLIGHT_CONDITIONS = ['Diabetes', 'PCOS', 'Thyroid', 'Hypertension', 'High Cholesterol'];

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const now = new Date();
  const b = new Date(dob);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return isNaN(age) ? null : age;
}

function GoalProgressMini({ start, current, goal }: { start: number | null; current: number | null; goal: number | null }) {
  if (!current || !goal) return null;
  const base = start ?? current;
  let pct = 0;
  if (base !== goal) pct = Math.max(0, Math.min(100, Math.round(((base - current) / (base - goal)) * 100)));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 dark:text-slate-400">Goal progress</span>
        <span className="font-bold text-teal-600">{pct}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  profile: ClientFullProfile;
  tags: string[];
}

export function EnhancedSummaryCard({ profile, tags }: SummaryCardProps) {
  const { client: c, assessment: a, medical_history: m, progress_logs } = profile;
  const age = calcAge(c.date_of_birth);
  const conditions = m?.conditions?.filter((cond) => HIGHLIGHT_CONDITIONS.includes(cond)) || [];

  return (
    <div className="bg-gradient-to-r from-teal-50 to-sky-50 dark:from-teal-900/20 dark:to-sky-900/20 border border-teal-100 dark:border-teal-800/40 rounded-2xl p-5 mb-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {/* Left: identity */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {age && <span className="text-xs text-slate-500 dark:text-slate-400">{age} yrs · {c.gender || '—'}</span>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{c.phone_number}</p>
          {c.primary_goal && (
            <p className="text-xs mt-1 font-semibold text-teal-700 dark:text-teal-400">Goal: {c.primary_goal}</p>
          )}
          {/* Condition badges */}
          {conditions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {conditions.map((cond) => (
                <span key={cond} className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONDITION_BADGE_COLORS[cond] || 'bg-slate-100 text-slate-600'}`}>
                  {cond}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: metrics */}
        <div className="flex gap-4 flex-wrap">
          {a?.current_weight_kg && (
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{a.current_weight_kg}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">kg</p>
            </div>
          )}
          {c.target_weight && (
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{c.target_weight}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Goal kg</p>
            </div>
          )}
          {a?.bmi && (
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{a.bmi}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">BMI</p>
            </div>
          )}
        </div>
      </div>

      {/* Tags row */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t) => <TagPill key={t} tag={t} />)}
        </div>
      )}

      {/* Goal progress mini bar */}
      <GoalProgressMini
        start={progress_logs[0]?.weight_kg ?? null}
        current={a?.current_weight_kg ?? null}
        goal={c.target_weight ?? null}
      />
    </div>
  );
}
