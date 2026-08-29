import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Github,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

export interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  display_order: number;
  created_at?: string;
}

const normalizeInputHandle = (input: string): string => {
  const trimmed = input.trim();
  // If full url like https://github.com/torvalds -> torvalds
  const urlMatch = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i.exec(trimmed);
  if (urlMatch) {
    return urlMatch[1];
  }
  // If @username -> username
  return trimmed.replace(/^@+/, '');
};

const AdminContributors = () => {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [adding, setAdding] = useState(false);

  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [failed, setFailed] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setFailed('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/contributors`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`Could not load contributors (${response.status})`);
      }

      const data = await response.json();
      setContributors(data.contributors ?? []);
    } catch (err: unknown) {
      setFailed(
        err instanceof Error ? err.message : 'Unable to load contributors list',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddContributor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionNote('');

    const clean = normalizeInputHandle(newHandle);
    if (!clean) {
      setActionError('Please enter a valid GitHub username.');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/contributors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          login: clean,
        }),
      });

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Could not add contributor (${response.status})`);
      }

      setActionNote(`Successfully added @${data.contributor?.login || clean} to core contributors.`);
      setNewHandle('');
      await load(true);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to add contributor',
      );
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveContributor = async (contributor: Contributor) => {
    setRemovingId(contributor.id);
    setActionError('');
    setActionNote('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/contributors/${contributor.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Could not remove @${contributor.login} (${response.status})`);
      }

      setActionNote(`Removed @${contributor.login} from core contributors.`);
      await load(true);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : `Failed to remove @${contributor.login}`,
      );
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contributors;
    return contributors.filter((c) => c.login.toLowerCase().includes(q));
  }, [contributors, search]);

  if (unauthorized) return null;

  return (
    <section className="mb-8 md:mb-10">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="admin-contributors-panel"
        className="glass-card flex min-h-[44px] w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        <Users
          size={16}
          aria-hidden="true"
          className="shrink-0 text-brand-accent"
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold uppercase tracking-widest text-brand-accent font-bebas">
            Core Contributors
          </span>

          <span className="mt-1 block text-xs text-gray-500 font-mono">
            {contributors.length} core contributor{contributors.length === 1 ? '' : 's'} registered · shown on oscvitap.com/contributors
          </span>
        </span>

        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`ml-auto shrink-0 text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {!open ? null : (
        <div id="admin-contributors-panel" className="mt-3 space-y-4">
          {/* Action alerts */}
          {actionNote && (
            <div
              role="status"
              className="glass-card flex items-center justify-between gap-3 border-emerald-500/30 p-4 text-emerald-400 font-mono text-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span>{actionNote}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNote('')}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="glass-card flex items-center justify-between gap-3 border-red-500/30 p-4 text-red-400 font-mono text-xs"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-400" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError('')}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {failed && (
            <div
              role="alert"
              className="glass-card border border-red-500/30 p-4 text-red-400 font-mono text-xs"
            >
              {failed}
            </div>
          )}

          {/* Add Contributor Box */}
          <div className="glass-card p-4 sm:p-6 border border-dark-700 bg-dark-900/60">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white font-bebas flex items-center gap-2 mb-2">
              <Plus size={16} className="text-brand-primary" />
              Add Contributor
            </h3>
            <p className="text-xs text-gray-400 font-mono mb-4 leading-relaxed">
              Enter a GitHub username (e.g. <span className="text-brand-accent">torvalds</span> or profile URL). The avatar and profile will automatically link on the contributors page.
            </p>

            <form onSubmit={handleAddContributor} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Github size={16} />
                </div>
                <input
                  type="text"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="GitHub username (e.g. morphisium)"
                  className="w-full min-h-[44px] pl-10 pr-4 bg-dark-800 border border-dark-600 rounded-lg text-white font-mono text-sm placeholder-gray-500 focus:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                />
              </div>

              <button
                type="submit"
                disabled={adding || !newHandle.trim()}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary/20 border border-brand-primary/40 px-5 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-dark-950 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                {adding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Adding…</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add to Roster</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Roster Controls: Search & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Search size={14} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contributors…"
                className="w-full min-h-[38px] pl-9 pr-3 bg-dark-800/80 border border-dark-600 rounded-lg text-white font-mono text-xs placeholder-gray-500 focus:border-brand-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-accent"
              />
            </div>

            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-dark-600 px-3 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent font-mono"
            >
              <RefreshCw
                size={14}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh Roster
            </button>
          </div>

          {/* Contributors Roster Grid */}
          {loading && contributors.length === 0 ? (
            <div className="glass-card flex items-center justify-center gap-3 p-8 text-gray-400 font-mono text-xs">
              <Loader2 size={16} className="animate-spin text-brand-accent" />
              Loading core contributors…
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-8 text-center text-gray-400 font-mono text-xs">
              {search ? 'No contributors match your search.' : 'No contributors registered yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((member) => (
                <div
                  key={member.id}
                  className="glass-card p-3 border border-dark-700 bg-dark-900/40 hover:border-brand-primary/40 transition-colors flex items-center gap-3 group relative overflow-hidden"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-dark-600 shrink-0 group-hover:border-brand-accent transition-colors">
                    <img
                      src={member.avatar_url}
                      alt={member.login}
                      loading="lazy"
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      onError={(e) => {
                        // Fallback avatar
                        (e.target as HTMLImageElement).src = `https://avatars.githubusercontent.com/${encodeURIComponent(member.login)}`;
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-mono text-xs font-semibold truncate">
                      @{member.login}
                    </h4>
                    <a
                      href={member.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-mono text-gray-400 hover:text-brand-accent inline-flex items-center gap-1 transition-colors mt-0.5"
                    >
                      <span>Profile</span>
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">
                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveContributor(member)}
                          disabled={removingId === member.id}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-mono font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                          title="Confirm removal"
                        >
                          {removingId === member.id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-1.5 py-1 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded text-[10px] font-mono transition-colors"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title={`Remove @${member.login}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default AdminContributors;
