import {
  useEffect,
  useState,
} from 'react';

/*
 * Is this page running as an installed app rather than in a browser tab?
 *
 * Two mechanisms, because iOS has never implemented the standard one.
 * Chrome, Edge and Android answer through the display-mode media query;
 * Safari on iOS answers through a non-standard boolean on navigator that
 * predates the query by about a decade and is still the only way to ask
 * there. Both are checked, and either is enough.
 *
 * display-mode is matched against three values, not just 'standalone'.
 * A manifest that asks for standalone can be honoured as minimal-ui when
 * the platform prefers it, and an app launched into fullscreen reports
 * neither — in both cases the person is in the installed app and a check
 * for 'standalone' alone would say they are not.
 */

const MODES = [
  '(display-mode: standalone)',
  '(display-mode: minimal-ui)',
  '(display-mode: fullscreen)',
  /*
   * Chromium's window-controls-overlay, used when an installed desktop
   * app draws its own title bar. Still the installed app.
   */
  '(display-mode: window-controls-overlay)',
];

/** iOS Safari's own flag, which is not on the typed Navigator. */
const iosStandalone = (): boolean =>
  (
    window.navigator as Navigator & {
      standalone?: boolean;
    }
  ).standalone === true;

export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;

  if (iosStandalone()) return true;

  return (
    typeof window.matchMedia === 'function' &&
    MODES.some(
      (query) => window.matchMedia(query).matches,
    )
  );
};

/**
 * The same answer as a hook, kept live.
 *
 * It can change inside a session: installing from the browser and
 * launching, or a desktop app toggling its title bar, both flip the
 * media query on a page that is already mounted. Reading it once into
 * state would leave the UI describing the wrong context until reload.
 */
export const useStandalone = (): boolean => {
  const [standalone, setStandalone] = useState(
    isStandalone,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const lists = MODES.map((query) =>
      window.matchMedia(query),
    );

    const recheck = () =>
      setStandalone(isStandalone());

    lists.forEach((list) =>
      list.addEventListener('change', recheck),
    );

    /* A launch can land before the listeners attach. */
    recheck();

    return () => {
      lists.forEach((list) =>
        list.removeEventListener(
          'change',
          recheck,
        ),
      );
    };
  }, []);

  return standalone;
};
