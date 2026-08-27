import { RefObject } from 'react';
import PosterDialog from './PosterDialog';
import { glassTint } from './posterColor';
import { PosterVariant } from './posterTypes';

/*
 * "What is GITTY UP?", answered without leaving the poster.
 *
 * A printed sheet has room for one line about the session, so the pages
 * inherited that: someone who scanned a QR code could read the
 * headline, the date and the venue, and still not know what they would
 * be sitting through. This is the long answer, kept off the poster
 * until it is asked for.
 *
 * The On Duty panel leads, before a word of description. Attendance is
 * what a student decides on — the copy underneath is what they read
 * once they know they can come at all.
 */

interface PosterAboutDialogProps {
  variant: PosterVariant;
  returnFocusTo: RefObject<HTMLElement>;
  onClose: () => void;
}

const withAlpha = (
  color: string,
  percent: number,
) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const PosterAboutDialog = ({
  variant,
  returnFocusTo,
  onClose,
}: PosterAboutDialogProps) => {
  /*
   * Ink for the accent slab. variant.ground is not safe here: on the
   * purple-ground poster its accent over its own ground measures 3.3:1.
   * Darkening the ground the way the glass does clears 5.2:1 on all
   * thirty, and keeps the hue so the slab still belongs to the poster.
   */
  const accentInk = glassTint(variant.ground, 1);

  return (
    <PosterDialog
      variant={variant}
      title="What is GITTY UP?"
      id="about"
      returnFocusTo={returnFocusTo}
      onClose={onClose}
    >

          {/*
            * The On Duty slab, first and full width.
            *
            * This is the thing people decide on. It was written at the
            * bottom under the description first, where someone who
            * opened the dialog and glanced at it never saw it at all —
            * so it leads, in the poster's accent, at a size the rest of
            * the copy does not come near.
            */}
          <div
            className="px-5 py-6 md:px-6 md:py-7"
            style={{
              backgroundColor: variant.accent,
              color: accentInk,
            }}
          >
            {/*
              * Full strength, not dimmed. At 70% over the darkest of
              * the thirty accents this label measured 3.8:1.
              */}
            <div className="font-postermono text-[10px] font-bold uppercase tracking-[0.28em] md:text-xs">
              Attendance
            </div>

            <div className="mt-3 text-[clamp(1.6rem,7vw,2.5rem)] font-black leading-[0.95] tracking-[-0.03em]">
              Full-day ODs
              <br />
              provided.
            </div>

            <p className="mt-4 max-w-md text-[clamp(1rem,3.4vw,1.15rem)] font-medium leading-snug">
              On Duty for the whole day is arranged
              for everyone who attends, both halves
              of the session. Attendance is not a
              reason to stay away.
            </p>
          </div>

          {/* What the session actually is */}

          <div
            className="px-5 py-6 md:px-6 md:py-7"
            style={{ color: variant.text }}
          >
            <p className="text-[clamp(0.9rem,2.6vw,1rem)] font-light leading-relaxed">
              An introductory session from the Open
              Source Community on version control,
              Git, and self hosting.
            </p>

            <p className="mt-4 text-[clamp(0.9rem,2.6vw,1rem)] font-light leading-relaxed">
              We start before Git existed, when
              programmers had no reliable way to
              track changes or work on the same code
              without overwriting each other, and
              what that cost them. From there, the
              systems built to solve it, how we
              arrived at Git, and why it won. Then
              running your own Git server, and why
              companies like Apple and Google run
              theirs.
            </p>

            <p className="mt-4 text-[clamp(0.9rem,2.6vw,1rem)] font-light leading-relaxed">
              No prior experience needed. We close
              with Home Labs, personal setups for
              hosting your own projects.
            </p>

            {/*
              * The facts again at the foot of the dialog: someone who
              * opened this to find out what the session is has covered
              * the details panel with it.
              */}
            <div
              className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t pt-5 font-postermono text-[10px] uppercase tracking-[0.18em] md:text-xs"
              style={{
                borderColor: withAlpha(variant.accent, 20),
              }}
            >
              <span style={{ color: variant.accent }}>
                {variant.dateLine}
              </span>

              {/* No opacity utility on top of variant.text, which
                  already carries its own alpha on most of the run. */}
              {variant.venueLine && (
                <span>
                  {variant.venueLine}
                </span>
              )}
            </div>
          </div>

    </PosterDialog>
  );
};

export default PosterAboutDialog;
