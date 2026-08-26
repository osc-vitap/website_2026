import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Github, Lock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { markOauthAttempted, oauthWasAttempted } from '../data/adminAuth';

/*
 * The screen between "you are not signed in" and GitHub.
 *
 * The dashboard used to jump straight to the OAuth URL the moment
 * /api/admin/me answered 401, which showed a flash of empty dashboard
 * and then an unexplained bounce to github.com. This says what is about
 * to happen and why, then goes.
 *
 * It also breaks the redirect loop. If the cookie never sticks — a
 * browser blocking it, a session that dies immediately — the old code
 * would land back on /admin, get another 401, and bounce to GitHub
 * again, forever. A return trip is recorded in sessionStorage, and on
 * the second pass the redirect becomes a button the person has to
 * press, with an explanation.
 */

const REDIRECT_DELAY_MS = 1400;

interface AdminAuthSplashProps {
  /** Where to send the browser to begin the OAuth flow. */
  authUrl: string;
}

const AdminAuthSplash = ({ authUrl }: AdminAuthSplashProps) => {
  /*
   * A previous attempt already came back here without a working
   * session, so redirecting again would just repeat the loop.
   */
  const [looped] = useState(
    oauthWasAttempted,
  );

  const [redirecting, setRedirecting] = useState(!looped);

  const timer = useRef<number>();

  const go = () => {
    markOauthAttempted();
    window.location.href = authUrl;
  };

  useEffect(() => {
    if (looped) return;

    timer.current = window.setTimeout(go, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looped]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-16 font-sans">

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md text-center"
      >

        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 glass border border-dark-600 flex items-center justify-center">
              <ShieldCheck size={26} className="text-brand-accent" />
            </div>

            {redirecting && (
              <span className="absolute -inset-1 border border-brand-accent/40 animate-pulse" />
            )}
          </div>
        </div>

        <div className="mb-4 text-brand-accent text-xs tracking-[0.3em] uppercase font-bold">
          {looped ? 'Sign-in did not stick' : 'Admin area'}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
          {looped ? (
            <>
              Your browser did not{' '}
              <span className="text-gradient">keep the session</span>
            </>
          ) : (
            <>
              Signing you in with{' '}
              <span className="text-gradient">GitHub</span>
            </>
          )}
        </h1>

        <p className="text-gray-400 font-mono text-xs md:text-sm leading-relaxed mb-8">
          {looped
            ? 'You came back from GitHub but the dashboard still sees you as signed out. That usually means cookies are blocked for this site, or a privacy extension is stripping them.'
            : 'The events dashboard is limited to the osc-vitap organisation. You are being sent to GitHub to confirm who you are — no password is shared with this site.'}
        </p>

        <button
          type="button"
          onClick={go}
          className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-brand-primary text-white font-bold uppercase tracking-[0.1em] text-sm hover:bg-brand-accent hover:text-dark-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
        >
          <Github size={16} />
          {looped ? 'Try GitHub again' : 'Continue to GitHub'}
        </button>

        {redirecting && (
          <>
            <div
              className="mt-6 h-px w-full bg-dark-700 overflow-hidden"
              role="presentation"
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{
                  duration: REDIRECT_DELAY_MS / 1000,
                  ease: 'linear',
                }}
                className="h-full bg-brand-accent"
              />
            </div>

            <p
              className="mt-3 text-gray-600 font-mono text-[11px]"
              /*
               * The countdown is decoration; the button above is the
               * real control, so screen readers are told about that
               * rather than a bar that is already moving.
               */
              aria-hidden="true"
            >
              Redirecting automatically…
            </p>

            <button
              type="button"
              onClick={() => {
                window.clearTimeout(timer.current);
                setRedirecting(false);
              }}
              className="mt-2 text-gray-600 hover:text-gray-400 font-mono text-[11px] underline underline-offset-4 transition-colors"
            >
              Stay on this page
            </button>
          </>
        )}

        <div className="mt-10 pt-8 border-t border-dark-700 flex items-center justify-center gap-2 text-gray-600 font-mono text-[11px]">
          <Lock size={12} />
          <span>Not an admin?</span>
          <Link
            to="/"
            className="text-gray-400 hover:text-brand-accent underline underline-offset-4 transition-colors"
          >
            Back to the site
          </Link>
        </div>

      </motion.div>

    </div>
  );
};

export default AdminAuthSplash;
