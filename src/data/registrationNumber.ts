/*
 * The VIT-AP registration number, validated the same way the events
 * Worker validates it — admission year 22 to 26, a three-letter
 * programme code, a four-digit roll: 22BCE1234.
 *
 * One definition for every form, so the client-side check can never
 * drift from the server's. If the server pattern changes
 * (osc-events-worker/src/index.ts), change this with it.
 */

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
