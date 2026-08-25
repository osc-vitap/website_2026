import { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

/*
 * Shared plumbing for event poster pages.
 *
 * Deliberately small: every event page is designed from its own poster,
 * so this file owns only the things that must behave identically across
 * events — the viewport-fitting frame and the link into the registration
 * form. Everything visual belongs to the page.
 *
 * The document title hook lives in ./useEventPageMeta.
 */

interface EventPageFrameProps {
  children: ReactNode;
  className?: string;
}

/*
 * A poster page is one screen. It is locked to the viewport from `lg`
 * up, and allowed to flow on smaller screens so the call to action can
 * never be clipped off a phone.
 */
export const EventPageFrame = ({
  children,
  className = '',
}: EventPageFrameProps) => (
  <div
    className={`relative min-h-[100dvh] w-full overflow-hidden lg:h-[100dvh] ${className}`}
  >
    {children}
  </div>
);

interface RegisterLinkProps {
  registrationSlug: string;
  className?: string;
  /** Poster pages colour the button from their own palette. */
  style?: CSSProperties;
  children?: ReactNode;
}

/*
 * The one contract every event page has to honour: a visible way into
 * the registration form.
 */
export const RegisterLink = ({
  registrationSlug,
  className = '',
  style,
  children,
}: RegisterLinkProps) => (
  <Link
    to={`/events/${registrationSlug}/register`}
    className={className}
    style={style}
  >
    {children ?? 'Register Now'}
  </Link>
);
