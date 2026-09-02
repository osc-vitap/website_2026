import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Github,
  ExternalLink,
  X,
} from 'lucide-react';
import { projectsData, type Project } from '../data/projectsData';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

const isLocalHost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/*
 * The API responds with camelCase plus displayOrder; the static array
 * in projectsData.ts uses the same shape. Keeping the local form state
 * in this shape too avoids a translation layer on every keystroke.
 */
interface ProjectFormState {
  id: string;
  title: string;
  description: string;
  techStackText: string;
  repoUrl: string;
  liveUrl: string;
  contributorsText: string;
}

const initialFallbackProjects: Project[] = projectsData;

const emptyForm: ProjectFormState = {
  id: '',
  title: '',
  description: '',
  techStackText: '',
  repoUrl: '',
  liveUrl: '',
  contributorsText: '',
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/*
 * The form is one text field per list so the admin can paste a comma-
 * separated value. On submit we split, trim and drop empties; the API
 * receives a real JSON array. The reverse direction (API -> form) joins
 * with ", " so a re-save round-trips cleanly.
 */
const arrayToText = (values: string[]): string => values.join(', ');

const textToArray = (text: string): string[] =>
  text
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const AdminProjects = () => {
  const [projects, setProjects] = useState<Project[]>(() =>
    isLocalHost() ? initialFallbackProjects : [],
  );
  const [loading, setLoading] = useState(!isLocalHost());
  const [unauthorized, setUnauthorized] = useState(false);

  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');

  const [addForm, setAddForm] = useState<ProjectFormState>(emptyForm);
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<ProjectFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [failed, setFailed] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setFailed('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/projects`, {
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
        throw new Error(`Could not load projects (${response.status})`);
      }

      const data = (await response.json()) as { projects?: Project[] };
      setProjects(data.projects ?? []);
    } catch (err: unknown) {
      if (isLocalHost()) {
        setLoading(false);
        return;
      }
      setFailed(
        err instanceof Error ? err.message : 'Unable to load projects',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetAddForm = () => {
    setAddForm(emptyForm);
    setActionError('');
  };

  const validateAndBuildPayload = (form: ProjectFormState) => {
    const id = slugify(form.id);
    if (!id) {
      return { ok: false as const, error: 'Project id is required.' };
    }

    if (!PROJECT_SLUG_PATTERN.test(id)) {
      return {
        ok: false as const,
        error: 'Project id must be lowercase letters, numbers and single hyphens.',
      };
    }

    const title = form.title.trim();
    if (!title) {
      return { ok: false as const, error: 'Project title is required.' };
    }

    const repoUrl = form.repoUrl.trim();
    if (!/^https?:\/\//i.test(repoUrl)) {
      return { ok: false as const, error: 'A valid repository URL (http or https) is required.' };
    }

    const liveUrl = form.liveUrl.trim();
    if (liveUrl && !/^https?:\/\//i.test(liveUrl)) {
      return { ok: false as const, error: 'Live URL must start with http or https.' };
    }

    return {
      ok: true as const,
      payload: {
        id,
        title,
        description: form.description.trim(),
        techStack: textToArray(form.techStackText),
        repoUrl,
        liveUrl: liveUrl || null,
        contributors: textToArray(form.contributorsText),
      },
    };
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    setActionError('');
    setActionNote('');

    const result = validateAndBuildPayload(addForm);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result.payload),
      });

      if (response.status === 401) {
        if (isLocalHost()) {
          const created: Project = {
            id: result.payload.id,
            title: result.payload.title,
            description: result.payload.description,
            techStack: result.payload.techStack,
            repoUrl: result.payload.repoUrl,
            liveUrl: result.payload.liveUrl ?? undefined,
            contributors: result.payload.contributors,
          };
          setProjects((prev) => [...prev, created]);
          setActionNote(`Added “${created.title}” to the project list.`);
          resetAddForm();
          return;
        }
        setUnauthorized(true);
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        project?: Project;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || `Could not add project (${response.status})`);
      }

      setActionNote(`Added “${data.project?.title ?? result.payload.title}”.`);
      resetAddForm();
      await load(true);
    } catch (err: unknown) {
      if (isLocalHost()) {
        const created: Project = {
          id: result.payload.id,
          title: result.payload.title,
          description: result.payload.description,
          techStack: result.payload.techStack,
          repoUrl: result.payload.repoUrl,
          liveUrl: result.payload.liveUrl ?? undefined,
          contributors: result.payload.contributors,
        };
        setProjects((prev) => [...prev, created]);
        setActionNote(`Added “${created.title}” to the project list.`);
        resetAddForm();
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to add project',
      );
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (project: Project) => {
    setEditing({
      id: project.id,
      title: project.title,
      description: project.description,
      techStackText: arrayToText(project.techStack),
      repoUrl: project.repoUrl,
      liveUrl: project.liveUrl ?? '',
      contributorsText: arrayToText(project.contributors),
    });
    setActionError('');
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setActionError('');
    setActionNote('');

    const result = validateAndBuildPayload(editing);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    /*
     * PATCH on the Worker replaces the id, so keep the original id in
     * the URL and only send the editable fields. Display order is
     * omitted to leave it untouched on the server.
     */
    const { id: _ignoredId, ...editable } = result.payload;
    void _ignoredId;

    setSavingEdit(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/projects/${encodeURIComponent(editing.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(editable),
        },
      );

      if (response.status === 401) {
        if (isLocalHost()) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === editing.id
                ? {
                    ...p,
                    title: editable.title,
                    description: editable.description,
                    techStack: editable.techStack,
                    repoUrl: editable.repoUrl,
                    liveUrl: editable.liveUrl ?? undefined,
                    contributors: editable.contributors,
                  }
                : p,
            ),
          );
          setActionNote(`Updated “${editable.title}”.`);
          setEditing(null);
          return;
        }
        setUnauthorized(true);
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        project?: Project;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || `Failed to update (${response.status})`);
      }

      setActionNote(`Updated “${data.project?.title ?? editable.title}”.`);
      setEditing(null);
      await load(true);
    } catch (err: unknown) {
      if (isLocalHost()) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === editing.id
              ? {
                  ...p,
                  title: editable.title,
                  description: editable.description,
                  techStack: editable.techStack,
                  repoUrl: editable.repoUrl,
                  liveUrl: editable.liveUrl ?? undefined,
                  contributors: editable.contributors,
                }
              : p,
          ),
        );
        setActionNote(`Updated “${editable.title}”.`);
        setEditing(null);
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to update project',
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (project: Project) => {
    setDeletingId(project.id);
    setActionError('');
    setActionNote('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/projects/${encodeURIComponent(project.id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        if (isLocalHost()) {
          setProjects((prev) => prev.filter((p) => p.id !== project.id));
          setActionNote(`Removed “${project.title}”.`);
          return;
        }
        setUnauthorized(true);
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Could not remove (${response.status})`);
      }

      setActionNote(`Removed “${project.title}”.`);
      await load(true);
    } catch (err: unknown) {
      if (isLocalHost()) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        setActionNote(`Removed “${project.title}”.`);
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to remove project',
      );
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.techStack.some((t) => t.toLowerCase().includes(q)),
    );
  }, [projects, search]);

  if (unauthorized) return null;

  return (
    <section className="mb-10">
      <div className="glass-card mb-6 overflow-hidden rounded-xl border border-dark-700 bg-dark-900/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/20 text-brand-accent">
              <Package size={20} />
            </div>
            <div>
              <h2 className="font-bebas text-2xl tracking-widest text-white">
                Projects
              </h2>
              <p className="font-mono text-xs text-gray-400">
                {projects.length} open-source projects registered &bull; shown on{' '}
                <span className="text-brand-accent">oscvitap.com/projects</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              title="Refresh project list"
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
          <div className="rounded-xl border border-dark-700 bg-dark-900/40 p-5 backdrop-blur">
            <h3 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-accent">
              <Plus size={14} /> Add Project
            </h3>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Project ID (slug) *
                  </label>
                  <input
                    type="text"
                    value={addForm.id}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, id: e.target.value }))
                    }
                    placeholder="wsoc-website"
                    disabled={adding}
                    required
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={addForm.title}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="WSoC-Website"
                    disabled={adding}
                    required
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Repository URL *
                  </label>
                  <input
                    type="url"
                    value={addForm.repoUrl}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, repoUrl: e.target.value }))
                    }
                    placeholder="https://github.com/osc-vitap/..."
                    disabled={adding}
                    required
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Live URL (optional)
                  </label>
                  <input
                    type="url"
                    value={addForm.liveUrl}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, liveUrl: e.target.value }))
                    }
                    placeholder="https://..."
                    disabled={adding}
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Tech Stack (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={addForm.techStackText}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, techStackText: e.target.value }))
                    }
                    placeholder="TypeScript, React, Tailwind"
                    disabled={adding}
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Contributors (comma-separated avatar URLs)
                  </label>
                  <input
                    type="text"
                    value={addForm.contributorsText}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, contributorsText: e.target.value }))
                    }
                    placeholder="https://avatars.githubusercontent.com/u/1"
                    disabled={adding}
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-mono text-gray-400">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={addForm.description}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Short description of the project."
                    disabled={adding}
                    className="w-full rounded-lg border border-dark-700 bg-dark-950/80 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 font-mono text-xs font-semibold uppercase tracking-wider text-white transition-all hover:bg-brand-secondary hover:shadow-lg disabled:opacity-50"
                >
                  {adding ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Add Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

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
                placeholder="Search projects by title, id, description or tech..."
                className="w-full rounded-lg border border-dark-700 bg-dark-900/60 py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-brand-accent focus:outline-none"
              />
            </div>

            <div className="text-xs font-mono text-gray-500">
              Showing {filtered.length} of {projects.length} projects
            </div>
          </div>

          {failed && (
            <div className="flex items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-mono text-rose-300">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{failed}</span>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="animate-spin text-brand-accent" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-dark-700 p-8 text-center">
              <Package className="mb-2 text-gray-600" size={32} />
              <p className="font-mono text-xs text-gray-400">
                {search
                  ? `No projects matched "${search}".`
                  : 'No projects in the roster yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => {
                const isConfirming = confirmDeleteId === project.id;
                const isDeleting = deletingId === project.id;

                return (
                  <div
                    key={project.id}
                    className="group flex flex-col justify-between rounded-xl border border-dark-700 bg-dark-900/50 p-4 transition-all hover:border-brand-primary/40 hover:bg-dark-900/80"
                  >
                    <div className="min-w-0">
                      <h4 className="truncate font-sans font-semibold text-sm text-white">
                        {project.title}
                      </h4>
                      <p className="truncate font-mono text-[11px] text-brand-accent">
                        {project.id}
                      </p>
                      <p className="mt-2 line-clamp-3 font-mono text-[11px] text-gray-400 leading-snug">
                        {project.description}
                      </p>

                      {project.techStack.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {project.techStack.map((tech) => (
                            <span
                              key={tech}
                              className="rounded-md bg-dark-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-300"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-dark-800/80 pt-2.5">
                      <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-gray-400 transition-colors hover:text-brand-accent"
                        >
                          <Github size={11} /> Repo
                        </a>
                        {project.liveUrl && (
                          <a
                            href={project.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-gray-400 transition-colors hover:text-brand-accent"
                          >
                            <ExternalLink size={10} /> Live
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(project)}
                          title={`Edit ${project.title}`}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-dark-800 hover:text-white"
                        >
                          <Pencil size={13} />
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(project)}
                              disabled={isDeleting}
                              className="rounded-lg bg-rose-600/90 px-2 py-1 font-mono text-[10px] uppercase font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                            >
                              {isDeleting ? '...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-dark-700 bg-dark-800 px-2 py-1 font-mono text-[10px] text-gray-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(project.id)}
                            title={`Delete ${project.title}`}
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-2xl border border-dark-700 bg-dark-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-dark-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/20 text-brand-accent">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="font-bebas text-xl tracking-wider text-white">
                    Edit Project
                  </h3>
                  <p className="font-mono text-[11px] text-gray-400">
                    {editing.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-mono text-gray-400">
                  Title *
                </label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-mono text-gray-400">
                    Repository URL *
                  </label>
                  <input
                    type="url"
                    value={editing.repoUrl}
                    onChange={(e) =>
                      setEditing({ ...editing, repoUrl: e.target.value })
                    }
                    required
                    className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-mono text-gray-400">
                    Live URL (optional)
                  </label>
                  <input
                    type="url"
                    value={editing.liveUrl}
                    onChange={(e) =>
                      setEditing({ ...editing, liveUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-gray-400">
                  Tech Stack (comma-separated)
                </label>
                <input
                  type="text"
                  value={editing.techStackText}
                  onChange={(e) =>
                    setEditing({ ...editing, techStackText: e.target.value })
                  }
                  placeholder="TypeScript, React"
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-gray-400">
                  Contributors (comma-separated avatar URLs)
                </label>
                <input
                  type="text"
                  value={editing.contributorsText}
                  onChange={(e) =>
                    setEditing({ ...editing, contributorsText: e.target.value })
                  }
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-gray-400">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-dark-800 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
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

export default AdminProjects;
