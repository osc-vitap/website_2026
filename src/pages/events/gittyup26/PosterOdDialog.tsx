import { RefObject } from 'react';
import PosterDialog from './PosterDialog';
import { glassTint } from './posterColor';
import { PosterVariant } from './posterTypes';

/*
 * "ODs Provided", explained.
 *
 * The pill on every sheet says it as three words and an acronym, which
 * is fine for anyone already in a campus club and opaque to a first
 * year — who is exactly the person this session is for. It sat there as
 * a static label for the whole run, so the one piece of information
 * that decides whether someone can attend was the one piece nobody
 * could ask about.
 *
 * Same shell as "What is GITTY UP?", because it is the same kind of
 * question asked of the same poster.
 */

interface PosterOdDialogProps {
  variant: PosterVariant;
  returnFocusTo: RefObject<HTMLElement>;
  onClose: () => void;
}

const withAlpha = (
  color: string,
  percent: number,
) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const PosterOdDialog = ({
  variant,
  returnFocusTo,
  onClose,
}: PosterOdDialogProps) => {
  /*
   * The same darkened ground the About dialog's slab uses. The accent
   * over the poster's raw ground measures 3.3:1 on the purple sheet;
   * pulled towards black it clears 5.2:1 on all thirty and keeps the
   * hue, so the panel still belongs to the poster it opened from.
   */
  const accentInk = glassTint(variant.ground, 1);

  return (
    <PosterDialog
      variant={variant}
      title="What is an OD?"
      id="od"
      returnFocusTo={returnFocusTo}
      onClose={onClose}
    >
      {/*
        * The answer, in the accent, before anything else. Somebody who
        * opens this and reads one line should already have what they
        * came for.
        */}
      <div
        className="px-5 py-5 md:px-6 md:py-6"
        style={{
          backgroundColor: variant.accent,
          color: accentInk,
        }}
      >
        <p className="text-[clamp(1.05rem,3vw,1.35rem)] font-bold leading-snug tracking-[-0.01em]">
          An OD is On Duty: your attendance is
          marked for the full day, granted to
          everyone who attends.
        </p>
      </div>

      <div className="px-5 py-5 md:px-6 md:py-6">
        <p
          className="text-[clamp(0.9rem,2.4vw,1rem)] font-light leading-relaxed"
          style={{ color: variant.text }}
        >
          Both halves are covered, not only the
          hours the session runs, so no class you
          miss to be here is counted against you.
        </p>

        {/*
          * The two things people actually worry about, and the reason
          * this dialog exists rather than a tooltip: "will I lose
          * attendance" and "do I have to arrange it myself". Both are
          * no, and both are worth saying in as many words.
          */}
        <p
          className="mt-4 text-[clamp(0.9rem,2.4vw,1rem)] font-light leading-relaxed"
          style={{ color: variant.text }}
        >
          It is arranged for you. There is
          nothing to apply for and no form to
          chase. Attendance is not a reason to
          stay away.
        </p>

        {/* The date it applies to, read off the sheet rather than fixed
            here, so a change to the schedule reaches this line too. */}
        <div
          className="mt-5 border-t pt-4 font-postermono text-[10px] uppercase tracking-[0.2em] md:text-xs"
          style={{
            borderColor: withAlpha(
              variant.accent,
              20,
            ),
            color: variant.accent,
          }}
        >
          {variant.dateLine}
          {variant.venueLine && (
            <span
              className="ml-2"
              style={{ color: variant.text }}
            >
              {variant.venueLine}
            </span>
          )}
        </div>
      </div>
    </PosterDialog>
  );
};

export default PosterOdDialog;
