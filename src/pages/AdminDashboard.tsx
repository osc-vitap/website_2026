import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Plus,
  ShieldCheck,
  Users,
  X,
  ArrowLeft,
  Save,
  RefreshCw,
  Download,
  User,
  Github,
  Mail,
  Trash2,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import AdminAuthSplash from '../components/AdminAuthSplash';
import { clearOauthLoopMarker } from '../data/adminAuth';

import AdminPosters from '../components/AdminPosters';
import AdminAppMeta from '../components/AdminAppMeta';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

interface Event {
  id: string;
  slug: string;
  title: string;
  sub_title: string | null;
  description: string | null;
  venue: string | null;
  event_date: string;
  event_end_at?: string | null;
  image: string | null;
  is_open: number;
  registration_type: 'solo' | 'team' | 'workshop';
  min_team_size: number;
  max_team_size: number;
  archive_status?: string;
  archived_at?: string | null;
  created_at?: string;
  /*
   * Counted by the events list query. Optional because a briefly
   * older deployed Worker will not send them yet — read them
   * through `?? 0` at the render site, never bare.
   */
  registration_count?: number;
  participant_count?: number;
}

interface AdminUser {
  authenticated: boolean;
  github_username?: string;
  role?: string;
}

interface EventForm {
  title: string;
  slug: string;
  sub_title: string;
  description: string;
  venue: string;
  event_date: string;
  event_end_at: string;
  image: string;
  registration_type: 'solo' | 'team' | 'workshop';
  min_team_size: number;
  max_team_size: number;
  is_open: boolean;
}

interface RegistrationMember {
  id: number;
  name: string;
  year_of_study: string;
  college_registration_number: string;
  github: string | null;
  email: string;
  member_number: number;
}

interface Registration {
  id: number;
  team_name: string | null;
  team_size: number;
  created_at: string;
  members: RegistrationMember[];
}

//reg response removed

/*
 * <input type="datetime-local"> works in the admin's local time and has
 * no timezone in its value, while event_end_at is stored as a UTC
 * instant. Without converting, an event ending at 4pm IST would be read
 * as 4pm UTC and archive itself five and a half hours late.
 */
const toLocalInput = (
  utcValue: string | null | undefined,
): string => {
  if (!utcValue) return '';

  const parsed = Date.parse(utcValue);

  if (Number.isNaN(parsed)) return '';

  const local = new Date(
    parsed -
      new Date(parsed).getTimezoneOffset() *
        60_000,
  );

  return local
    .toISOString()
    .slice(0, 16);
};

const fromLocalInput = (
  localValue: string,
): string | null => {
  if (!localValue) return null;

  const parsed = Date.parse(localValue);

  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toISOString();
};

/*
 * A team event's registration count is teams, not heads, so the head
 * count is worth spelling out next to it. Solo and workshop events
 * have one member per registration, and "5 teams · 5 people" would
 * only be noise there.
 */
const countLabel = (
  event: Event,
): string => {
  const registrations =
    event.registration_count ?? 0;

  const participants =
    event.participant_count ?? 0;

  if (
    event.registration_type !== 'team'
  ) {
    return registrations === 1
      ? 'registration'
      : 'registrations';
  }

  const teams =
    registrations === 1
      ? 'team'
      : 'teams';

  if (
    participants === registrations
  ) {
    return teams;
  }

  return `${teams} · ${participants} ${
    participants === 1
      ? 'person'
      : 'people'
  }`;
};

const emptyForm: EventForm = {
  title: '',
  slug: '',
  sub_title: '',
  description: '',
  venue: '',
  event_date: '',
  event_end_at: '',
  image: '',
  registration_type: 'solo',
  min_team_size: 2,
  max_team_size: 4,
  is_open: true,
};

const AdminDashboard = () => {
  const [user, setUser] =
    useState<AdminUser | null>(null);

  /*
   * Set when the Worker says we are not signed in. The dashboard used
   * to assign window.location.href straight to the OAuth URL from five
   * different places, which showed a flash of empty dashboard and then
   * an unexplained bounce to github.com — and looped forever if the
   * session cookie never stuck. Rendering the splash instead puts a
   * screen in front of the redirect and gives the loop a way out.
   */
  const [needsSignIn, setNeedsSignIn] =
    useState(false);

  const [signingOut, setSigningOut] =
    useState(false);

  const [events, setEvents] =
    useState<Event[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [form, setForm] =
    useState<EventForm>(emptyForm);

  const [saving, setSaving] =
    useState(false);

  const [formError, setFormError] =
    useState('');

  const [selectedEvent, setSelectedEvent] =
    useState<Event | null>(null);

  const [showManageModal, setShowManageModal] =
    useState(false);

  const [manageForm, setManageForm] =
    useState<EventForm>(emptyForm);

  const [manageSaving, setManageSaving] =
    useState(false);

  const [manageError, setManageError] =
    useState('');

  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const [deleteConfirmText, setDeleteConfirmText] =
    useState('');

  const [deleting, setDeleting] =
    useState(false);

  const [manageSuccess, setManageSuccess] =
    useState('');

  const [registrations, setRegistrations] =
    useState<Registration[]>([]);

  const [registrationsLoading, setRegistrationsLoading] =
    useState(false);

  const [registrationsError, setRegistrationsError] =
    useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      const meResponse = await fetch(
        `${API_BASE_URL}/api/admin/me`,
        {
          credentials: 'include',
        },
      );

      if (meResponse.status === 401) {
        setNeedsSignIn(true);
        return;
      }

      if (!meResponse.ok) {
        throw new Error(
          'Unable to verify admin session',
        );
      }

      const me: AdminUser =
        await meResponse.json();

      setUser(me);

      /*
       * A session that works clears the loop marker, so the next sign-in
       * starts from a clean slate rather than opening on the
       * cookies-are-blocked warning.
       */
      clearOauthLoopMarker();

      const eventsResponse =
        await fetch(
          `${API_BASE_URL}/api/admin/events`,
          {
            credentials: 'include',
          },
        );

      if (eventsResponse.status === 401) {
        setNeedsSignIn(true);
        return;
      }

      if (!eventsResponse.ok) {
        throw new Error(
          'Unable to load events',
        );
      }

      const data =
        await eventsResponse.json();

      setEvents(data.events ?? []);
    } catch (err) {
      console.error(err);

      setError(
        'Unable to load the admin dashboard.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /*
   * Ends the session server-side rather than only dropping the cookie,
   * so the row cannot be reused by anyone holding the old value. The
   * page is then sent to the restricted screen, which explains what
   * just happened instead of bouncing straight back into sign-in.
   */
  const signOut = async () => {
    setSigningOut(true);

    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      /*
       * The cookie is host-only on the Worker's domain, so the browser
       * cannot clear it from here. Sending them to the restricted page
       * anyway would imply a sign-out that did not happen.
       */
      console.error(err);

      setSigningOut(false);

      setError(
        'Could not reach the server to sign out. Check your connection and try again.',
      );

      return;
    }

    clearOauthLoopMarker();

    window.location.href = '/admin/restricted?reason=signed-out';
  };

  const updateForm = <
    K extends keyof EventForm,
  >(
    key: K,
    value: EventForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateManageForm = <
    K extends keyof EventForm,
  >(
    key: K,
    value: EventForm[K],
  ) => {
    setManageForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const createEvent = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    setFormError('');

    if (
      !form.title.trim() ||
      !form.slug.trim() ||
      !form.event_date
    ) {
      setFormError(
        'Title, slug and event date are required.',
      );
      return;
    }

    if (
      form.registration_type === 'team' &&
      form.min_team_size > form.max_team_size
    ) {
      setFormError(
        'Minimum team size cannot be greater than maximum team size.',
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/events`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            title: form.title.trim(),
            slug: form.slug.trim(),
            sub_title:
              form.sub_title.trim(),
            description:
              form.description.trim(),
            venue: form.venue.trim(),
            event_date:
              form.event_date,
            event_end_at:
              fromLocalInput(form.event_end_at),
            image:
              form.image.trim(),
            registration_type:
              form.registration_type,
            min_team_size:
              form.registration_type ===
              'team'
                ? form.min_team_size
                : 1,
            max_team_size:
              form.registration_type ===
              'team'
                ? form.max_team_size
                : 1,
            is_open: form.is_open,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to create event.',
        );
      }

      setShowCreateModal(false);
      setForm(emptyForm);

      await loadDashboard();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to create event.',
      );
    } finally {
      setSaving(false);
    }
  };

  const openManage = async (
    event: Event,
  ) => {
    setSelectedEvent(event);

    setManageForm({
      title: event.title,
      slug: event.slug,
      sub_title:
        event.sub_title ?? '',
      description:
        event.description ?? '',
      venue: event.venue ?? '',
      event_date:
        event.event_date,
      event_end_at:
        toLocalInput(event.event_end_at),
      image: event.image ?? '',
      registration_type:
        event.registration_type,
      min_team_size:
        event.min_team_size,
      max_team_size:
        event.max_team_size,
      is_open:
        event.is_open === 1,
    });

    setManageError('');
    setManageSuccess('');
    setRegistrations([]);
    setRegistrationsError('');
    setConfirmDelete(false);
    setDeleteConfirmText('');
    setShowManageModal(true);

    await loadRegistrations(event.slug);
  };

  /*
   * Deleting an event cascades to its registrations and removes the
   * archived CSV from R2, so the slug has to be typed to confirm.
   */
  const deleteEvent = async () => {
    if (!selectedEvent) return;

    setManageError('');
    setManageSuccess('');

    try {
      setDeleting(true);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${encodeURIComponent(selectedEvent.slug)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        setNeedsSignIn(true);
        return;
      }

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Unable to delete event.',
        );
      }

      setShowManageModal(false);
      setSelectedEvent(null);
      setConfirmDelete(false);
      setDeleteConfirmText('');

      await loadDashboard();
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : 'Unable to delete event.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const loadRegistrations = async (
    slug: string,
  ) => {
    try {
      setRegistrationsLoading(true);
      setRegistrationsError('');

      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${encodeURIComponent(slug)}/registrations`,
        {
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        setNeedsSignIn(true);
        return;
      }

      const data =
          await response.json();

     if (!response.ok) {
         throw new Error(
             data?.error ||
             'Unable to load registrations.',
      );
}

setRegistrations(
  data?.registrations ?? [],
);
    } catch (err) {
      setRegistrationsError(
        err instanceof Error
          ? err.message
          : 'Unable to load registrations.',
      );
    } finally {
      setRegistrationsLoading(false);
    }
  };

  /*
   * Live events are still in D1, so their registrations come from
   * the CSV endpoint. Once an event has been archived its rows are
   * deleted from D1 and only the gzipped R2 archive is left.
   */
  const downloadRegistrations = async (
    slug: string,
    archived: boolean,
  ) => {
    try {
      setManageError('');

      const path = archived
        ? `registrations/archive`
        : `registrations.csv`;

      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${encodeURIComponent(slug)}/${path}`,
        {
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        setNeedsSignIn(true);
        return;
      }

      if (!response.ok) {
        let message =
          'Unable to download registrations.';

        try {
          const data = await response.json();
          message = data?.error || message;
        } catch {
          // Response was not JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const contentDisposition =
        response.headers.get(
          'Content-Disposition',
        );

      let filename = archived
        ? `${slug}-registrations.csv.gz`
        : `${slug}-registrations.csv`;

      const filenameMatch =
        contentDisposition?.match(
          /filename="?([^"]+)"?/i,
        );

      if (filenameMatch?.[1]) {
        filename = filenameMatch[1];
      }

      const url =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

      anchor.href = url;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : 'Unable to download registrations.',
      );
    }
  };

  const saveEvent = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    if (!selectedEvent) {
      return;
    }

    setManageError('');
    setManageSuccess('');

    if (
      !manageForm.title.trim() ||
      !manageForm.slug.trim() ||
      !manageForm.event_date
    ) {
      setManageError(
        'Title, slug and event date are required.',
      );
      return;
    }

    if (
      manageForm.registration_type ===
        'team' &&
      manageForm.min_team_size >
        manageForm.max_team_size
    ) {
      setManageError(
        'Minimum team size cannot be greater than maximum team size.',
      );
      return;
    }

    try {
      setManageSaving(true);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${encodeURIComponent(selectedEvent.slug)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            title:
              manageForm.title.trim(),
            slug:
              manageForm.slug.trim(),
            sub_title:
              manageForm.sub_title.trim(),
            description:
              manageForm.description.trim(),
            venue:
              manageForm.venue.trim(),
            event_date:
              manageForm.event_date,
            event_end_at:
              fromLocalInput(manageForm.event_end_at),
            image:
              manageForm.image.trim(),
            registration_type:
              manageForm.registration_type,
            min_team_size:
              manageForm.registration_type ===
              'team'
                ? manageForm.min_team_size
                : 1,
            max_team_size:
              manageForm.registration_type ===
              'team'
                ? manageForm.max_team_size
                : 1,
            is_open:
              manageForm.is_open,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to update event.',
        );
      }

      setManageSuccess(
        'Event updated successfully.',
      );

      const updatedEvent: Event = {
        ...selectedEvent,
        title:
          manageForm.title.trim(),
        slug:
          manageForm.slug.trim(),
        sub_title:
          manageForm.sub_title.trim() ||
          null,
        description:
          manageForm.description.trim() ||
          null,
        venue:
          manageForm.venue.trim() ||
          null,
        event_date:
          manageForm.event_date,
        event_end_at:
          fromLocalInput(manageForm.event_end_at),
        image:
          manageForm.image.trim() ||
          null,
        registration_type:
          manageForm.registration_type,
        min_team_size:
          manageForm.registration_type ===
          'team'
            ? manageForm.min_team_size
            : 1,
        max_team_size:
          manageForm.registration_type ===
          'team'
            ? manageForm.max_team_size
            : 1,
        is_open:
          manageForm.is_open ? 1 : 0,
      };

      setSelectedEvent(
        updatedEvent,
      );

      await loadDashboard();

      if (
        updatedEvent.slug !==
        selectedEvent.slug
      ) {
        await loadRegistrations(
          updatedEvent.slug,
        );
      }
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : 'Unable to update event.',
      );
    } finally {
      setManageSaving(false);
    }
  };

  /*
   * Checked before `loading`, because the sign-in screen is the answer
   * to "not signed in" — showing "Loading admin dashboard…" first would
   * be describing work that is not going to happen.
   */
  if (needsSignIn) {
    return (
      <AdminAuthSplash
        authUrl={`${API_BASE_URL}/auth/github`}
      />
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="text-gray-400">
          Loading admin dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="glass-card max-w-lg mx-auto p-8">
          <ShieldCheck
            className="mx-auto mb-4 text-red-400"
            size={42}
          />

          <h1 className="text-xl font-bold text-white mb-2">
            Dashboard Error
          </h1>

          <p className="text-gray-400 mb-6">
            {error}
          </p>

          <button
            onClick={loadDashboard}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-2.5 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    /*
     * pb uses the safe-area inset so the last row clears the home
     * indicator when this is running as the installed app. In a browser
     * tab the inset is 0 and the padding is just the 40px.
     */
    <div
      className="container mx-auto px-4 md:px-6 pt-6 md:pt-10"
      style={{
        paddingBottom:
          'calc(2.5rem + env(safe-area-inset-bottom))',
      }}
    >

      {/* Install metadata, present only while this route is mounted. */}
      <AdminAppMeta />

      {/* Header */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-8 md:mb-10">
        <div>
          <div className="flex items-center gap-2 text-brand-accent text-xs sm:text-sm font-semibold uppercase tracking-widest mb-2">
            <ShieldCheck size={16} />
            Technical Department
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            Admin Dashboard
          </h1>

          <p className="text-gray-400 mt-2 text-sm md:text-base">
            Manage OSC VIT-AP events and registrations.
          </p>
        </div>

        {user && (
          /*
           * Wraps rather than squeezing. As a single nowrap row the
           * username and the sign-out button shared 320px with a
           * divider between them, and the button's label was the part
           * that lost.
           */
          <div className="glass-card px-4 py-3 md:px-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">
                Signed in as
              </div>

              <div className="text-white font-semibold">
                @{user.github_username}
              </div>
            </div>

            <ShieldCheck
              size={18}
              className="text-green-400"
            />

            {/*
              * There was no way to end a session at all — on a shared
              * club laptop the next person inherited the dashboard.
              */}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              /* min-h-[44px] because this is a real target on a phone,
                 and the divider only reads as one when the row has not
                 wrapped underneath it. */
              className="flex min-h-[44px] items-center gap-2 border-dark-600 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent sm:border-l sm:pl-4"
              title="End this admin session"
            >
              <LogOut size={16} />
              <span className="text-sm font-semibold">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </button>
          </div>
        )}
      </div>

      <AdminPosters />

      {/* Statistics */}

      {/*
        * Two across on a phone rather than one.
        *
        * Stacked, three cards at p-6 filled most of a phone screen with
        * three numbers, and the registrations table — the reason anyone
        * opens this on a phone — started below the fold.
        */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 mb-8 md:mb-10">

        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Calendar
              size={22}
              className="text-brand-primary"
            />

            <span className="text-xs text-gray-500">
              EVENTS
            </span>
          </div>

          <div className="text-3xl font-bold text-white">
            {events.length}
          </div>

          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            Total events
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Calendar
              size={22}
              className="text-green-400"
            />

            <span className="text-xs text-gray-500">
              OPEN
            </span>
          </div>

          <div className="text-3xl font-bold text-white">
            {
              events.filter(
                (event) =>
                  event.is_open === 1,
              ).length
            }
          </div>

          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            Registration open
          </div>
        </div>

        {/* Odd one out of three, so it takes the whole second row
            rather than leaving a half-width gap beside it. */}
        <div className="glass-card p-4 sm:p-6 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Users
              size={22}
              className="text-brand-accent"
            />

            <span className="text-xs text-gray-500">
              TEAMS
            </span>
          </div>

          <div className="text-3xl font-bold text-white">
            {
              events.filter(
                (event) =>
                  event.registration_type ===
                  'team',
              ).length
            }
          </div>

          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            Team-based events
          </div>
        </div>

      </div>

      {/* Events */}

      <div className="glass-card overflow-hidden">

        <div className="p-4 sm:p-6 border-b border-dark-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Events
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Manage your organization's events.
            </p>
          </div>

          <button
            onClick={() => {
              setForm(emptyForm);
              setFormError('');
              setShowCreateModal(true);
            }}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white px-5 min-h-[44px] py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 shrink-0"
          >
            <Plus size={18} />
            Create Event
          </button>

        </div>

        {events.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No events found.
          </div>
        ) : (
          <>

          {/*
            * On a phone the same rows as cards.
            *
            * Six columns cannot be read on a 390px screen. As a table it
            * either scrolled sideways — which hides Actions, the only
            * column anyone taps — or crushed the title to one word per
            * line. Each event gets a card instead, with the status where
            * the eye lands first and Manage as a full-width target.
            */}
          <ul className="divide-y divide-dark-700/50 md:hidden">
            {events.map((event) => (
              <li key={event.id} className="p-4">

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-white break-words">
                      {event.title}
                    </div>

                    <div className="text-xs text-gray-500 mt-0.5">
                      /{event.slug}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                      event.is_open === 1
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-dark-700 text-gray-500'
                    }`}
                  >
                    {event.is_open === 1
                      ? 'Open'
                      : 'Closed'}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">

                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">
                      Date
                    </dt>

                    <dd className="text-sm text-gray-300 mt-0.5">
                      {event.event_date}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">
                      Type
                    </dt>

                    <dd className="text-sm text-gray-300 mt-0.5 uppercase">
                      {event.registration_type}

                      {event.registration_type ===
                        'team' && (
                        <span className="block text-xs normal-case text-gray-500">
                          {event.min_team_size}
                          {'–'}
                          {event.max_team_size} members
                        </span>
                      )}
                    </dd>
                  </div>

                  <div className="col-span-2">
                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">
                      Registrations
                    </dt>

                    <dd className="mt-0.5">
                      {event.archive_status ===
                      'archived' ? (
                        <span className="text-sm text-gray-400">
                          Archived — download the CSV
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">
                          <span className="text-white font-semibold tabular-nums">
                            {event.registration_count ??
                              0}
                          </span>{' '}
                          {countLabel(event)}
                        </span>
                      )}
                    </dd>
                  </div>

                </dl>

                <button
                  onClick={() => openManage(event)}
                  className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-brand-primary/40 bg-brand-primary/10 text-sm font-semibold text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  Manage
                </button>

              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto">

            <table className="w-full">

              <thead>
                <tr className="border-b border-dark-700 text-left">

                  <th className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wider">
                    Event
                  </th>

                  <th className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wider">
                    Date
                  </th>

                  <th className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wider">
                    Type
                  </th>

                  <th className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wider">
                    Registrations
                  </th>

                  <th className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wider">
                    Status
                  </th>

                  <th className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>

                {events.map(
                  (event, index) => (
                    <motion.tr
                      key={event.id}
                      initial={{
                        opacity: 0,
                      }}
                      animate={{
                        opacity: 1,
                      }}
                      transition={{
                        delay:
                          index * 0.05,
                      }}
                      className="border-b border-dark-700/50 hover:bg-white/[0.02]"
                    >

                      <td className="px-6 py-5">
                        <div className="font-semibold text-white">
                          {event.title}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          /{event.slug}
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-300">
                        {event.event_date}
                      </td>

                      <td className="px-6 py-5">

                        <span className="px-2.5 py-1 rounded-md text-xs bg-dark-700 text-gray-300 uppercase">
                          {
                            event.registration_type
                          }
                        </span>

                        {event.registration_type ===
                          'team' && (
                          <div className="text-xs text-gray-500 mt-2">
                            {event.min_team_size}
                            {'–'}
                            {event.max_team_size}{' '}
                            members
                          </div>
                        )}

                      </td>

                      <td className="px-6 py-5">

                        {/*
                          * Archiving deletes the rows from D1 after
                          * writing the CSV to R2, so the counts really
                          * are zero. Showing a bare 0 would read as
                          * "nobody signed up" rather than "moved to
                          * the archive".
                          */}
                        {event.archive_status ===
                        'archived' ? (
                          <>
                            <div className="text-sm text-gray-400 leading-none">
                              Archived
                            </div>

                            <div className="text-xs text-gray-500 mt-1.5">
                              download the CSV
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-semibold text-white tabular-nums leading-none">
                              {
                                event.registration_count ??
                                  0
                              }
                            </div>

                            <div className="text-xs text-gray-500 mt-1.5">
                              {countLabel(event)}
                            </div>
                          </>
                        )}

                      </td>

                      <td className="px-6 py-5">

                        {event.is_open === 1 ? (
                          <span className="text-green-400 text-sm">
                            Open
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">
                            Closed
                          </span>
                        )}

                      </td>

                      <td className="px-6 py-5">
                        <button
                          onClick={() =>
                            openManage(event)
                          }
                          className="text-brand-primary hover:text-white text-sm font-medium"
                        >
                          Manage
                        </button>
                      </td>

                    </motion.tr>
                  ),
                )}

              </tbody>

            </table>

          </div>

          </>
        )}

      </div>

      {/* Create Event Modal */}

      {/* No padding on a phone: the sheet uses the full width and insets
          itself, so a long form is not read through a 20px letterbox on
          either side. */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">

          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!saving) {
                setShowCreateModal(false);
              }
            }}
          />

          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 10,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            /* Full height on a phone, a centred card from sm up. The
               bottom inset keeps the last field and the save button
               clear of the home indicator in the installed app. */
            className="relative z-10 flex h-full w-full max-w-3xl flex-col overflow-y-auto glass-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:h-auto sm:max-h-[90vh] sm:p-6 sm:pb-6 md:p-8"
          >

            <div className="flex items-start justify-between mb-8">

              <div>
                <div className="text-brand-accent text-xs font-bold uppercase tracking-widest mb-2">
                  Event Management
                </div>

                <h2 className="text-2xl font-bold text-white">
                  Create Event
                </h2>

                <p className="text-gray-400 text-sm mt-1">
                  Configure the event and its registration rules.
                </p>
              </div>

              <button
                disabled={saving}
                onClick={() =>
                  setShowCreateModal(false)
                }
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>

            </div>

            <form
              onSubmit={createEvent}
              className="space-y-6"
            >

              {/* Basic information */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div className="md:col-span-2">

                  <label className="block text-sm text-gray-300 mb-2">
                    Event Title *
                  </label>

                  <input
                    value={form.title}
                    onChange={(e) =>
                      updateForm(
                        'title',
                        e.target.value,
                      )
                    }
                    placeholder="OSC Hack 2026"
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-300 mb-2">
                    URL Slug *
                  </label>

                  <input
                    value={form.slug}
                    onChange={(e) =>
                      updateForm(
                        'slug',
                        e.target.value
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            '-',
                          ),
                      )
                    }
                    placeholder="osc-hack-2026"
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-300 mb-2">
                    Event Date *
                  </label>

                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) =>
                      updateForm(
                        'event_date',
                        e.target.value,
                      )
                    }
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />

                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Event End Date & Time
                  </label>

                  <input
                    type="datetime-local"
                    value={form.event_end_at}
                    onChange={(e) =>
                      updateForm(
                        'event_end_at',
                        e.target.value,
                      )
                    }
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />
                </div>

                <div>

                  <label className="block text-sm text-gray-300 mb-2">
                    Subtitle
                  </label>

                  <input
                    value={form.sub_title}
                    onChange={(e) =>
                      updateForm(
                        'sub_title',
                        e.target.value,
                      )
                    }
                    placeholder="Annual Open Source Hackathon"
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-300 mb-2">
                    Venue
                  </label>

                  <input
                    value={form.venue}
                    onChange={(e) =>
                      updateForm(
                        'venue',
                        e.target.value,
                      )
                    }
                    placeholder="Newton Hall, AB-1"
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />

                </div>

                <div className="md:col-span-2">

                  <label className="block text-sm text-gray-300 mb-2">
                    Image URL
                  </label>

                  <input
                    value={form.image}
                    onChange={(e) =>
                      updateForm(
                        'image',
                        e.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors"
                  />

                </div>

                <div className="md:col-span-2">

                  <label className="block text-sm text-gray-300 mb-2">
                    Description
                  </label>

                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      updateForm(
                        'description',
                        e.target.value,
                      )
                    }
                    rows={4}
                    placeholder="Describe the event..."
                    className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none transition-colors resize-none"
                  />

                </div>

              </div>

              {/* Registration configuration */}

              <div className="border-t border-dark-700 pt-6">

                <div className="mb-5">

                  <h3 className="text-lg font-semibold text-white">
                    Registration Configuration
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Choose how participants register for this event.
                  </p>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {(
                    [
                      [
                        'solo',
                        'Solo',
                        'One participant per registration.',
                      ],
                      [
                        'team',
                        'Team',
                        'Multiple participants in one team.',
                      ],
                      [
                        'workshop',
                        'Workshop',
                        'Individual workshop registration.',
                      ],
                    ] as const
                  ).map(
                    ([
                      value,
                      label,
                      description,
                    ]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateForm(
                            'registration_type',
                            value,
                          )
                        }
                        className={`text-left p-4 rounded-xl border transition-all ${
                          form.registration_type ===
                          value
                            ? 'border-brand-primary bg-brand-primary/10'
                            : 'border-dark-700 bg-dark-900/30 hover:border-dark-500'
                        }`}
                      >

                        <div className="flex items-center justify-between mb-2">

                          <span className="font-semibold text-white">
                            {label}
                          </span>

                          <div
                            className={`w-4 h-4 rounded-full border ${
                              form.registration_type ===
                              value
                                ? 'border-brand-primary bg-brand-primary'
                                : 'border-gray-600'
                            }`}
                          />

                        </div>

                        <p className="text-xs text-gray-500">
                          {description}
                        </p>

                      </button>
                    ),
                  )}

                </div>

                {/* Team settings */}

                {form.registration_type ===
                  'team' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 p-5 rounded-xl bg-dark-900/40 border border-dark-700">

                    <div>

                      <label className="block text-sm text-gray-300 mb-2">
                        Minimum Team Size
                      </label>

                      <input
                        type="number"
                        min={1}
                        value={
                          form.min_team_size
                        }
                        onChange={(e) =>
                          updateForm(
                            'min_team_size',
                            Number(
                              e.target.value,
                            ),
                          )
                        }
                        className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                      />

                    </div>

                    <div>

                      <label className="block text-sm text-gray-300 mb-2">
                        Maximum Team Size
                      </label>

                      <input
                        type="number"
                        min={1}
                        value={
                          form.max_team_size
                        }
                        onChange={(e) =>
                          updateForm(
                            'max_team_size',
                            Number(
                              e.target.value,
                            ),
                          )
                        }
                        className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                      />

                    </div>

                  </div>
                )}

                {/* Registration status */}

                <label className="flex items-center gap-3 mt-5 cursor-pointer">

                  <input
                    type="checkbox"
                    checked={form.is_open}
                    onChange={(e) =>
                      updateForm(
                        'is_open',
                        e.target.checked,
                      )
                    }
                    className="w-4 h-4 accent-brand-primary"
                  />

                  <span className="text-sm text-gray-300">
                    Open registration immediately
                  </span>

                </label>

              </div>

              {formError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setShowCreateModal(false)
                  }
                  className="px-5 py-2.5 rounded-lg border border-dark-600 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold"
                >
                  {saving
                    ? 'Creating...'
                    : 'Create Event'}
                </button>

              </div>

            </form>

          </motion.div>

        </div>
      )}

      {/* Manage Event Modal */}

      {showManageModal &&
        selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">

            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => {
                if (!manageSaving && !deleting) {
                  setShowManageModal(false);
                }
              }}
            />

            <motion.div
              initial={{
                opacity: 0,
                scale: 0.95,
                y: 10,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              /* Same treatment as the create sheet: full height on a
                 phone, centred card from sm up. */
              className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-y-auto glass-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:h-auto sm:max-h-[92vh] sm:p-6 sm:pb-6 md:p-8"
            >

              {/* Manage header */}

              <div className="flex items-start justify-between mb-8">

                <div>
                  <div className="text-brand-accent text-xs font-bold uppercase tracking-widest mb-2">
                    Event Management
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {selectedEvent.title}
                  </h2>

                  <p className="text-gray-400 text-sm mt-1">
                    Configure the event and view registrations.
                  </p>
                </div>

                <button
                  disabled={manageSaving || deleting}
                  onClick={() =>
                    setShowManageModal(false)
                  }
                  className="text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X size={22} />
                </button>

              </div>

              {/* Edit event */}

              <form
                onSubmit={saveEvent}
                className="space-y-6"
              >

                <div className="flex items-center gap-2 mb-2">
                  <Calendar
                    size={18}
                    className="text-brand-primary"
                  />

                  <h3 className="text-lg font-semibold text-white">
                    Event Configuration
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div className="md:col-span-2">

                    <label className="block text-sm text-gray-300 mb-2">
                      Event Title *
                    </label>

                    <input
                      value={manageForm.title}
                      onChange={(e) =>
                        updateManageForm(
                          'title',
                          e.target.value,
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />

                  </div>

                  <div>

                    <label className="block text-sm text-gray-300 mb-2">
                      URL Slug *
                    </label>

                    <input
                      value={manageForm.slug}
                      onChange={(e) =>
                        updateManageForm(
                          'slug',
                          e.target.value
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              '-',
                            ),
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />

                  </div>

                  <div>

                    <label className="block text-sm text-gray-300 mb-2">
                      Event Date *
                    </label>

                    <input
                      type="date"
                      value={
                        manageForm.event_date
                      }
                      onChange={(e) =>
                        updateManageForm(
                          'event_date',
                          e.target.value,
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />

                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Event End Date & Time
                    </label>

                    <input
                      type="datetime-local"
                      value={manageForm.event_end_at}
                      onChange={(e) =>
                        updateManageForm(
                          'event_end_at',
                          e.target.value,
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />
                  </div>

                  <div>

                    <label className="block text-sm text-gray-300 mb-2">
                      Subtitle
                    </label>

                    <input
                      value={
                        manageForm.sub_title
                      }
                      onChange={(e) =>
                        updateManageForm(
                          'sub_title',
                          e.target.value,
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />

                  </div>

                  <div>

                    <label className="block text-sm text-gray-300 mb-2">
                      Venue
                    </label>

                    <input
                      value={
                        manageForm.venue
                      }
                      onChange={(e) =>
                        updateManageForm(
                          'venue',
                          e.target.value,
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />

                  </div>

                  <div className="md:col-span-2">

                    <label className="block text-sm text-gray-300 mb-2">
                      Image URL
                    </label>

                    <input
                      value={
                        manageForm.image
                      }
                      onChange={(e) =>
                        updateManageForm(
                          'image',
                          e.target.value,
                        )
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                    />

                  </div>

                  <div className="md:col-span-2">

                    <label className="block text-sm text-gray-300 mb-2">
                      Description
                    </label>

                    <textarea
                      value={
                        manageForm.description
                      }
                      onChange={(e) =>
                        updateManageForm(
                          'description',
                          e.target.value,
                        )
                      }
                      rows={4}
                      className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none resize-none"
                    />

                  </div>

                </div>

                {/* Registration configuration */}

                <div className="border-t border-dark-700 pt-6">

                  <h3 className="text-lg font-semibold text-white mb-5">
                    Registration Configuration
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {(
                      [
                        [
                          'solo',
                          'Solo',
                          'One participant per registration.',
                        ],
                        [
                          'team',
                          'Team',
                          'Multiple participants in one team.',
                        ],
                        [
                          'workshop',
                          'Workshop',
                          'Individual workshop registration.',
                        ],
                      ] as const
                    ).map(
                      ([
                        value,
                        label,
                        description,
                      ]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            updateManageForm(
                              'registration_type',
                              value,
                            )
                          }
                          className={`text-left p-4 rounded-xl border transition-all ${
                            manageForm.registration_type ===
                            value
                              ? 'border-brand-primary bg-brand-primary/10'
                              : 'border-dark-700 bg-dark-900/30 hover:border-dark-500'
                          }`}
                        >

                          <div className="flex items-center justify-between mb-2">

                            <span className="font-semibold text-white">
                              {label}
                            </span>

                            <div
                              className={`w-4 h-4 rounded-full border ${
                                manageForm.registration_type ===
                                value
                                  ? 'border-brand-primary bg-brand-primary'
                                  : 'border-gray-600'
                              }`}
                            />

                          </div>

                          <p className="text-xs text-gray-500">
                            {description}
                          </p>

                        </button>
                      ),
                    )}

                  </div>

                  {manageForm.registration_type ===
                    'team' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 p-5 rounded-xl bg-dark-900/40 border border-dark-700">

                      <div>

                        <label className="block text-sm text-gray-300 mb-2">
                          Minimum Team Size
                        </label>

                        <input
                          type="number"
                          min={1}
                          value={
                            manageForm.min_team_size
                          }
                          onChange={(e) =>
                            updateManageForm(
                              'min_team_size',
                              Number(
                                e.target.value,
                              ),
                            )
                          }
                          className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                        />

                      </div>

                      <div>

                        <label className="block text-sm text-gray-300 mb-2">
                          Maximum Team Size
                        </label>

                        <input
                          type="number"
                          min={1}
                          value={
                            manageForm.max_team_size
                          }
                          onChange={(e) =>
                            updateManageForm(
                              'max_team_size',
                              Number(
                                e.target.value,
                              ),
                            )
                          }
                          className="w-full bg-dark-900/60 border border-dark-700 focus:border-brand-primary rounded-lg px-4 py-3 text-white outline-none"
                        />

                      </div>

                    </div>
                  )}

                  <label className="flex items-center gap-3 mt-5 cursor-pointer">

                    <input
                      type="checkbox"
                      checked={
                        manageForm.is_open
                      }
                      onChange={(e) =>
                        updateManageForm(
                          'is_open',
                          e.target.checked,
                        )
                      }
                      className="w-4 h-4 accent-brand-primary"
                    />

                    <span className="text-sm text-gray-300">
                      Registration is open
                    </span>

                  </label>

                </div>

                {manageError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
                    {manageError}
                  </div>
                )}

                {manageSuccess && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 px-4 py-3 text-sm">
                    {manageSuccess}
                  </div>
                )}

                <div className="flex justify-end">

                  <button
                    type="submit"
                    disabled={manageSaving}
                    className="px-5 py-2.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold flex items-center gap-2"
                  >
                    <Save size={17} />

                    {manageSaving
                      ? 'Saving...'
                      : 'Save Changes'}
                  </button>

                </div>

              </form>

              {/* Registrations */}

              <div className="border-t border-dark-700 mt-10 pt-8">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

                  <div>

                    <div className="flex items-center gap-2">
                      <Users
                        size={20}
                        className="text-brand-accent"
                      />

                      <h3 className="text-xl font-semibold text-white">
                        Registrations
                      </h3>

                      <span className="px-2.5 py-1 rounded-full bg-dark-700 text-gray-300 text-xs">
                        {registrations.length}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 mt-1">
                      Registered participants and teams for this event.
                    </p>

                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        downloadRegistrations(
                          selectedEvent.slug,
                          selectedEvent.archive_status ===
                            'archived',
                        )
                      }
                      title={
                        selectedEvent.archive_status ===
                        'archived'
                          ? 'This event has been archived. Downloads the compressed archive from R2.'
                          : 'Downloads the current registrations as a CSV file.'
                      }
                      className="px-4 py-2 rounded-lg border border-dark-600 text-gray-300 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download size={16} />
                      {selectedEvent.archive_status ===
                      'archived'
                        ? 'Download archive'
                        : 'Download CSV'}
                    </button>

                    <button
                      onClick={() =>
                        loadRegistrations(
                          selectedEvent.slug,
                        )
                      }
                      disabled={
                        registrationsLoading
                      }
                      className="px-4 py-2 rounded-lg border border-dark-600 text-gray-300 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw
                        size={16}
                        className={
                          registrationsLoading
                            ? 'animate-spin'
                            : ''
                        }
                      />
                      Refresh
                    </button>
                  </div>

                </div>

                {registrationsLoading ? (
                  <div className="py-12 text-center text-gray-500">
                    Loading registrations...
                  </div>
                ) : registrationsError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
                    {registrationsError}
                  </div>
                ) : registrations.length ===
                  0 ? (
                  <div className="rounded-xl border border-dark-700 bg-dark-900/30 py-12 text-center">
                    <Users
                      size={34}
                      className="mx-auto mb-3 text-gray-600"
                    />

                    <div className="text-gray-300 font-medium">
                      No registrations yet
                    </div>

                    <div className="text-gray-500 text-sm mt-1">
                      Registrations will appear here when participants register.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">

                    {registrations.map(
                      (
                        registration,
                      ) => (
                        <div
                          key={
                            registration.id
                          }
                          className="rounded-xl border border-dark-700 overflow-hidden"
                        >

                          <div className="px-5 py-4 bg-dark-900/50 border-b border-dark-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                            <div>

                              <div className="flex items-center gap-3">

                                <span className="text-white font-semibold">
                                  Registration #
                                  {
                                    registration.id
                                  }
                                </span>

                                {registration.team_name && (
                                  <span className="px-2.5 py-1 rounded-md bg-brand-primary/10 text-brand-primary text-xs">
                                    {
                                      registration.team_name
                                    }
                                  </span>
                                )}

                              </div>

                              <div className="text-xs text-gray-500 mt-1">
                                Registered{' '}
                                {new Date(
                                  registration.created_at,
                                ).toLocaleString()}
                              </div>

                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Users
                                size={15}
                              />
                              {
                                registration.team_size
                              }{' '}
                              member
                              {registration.team_size !==
                              1
                                ? 's'
                                : ''}
                            </div>

                          </div>

                          {/*
                            * Six columns at a 900px minimum, inside a
                            * modal, on a 390px screen: the member table
                            * scrolled sideways within a sheet that was
                            * already scrolling down, and email — the
                            * column anyone actually needs — sat off the
                            * right edge. One block per member instead,
                            * with the labels beside the values.
                            */}
                          <ul className="divide-y divide-dark-700/50 md:hidden">
                            {registration.members.map(
                              (member) => (
                                <li
                                  key={member.id}
                                  className="px-4 py-4"
                                >

                                  <div className="flex items-center gap-2">
                                    <User
                                      size={16}
                                      className="shrink-0 text-gray-500"
                                    />

                                    <span className="font-medium text-white break-words">
                                      {member.name}
                                    </span>

                                    <span className="ml-auto shrink-0 text-xs text-gray-500">
                                      #
                                      {
                                        member.member_number
                                      }
                                    </span>
                                  </div>

                                  <dl className="mt-2.5 space-y-1.5 text-sm">

                                    <div className="flex gap-2">
                                      <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-gray-500 pt-0.5">
                                        Email
                                      </dt>

                                      <dd className="min-w-0 break-all text-gray-300">
                                        {member.email}
                                      </dd>
                                    </div>

                                    <div className="flex gap-2">
                                      <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-gray-500 pt-0.5">
                                        Reg. no.
                                      </dt>

                                      <dd className="min-w-0 break-all text-gray-300">
                                        {
                                          member.college_registration_number
                                        }
                                      </dd>
                                    </div>

                                    <div className="flex gap-2">
                                      <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-gray-500 pt-0.5">
                                        Year
                                      </dt>

                                      <dd className="text-gray-300">
                                        {
                                          member.year_of_study
                                        }
                                      </dd>
                                    </div>

                                    <div className="flex gap-2">
                                      <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-gray-500 pt-0.5">
                                        GitHub
                                      </dt>

                                      <dd className="min-w-0 break-all text-gray-300">
                                        {member.github || '—'}
                                      </dd>
                                    </div>

                                  </dl>

                                </li>
                              ),
                            )}
                          </ul>

                          <div className="hidden md:block overflow-x-auto">

                            <table className="w-full min-w-[900px]">

                              <thead>

                                <tr className="border-b border-dark-700 text-left">

                                  <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider">
                                    #
                                  </th>

                                  <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider">
                                    Member
                                  </th>

                                  <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider">
                                    Year
                                  </th>

                                  <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider">
                                    College Registration No.
                                  </th>

                                  <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider">
                                    GitHub
                                  </th>

                                  <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider">
                                    Email
                                  </th>

                                </tr>

                              </thead>

                              <tbody>

                                {registration.members.map(
                                  (
                                    member,
                                  ) => (
                                    <tr
                                      key={
                                        member.id
                                      }
                                      className="border-b border-dark-700/50 last:border-b-0"
                                    >

                                      <td className="px-5 py-4 text-sm text-gray-500">
                                        {
                                          member.member_number
                                        }
                                      </td>

                                      <td className="px-5 py-4">

                                        <div className="flex items-center gap-2">

                                         <User
                                             size={16}
                                             className="text-gray-500"
                                            />

                                          <span className="text-white font-medium">
                                            {
                                              member.name
                                            }
                                          </span>

                                        </div>

                                      </td>

                                      <td className="px-5 py-4 text-sm text-gray-300">
                                        {
                                          member.year_of_study
                                        }
                                      </td>

                                      <td className="px-5 py-4 text-sm text-gray-300">
                                        {
                                          member.college_registration_number
                                        }
                                      </td>

                                      <td className="px-5 py-4">

                                        {member.github ? (
                                          <div className="flex items-center gap-2 text-sm text-gray-300">
                                            <Github
                                              size={
                                                15
                                              }
                                            />
                                            {
                                              member.github
                                            }
                                          </div>
                                        ) : (
                                          <span className="text-gray-600">
                                            —
                                          </span>
                                        )}

                                      </td>

                                      <td className="px-5 py-4">

                                        <div className="flex items-center gap-2 text-sm text-gray-300">
                                          <Mail
                                            size={
                                              15
                                            }
                                            className="text-gray-500"
                                          />
                                          {
                                            member.email
                                          }
                                        </div>

                                      </td>

                                    </tr>
                                  ),
                                )}

                              </tbody>

                            </table>

                          </div>

                        </div>
                      ),
                    )}

                  </div>
                )}

              </div>

              {/* Danger zone */}

              <div className="border-t border-dark-700 mt-8 pt-6">

                {!confirmDelete ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">
                        Delete this event
                      </h4>

                      <p className="text-xs text-gray-500">
                        Removes the event and its{' '}
                        {registrations.length}{' '}
                        {registrations.length === 1
                          ? 'registration'
                          : 'registrations'}
                        {selectedEvent.archive_status ===
                        'archived'
                          ? ', including the archived CSV'
                          : ''}
                        . This cannot be undone.
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setConfirmDelete(true)
                      }
                      disabled={
                        manageSaving || deleting
                      }
                      className="shrink-0 px-5 py-2.5 rounded-lg border border-red-500/40 text-red-300 hover:text-white hover:bg-red-500/20 hover:border-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete Event
                    </button>

                  </div>
                ) : (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5">

                    <div className="flex items-start gap-3 mb-4">

                      <AlertTriangle
                        size={20}
                        className="text-red-400 shrink-0 mt-0.5"
                      />

                      <div>
                        <h4 className="text-sm font-semibold text-red-200 mb-1">
                          Permanently delete "
                          {selectedEvent.title}"?
                        </h4>

                        <p className="text-xs text-red-300/80">
                          {registrations.length}{' '}
                          {registrations.length === 1
                            ? 'registration'
                            : 'registrations'}{' '}
                          will be deleted with it
                          {selectedEvent.archive_status ===
                          'archived'
                            ? ', along with the archived CSV in R2'
                            : ''}
                          . Download the CSV first if
                          you still need it.
                        </p>
                      </div>

                    </div>

                    <label className="block text-xs text-gray-400 mb-2">
                      Type{' '}
                      <span className="font-mono text-red-300">
                        {selectedEvent.slug}
                      </span>{' '}
                      to confirm
                    </label>

                    <input
                      value={deleteConfirmText}
                      onChange={(e) =>
                        setDeleteConfirmText(
                          e.target.value,
                        )
                      }
                      autoFocus
                      placeholder={
                        selectedEvent.slug
                      }
                      className="w-full bg-dark-900/60 border border-dark-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm outline-none focus:border-red-500 transition-colors mb-4"
                    />

                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">

                      <button
                        onClick={() => {
                          setConfirmDelete(false);
                          setDeleteConfirmText('');
                        }}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-lg border border-dark-600 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={deleteEvent}
                        disabled={
                          deleting ||
                          deleteConfirmText.trim() !==
                            selectedEvent.slug
                        }
                        className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} />
                        {deleting
                          ? 'Deleting...'
                          : 'Delete Event'}
                      </button>

                    </div>

                  </div>
                )}

              </div>

              {/* Footer actions */}

              <div className="border-t border-dark-700 mt-8 pt-6 flex justify-end">

                <button
                  onClick={() =>
                    setShowManageModal(false)
                  }
                  disabled={manageSaving || deleting}
                  className="px-5 py-2.5 rounded-lg border border-dark-600 text-gray-300 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft
                    size={16}
                  />
                  Back to Events
                </button>

              </div>

            </motion.div>

          </div>
        )}

    </div>
  );
};

export default AdminDashboard;
