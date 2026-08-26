/*
 * Why an admin sign-in did not go through.
 *
 * The Worker redirects back to /admin/restricted?reason=<code> instead
 * of answering the browser with JSON, so these codes are a contract
 * between osc-events-worker/src/index.ts and the restricted page.
 * Adding a code here means adding it there too; an unrecognised code
 * falls back to `unknown` rather than rendering a blank page.
 */

export type AdminAuthReason =
  | 'denied'
  | 'no-code'
  | 'bad-state'
  | 'github-error'
  | 'not-allowed'
  | 'not-a-member'
  | 'pending-invite'
  | 'signed-out'
  | 'unknown';

export interface AdminAuthCopy {
  /** Short label above the heading. */
  kicker: string;
  heading: string;
  /** What happened, in plain language. */
  detail: string;
  /** What the person can actually do about it. */
  next: string;
  /** Whether trying again could plausibly succeed. */
  retryable: boolean;
}

const COPY: Record<AdminAuthReason, AdminAuthCopy> = {
  'not-a-member': {
    kicker: 'Access restricted',
    heading: 'You are not in the OSC organisation',
    detail:
      'The events dashboard is limited to members of the osc-vitap GitHub organisation. Your GitHub account signed in correctly, but it is not a member.',
    next: 'Ask a core team member to invite your GitHub handle to the organisation, then sign in again.',
    retryable: false,
  },

  'pending-invite': {
    kicker: 'Invitation pending',
    heading: 'Your organisation invite is not accepted yet',
    detail:
      'You have been invited to the osc-vitap GitHub organisation, but the invitation is still waiting. Membership only counts once it is accepted.',
    next: 'Open github.com/osc-vitap, accept the invitation, then sign in again.',
    retryable: true,
  },

  'not-allowed': {
    kicker: 'Access restricted',
    heading: 'This account is not on the admin list',
    detail:
      'An explicit allow list is in force, and your GitHub handle is not on it. Organisation membership alone is not enough while that list is set.',
    next: 'Ask a core team member to add your handle to the events admin allow list.',
    retryable: false,
  },

  denied: {
    kicker: 'Sign-in cancelled',
    heading: 'You cancelled the GitHub sign-in',
    detail:
      'GitHub reported that authorisation was declined, so no session was created. Nothing was changed on your account.',
    next: 'Start again when you are ready.',
    retryable: true,
  },

  'bad-state': {
    kicker: 'Sign-in expired',
    heading: 'That sign-in attempt is no longer valid',
    detail:
      'Sign-in links are single use and expire after ten minutes. This one had already been used, or it sat too long before GitHub sent you back.',
    next: 'Start a fresh sign-in — this is normal if you left the tab open for a while.',
    retryable: true,
  },

  'no-code': {
    kicker: 'Sign-in incomplete',
    heading: 'GitHub did not send back a sign-in code',
    detail:
      'The callback arrived without the parameters it needs. This usually means the link was opened directly rather than being reached through GitHub.',
    next: 'Start the sign-in from the dashboard rather than opening the callback URL yourself.',
    retryable: true,
  },

  'github-error': {
    kicker: 'GitHub unavailable',
    heading: 'GitHub could not be reached',
    detail:
      'The sign-in reached GitHub but the response could not be completed. This is usually a temporary problem on GitHub rather than with your account.',
    next: 'Wait a moment and try again. If it keeps happening, check the GitHub status page.',
    retryable: true,
  },

  'signed-out': {
    kicker: 'Signed out',
    heading: 'You have been signed out',
    detail: 'Your admin session has been ended and the session cookie cleared.',
    next: 'Sign in again whenever you need the dashboard.',
    retryable: true,
  },

  unknown: {
    kicker: 'Access restricted',
    heading: 'Sign-in did not complete',
    detail:
      'The sign-in did not finish, and no more specific reason was reported.',
    next: 'Try signing in again. If it keeps failing, tell the core team what you see here.',
    retryable: true,
  },
};

const REASONS = Object.keys(COPY) as AdminAuthReason[];

/** Narrows an untrusted query parameter to a known reason. */
export const parseAdminAuthReason = (value: string | null): AdminAuthReason =>
  value !== null && (REASONS as string[]).includes(value)
    ? (value as AdminAuthReason)
    : 'unknown';

export const adminAuthCopy = (reason: AdminAuthReason): AdminAuthCopy =>
  COPY[reason];

/*
 * Marks that a sign-in has already been attempted in this tab.
 *
 * sessionStorage survives the round trip to GitHub and back but not a
 * new tab, which is exactly the lifetime a loop-breaker wants: if we
 * return from OAuth still signed out, redirecting again would repeat
 * forever, so the second pass stops and asks.
 */
const LOOP_KEY = 'osc-admin-oauth-attempted';

export const markOauthAttempted = () => {
  try {
    sessionStorage.setItem(LOOP_KEY, '1');
  } catch {
    /* Storage can be unavailable in private modes; the splash still
     * renders, it just cannot detect the second pass. */
  }
};

export const oauthWasAttempted = (): boolean => {
  try {
    return sessionStorage.getItem(LOOP_KEY) === '1';
  } catch {
    return false;
  }
};

export const clearOauthLoopMarker = () => {
  try {
    sessionStorage.removeItem(LOOP_KEY);
  } catch {
    /* Nothing to clear if storage is unavailable. */
  }
};
