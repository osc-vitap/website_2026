import { ArrowRight } from 'lucide-react';
import { RegisterLink } from '../eventPageKit';
import { PosterVariant } from './posterTypes';
import {
  PosterEyebrow,
  PosterFootline,
  PosterHeadline,
  PosterMasthead,
  PosterWordmark,
} from './PosterParts';

/*
 * The four families the thirty posters fall into. Twenty-five are
 * wordmark stacks; the rest are one-offs the print run experimented
 * with, kept because a QR code on one of them has to land on something
 * that looks like the poster in the reader's hand.
 */

interface LayoutProps {
  variant: PosterVariant;
}

const Cta = ({ variant }: LayoutProps) => (
  <RegisterLink
    registrationSlug="gittyup26"
    className="group inline-flex w-full items-center justify-between gap-4 rounded-full px-6 py-3.5 text-sm font-bold transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto md:text-base"
    style={{
      backgroundColor: variant.accent,
      color: variant.ground,
      outlineColor: variant.accent,
    }}
  >
    Register Now
    <ArrowRight
      size={18}
      className="transition-transform group-hover:translate-x-1"
    />
  </RegisterLink>
);

const Details = ({ variant }: LayoutProps) => (
  <div className="font-postermono text-xs md:text-sm">
    <div
      className="font-poster text-[clamp(1.4rem,3.4vw,2.2rem)] font-bold leading-none tracking-[-0.02em]"
      style={{ color: variant.text }}
    >
      {variant.dateLine}
    </div>

    {variant.venueLine && (
      <div
        className="mt-2 opacity-75"
        style={{ color: variant.text }}
      >
        {variant.venueLine}
      </div>
    )}
  </div>
);

/* 25 of 30: the wordmark fills the upper page, the line sits under it. */
export const WordmarkStack = ({
  variant,
}: LayoutProps) => (
  <div className="flex min-h-[100dvh] flex-col gap-5 px-6 py-6 md:px-12 md:py-8 lg:h-full">

    <PosterMasthead />

    <PosterEyebrow variant={variant} />

    {/*
      * The print posters justify each row edge to edge, but across a
      * narrow A4 column. Capped here so the spread reads as deliberate
      * on a landscape screen instead of two words flung to the corners.
      */}
    <PosterWordmark
      variant={variant}
      className="w-full max-w-[46rem]"
    />

    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">

      <PosterHeadline
        variant={variant}
        className="max-w-3xl text-[clamp(1.5rem,4.4vw,2.9rem)]"
      />

      <div className="flex flex-col gap-5 lg:items-end">
        <Details variant={variant} />
        <Cta variant={variant} />
      </div>

    </div>

    <PosterFootline variant={variant} />

  </div>
);

/* The line leads; the wordmark drops back to become texture. */
export const HeadlineLed = ({
  variant,
}: LayoutProps) => (
  <div className="relative flex min-h-[100dvh] flex-col gap-6 px-6 py-7 md:px-12 md:py-9 lg:h-full">

    <PosterMasthead />

    <PosterWordmark
      variant={variant}
      className="pointer-events-none absolute inset-x-6 top-1/4 -z-0 md:inset-x-12"
    />

    <div className="relative z-10 flex flex-1 flex-col justify-center gap-7">

      <PosterEyebrow variant={variant} />

      <PosterHeadline
        variant={variant}
        className="max-w-4xl text-[clamp(2rem,6.5vw,4.6rem)]"
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Details variant={variant} />
        <Cta variant={variant} />
      </div>

    </div>

    <PosterFootline variant={variant} />

  </div>
);

/* A git log rendered as a glass terminal card. */
export const Terminal = ({
  variant,
}: LayoutProps) => (
  <div className="relative flex min-h-[100dvh] flex-col gap-6 px-6 py-6 md:px-12 md:py-8 lg:h-full">

    <PosterMasthead />

    {/* The print poster runs the wordmark behind the card as a watermark. */}
    <PosterWordmark
      variant={variant}
      className="pointer-events-none absolute inset-x-6 top-24 max-w-[46rem] md:inset-x-12"
    />

    <div className="relative z-10 flex flex-1 flex-col justify-center gap-7">

      <PosterHeadline
        variant={variant}
        className="max-w-3xl text-[clamp(1.6rem,4.6vw,3rem)]"
      />

      <div
        className="rounded-[20px] border-2 p-5 backdrop-blur-xl md:p-7"
        style={{
          borderColor: `${variant.accent}33`,
          backgroundColor: `${variant.ground}c7`,
        }}
      >
        <div className="flex flex-col gap-2 font-postermono text-[11px] leading-relaxed md:text-sm">
          {(variant.terminal ?? []).map(
            (line, index) => (
              <div
                key={index}
                className="flex gap-3"
              >
                <span
                  aria-hidden="true"
                  style={{ color: variant.accent }}
                >
                  $
                </span>

                <span
                  style={{ color: variant.text }}
                >
                  {line}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Details variant={variant} />
        <Cta variant={variant} />
      </div>

    </div>

    <PosterFootline variant={variant} />

  </div>
);

/* Spec sheet: labelled rows on a technical grid. */
export const DataBlock = ({
  variant,
}: LayoutProps) => (
  <div className="flex min-h-[100dvh] flex-col gap-6 px-6 py-7 md:px-12 md:py-9 lg:h-full">

    <PosterMasthead />

    <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.3fr_1fr]">

      <div className="flex flex-col gap-7">
        <PosterWordmark variant={variant} />

        <PosterHeadline
          variant={variant}
          className="max-w-2xl text-[clamp(1.4rem,3.8vw,2.4rem)]"
        />
      </div>

      <dl className="flex flex-col font-postermono text-xs md:text-sm">
        {(variant.specs ?? []).map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-t py-3"
            style={{
              borderColor: `${variant.accent}33`,
            }}
          >
            <dt
              className="uppercase tracking-[0.2em]"
              style={{ color: variant.accent }}
            >
              {row.label}
            </dt>

            <dd
              className="text-right"
              style={{ color: variant.text }}
            >
              {row.value}
            </dd>
          </div>
        ))}

        <div className="mt-7">
          <Cta variant={variant} />
        </div>
      </dl>

    </div>

    <PosterFootline variant={variant} />

  </div>
);

export const LAYOUTS = {
  'wordmark-stack': WordmarkStack,
  'headline-led': HeadlineLed,
  terminal: Terminal,
  'data-block': DataBlock,
} as const;
