/*
 * Something the hand feels, so a volunteer does not have to read the
 * screen to know what happened.
 *
 * At a door the phone is often held low and pointed at a pass while the
 * person doing the scanning is looking at a face. A distinct buzz for
 * "in" versus "stop" is worth more than any amount of colour.
 *
 * Two entirely different mechanisms, because the platforms share
 * nothing here.
 *
 * ANDROID and everything else: navigator.vibrate, which takes a
 * millisecond pattern and does exactly what it says.
 *
 * iOS: navigator.vibrate does not exist and never has. The only haptic
 * a web page can reach is the one Safari plays when a switch control is
 * toggled, which since 17.4 fires the system feedback generator. So a
 * hidden switch is kept in the document and flipped.
 *
 * Being straight about the limit: a web page cannot call the API behind
 * the Apple Pay confirmation, which is UINotificationFeedbackGenerator
 * with .success, and there is no way to ask for that specific pattern.
 * What the switch gives is the lighter selection haptic. Two of them,
 * spaced the way the payment confirmation spaces its pair, is as close
 * as the platform allows and reads as the same gesture in the hand.
 */

export type Haptic = 'admitted' | 'warn' | 'refused';

/*
 * Millisecond patterns for navigator.vibrate. Alternating on and off,
 * so [30, 60, 30] is buzz, pause, buzz.
 */
const PATTERNS: Record<Haptic, number | number[]> = {
  /* Two short taps: the shape of a confirmation everywhere. */
  admitted: [28, 55, 28],

  /* One medium. Not an error, but stop and look. */
  warn: 90,

  /* Long and single, so it is unmistakable through a pocket or a
     glove and cannot be confused with the double. */
  refused: [180, 70, 180],
};

/* How many switch flips stand in for each pattern on iOS, and how far
   apart, since that is the only variable available there. */
const IOS_TAPS: Record<Haptic, number[]> = {
  admitted: [0, 70],
  warn: [0],
  refused: [0, 90, 180],
};

let ios: HTMLInputElement | null = null;

/*
 * The hidden switch.
 *
 * It has to be a real, rendered, interactive control: Safari plays
 * nothing for one that is display:none, and nothing for a plain
 * checkbox without the switch attribute. So it is one pixel, fully
 * transparent, fixed out of reach, and hidden from assistive tech,
 * which is visible enough for the haptic and invisible enough for
 * everyone.
 */
const iosSwitch = (): HTMLInputElement | null => {
  if (typeof document === 'undefined') return null;

  if (ios?.isConnected) return ios;

  const input = document.createElement('input');

  input.type = 'checkbox';

  /* Not a React prop and not in the HTML types, so it is set directly. */
  input.setAttribute('switch', '');

  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;

  Object.assign(input.style, {
    position: 'fixed',
    top: '-1px',
    left: '-1px',
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none',
  });

  document.body.appendChild(input);

  ios = input;

  return input;
};

/**
 * Does this browser have the vibration API at all?
 *
 * Chrome on desktop reports it and does nothing, which is harmless.
 * Safari does not report it, which is what routes iOS to the switch.
 */
const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function haptic(kind: Haptic): void {
  if (canVibrate()) {
    try {
      navigator.vibrate(PATTERNS[kind]);
      return;
    } catch {
      /* Some browsers throw rather than returning false. Fall through
         to the switch, which costs nothing if it also does nothing. */
    }
  }

  const input = iosSwitch();

  if (!input) return;

  IOS_TAPS[kind].forEach((delay) => {
    window.setTimeout(() => {
      /* Toggling is what plays it, so the state is flipped rather than
         set. Its value is never read by anything. */
      input.checked = !input.checked;

      input.dispatchEvent(new Event('change', { bubbles: false }));
    }, delay);
  });
}

/*
 * Some platforms only allow a haptic inside a real user gesture, and
 * the first scan of a shift is not one. Calling this from the sign-in
 * tap warms the path so the first admission is felt like every other.
 */
export function primeHaptics(): void {
  if (canVibrate()) {
    try {
      navigator.vibrate(0);
    } catch {
      /* nothing to do */
    }

    return;
  }

  iosSwitch();
}
