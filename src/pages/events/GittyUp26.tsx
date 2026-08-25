import { ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  EventPageFrame,
  RegisterLink,
} from './eventPageKit';
import { useEventPageMeta } from './useEventPageMeta';
import {
  POSTER_COUNT,
  variantFromParam,
} from './gittyUp26Variants';

/*
 * GITTYUP 2026 — 29 August 2026, AB-2 Auditorium.
 *
 * Built from the printed poster: a violet-to-indigo gradient under a
 * halftone dot field, the wordmark repeated four times in alternating
 * Objectivity weights, the toggle mark and the oversized "26".
 *
 * ?pg=1…25 selects the poster variant, so a QR code scanned off a
 * particular printed poster lands on a page that matches it. See
 * ./gittyUp26Variants.ts.
 */

const topics = [
  'Version Control',
  'Git, GitHub and more',
  'Home Labs',
];

const GittyUp26 = () => {
  const [searchParams] = useSearchParams();

  const variant = variantFromParam(
    searchParams.get('pg'),
  );

  useEventPageMeta(
    'GITTYUP 26 · Open Source Community, VIT-AP',
    'GITTYUP 2026 — one day on version control, Git, GitHub and home labs. 29 August 2026, AB-2 Auditorium, VIT-AP University.',
  );

  return (
    <EventPageFrame className="bg-[#4A1AE0] font-poster text-white selection:bg-white selection:text-[#150A4E]">

      {/* Poster ground: gradient, halftone field, vignette */}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: variant.gradient }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `radial-gradient(circle, ${variant.dot} 1.25px, transparent 1.35px)`,
          backgroundSize: '8px 8px',
          maskImage:
            'radial-gradient(130% 100% at 20% 0%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 55%, #000 100%)',
          WebkitMaskImage:
            'radial-gradient(130% 100% at 20% 0%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 55%, #000 100%)',
        }}
      />

      {/* Content */}

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 py-7 md:px-12 md:py-9 lg:h-full">

        {/* Masthead */}

        <header className="flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            {/*
              * The mark carries a violet lobe that would sink into this
              * ground, so it gets a drop shadow that follows the
              * transparency rather than a tile behind it.
              */}
            <img
              src="/events/favicon.png"
              alt=""
              className="h-9 w-9 shrink-0 drop-shadow-[0_2px_5px_rgba(8,3,32,0.75)] md:h-11 md:w-11"
            />

            <div className="leading-none">
              <div className="text-sm font-bold tracking-tight md:text-lg">
                Open Source Community
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <span className="bg-white px-1.5 py-0.5 text-[9px] font-bold tracking-tight text-[#150A4E] md:text-[10px]">
                  moz://a
                </span>

                <span className="text-[10px] font-light text-white/80 md:text-xs">
                  Campus Club at VIT-AP
                </span>
              </div>
            </div>

          </div>

          <div className="text-right leading-none">
            <div className="font-serif text-base font-bold tracking-wide drop-shadow-[0_2px_6px_rgba(10,4,40,0.5)] md:text-2xl">
              VIT-AP
            </div>
            <div className="mt-1 font-serif text-[10px] tracking-[0.2em] text-white/80 md:text-xs">
              UNIVERSITY
            </div>
          </div>

        </header>

        {/* Poster body */}

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12 lg:py-6">

          {/* Wordmark stack */}

          <section className="relative">

            {/*
              * Each row is clipped separately, which both masks the
              * rise-in animation and stops descenders colliding with
              * the row below. The line box is 1.2em so Objectivity's
              * descenders sit inside it rather than being cut off;
              * the negative top margin pulls the rows back together,
              * and overlapping transparent boxes do not clip each
              * other.
              */}
            <div
              className="select-none tracking-[-0.015em]"
              style={{ color: variant.ink }}
            >
              {variant.rows.map((row, index) => (
                <div
                  key={index}
                  className={`overflow-hidden ${index > 0 ? '-mt-[0.26em]' : ''}`}
                >
                  <div
                    className="poster-rise flex whitespace-nowrap leading-[1.2] text-[clamp(2.5rem,12vw,7rem)] lg:text-[min(8.6vw,11.8vh)]"
                    style={{
                      animationDelay: `${index * 0.09}s`,
                    }}
                  >
                    <span className={row.gitty}>
                      gitty
                    </span>

                    <span
                      className={row.up}
                      style={{
                        marginLeft: row.gap,
                      }}
                    >
                      up
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Toggle mark */}

            <div className="mt-7 flex items-center gap-6 lg:mt-6">

              <div
                aria-hidden="true"
                className={`flex w-[clamp(6rem,13vw,9.5rem)] items-center rounded-full border-[3px] p-[0.3rem] md:border-4 ${
                  variant.toggle === 'right'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
                style={{
                  borderColor: variant.ink,
                }}
              >
                <div
                  className="aspect-square w-[clamp(1.4rem,3.2vw,2.3rem)] rounded-full"
                  style={{
                    backgroundColor:
                      variant.ink,
                  }}
                />
              </div>

              <div
                className="font-black leading-none text-[clamp(3rem,9vw,6rem)] lg:text-[min(6vw,9vh)]"
                style={{ color: variant.ink }}
              >
                26
              </div>

            </div>

            <p className="mt-8 max-w-xl text-[clamp(1.15rem,2.6vw,1.9rem)] font-light leading-snug lg:mt-7">
              Before{' '}
              <span className="font-bold">git</span>
              , there was a problem worth solving.
            </p>

          </section>

          {/* Details and call to action */}

          <aside className="lg:pb-4">

            <div className="border-t-2 border-white/25 pt-6">

              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
                One Day · Open to All First Years
              </div>

              <div className="mt-4 text-[clamp(1.75rem,4vw,2.6rem)] font-bold leading-none">
                29 August 2026
              </div>

              <div className="mt-3 space-y-1 text-sm font-light text-white/85 md:text-base">
                <div>10:00 AM — 4:00 PM</div>
                <div>AB-2 Auditorium · VIT-AP University</div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-medium tracking-wide text-white/90 md:text-xs"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              <p className="mt-6 text-xs font-light leading-relaxed text-white/75 md:text-sm">
                Mandatory for all first years. No prior
                knowledge of Git or GitHub needed —
                start from zero.
              </p>

              <RegisterLink
                registrationSlug="gittyup26"
                className="group mt-7 inline-flex w-full items-center justify-between gap-4 rounded-full bg-white px-7 py-4 text-base font-bold text-[#150A4E] transition-colors hover:bg-[#150A4E] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto md:text-lg"
              >
                Register Now
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1"
                />
              </RegisterLink>

            </div>

          </aside>

        </main>

        {/* Footline */}

        <footer
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-5 text-[11px] font-light text-white/70 md:text-xs"
          >

          <span className="font-medium text-white/90">
            oscvitap.com/gittyup26
          </span>

          <span className="flex items-center gap-3">
            <span>
              Open Source Community · VIT-AP University
            </span>

            <span
              className="tabular-nums text-white/45"
              title={`Poster ${variant.id} of ${POSTER_COUNT}`}
            >
              {String(variant.id).padStart(2, '0')}/
              {POSTER_COUNT}
            </span>
          </span>

        </footer>

      </div>

    </EventPageFrame>
  );
};

export default GittyUp26;
