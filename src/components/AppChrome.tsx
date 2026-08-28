import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ShieldCheck } from 'lucide-react';

/*
 * The installed app's own title bar, in place of the club site's.
 *
 * Running as a PWA there is no address bar and no browser back button, so
 * the marketing navbar is not just noise — it is a trapdoor. Tapping
 * "Gallery" inside an app called OSC Admin leaves you on the public site
 * with nothing to get back with, and the only way out is to force-quit.
 * The footer is the same eight links again at the bottom.
 *
 * So they go, and this takes their place: the app's name, and — anywhere
 * that is not the panel — the one link back to it. The panel itself has
 * no outbound links, so in practice that back link is for a launch the
 * OS restored to some other URL, or a saved shortcut.
 *
 * Rendered only in standalone. In a browser tab the site's own navbar is
 * there, the back button works, and none of this is needed.
 */
const AppChrome = () => {
  const { pathname } = useLocation();

  const onPanel = pathname === '/admin';

  /*
   * Marks the document as the installed app, for the rules in index.css
   * that stop it rubber-banding off its own chrome. Set here rather than
   * from a media query because this component renders exactly when the
   * app is standalone — including on iOS, which answers that question
   * through navigator.standalone and not through display-mode.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-standalone', 'true');

    return () => {
      root.removeAttribute('data-standalone');
    };
  }, []);

  return (
    <header
      /*
       * viewport-fit=cover puts the document under the status bar, so the
       * bar pays for the inset itself. It is 0 in anything that is not a
       * notched phone, which is why it is added rather than substituted.
       */
      className="sticky top-0 z-40 border-b border-dark-700/60 bg-dark-900/85 backdrop-blur-md"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex min-h-[48px] items-center px-4">
        {onPanel ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck
              size={16}
              aria-hidden="true"
              className="text-brand-accent"
            />
            OSC Admin
          </span>
        ) : (
          <Link
            to="/admin"
            /* A real target: this is the only way back. */
            className="-ml-2 flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            Admin panel
          </Link>
        )}
      </div>
    </header>
  );
};

export default AppChrome;
