import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Github, Mail, User, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

type RegistrationType = 'solo' | 'team' | 'workshop';

interface Event {
  id: string;
  slug: string;
  title: string;
  sub_title?: string;
  description?: string;
  venue?: string;
  event_date: string;
  event_end_at?: string | null;
  image?: string;
  is_open: number;
  registration_type: RegistrationType;
  min_team_size: number;
  max_team_size: number;
  archive_status?: string;
}

interface Member {
  name: string;
  year_of_study: string;
  college_registration_number: string;
  github: string;
  email: string;
}

const emptyMember = (): Member => ({
  name: '',
  year_of_study: '',
  college_registration_number: '',
  github: '',
  email: '',
});

const EventRegistration = () => {
  const { slug } = useParams<{ slug: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [members, setMembers] = useState<Member[]>([
    emptyMember(),
  ]);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!slug) return;

    const loadEvent = async () => {
      try {
        setLoading(true);
        setMessage('');

        const response = await fetch(
          `${API_URL}/api/events/${encodeURIComponent(slug)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Event not found',
          );
        }

        setEvent(data.event);

        const initialSize =
          data.event.registration_type === 'team'
            ? data.event.min_team_size
            : 1;

        setMembers(
          Array.from(
            { length: initialSize },
            () => emptyMember(),
          ),
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load event',
        );
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [slug]);

  const updateMember = (
    index: number,
    field: keyof Member,
    value: string,
  ) => {
    setMembers((current) =>
      current.map((member, i) =>
        i === index
          ? { ...member, [field]: value }
          : member,
      ),
    );
  };

  const changeTeamSize = (size: number) => {
    setMembers((current) => {
      if (size > current.length) {
        return [
          ...current,
          ...Array.from(
            { length: size - current.length },
            () => emptyMember(),
          ),
        ];
      }

      return current.slice(0, size);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!event || !slug) return;

    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(
        `${API_URL}/api/events/${encodeURIComponent(slug)}/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team_name:
              event.registration_type === 'team'
                ? teamName || undefined
                : undefined,
            members,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Registration failed',
        );
      }

      setMessage(
        `Registration successful! Registration ID: ${data.registration_id}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Registration failed',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center text-gray-400">
        Loading event...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-red-400 mb-6">
          {message || 'Event not found'}
        </p>

        <Link
          to="/events"
          className="text-brand-primary hover:underline"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  const isTeam =
    event.registration_type === 'team';

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-5xl">

      <Link
        to="/events"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Events
      </Link>

      <motion.div
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
      >
        <div className="glass-card overflow-hidden rounded-xl">

          {event.image && (
            <div className="h-48 md:h-64 overflow-hidden">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 md:p-10">

            <div className="text-brand-accent text-xs font-bold uppercase tracking-widest mb-2">
              {event.sub_title ||
                event.registration_type}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Register for{' '}
              <span className="text-gradient">
                {event.title}
              </span>
            </h1>

            <p className="text-gray-400 mb-8">
              {event.description}
            </p>

            {!event.is_open && (
              <div className="glass border border-red-500/30 rounded-lg p-4 text-red-400 mb-8">
                Registration for this event is currently closed.
              </div>
            )}

            {event.is_open === 1 && (
              <form
                onSubmit={handleSubmit}
                className="space-y-8"
              >

                {isTeam && (
                  <div className="glass rounded-lg p-5">

                    <div className="flex items-center gap-2 mb-4">
                      <Users
                        size={20}
                        className="text-brand-primary"
                      />

                      <h2 className="text-lg font-semibold text-white">
                        Team Details
                      </h2>
                    </div>

                    <label className="block text-sm text-gray-300 mb-2">
                      Team Name
                    </label>

                    <input
                      value={teamName}
                      onChange={(e) =>
                        setTeamName(e.target.value)
                      }
                      placeholder="Enter your team name"
                      className="w-full bg-dark-900/60 border border-dark-700 rounded-lg px-4 py-3 text-white outline-none focus:border-brand-primary transition-colors"
                    />

                    <label className="block text-sm text-gray-300 mt-5 mb-2">
                      Number of Members
                    </label>

                    <select
                      value={members.length}
                      onChange={(e) =>
                        changeTeamSize(
                          Number(e.target.value),
                        )
                      }
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white outline-none focus:border-brand-primary"
                    >
                      {Array.from(
                        {
                          length:
                            event.max_team_size -
                            event.min_team_size +
                            1,
                        },
                        (_, i) =>
                          event.min_team_size + i,
                      ).map((size) => (
                        <option
                          key={size}
                          value={size}
                        >
                          {size}{' '}
                          {size === 1
                            ? 'Member'
                            : 'Members'}
                        </option>
                      ))}
                    </select>

                    <p className="text-xs text-gray-500 mt-2">
                      Team size:{' '}
                      {event.min_team_size}–
                      {event.max_team_size}
                    </p>

                  </div>
                )}

                {members.map(
                  (member, index) => (
                    <div
                      key={index}
                      className="glass rounded-lg p-5 md:p-6"
                    >

                      <h2 className="text-lg font-semibold text-white mb-5">
                        {isTeam
                          ? `Member ${index + 1}`
                          : 'Participant Details'}
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        <Field
                          icon={<User size={16} />}
                          label="Name"
                          value={member.name}
                          onChange={(value) =>
                            updateMember(
                              index,
                              'name',
                              value,
                            )
                          }
                          required
                        />

                        <Field
                          label="Year of Study"
                          value={
                            member.year_of_study
                          }
                          onChange={(value) =>
                            updateMember(
                              index,
                              'year_of_study',
                              value,
                            )
                          }
                          placeholder="e.g. 2"
                          required
                        />

                        <Field
                          label="College Registration Number"
                          value={
                            member.college_registration_number
                          }
                          onChange={(value) =>
                            updateMember(
                              index,
                              'college_registration_number',
                              value,
                            )
                          }
                          required
                        />

                        <Field
                          icon={
                            <Github size={16} />
                          }
                          label="GitHub"
                          value={member.github}
                          onChange={(value) =>
                            updateMember(
                              index,
                              'github',
                              value,
                            )
                          }
                          placeholder="github.com/username"
                        />

                        <div className="md:col-span-2">
                          <Field
                            icon={
                              <Mail size={16} />
                            }
                            label="Email"
                            type="email"
                            value={member.email}
                            onChange={(value) =>
                              updateMember(
                                index,
                                'email',
                                value,
                              )
                            }
                            required
                          />
                        </div>

                      </div>

                    </div>
                  ),
                )}

                {message && (
                  <div
                    className={`glass rounded-lg p-4 text-sm ${
                      message.startsWith(
                        'Registration successful!',
                      )
                        ? 'text-green-400 border border-green-500/30'
                        : 'text-gray-300'
                    }`}
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all"
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Complete Registration'}
                </button>

              </form>
            )}

          </div>

        </div>
      </motion.div>

    </div>
  );
};

interface FieldProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

const Field = ({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: FieldProps) => (
  <div>
    <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
      {icon}
      {label}
    </label>

    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      placeholder={placeholder}
      required={required}
      className="w-full bg-dark-900/60 border border-dark-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-brand-primary transition-colors"
    />
  </div>
);

export default EventRegistration;
