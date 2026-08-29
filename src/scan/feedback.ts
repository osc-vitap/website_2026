/*
 * Something other than the screen telling a volunteer what happened.
 *
 * The phone is held low and pointed at a pass while the person doing
 * the scanning is looking at a face, so a signal that does not need
 * eyes is worth more than any amount of colour.
 *
 * SOUND is the channel that works everywhere. Once an AudioContext has
 * been unlocked inside a real tap it plays from a timer or a promise
 * with no further gesture, including on iOS, so the sign-in press
 * unlocks it for the whole shift. A short tone per verdict is also what
 * every barcode scanner already does, so nobody has to be taught it.
 *
 * VIBRATION is Android only, and that is not an oversight.
 *
 * iOS has never shipped navigator.vibrate. The one haptic a web page
 * could plausibly reach there is the feedback Safari plays when a
 * switch control is toggled, and that was built, tried on an iPhone and
 * removed: it did nothing, including from inside a real tap, which
 * rules out user activation as the explanation. Clicking the label
 * rather than the input did not change it either.
 *
 * Left out rather than left in, so nobody has to wonder later whether
 * the silent branch is broken or merely unreachable. If someone wants
 * to try again, the shape was a hidden `<input type="checkbox" switch>`
 * inside a label, with the label clicked — and it is worth knowing that
 * a camera decoding a code by itself has no user activation to spend,
 * so even a working version may only ever fire on a deliberate tap.
 */

export type Feedback = 'admitted' | 'warn' | 'refused';

/* Alternating on and off, in milliseconds. Android only. */
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
   * resume it outside one either, which is why this is also called from
   * the sign-in tap. Resuming a running context is free.
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

const buzz = (kind: Feedback): void => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  try {
    navigator.vibrate(VIBRATION[kind]);
  } catch {
    /* Some browsers throw rather than returning false. Nothing to do
       about it and nothing worth reporting. */
  }
};

export function feedback(kind: Feedback, sound: boolean): void {
  buzz(kind);

  if (sound) play(kind);
}

/**
 * Call from inside a real tap.
 *
 * Unlocks audio, which iOS will not do outside a gesture, and plays one
 * tone so a volunteer learns in the first second of a shift whether
 * this handset makes any noise at all, rather than halfway through a
 * queue.
 */
export function primeFeedback(sound: boolean): void {
  audioContext();

  buzz('admitted');

  if (sound) play('admitted');
}
