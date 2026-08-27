/*
 * The VIT-AP registration number, validated the same way the events
 * Worker validates it — admission year 22 to 26, a three-letter
 * programme code, a four-digit roll: 22BCE1234.
 *
 * One definition for every form, so the client-side check can never
 * drift from the server's. If the server pattern changes
 * (osc-events-worker/src/index.ts), change this with it.
 */

/*
 * How the Worker sees every other field before it validates it — see
 * collapseWhitespace in osc-events-worker/src/index.ts. Testing a value
 * in a shape the server never tests is how a mirrored rule drifts from
 * the rule it mirrors.
 */
const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

/** Uppercased with all whitespace removed — the form the server stores. */
export const normalizeRegistrationNumber = (value: string): string =>
  value.toUpperCase().replace(/\s+/g, '');

export const REGISTRATION_NUMBER_PATTERN = /^2[2-6][A-Z]{3}[0-9]{4}$/;

export const REGISTRATION_NUMBER_HINT =
  'Use your university registration number, e.g. 22BCE1234';

/** Empty string when valid; a message to show the user when not. */
export const registrationNumberError = (value: string): string => {
  const normalized = normalizeRegistrationNumber(value);

  if (!normalized) {
    return 'Registration number is required';
  }

  return REGISTRATION_NUMBER_PATTERN.test(normalized)
    ? ''
    : `${REGISTRATION_NUMBER_HINT} — "${normalized}" does not look like one.`;
};

/*
 * Registration is for VIT-AP, so the address has to be a university
 * one — students are @vitapstudent.ac.in, staff @vitap.ac.in.
 *
 * Mirrors the check in osc-events-worker/src/index.ts. The server is
 * the one that decides; this only saves a round trip and says the rule
 * out loud before someone submits.
 */
export const ALLOWED_EMAIL_DOMAINS = [
  'vitapstudent.ac.in',
  'vitap.ac.in',
];

export const EMAIL_DOMAIN_HINT = `Use your university email — ${ALLOWED_EMAIL_DOMAINS.map(
  (domain) => `@${domain}`,
).join(' or ')}`;

/** Empty string when acceptable; a message to show the user when not. */
export const universityEmailError = (
  value: string,
): string => {
  const email = value.trim().toLowerCase();

  if (!email) {
    return 'Email is required';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'That email address does not look valid';
  }

  /*
   * Exact domain match. Anything looser would accept
   * "vitap.ac.in.example.com".
   */
  const domain = email.slice(email.lastIndexOf('@') + 1);

  return ALLOWED_EMAIL_DOMAINS.includes(domain)
    ? ''
    : `${EMAIL_DOMAIN_HINT}.`;
};

/*
 * Year of study.
 *
 * Six of the first 239 participants answered this with the year they
 * joined rather than the year they are in, so the Worker reads a plain
 * integer above ten as a calendar year and subtracts it from 2027:
 * 2026 is year 1, 2025 is year 2.
 *
 * The subtraction on its own invents years for input it was never
 * written for — 2027 gives 0, 2028 gives -1, a mistyped "25" gives
 * 2002 — so the result is range-checked and a bad one is refused
 * rather than clamped.
 *
 * Mirrors normalizeYearOfStudy in osc-events-worker/src/index.ts,
 * including the digits-only test: "1st year" is refused there, so
 * accepting it here would only move the rejection to the server.
 */

/* Degrees at VIT-AP run to five years — four for B.Tech, five for the
   integrated programmes. */
const MAX_YEAR_OF_STUDY = 5;

const CALENDAR_YEAR_THRESHOLD = 10;

/* Moves with the intake: once 2027 admissions register, a first-year
   types "2027" and this has to become 2028 or they are turned away. */
const ACADEMIC_YEAR_BASE = 2027;

export const YEAR_OF_STUDY_HINT = `Enter the year you are in as a number from 1 to ${MAX_YEAR_OF_STUDY}`;

/** The year the server will store, or null when it will refuse the value. */
export const normalizeYearOfStudy = (
  value: string,
): string | null => {
  const entered = collapseWhitespace(value);

  if (!/^[0-9]{1,4}$/.test(entered)) {
    return null;
  }

  const typed = Number(entered);

  const year =
    typed > CALENDAR_YEAR_THRESHOLD
      ? ACADEMIC_YEAR_BASE - typed
      : typed;

  return year < 1 || year > MAX_YEAR_OF_STUDY
    ? null
    : String(year);
};

/** Empty string when valid; a message to show the user when not. */
export const yearOfStudyError = (value: string): string => {
  const entered = collapseWhitespace(value);

  if (!entered) {
    return 'Year of study is required';
  }

  return normalizeYearOfStudy(entered)
    ? ''
    : `${YEAR_OF_STUDY_HINT} — "${entered}" is not one.`;
};

/*
 * What the server will store, said out loud, when that differs from
 * what was typed.
 *
 * Someone entering 2026 is registered as a first year. Rewriting the
 * field under them reads as the form losing their answer, and refusing
 * it with no explanation is worse — so the field keeps what they typed
 * and the form says what it will mean. Empty whenever the two agree,
 * which is every entry that was already a year of study.
 */
export const yearOfStudyRecordedAs = (
  value: string,
): string => {
  const entered = collapseWhitespace(value);

  const year = normalizeYearOfStudy(entered);

  return year && year !== entered
    ? `Recorded as year ${year}.`
    : '';
};

/*
 * GitHub. Optional — 177 of the first 239 participants left it blank.
 *
 * A handle or a link to a profile is accepted and the handle is what
 * gets stored, so the two forms are the same registration. Mirrors
 * normalizeGithub in osc-events-worker/src/index.ts.
 */

/*
 * GitHub's own username rule: 1 to 39 characters, letters, digits and
 * single hyphens, never starting or ending with one. Spelled out
 * because the obvious \w+ accepts "-", "--" and a 200-character string
 * as handles.
 */
const GITHUB_USERNAME =
  /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/*
 * A profile URL in the shapes an address bar hands out: scheme
 * optional, www. optional, trailing slash optional.
 *
 * A deeper path does not match at all, so "github.com/name/project" is
 * refused rather than trimmed to its first segment — that is a
 * repository someone pasted by mistake.
 */
const GITHUB_PROFILE_URL =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/?$/i;

export const GITHUB_HINT =
  'Use your username, e.g. adalovelace, or a link to your profile';

/** The handle the server will store, or null when it will refuse the value. */
export const normalizeGithub = (
  value: string,
): string | null => {
  const entered = collapseWhitespace(value);

  /*
   * Copying the link while sitting on your own Repositories tab gives
   * "github.com/ada?tab=repositories", and the address bar hands out
   * "#top" the same way. The Worker cuts both before matching, so this
   * has to as well — the placeholder now offers a profile link as an
   * accepted answer, and a form that refuses the link the browser
   * actually produced would send people back to a field the server
   * would have taken. Only the URL form is cut: a bare handle carrying
   * a '?' is not a handle.
   */
  const url = entered.split(/[?#]/)[0];

  const handle =
    GITHUB_PROFILE_URL.exec(url)?.[1] ?? entered;

  /*
   * "https://github.com/" captures nothing and names nobody, so it
   * fails here with everything else that has no handle in it.
   */
  return GITHUB_USERNAME.test(handle) ? handle : null;
};

/** Empty string when acceptable; a message to show the user when not. */
export const githubError = (value: string): string => {
  const entered = collapseWhitespace(value);

  /* Left blank is not an answer to check. */
  if (!entered) {
    return '';
  }

  return normalizeGithub(entered)
    ? ''
    : `${GITHUB_HINT} — "${entered}" is neither.`;
};
