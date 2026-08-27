import { useEffect } from 'react';

/*
 * The install metadata, mounted only while the admin panel is on screen.
 *
 * The manifest deliberately does not live in index.html. A manifest in
 * the document head is served to every visitor on every page, which
 * means view-source on the home page names the admin app, and browsers
 * offer to install "OSC Admin" to anyone reading about the club. Keeping
 * the tags on this route means the app is installable from the panel and
 * invisible everywhere else.
 *
 * Injecting after mount is fine: Chromium re-runs its installability
 * check when a manifest link appears, and Safari reads the apple-* tags
 * out of the live DOM at the moment someone taps Add to Home Screen.
 *
 * This is presentation, not protection. Anyone can request /admin and
 * anyone can read the built bundle; what stops them is the Worker, which
 * checks the session on every request. Hiding the entrance is for the
 * people who have no reason to see it, not for the ones looking.
 */

const MANIFEST = '/app/site.webmanifest';

const META: Array<[string, string]> = [
  /*
   * iOS has no manifest support worth relying on for this, so the
   * legacy pair still does the work there. The unprefixed name is the
   * one Chromium reads; both are needed.
   */
  ['apple-mobile-web-app-capable', 'yes'],
  ['mobile-web-app-capable', 'yes'],
  ['apple-mobile-web-app-title', 'OSC Admin'],
  /*
   * 'black', not 'black-translucent'. Translucent hands the status bar
   * area to the page, and every view would need safe-area padding to
   * stop the first row of content sliding under the clock.
   */
  [
    'apple-mobile-web-app-status-bar-style',
    'black',
  ],
  ['theme-color', '#0a0a0c'],
];

const AdminAppMeta = () => {
  useEffect(() => {
    const added: Element[] = [];

    const manifest =
      document.createElement('link');

    manifest.rel = 'manifest';
    manifest.href = MANIFEST;
    document.head.appendChild(manifest);
    added.push(manifest);

    const touchIcon =
      document.createElement('link');

    touchIcon.rel = 'apple-touch-icon';
    touchIcon.setAttribute('sizes', '180x180');
    touchIcon.href = '/app/apple-touch-icon.png';
    document.head.appendChild(touchIcon);
    added.push(touchIcon);

    for (const [name, content] of META) {
      /*
       * A tag the document already carries is left alone — replacing
       * it would mean restoring it on unmount, and the only one that
       * overlaps is theme-color, which is the same value anyway.
       */
      if (
        document.head.querySelector(
          `meta[name="${name}"]`,
        )
      ) {
        continue;
      }

      const tag = document.createElement('meta');
      tag.name = name;
      tag.content = content;
      document.head.appendChild(tag);
      added.push(tag);
    }

    return () => {
      added.forEach((node) => node.remove());
    };
  }, []);

  return null;
};

export default AdminAppMeta;
