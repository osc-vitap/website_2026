/*
 * Something other than the screen telling a volunteer what happened.
 *
 * The phone is held low and pointed at a pass while the person doing
 * the scanning is looking at a face, so a signal that does not need
 * eyes is worth more than any amount of colour.
 *
 * Two channels, because neither is reliable everywhere.
 *
 * VIBRATION works on Android without ceremony. iOS has never shipped
 * navigator.vibrate, and the only haptic a web page can reach there is
 * the one Safari plays when a switch control is toggled. That is
 * attempted, and it may well not fire: it is undocumented, it needs
 * 17.4 or newer, and Safari ties feedback to user activation, which a
 * camera decoding a code by itself does not have.
 *
 * SOUND is the one that works. Once an AudioContext has been unlocked
 * inside a real tap, iOS will play from a timer, a promise, or anything
 * else, with no further gesture needed. A short tone per verdict is
 * also what every barcode scanner in the world already does, so nobody
 * has to be taught what it means.
 */

export type Feedback = 'admitted' | 'warn' | 'refused';

/* Alternating on and off, in milliseconds. */
const VIBRATION: Record<Feedback, number | number[]> = {
  admitted: [28, 55, 28],
  warn: 90,
  refused: [180, 70, 180],
};

/*
 * Tones as [hertz, start ms, length ms].
 *
 * Rising for yes, flat for wait, low and doubled for no. Kept under a
 * fifth of a second: this plays once per person and a queue is not the
 * place for a jingle.
 */
const TONES: Record<Feedback, [number, number, number][]> = {
  admitted: [
    [880, 0, 70],
    [1320, 70, 110],
  ],
  warn: [[620, 0, 180]],
  refused: [
    [300, 0, 130],
    [200, 150, 200],
  ],
};

/* ------------------------------------------------------------------ */
/* Sound                                                               */
/* ------------------------------------------------------------------ */

type WindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audio: AudioContext | null = null;

const audioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;

  if (!audio) {
    const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;

    if (!Ctor) return null;

    audio = new Ctor();
  }

  /*
   * Safari suspends a context created outside a gesture and will not
   * resume it outside one either, so this is called from the sign-in
   * tap as well as from here. Resuming an already-running context is
   * free.
   */
  if (audio.state === 'suspended') void audio.resume();

  return audio;
};

const play = (kind: Feedback): void => {
  const ctx = audioContext();

  if (!ctx || ctx.state !== 'running') return;

  for (const [hz, startMs, lengthMs] of TONES[kind]) {
    const at = ctx.currentTime + startMs / 1000;
    const until = at + lengthMs / 1000;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = hz;

    /*
     * Ramped rather than switched. A gain that jumps from 0 to full
     * puts a click at both ends of every tone, which over a few hundred
     * people is more irritating than the tone itself.
     */
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, until);

    osc.connect(gain).connect(ctx.destination);

    osc.start(at);
    osc.stop(until + 0.02);
  }
};

/* ------------------------------------------------------------------ */
/* Vibration and the iOS switch                                        */
/* ------------------------------------------------------------------ */

let iosLabel: HTMLLabelElement | null = null;

/*
 * A switch inside a label, clicked by the label.
 *
 * Clicking the input directly was the first attempt and was silent. The
 * haptic belongs to the label's activation behaviour forwarding to the
 * control, which is the path a real tap takes; poking the input is not
 * the same thing.
 */
const iosSwitch = (): HTMLLabelElement | null => {
  if (typeof document === 'undefined') return null;

  if (iosLabel?.isConnected) return iosLabel;

  const label = document.createElement('label');

  label.setAttribute('aria-hidden', 'true');

  Object.assign(label.style, {
    position: 'fixed',
    top: '-1px',
    left: '-1px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: '0',
  });

  const input = document.createElement('input');

  input.type = 'checkbox';

  /* Not a React prop and not in the HTML types, so set directly. A
     plain checkbox without this plays nothing. */
  input.setAttribute('switch', '');

  input.tabIndex = -1;

  label.appendChild(input);
  document.body.appendChild(label);

  iosLabel = label;

  return label;
};

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const buzz = (kind: Feedback): void => {
  if (canVibrate()) {
    try {
      navigator.vibrate(VIBRATION[kind]);
      return;
    } catch {
      /* Some browsers throw rather than returning false. */
    }
  }

  const label = iosSwitch();

  if (!label) return;

  /* One flip per pulse in the pattern, which is the only variable the
     switch gives. */
  const pulses = kind === 'warn' ? 1 : kind === 'admitted' ? 2 : 3;

  for (let n = 0; n < pulses; n += 1) {
    window.setTimeout(() => label.click(), n * 80);
  }
};

/* ------------------------------------------------------------------ */

export function feedback(kind: Feedback, sound: boolean): void {
  buzz(kind);

  if (sound) play(kind);
}

/**
 * Call from inside a real tap.
 *
 * Unlocks audio, which iOS will not do outside a gesture, and builds
 * the switch. Also fires one of each so the volunteer learns in the
 * first second of a shift whether this phone does anything at all,
 * rather than halfway through a queue.
 */
export function primeFeedback(sound: boolean): void {
  audioContext();

  iosSwitch();

  buzz('admitted');

  if (sound) play('admitted');
}
