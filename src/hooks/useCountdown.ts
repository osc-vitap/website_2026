import {
  useEffect,
  useState,
} from 'react';

import {
  Remaining,
  remainingUntil,
} from '../data/eventCountdown';

/*
 * Time left until an instant, recomputed once a second.
 *
 * A second rather than a minute even though only minutes are shown: on
 * a minute timer the display turns over up to 59 seconds late, which
 * looks broken next to a phone clock. Date.now() is re-read on each
 * tick rather than accumulated, so a tab that was throttled in the
 * background is correct again on its first tick back.
 *
 * Passing null stops the interval, so a caller waiting on a fetch does
 * not have to mount the hook conditionally.
 */
export const useCountdown = (
  target: number | null,
): Remaining | null => {
  const [now, setNow] = useState(() =>
    Date.now(),
  );

  useEffect(() => {
    if (target === null) return;

    /* Re-sync immediately: `now` may be stale from a previous target. */
    setNow(Date.now());

    const id = window.setInterval(
      () => setNow(Date.now()),
      1000,
    );

    return () =>
      window.clearInterval(id);
  }, [target]);

  if (target === null) return null;

  return remainingUntil(target, now);
};
