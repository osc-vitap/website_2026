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
  Pencil,
  X,
  Sparkles,
} from 'lucide-react';
import { contributorsData } from '../data/contributorsData';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

const isLocalHost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export interface Contributor {
  id: number;
  login: string;
  name?: string | null;
  description?: string | null;
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

const initialFallbackContributors: Contributor[] = contributorsData.map((c, i) => ({
  id: i + 1,
  login: c.login,
  name: null,
  description: null,
  avatar_url: c.avatar_url,
  html_url: c.html_url,
  display_order: i + 1,
}));

interface EditFormState {
  id: number;
  login: string;
  name: string;
  description: string;
  avatar_url: string;
  html_url: string;
}

const AdminContributors = () => {
  const [contributors, setContributors] = useState<Contributor[]>(() =>
    isLocalHost() ? initialFallbackContributors : [],
  );
  const [loading, setLoading] = useState(!isLocalHost());
  const [unauthorized, setUnauthorized] = useState(false);
  const [open, setOpen] = useState(true);

  const [search, setSearch] = useState('');

  // Add Form State
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newHtmlUrl, setNewHtmlUrl] = useState('');
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  // Edit Modal State
  const [editingContributor, setEditingContributor] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Remove State
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
        if (isLocalHost()) {
          setLoading(false);
          return;
        }
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`Could not load contributors (${response.status})`);
      }

      const data = await response.json();
      setContributors(data.contributors ?? []);
    } catch (err: unknown) {
      if (isLocalHost()) {
        setLoading(false);
        return;
      }
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
      const payload = {
        login: clean,
        name: newName.trim() || undefined,
        description: newDescription.trim() || undefined,
        avatar_url: newAvatarUrl.trim() || undefined,
        html_url: newHtmlUrl.trim() || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/contributors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        if (isLocalHost()) {
          const newContrib: Contributor = {
            id: Date.now(),
            login: clean,
            name: newName.trim() || null,
            description: newDescription.trim() || null,
            avatar_url:
              newAvatarUrl.trim() ||
              `https://avatars.githubusercontent.com/${encodeURIComponent(clean)}`,
            html_url:
              newHtmlUrl.trim() ||
              `https://github.com/${encodeURIComponent(clean)}`,
            display_order: contributors.length + 1,
          };
          setContributors((prev) => [...prev, newContrib]);
          setActionNote(`Added @${clean} to contributors.`);
          setNewHandle('');
          setNewName('');
          setNewDescription('');
          setNewAvatarUrl('');
          setNewHtmlUrl('');
          setShowAdvancedAdd(false);
          return;
        }
        setUnauthorized(true);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Could not add contributor (${response.status})`);
      }

      setActionNote(`Successfully added @${data.contributor?.login || clean} to core contributors.`);
      setNewHandle('');
      setNewName('');
      setNewDescription('');
      setNewAvatarUrl('');
      setNewHtmlUrl('');
      setShowAdvancedAdd(false);
      await load(true);
    } catch (err: unknown) {
      if (isLocalHost()) {
        const newContrib: Contributor = {
          id: Date.now(),
          login: clean,
          name: newName.trim() || null,
          description: newDescription.trim() || null,
          avatar_url:
            newAvatarUrl.trim() ||
            `https://avatars.githubusercontent.com/${encodeURIComponent(clean)}`,
          html_url:
            newHtmlUrl.trim() ||
            `https://github.com/${encodeURIComponent(clean)}`,
          display_order: contributors.length + 1,
        };
        setContributors((prev) => [...prev, newContrib]);
        setActionNote(`Added @${clean} to contributors.`);
        setNewHandle('');
        setNewName('');
        setNewDescription('');
        setNewAvatarUrl('');
        setNewHtmlUrl('');
        setShowAdvancedAdd(false);
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to add contributor',
      );
    } finally {
      setAdding(false);
    }
  };

  const handleOpenEdit = (contributor: Contributor) => {
    setEditingContributor({
      id: contributor.id,
      login: contributor.login,
      name: contributor.name || '',
      description: contributor.description || '',
      avatar_url: contributor.avatar_url,
      html_url: contributor.html_url,
    });
    setActionError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContributor) return;

    setSavingEdit(true);
    setActionError('');

    const clean = normalizeInputHandle(editingContributor.login);
    if (!clean) {
      setActionError('GitHub username cannot be empty.');
      setSavingEdit(false);
      return;
    }

    try {
      const payload = {
        login: clean,
        name: editingContributor.name.trim() || null,
        description: editingContributor.description.trim() || null,
        avatar_url: editingContributor.avatar_url.trim() || undefined,
        html_url: editingContributor.html_url.trim() || undefined,
      };

      const response = await fetch(
        `${API_BASE_URL}/api/admin/contributors/${editingContributor.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        if (isLocalHost()) {
          setContributors((prev) =>
            prev.map((c) =>
              c.id === editingContributor.id
                ? {
                    ...c,
                    login: clean,
                    name: editingContributor.name.trim() || null,
                    description: editingContributor.description.trim() || null,
                    avatar_url:
                      editingContributor.avatar_url.trim() ||
                      `https://avatars.githubusercontent.com/${encodeURIComponent(clean)}`,
                    html_url:
                      editingContributor.html_url.trim() ||
                      `https://github.com/${encodeURIComponent(clean)}`,
                  }
                : c,
            ),
          );
          setActionNote(`Updated details for @${clean}.`);
          setEditingContributor(null);
          return;
        }
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update (${response.status})`);
      }

      setActionNote(`Updated details for @${clean}.`);
      setEditingContributor(null);
      await load(true);
    } catch (err: unknown) {
      if (isLocalHost()) {
        setContributors((prev) =>
          prev.map((c) =>
            c.id === editingContributor.id
              ? {
                  ...c,
                  login: clean,
                  name: editingContributor.name.trim() || null,
                  description: editingContributor.description.trim() || null,
                  avatar_url:
                    editingContributor.avatar_url.trim() ||
                    `https://avatars.githubusercontent.com/${encodeURIComponent(clean)}`,
                  html_url:
                    editingContributor.html_url.trim() ||
                    `https://github.com/${encodeURIComponent(clean)}`,
                }
              : c,
          ),
        );
        setActionNote(`Updated details for @${clean}.`);
        setEditingContributor(null);
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to update contributor',
      );
    } finally {
      setSavingEdit(false);
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
        if (isLocalHost()) {
          setContributors((prev) => prev.filter((c) => c.id !== contributor.id));
          setActionNote(`Removed @${contributor.login} from core contributors.`);
          return;
        }
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
      if (isLocalHost()) {
        setContributors((prev) => prev.filter((c) => c.id !== contributor.id));
        setActionNote(`Removed @${contributor.login} from core contributors.`);
        return;
      }
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
    return contributors.filter(
      (c) =>
        c.login.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)),
    );
  }, [contributors, search]);

  if (unauthorized) return null;

  return (
    <section className="mb-10">
      {/* Header Banner */}
      <div className="glass-card mb-6 overflow-hidden rounded-xl border border-dark-700 bg-dark-900/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/20 text-brand-accent">
              <Users size={20} />
            </div>
            <div>
              <h2 className="font-bebas text-2xl tracking-widest text-white">
                Core Contributors
              </h2>
              <p className="font-mono text-xs text-gray-400">
                {contributors.length} core contributors registered &bull; shown on{' '}
                <span className="text-brand-accent">oscvitap.com/contributors</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              title="Refresh contributor list"
              className="flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-800/80 px-3 py-2 text-xs font-mono uppercase tracking-wider text-gray-300 transition-colors hover:border-brand-primary/50 hover:text-white"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1 rounded-lg border border-dark-700 bg-dark-800/80 px-3 py-2 text-xs font-mono text-gray-300 transition-colors hover:text-white"
            >
              <ChevronDown
                size={16}
                className={`transform transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {actionNote && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400 font-mono">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{actionNote}</span>
          </div>
        )}

        {actionError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400 font-mono">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-6">
          {/* Add Contributor Card */}
          <div className="rounded-xl border border-dark-700 bg-dark-900/40 p-5 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-accent">
                <Plus size={14} /> Add Contributor
              </h3>
              <button
                type="button"
                onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}
                className="text-[11px] font-mono text-gray-400 hover:text-brand-accent transition-colors flex items-center gap-1"
              >
                <Sparkles size={12} />
                {showAdvancedAdd ? 'Hide Custom Options' : '+ Add Description & Custom Details'}
              </button>
            </div>

            <p className="mb-4 text-xs font-mono text-gray-400">
              Enter a GitHub username. Avatars, names, and profiles are fetched from GitHub by default, or you can specify custom descriptions and images below.
            </p>

            <form onSubmit={handleAddContributor} className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <Github size={16} />
                  </span>
                  <input
                    type="text"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder="GitHub username (e.g. torvalds or profile URL)"
                    disabled={adding}
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adding || !newHandle.trim()}
                  className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 font-mono text-xs font-semibold uppercase tracking-wider text-white transition-all hover:bg-brand-secondary hover:shadow-lg disabled:opacity-50"
                >
                  {adding ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Add to Roster
                    </>
                  )}
                </button>
              </div>

              {/* Optional Custom Fields */}
              {showAdvancedAdd && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-dark-800">
                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">
                      Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Linus Torvalds"
                      className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">
                      Description / Role (Optional)
                    </label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="e.g. Linux Kernel Creator & Git Architect"
                      className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">
                      Custom Avatar URL (Optional — defaults to GitHub)
                    </label>
                    <input
                      type="url"
                      value={newAvatarUrl}
                      onChange={(e) => setNewAvatarUrl(e.target.value)}
                      placeholder="https://... image link"
                      className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">
                      Custom Profile Link (Optional — defaults to GitHub profile)
                    </label>
                    <input
                      type="url"
                      value={newHtmlUrl}
                      onChange={(e) => setNewHtmlUrl(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contributors by handle, name, or bio..."
                className="w-full rounded-lg border border-dark-700 bg-dark-900/60 py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-brand-accent focus:outline-none"
              />
            </div>

            <div className="text-xs font-mono text-gray-500">
              Showing {filtered.length} of {contributors.length} contributors
            </div>
          </div>

          {/* Error Banner */}
          {failed && (
            <div className="flex items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-mono text-rose-300">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{failed}</span>
            </div>
          )}

          {/* Contributors Grid */}
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="animate-spin text-brand-accent" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-dark-700 p-8 text-center">
              <Users className="mb-2 text-gray-600" size={32} />
              <p className="font-mono text-xs text-gray-400">
                {search
                  ? `No contributors matched "${search}".`
                  : 'No core contributors found in roster.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((contributor) => {
                const isConfirming = confirmRemoveId === contributor.id;
                const isRemoving = removingId === contributor.id;

                return (
                  <div
                    key={contributor.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-dark-700 bg-dark-900/50 p-4 transition-all hover:border-brand-primary/40 hover:bg-dark-900/80"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-dark-600 bg-dark-950">
                        <img
                          src={contributor.avatar_url}
                          alt={contributor.name || contributor.login}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://avatars.githubusercontent.com/${encodeURIComponent(contributor.login)}`;
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        {contributor.name ? (
                          <>
                            <h4 className="truncate font-sans font-semibold text-sm text-white">
                              {contributor.name}
                            </h4>
                            <p className="truncate font-mono text-[11px] text-brand-accent">
                              @{contributor.login}
                            </p>
                          </>
                        ) : (
                          <h4 className="truncate font-mono text-sm font-semibold text-white">
                            @{contributor.login}
                          </h4>
                        )}

                        {contributor.description ? (
                          <p className="mt-1 line-clamp-2 font-mono text-[10px] text-gray-400 leading-snug">
                            {contributor.description}
                          </p>
                        ) : (
                          <p className="mt-1 font-mono text-[10px] text-gray-600 italic">
                            No custom description
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-dark-800/80 pt-2.5">
                      <a
                        href={contributor.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-gray-400 transition-colors hover:text-brand-accent"
                      >
                        Profile <ExternalLink size={10} />
                      </a>

                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(contributor)}
                          title={`Edit @${contributor.login}`}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-dark-800 hover:text-white"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Remove Button */}
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRemoveContributor(contributor)}
                              disabled={isRemoving}
                              className="rounded-lg bg-rose-600/90 px-2 py-1 font-mono text-[10px] uppercase font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                            >
                              {isRemoving ? '...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="rounded-lg border border-dark-700 bg-dark-800 px-2 py-1 font-mono text-[10px] text-gray-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(contributor.id)}
                            title={`Remove @${contributor.login}`}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Contributor Modal */}
      {editingContributor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-dark-700 bg-dark-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-dark-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/20 text-brand-accent">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="font-bebas text-xl tracking-wider text-white">
                    Edit Contributor Details
                  </h3>
                  <p className="font-mono text-[11px] text-gray-400">
                    @{editingContributor.login}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingContributor(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  GitHub Username / Handle
                </label>
                <input
                  type="text"
                  value={editingContributor.login}
                  onChange={(e) =>
                    setEditingContributor({
                      ...editingContributor,
                      login: e.target.value,
                    })
                  }
                  required
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  Custom Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={editingContributor.name}
                  onChange={(e) =>
                    setEditingContributor({
                      ...editingContributor,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Jane Doe"
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  Description / Bio / Role (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editingContributor.description}
                  onChange={(e) =>
                    setEditingContributor({
                      ...editingContributor,
                      description: e.target.value,
                    })
                  }
                  placeholder="e.g. Core Maintainer · Rust & WebAssembly"
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1 flex items-center justify-between">
                  <span>Custom Avatar Image URL</span>
                  <span className="text-[10px] text-gray-500">
                    leave blank to use GitHub avatar
                  </span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={editingContributor.avatar_url}
                    onChange={(e) =>
                      setEditingContributor({
                        ...editingContributor,
                        avatar_url: e.target.value,
                      })
                    }
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                  <div className="h-8 w-8 rounded-full overflow-hidden border border-dark-600 bg-dark-950 shrink-0">
                    <img
                      src={
                        editingContributor.avatar_url ||
                        `https://avatars.githubusercontent.com/${encodeURIComponent(editingContributor.login)}`
                      }
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://avatars.githubusercontent.com/${encodeURIComponent(editingContributor.login)}`;
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">
                  Profile URL
                </label>
                <input
                  type="url"
                  value={editingContributor.html_url}
                  onChange={(e) =>
                    setEditingContributor({
                      ...editingContributor,
                      html_url: e.target.value,
                    })
                  }
                  placeholder="https://github.com/..."
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-800">
                <button
                  type="button"
                  onClick={() => setEditingContributor(null)}
                  disabled={savingEdit}
                  className="rounded-lg border border-dark-700 bg-dark-800 px-4 py-2 font-mono text-xs text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-white hover:bg-brand-secondary transition-all disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminContributors;
