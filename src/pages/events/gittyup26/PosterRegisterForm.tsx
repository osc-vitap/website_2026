import { FormEvent, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { ApiEvent, API_BASE_URL } from '../../../data/eventsApi';
import EventStartsIn from '../../../components/EventStartsIn';
import RedirectToast from '../../../components/RedirectToast';
import {
  registrationNumberError,
  universityEmailError,
} from '../../../data/registrationNumber';
import { glassTint } from './posterColor';
import { PosterVariant } from './posterTypes';

/*
 * Registration, inline on the poster page.
 *
 * GITTYUP is a workshop, so it takes exactly one participant — the same
 * shape POST /api/events/:slug/register expects for a solo or workshop
 * event. Keeping the form here means someone who scanned a poster never
 * leaves the design they scanned into.
 *
 * Server-side rules still apply: registration closed, deadline passed,
 * event already ended and duplicate registration numbers all come back
 * as errors, and are shown as sent rather than reworded.
 */

/*
 * Every field carries an example, because the server is strict about
 * two of them and silent about the shape it wants until you submit.
 * A registration number in the wrong shape and a non-university email
 * are both rejected, so the format is shown up front rather than
 * discovered by failing.
 */
const FIELDS = [
  {
    name: 'name',
    label: 'Full name',
    type: 'text',
    autoComplete: 'name',
    placeholder: 'Ada Lovelace',
    required: true,
  },
  {
    name: 'college_registration_number',
    label: 'University registration number',
    type: 'text',
    autoComplete: 'off',
    placeholder: '22BCE1234',
    required: true,
  },
  {
    name: 'year_of_study',
    label: 'Year of study',
    type: 'text',
    autoComplete: 'off',
    placeholder: '2',
    required: true,
  },
  {
    name: 'email',
    label: 'University email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'ada.22bce1234@vitapstudent.ac.in',
    required: true,
  },
  {
    name: 'github',
    label: 'GitHub (optional)',
    type: 'text',
    autoComplete: 'off',
    placeholder: 'adalovelace',
    required: false,
  },
] as const;

type FieldName = (typeof FIELDS)[number]['name'];

const EMPTY: Record<FieldName, string> = {
  name: '',
  college_registration_number: '',
  year_of_study: '',
  email: '',
  github: '',
};

interface PosterRegisterFormProps {
  variant: PosterVariant;
  /** The event registered for, so the confirmation can count down to it. */
  event: ApiEvent | null;
  onClose: () => void;
}

const PosterRegisterForm = ({
  variant,
  event,
  onClose,
}: PosterRegisterFormProps) => {
  const [values, setValues] =
    useState<Record<FieldName, string>>(EMPTY);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState('');

  const [done, setDone] = useState(false);

  /*
   * A registration is the end of what this page is for, so it hands the
   * visitor on to the rest of the site rather than leaving them on a
   * poster with nothing further to do. RedirectToast owns that now: it
   * counts the wait down out loud and can be cancelled, which a silent
   * setTimeout could not be — someone photographing their confirmation
   * had the page moved out from under them.
   */

  const set = (
    field: FieldName,
    value: string,
  ) =>
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

  const submit = async (
    submitEvent: FormEvent,
  ) => {
    submitEvent.preventDefault();

    setError('');

    /*
     * Same check the Worker runs, so a typo is caught before the
     * request instead of coming back as a 400.
     */
    const regNoError = registrationNumberError(
      values.college_registration_number,
    );

    if (regNoError) {
      setError(regNoError);
      return;
    }

    const emailError = universityEmailError(
      values.email,
    );

    if (emailError) {
      setError(emailError);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/events/gittyup26/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            /*
             * Which sheet sent them, so the Discord announcement can say
             * so and the club can see which of the thirty printed
             * posters actually bring people in. The Worker validates
             * this and falls back to "unknown" rather than repeating
             * anything it does not recognise.
             */
            source: {
              page: window.location.pathname,
              poster: variant.id,
            },
            members: [
              {
                name: values.name.trim(),
                year_of_study:
                  values.year_of_study.trim(),
                college_registration_number:
                  values.college_registration_number.trim(),
                github:
                  values.github.trim() ||
                  undefined,
                email: values.email.trim(),
              },
            ],
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Registration failed. Try again in a moment.',
        );
      }

      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    borderColor: `color-mix(in srgb, ${variant.accent} 45%, transparent)`,
    color: variant.text,
  };

  if (done) {
    return (
      <div
        className="poster-slide-in poster-glass p-5 md:p-6"
        /* The tints match the details panel exactly. This card replaces
           that one in place, so any difference in them reads as the card
           changing material at the moment somebody registers. */
        style={{
          backgroundColor: glassTint(variant.ground, 0.95),
          ['--glass-solid' as string]: glassTint(variant.ground, 0.96),
          borderColor: `color-mix(in srgb, ${variant.accent} 22%, transparent)`,
        }}
      >
        {/* Same split hairline the details panel carries, so replacing
            one with the other does not change the shape of the card. */}
        {variant.dispersion && (
          <span
            aria-hidden="true"
            className="poster-fringe"
          >
            <span className="poster-fringe-tear" />
          </span>
        )}

        <div
          className="flex items-center gap-3 text-lg font-bold md:text-xl"
          style={{ color: variant.text }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: variant.accent,
              color: variant.ground,
            }}
          >
            <Check size={18} />
          </span>
          You're registered.
        </div>

        <p
          className="mt-4 max-w-md text-xs font-light leading-relaxed md:text-sm"
          style={{ color: variant.text }}
        >
          See you on 29 August at the AB-2 Auditorium.
          Bring a laptop if you have one.
        </p>

        {/* How long the wait is, now that there is one. */}
        {event && (
          <div
            className="mt-6 border-t pt-5"
            style={{
              borderColor: `color-mix(in srgb, ${variant.accent} 20%, transparent)`,
            }}
          >
            <EventStartsIn
              event={event}
              size={30}
              accent={variant.accent}
              ground={glassTint(
                variant.ground,
                0.94,
              )}
              labelColor={variant.text}
            />
          </div>
        )}

        <RedirectToast seconds={5} />
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="poster-slide-in poster-glass p-5 md:p-6"
      style={{
        backgroundColor: glassTint(variant.ground, 0.95),
        ['--glass-solid' as string]: glassTint(variant.ground, 0.96),
        borderColor: `color-mix(in srgb, ${variant.accent} 22%, transparent)`,
      }}
    >
      {/* It holds still while any of these fields has focus — see
          .poster-fringe. An edge jittering under someone typing their
          registration number reads as the page being broken. */}
      {variant.dispersion && (
        <span
          aria-hidden="true"
          className="poster-fringe"
        >
          <span className="poster-fringe-tear" />
        </span>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <h2
          className="text-[clamp(1.25rem,2.6vw,1.75rem)] font-bold leading-none tracking-[-0.02em]"
          style={{ color: variant.text }}
        >
          Register
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="font-postermono text-[10px] uppercase tracking-[0.2em] underline-offset-4 hover:underline md:text-xs"
          style={{ color: variant.accent }}
        >
          Back
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {FIELDS.map((field) => (
          <label
            key={field.name}
            className="flex flex-col gap-1.5"
          >
            {/* No opacity on top of the colour: variant.text is already
                translucent on most of the run, and 0.7 of that put these
                labels at an effective 0.5 — the smallest type in the one
                box on the page a stranger has to fill in. */}
            <span
              className="font-postermono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: variant.text }}
            >
              {field.label}
            </span>

            <input
              type={field.type}
              required={field.required}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              value={values[field.name]}
              onChange={(e) =>
                set(field.name, e.target.value)
              }
              disabled={submitting}
              className="w-full rounded-full border-2 bg-transparent px-4 py-2.5 text-sm outline-none transition-colors placeholder:opacity-40 focus:border-current disabled:opacity-50"
              style={fieldStyle}
            />
          </label>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl px-4 py-3 text-xs md:text-sm"
          style={{
            backgroundColor:
              'color-mix(in srgb, #ff5d63 18%, transparent)',
            color: '#ffd9db',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="group mt-6 inline-flex w-full items-center justify-between gap-4 rounded-full px-7 py-4 text-base font-bold transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60 sm:w-auto md:text-lg"
        style={{
          backgroundColor: variant.accent,
          color: variant.ground,
          outlineColor: variant.accent,
        }}
      >
        {submitting
          ? 'Sending…'
          : 'Confirm registration'}
        <ArrowRight
          size={20}
          className="transition-transform group-hover:translate-x-1"
        />
      </button>
    </form>
  );
};

export default PosterRegisterForm;
