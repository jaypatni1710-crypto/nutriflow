import { useState } from 'react';
import { clientApi } from '../../lib/client.api';
import { SUGGESTED_TAGS } from '../../lib/clientOptions';

interface Props {
  clientId: string;
  tags: string[];
  onChanged: (tags: string[]) => void;
  readOnly?: boolean;
}

const TAG_COLORS = [
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
];

export function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[hash];
}

export function TagPill({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 leading-none">×</button>
      )}
    </span>
  );
}

export function ClientTagsEditor({ clientId, tags, onChanged, readOnly }: Props) {
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);

  const addTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setLoading(true);
    try {
      const res = await clientApi.addTag(clientId, trimmed);
      onChanged(res.data);
    } finally {
      setLoading(false);
    }
  };

  const removeTag = async (tag: string) => {
    setLoading(true);
    try {
      const res = await clientApi.removeTag(clientId, tag);
      onChanged(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(customInput);
      setCustomInput('');
    }
  };

  if (readOnly) {
    if (tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => <TagPill key={t} tag={t} />)}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Client Tags</h4>

      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.map((t) => <TagPill key={t} tag={t} onRemove={loading ? undefined : () => removeTag(t)} />)}
        </div>
      )}

      {/* Suggested tags */}
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Suggested Tags</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
          <button key={t} onClick={() => addTag(t)} disabled={loading}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 transition-colors disabled:opacity-50">
            + {t}
          </button>
        ))}
      </div>

      {/* Custom tag input */}
      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleCustomKey}
          placeholder="Type custom tag, press Enter"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button onClick={() => { addTag(customInput); setCustomInput(''); }} disabled={loading || !customInput.trim()}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
          Add
        </button>
      </div>
    </div>
  );
}
