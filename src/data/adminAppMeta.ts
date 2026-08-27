import { useEffect } from 'react';

/*
 * Install support for the admin panel.
 *
 * A hook rather than a component, and that is the whole point. As
 * <AdminAppMeta /> it sat in the dashboard's main return, behind three
 * early returns — one of them the sign-in splash. So it never ran for
 * anyone who was not already signed in, which is precisely the state a
 * phone is in when someone opens the panel to install it. Hooks run
 * before returns; this one cannot be skipped.
 *
 * In production the head tags come from admin.html, which Vercel
 * rewrites /admin to, because they have to be present while the
 * document parses — a manifest added afterwards is too late to install
 * from, and that is what left the installed panel showing an address
 * bar. Vite's dev server does not apply that rewrite, so on localhost
 * the tags are added here; in production this finds them already there
 * and adds nothing.
 *
 * None of it is protection. The Worker checks the session on every
 * request and always did — keeping the panel out of the public
 * document is for the people who have no reason to see it.
 */

const MANIFEST = '/app/site.webmanifest';

const META: Array<[string, string]> = [
  ['apple-mobile-web-app-capable', 'yes'],
  ['mobile-web-app-capable', 'yes'],
  ['apple-mobile-web-app-title', 'OSC Admin'],
  /*
   * 'black', not 'black-translucent'. Translucent hands the status bar
   * area to the page, and every view would need safe-area padding to
   * stop the first row of content sliding under the clock.
   */
  ['apple-mobile-web-app-status-bar-style', 'black'],
  ['theme-color', '#0a0a0c'],
];

export const useAdminAppMeta = (): void => {
  useEffect(() => {
    const added: Element[] = [];

    /** Add a head tag unless the document already carries one. */
    const ensure = (
      selector: string,
      build: () => Element,
    ) => {
      if (document.head.querySelector(selector)) {
        return;
      }

      const node = build();
      document.head.appendChild(node);
      added.push(node);
    };

    ensure('link[rel="manifest"]', () => {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = MANIFEST;
      return link;
    });

    ensure('link[rel="apple-touch-icon"]', () => {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.setAttribute('sizes', '180x180');
      link.href = '/app/apple-touch-icon.png';
      return link;
    });

    for (const [name, content] of META) {
      ensure(`meta[name="${name}"]`, () => {
        const tag = document.createElement('meta');
        tag.name = name;
        tag.content = content;
        return tag;
      });
    }

    /*
     * Scoped to /admin, so it is never asked about a request for the
     * public site. A failure is not worth surfacing: the panel works
     * without it, and what is lost is the offline launch and some of
     * Chrome's willingness to call this an app rather than a bookmark.
     */
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/admin' })
        .catch(() => {
          /* http origin, private window, or the file did not deploy */
        });
    }

    return () => {
      added.forEach((node) => node.remove());
    };
  }, []);
};
