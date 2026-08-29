import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { DoorOpen, Loader2 } from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://events.oscvitap.com';

/*
 * The auditorium door, from the panel.
 *
 * How many people fit in a room is not a constant anyone can know from
 * a seat map: it depends on what the venue allows on the day, whether a
 * row is roped off, and whether the fire officer says otherwise at 9am.
 * So it is a number an admin can change from here rather than a value
 * compiled into the Worker, and changing it takes effect on the very
 * next scan.
 *
 * Behind the normal GitHub gate. The five phones at the door reach
 * /api/scan and cannot see this.
 */

interface GateState {
  configured: boolean;
  is_open?: boolean;
  capacity?: number;
  inside?: number;
  inside_general?: number;
  inside_reserved?: number;
  reserved_issued?: number;
  general_cap?: number;
  general_remaining?: number;
}

const AdminEntryGate = ({ slug }: { slug: string }) => {
  const [gate, setGate] = useState<GateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');

  const url = `${API_BASE_URL}/api/admin/events/${slug}/entry`;

  const read = useCallback(async () => {
    try {
      const response = await fetch(url, { credentials: 'include' });

      if (!response.ok) throw new Error(String(response.status));

      const state: GateState = await response.json();

      setGate(state);
      setDraft(state.capacity ? String(state.capacity) : '');
      setError('');
    } catch {
      setError('Could not read the door.');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void read();

    /* Slow on purpose. This is a supervisory view, not the door itself,
       and the phones already poll every three seconds. */
    const timer = window.setInterval(read, 15000);

    return () => window.clearInterval(timer);
  }, [read]);

  const change = async (patch: Record<string, unknown>) => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? 'That change was refused.');
        return;
      }

      setGate(body);
      setDraft(body.capacity ? String(body.capacity) : '');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div role="status" className="glass-card mb-8 flex items-center gap-3 p-4 text-gray-400 md:mb-10">
        <Loader2 size={16} className="animate-spin" />
        Reading the door…
      </div>
    );
  }

  if (!gate?.configured) {
    return (
      <section className="glass-card mb-8 p-4 md:mb-10">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-accent">
          <DoorOpen size={16} aria-hidden="true" />
          Door
        </div>

        <p className="mt-2 text-sm text-gray-400">
          Not set up for this event. Set a capacity to open it.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Seats"
            className="min-h-[44px] w-32 rounded-lg border border-dark-600 bg-dark-800 px-3 font-mono text-white"
          />

          <button
            type="button"
            disabled={saving || !draft.trim()}
            onClick={() => change({ capacity: Number(draft), is_open: true })}
            className="min-h-[44px] rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            Open the door
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>
    );
  }

  const full = (gate.general_remaining ?? 0) === 0;

  return (
    <section className="glass-card mb-8 p-4 md:mb-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-accent">
          <DoorOpen size={16} aria-hidden="true" />
          Door
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            gate.is_open ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}
        >
          {gate.is_open ? 'Open' : 'Closed'}
        </span>

        {gate.is_open && full && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
            General admission full
          </span>
        )}
      </div>

      {/* What is actually true right now, counted from the scans
          themselves rather than from a stored number. */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {[
          ['Inside', `${gate.inside} / ${gate.capacity}`],
          ['Reserved in', String(gate.inside_reserved)],
          ['General in', `${gate.inside_general} / ${gate.general_cap}`],
          ['Passes held', String(gate.reserved_issued)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] uppercase tracking-widest text-gray-500">{label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-widest text-gray-500" htmlFor="entry-capacity">
          Seats
        </label>

        <input
          id="entry-capacity"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[44px] w-28 rounded-lg border border-dark-600 bg-dark-800 px-3 font-mono text-white"
        />

        <button
          type="button"
          disabled={saving || !draft.trim() || Number(draft) === gate.capacity}
          onClick={() => change({ capacity: Number(draft) })}
          className="min-h-[44px] rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 text-sm font-semibold text-brand-accent disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Set capacity'}
        </button>

        {/*
          * The kill switch. Closing refuses everyone at every queue on
          * the next scan, without touching capacity, so it can be
          * undone as easily as it was done.
          */}
        <button
          type="button"
          disabled={saving}
          onClick={() => change({ is_open: !gate.is_open })}
          className={`ml-auto min-h-[44px] rounded-lg px-4 text-sm font-semibold disabled:opacity-40 ${
            gate.is_open
              ? 'border border-red-500/40 bg-red-500/10 text-red-300'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {gate.is_open ? 'Close the door' : 'Reopen the door'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
};

export default AdminEntryGate;
