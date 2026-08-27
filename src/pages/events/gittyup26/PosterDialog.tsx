import React, { RefObject, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { glassTint } from './posterColor';
import { PosterVariant } from './posterTypes';

/*
 * The shell every poster dialog is built in.
 *
 * Extracted when a second one was needed, rather than copied. What is
 * in here is not layout — it is a focus trap, a scroll lock, a
 * focusable scrolling region, focus restored to a node captured on
 * open, and a portal out of a stacking context that would otherwise
 * pin the dialog inside a column. Every one of those was arrived at by
 * a bug. A second hand-rolled copy would drift from this one the first
 * time either was touched.
 */

interface PosterDialogProps {
  variant: PosterVariant;

  /** Heading, and what the dialog is announced as. */
  title: string;

  /** Distinguishes the two dialogs' ids and their scroller's name. */
  id: string;

  children: React.ReactNode;
  /*
   * Whatever opened the dialog, handed over rather than read back off
   * document.activeElement: WebKit does not focus a <button> on a tap
   * or a click unless Full Keyboard Access is on, so on iOS Safari the
   * opener measured as <body> and closing dropped focus there — on the
   * one browser most of these QR scans arrive from.
   */
  returnFocusTo: RefObject<HTMLElement>;
  onClose: () => void;
}

/*
 * Everything inside the panel that can hold focus, for the tab trap.
 * The panel itself is deliberately not matched — it is tabindex="-1",
 * a focus target for the dialog rather than a stop on the way round.
 * The scrolling copy is, through its tabindex, which is what keeps a
 * dialog whose only control is the close button cycling between two
 * stops instead of one.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const withAlpha = (
  color: string,
  percent: number,
) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const PosterDialog = ({
  variant,
  title,
  id,
  children,
  returnFocusTo,
  onClose,
}: PosterDialogProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  /*
   * The panel is the poster's own ground pulled towards black, the same
   * tint the details panel uses — but nearly opaque rather than frosted.
   * This is the one place on the page carrying several paragraphs, and
   * body copy at 0.74 alpha over a photographic ground measures under
   * 4.5:1 wherever the artwork happens to be bright.
   */
  const panelInk = glassTint(variant.ground, 0.97);

  /*
   * Focus goes into the dialog and comes back to whatever opened it.
   *
   * It lands on the copy rather than on the panel so the description
   * answers Page Down and the arrow keys from the first keystroke: the
   * panel is overflow-hidden and the scroller is inside it, so with
   * focus on the panel the browser had nothing to scroll.
   */
  useEffect(() => {
    /*
     * The opener is held as a node from here rather than read back off
     * the ref in the cleanup. It points at a React-rendered element, so
     * reading .current out of a cleanup trips
     * react-hooks/exhaustive-deps, and lint runs at --max-warnings 0 —
     * that one warning failed `npm run lint` for the whole repo. The
     * footnote button sits outside the panel the dialog replaces and
     * outlives it, so the node captured on open is still the one to go
     * back to on close.
     */
    const opener = returnFocusTo.current;

    copyRef.current?.focus();

    return () => opener?.focus();
  }, [returnFocusTo]);

  /* Nothing behind the dialog scrolls while it is up. */
  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (
      keyEvent: KeyboardEvent,
    ) => {
      if (keyEvent.key === 'Escape') {
        onClose();
        return;
      }

      if (keyEvent.key !== 'Tab') return;

      const panel = panelRef.current;

      if (!panel) return;

      const stops = Array.from(
        panel.querySelectorAll<HTMLElement>(
          FOCUSABLE,
        ),
      );

      if (stops.length === 0) return;

      const first = stops[0];
      const last = stops[stops.length - 1];
      const active =
        document.activeElement as HTMLElement | null;

      /*
       * Tab is trapped rather than left to the browser: the page
       * behind is a full poster with a register button and a form,
       * and tabbing out of the dialog landed on controls hidden under
       * the backdrop with no way to see where focus had gone.
       */
      if (keyEvent.shiftKey) {
        if (active === first || active === panel) {
          keyEvent.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        keyEvent.preventDefault();
        first.focus();
      }
    };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
  }, [onClose]);

  /*
   * Portalled to <body> rather than rendered where it is used.
   *
   * position: fixed resolves against the nearest ancestor with a
   * transform, filter or backdrop-filter, not the viewport. The trigger
   * sits beside the frosted details panel, so in place the dialog was
   * pinned inside that column at a third of the width.
   */
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6">

      <div
        /*
          * Clicking off the dialog closes it. Left non-interactive to
          * assistive technology: the close button and Escape are the
          * announced ways out.
          */
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(0,0,0,0.72)',
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`poster-dialog-${id}-title`}
        tabIndex={-1}
        /*
          * A column, not a block: the header stays put so the close
          * control is reachable without scrolling back up, and only
          * the copy under it moves. max-h in dvh so a phone's address
          * bar cannot push the bottom of the dialog off screen.
          */
        /*
          * The details panel's own shell, not a rebuilt copy of it: the
          * radius, the two inset hairlines and the grain all arrive with
          * .poster-glass. The backdrop is only rgba(0,0,0,0.72), so the
          * panel this replaces stays visible beside it, and anything
          * this one draws differently is read as a second material.
          * overflow-hidden clips the header and the scroller to the
          * shell's curve.
          */
        className="poster-fade-up poster-glass poster-glass-modal relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden font-poster outline-none md:max-h-[88dvh]"
        style={{
          backgroundColor: panelInk,
          /*
            * The opaque fallback .poster-glass reaches for where there is
            * no backdrop-filter. Without it that rule drops to a flat
            * black default and this dialog loses the poster's hue.
            */
          ['--glass-solid' as string]: panelInk,
          border: `1px solid ${withAlpha(variant.accent, 22)}`,
        }}
      >

        {/* Header */}

        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4 md:px-6 md:py-5"
          style={{
            borderColor: withAlpha(variant.accent, 20),
          }}
        >
          <div>
            <div
              className="font-postermono text-[10px] uppercase tracking-[0.26em] md:text-xs"
              style={{ color: variant.accent }}
            >
              GITTYUP 26
            </div>

            <h2
              id={`poster-dialog-${id}-title`}
              className="mt-2 text-[clamp(1.35rem,4.4vw,1.9rem)] font-bold leading-none tracking-[-0.02em]"
              style={{ color: variant.text }}
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              borderColor: withAlpha(variant.accent, 45),
              color: variant.accent,
              outlineColor: variant.accent,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/*
          * The scrolling half. overscroll-contain so reaching the end
          * of the copy on a phone does not hand the scroll to the
          * poster behind the backdrop.
          *
          * tabindex because a keyboard cannot scroll a box it cannot
          * reach. Body scroll is locked and Tab is trapped, so with no
          * focusable scroller the last paragraph and the date line —
          * 290px of copy on a short laptop window — were readable by
          * mouse wheel only. It joins the tab cycle through the same
          * attribute, so FOCUSABLE above needs no new clause.
          */}
        <div
          ref={copyRef}
          tabIndex={0}
          role="group"
          aria-label={title}
          /*
            * The ring is drawn inside: an offset one on the element
            * that owns the panel's only scrollbar falls under
            * overflow-hidden and is clipped away on three sides.
            */
          className="overflow-y-auto overscroll-contain outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
          style={{ outlineColor: variant.accent }}
        >

          {children}

        </div>

      </div>
    </div>,
    document.body,
  );
};

export default PosterDialog;
