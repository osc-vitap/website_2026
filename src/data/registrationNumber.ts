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
