import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

/*
 * The four roster tiers, in the order the public /team page lays them out.
 * Kept in step with TEAM_TIERS in the Worker and the tiers array in
 * Team.tsx — a value outside this set is rejected server-side.
 */
const TIERS = [
  'Admins',
  'Track Leads',
  'Technical Leads',
  'Executive Members',
] as const;

type Tier = (typeof TIERS)[number];

interface MemberSocials {
  github?: string;
  linkedin?: string;
  instagram?: string;
  website?: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
  tier: string;
  bio: string;
  image: string;
  socials: MemberSocials;
}

interface MemberForm {
  name: string;
  role: string;
  tier: Tier;
  bio: string;
  github: string;
  linkedin: string;
  instagram: string;
  website: string;
}

const emptyForm: MemberForm = {
  name: '',
  role: '',
  tier: 'Executive Members',
  bio: '',
  github: '',
  linkedin: '',
  instagram: '',
  website: '',
};

const formFromMember = (member: Member): MemberForm => ({
  name: member.name,
  role: member.role,
  tier: (TIERS as readonly string[]).includes(member.tier)
    ? (member.tier as Tier)
    : 'Executive Members',
  bio: member.bio,
  github: member.socials.github ?? '',
  linkedin: member.socials.linkedin ?? '',
  instagram: member.socials.instagram ?? '',
  website: member.socials.website ?? '',
});

const messageFrom = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data = await response.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
};

/* Same accepted set the Worker enforces, so the picker cannot offer more. */
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const inputClass =
  'w-full min-h-[44px] rounded-lg border border-dark-700 bg-dark-900/60 px-4 text-white outline-none transition-colors focus:border-brand-primary';

const labelClass = 'block text-sm text-gray-300 mb-2';

const MemberPhoto = ({ member }: { member: Member }) =>
  member.image ? (
    <img
      src={member.image}
      alt={member.name}
      loading="lazy"
      decoding="async"
      className="h-14 w-14 shrink-0 rounded-lg border border-dark-700 object-cover"
    />
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dark-700 bg-dark-900 text-gray-600">
      <User size={20} aria-hidden="true" />
    </div>
  );

const AdminMembers = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [failed, setFailed] = useState('');
  const [open, setOpen] = useState(false);

  const [actionError, setActionError] = useState('');

  /*
   * Which member the inline form is editing, 'new' while adding, or null
   * when the form is closed. One form serves both jobs.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [uploadingId, setUploadingId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [removing, setRemoving] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/team/members`,
        { credentials: 'include' },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(
            response,
            `Could not load members (${response.status})`,
          ),
        );
      }

      const data = await response.json();
      setMembers(data.members ?? []);
    } catch (error: unknown) {
      setFailed(
        error instanceof Error
          ? error.message
          : 'Could not load members',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateForm = <K extends keyof MemberForm>(
    key: K,
    value: MemberForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openAdd = () => {
    setForm(emptyForm);
    setPendingImage(null);
    setActionError('');
    setEditingId('new');
  };

  const openEdit = (member: Member) => {
    setForm(formFromMember(member));
    setPendingImage(null);
    setActionError('');
    setEditingId(member.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setPendingImage(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const pickImage = (file: File | null) => {
    setActionError('');

    if (!file) {
      setPendingImage(null);
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.split(',').includes(file.type)) {
      setActionError('Image must be a PNG, JPEG or WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setActionError('Image must be 5 MB or smaller.');
      return;
    }

    setPendingImage(file);
  };

  /* Shared by the create-then-upload flow and the per-row replace button. */
  const uploadImage = async (
    memberId: string,
    file: File,
  ): Promise<boolean> => {
    const body = new FormData();
    body.append('image', file);

    const response = await fetch(
      `${API_BASE_URL}/api/admin/team/members/${memberId}/image`,
      { method: 'POST', credentials: 'include', body },
    );

    if (response.status === 401) {
      setUnauthorized(true);
      return false;
    }

    if (!response.ok) {
      throw new Error(
        await messageFrom(response, 'Could not upload the photo.'),
      );
    }

    return true;
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setActionError('');

    if (!form.name.trim() || !form.role.trim() || !form.tier) {
      setActionError('Name, role and tier are required.');
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      tier: form.tier,
      bio: form.bio.trim(),
      socials: {
        github: form.github.trim(),
        linkedin: form.linkedin.trim(),
        instagram: form.instagram.trim(),
        website: form.website.trim(),
      },
    };

    try {
      const editingNew = editingId === 'new';

      const response = await fetch(
        editingNew
          ? `${API_BASE_URL}/api/admin/team/members`
          : `${API_BASE_URL}/api/admin/team/members/${editingId}`,
        {
          method: editingNew ? 'POST' : 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(response, 'Could not save the member.'),
        );
      }

      const data = await response.json();
      const savedId: string | undefined = data.member?.id;

      if (pendingImage && savedId) {
        const ok = await uploadImage(savedId, pendingImage);
        if (!ok) return;
      }

      await load();
      closeForm();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not save the member.',
      );
    } finally {
      setSaving(false);
    }
  };

  /* The per-row "Replace photo" button, separate from the edit form. */
  const replacePhoto = async (memberId: string, file: File | null) => {
    if (!file) return;

    setActionError('');

    if (!ACCEPTED_IMAGE_TYPES.split(',').includes(file.type)) {
      setActionError('Image must be a PNG, JPEG or WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setActionError('Image must be 5 MB or smaller.');
      return;
    }

    setUploadingId(memberId);

    try {
      const ok = await uploadImage(memberId, file);
      if (ok) await load();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not upload the photo.',
      );
    } finally {
      setUploadingId('');
    }
  };

  const remove = async (member: Member) => {
    setRemoving(member.id);
    setActionError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/team/members/${member.id}`,
        { method: 'DELETE', credentials: 'include' },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(response, 'Could not remove the member.'),
        );
      }

      if (editingId === member.id) closeForm();
      await load();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not remove the member.',
      );
    } finally {
      setRemoving('');
      setConfirmRemove('');
    }
  };

  if (unauthorized) return null;

  if (loading && members.length === 0) {
    return (
      <div
        role="status"
        className="glass-card mb-8 flex items-center gap-3 p-6 text-gray-400 md:mb-10"
      >
        <Loader2 size={16} className="animate-spin" />
        Loading members…
      </div>
    );
  }

  if (failed && members.length === 0) {
    return (
      <div
        role="alert"
        className="glass-card mb-8 border border-red-500/30 p-6 text-red-400 md:mb-10"
      >
        {failed}
      </div>
    );
  }

  const tierCount = new Set(members.map((member) => member.tier)).size;

  return (
    <section className="mb-8 md:mb-10">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="admin-members-panel"
        className="glass-card flex min-h-[44px] w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        <Users
          size={16}
          aria-hidden="true"
          className="shrink-0 text-brand-accent"
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold uppercase tracking-widest text-brand-accent">
            Members list
          </span>

          <span className="mt-1 block text-xs text-gray-500">
            {members.length}{' '}
            {members.length === 1 ? 'member' : 'members'} ·{' '}
            {tierCount} {tierCount === 1 ? 'tier' : 'tiers'}
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
        <div id="admin-members-panel" className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              These are the people shown on the public{' '}
              <span className="text-gray-400">/team</span> page.
            </p>

            {editingId === null && (
              <button
                type="button"
                onClick={openAdd}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                <Plus size={16} />
                Add member
              </button>
            )}
          </div>

          {actionError && (
            <div
              role="alert"
              className="glass-card border border-red-500/30 p-4 text-sm text-red-400"
            >
              {actionError}
            </div>
          )}

          {/* Add / edit form */}
          {editingId !== null && (
            <form
              onSubmit={submitForm}
              className="glass-card space-y-5 p-4 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-accent">
                  {editingId === 'new'
                    ? 'Add member'
                    : 'Edit member'}
                </h3>

                <button
                  type="button"
                  onClick={closeForm}
                  aria-label="Close form"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="member-name">
                    Name *
                  </label>
                  <input
                    id="member-name"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    placeholder="Ada Lovelace"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-role">
                    Role *
                  </label>
                  <input
                    id="member-role"
                    value={form.role}
                    onChange={(e) => updateForm('role', e.target.value)}
                    placeholder="Technical Lead"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-tier">
                    Tier *
                  </label>
                  <select
                    id="member-tier"
                    value={form.tier}
                    onChange={(e) =>
                      updateForm('tier', e.target.value as Tier)
                    }
                    className={`${inputClass} appearance-none`}
                  >
                    {TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-photo">
                    Photo
                  </label>
                  <input
                    id="member-photo"
                    ref={fileInput}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={(e) =>
                      pickImage(e.target.files?.[0] ?? null)
                    }
                    className="w-full text-sm text-gray-400 file:mr-3 file:min-h-[44px] file:rounded-lg file:border file:border-dark-600 file:bg-dark-900 file:px-4 file:text-sm file:font-semibold file:text-gray-300 hover:file:border-gray-500"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    {pendingImage
                      ? `Selected: ${pendingImage.name}`
                      : 'PNG, JPEG or WebP, up to 5 MB.'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass} htmlFor="member-bio">
                    Description
                  </label>
                  <textarea
                    id="member-bio"
                    value={form.bio}
                    onChange={(e) => updateForm('bio', e.target.value)}
                    rows={3}
                    placeholder="A short bio shown on the member's card."
                    className={`${inputClass} resize-none py-3`}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-github">
                    GitHub URL
                  </label>
                  <input
                    id="member-github"
                    value={form.github}
                    onChange={(e) => updateForm('github', e.target.value)}
                    placeholder="https://github.com/…"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-linkedin">
                    LinkedIn URL
                  </label>
                  <input
                    id="member-linkedin"
                    value={form.linkedin}
                    onChange={(e) =>
                      updateForm('linkedin', e.target.value)
                    }
                    placeholder="https://linkedin.com/in/…"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-instagram">
                    Instagram URL
                  </label>
                  <input
                    id="member-instagram"
                    value={form.instagram}
                    onChange={(e) =>
                      updateForm('instagram', e.target.value)
                    }
                    placeholder="https://instagram.com/…"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="member-website">
                    Website URL
                  </label>
                  <input
                    id="member-website"
                    value={form.website}
                    onChange={(e) =>
                      updateForm('website', e.target.value)
                    }
                    placeholder="https://…"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="min-h-[44px] rounded-lg border border-dark-600 px-5 text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {saving
                    ? 'Saving…'
                    : editingId === 'new'
                      ? 'Add member'
                      : 'Save changes'}
                </button>
              </div>
            </form>
          )}

          {/* Roster, grouped by tier */}
          {members.length === 0 ? (
            <div className="rounded-xl border border-dark-700 bg-dark-900/30 py-12 text-center">
              <Users
                size={34}
                className="mx-auto mb-3 text-gray-600"
              />
              <div className="font-medium text-gray-300">
                No members yet
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Add the first one with the button above.
              </div>
            </div>
          ) : (
            TIERS.map((tier) => {
              const inTier = members.filter(
                (member) => member.tier === tier,
              );

              if (inTier.length === 0) return null;

              return (
                <div key={tier} className="glass-card overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-dark-700 px-4 py-4 sm:px-6">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-accent">
                      {tier}
                    </h3>
                    <span className="rounded-full bg-dark-700 px-2.5 py-1 text-xs text-gray-300">
                      {inTier.length}
                    </span>
                  </div>

                  <ul className="divide-y divide-dark-700/50">
                    {inTier.map((member) => (
                      <li
                        key={member.id}
                        className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:px-6"
                      >
                        <MemberPhoto member={member} />

                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white">
                            {member.name}
                          </div>
                          <div className="text-xs uppercase tracking-wider text-brand-accent">
                            {member.role}
                          </div>

                          {member.bio && (
                            <p className="mt-2 text-sm text-gray-400">
                              {member.bio}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-gray-500">
                            {member.socials.github && (
                              <a
                                href={member.socials.github}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${member.name} on GitHub`}
                                className="hover:text-white"
                              >
                                <Github size={15} />
                              </a>
                            )}
                            {member.socials.linkedin && (
                              <a
                                href={member.socials.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${member.name} on LinkedIn`}
                                className="hover:text-brand-accent"
                              >
                                <Linkedin size={15} />
                              </a>
                            )}
                            {member.socials.instagram && (
                              <a
                                href={member.socials.instagram}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${member.name} on Instagram`}
                                className="hover:text-pink-500"
                              >
                                <Instagram size={15} />
                              </a>
                            )}
                            {member.socials.website && (
                              <a
                                href={member.socials.website}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${member.name}'s website`}
                                className="hover:text-white"
                              >
                                <Globe size={15} />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {/* Replace photo without opening the full form. */}
                          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-dark-600 px-3 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
                            {uploadingId === member.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Upload size={14} />
                            )}
                            {uploadingId === member.id
                              ? 'Uploading…'
                              : 'Photo'}
                            <input
                              type="file"
                              accept={ACCEPTED_IMAGE_TYPES}
                              className="hidden"
                              disabled={uploadingId === member.id}
                              onChange={(e) => {
                                replacePhoto(
                                  member.id,
                                  e.target.files?.[0] ?? null,
                                );
                                e.target.value = '';
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => openEdit(member)}
                            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-dark-600 px-3 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          {confirmRemove === member.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => remove(member)}
                                disabled={removing === member.id}
                                className="min-h-[44px] rounded-lg border border-red-500/40 px-3 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                              >
                                {removing === member.id
                                  ? 'Removing…'
                                  : 'Yes, remove'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemove('')}
                                className="min-h-[44px] rounded-lg border border-dark-700 px-3 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(member.id)}
                              aria-label={`Remove ${member.name}`}
                              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-dark-700 px-3 text-xs font-semibold text-gray-400 transition-colors hover:text-red-400"
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};

export default AdminMembers;
