import { ArrowRight } from 'lucide-react';
import {
  EventPageFrame,
  RegisterLink,
} from './eventPageKit';
import { useEventPageMeta } from './useEventPageMeta';

/*
 * GITTYUP 2026 — 29 August 2026, AB-2 Auditorium.
 *
 * Built from the printed poster: violet-to-indigo gradient under a
 * halftone dot field, the wordmark repeated four times in alternating
 * Poppins weights, the toggle mark, and the oversized "26".
 */

const INK = '#150A4E';

const wordmarkRows = [
  {
    gitty: 'font-extralight',
    up: 'font-black',
    indent: '0%',
    gap: '0.36em',
  },
  {
    gitty: 'font-extralight',
    up: 'font-black',
    indent: '0%',
    gap: '0.44em',
  },
  {
    gitty: 'font-black',
    up: 'font-extralight',
    indent: '0%',
    gap: '0.30em',
  },
  {
    gitty: 'font-black',
    up: 'font-extralight',
    indent: '0%',
    gap: '0.38em',
  },
];

const topics = [
  'Version Control',
  'Git & GitHub',
  'Home Labs',
];

const GittyUp26 = () => {
  useEventPageMeta(
    'GITTYUP 26 · Open Source Community, VIT-AP',
    'GITTYUP 2026 — an introductory session on version control, Git, GitHub and home labs. 29 August 2026, AB-2 Auditorium, VIT-AP University.',
  );

  return (
    <EventPageFrame className="bg-[#4A1AE0] font-poster text-white selection:bg-[#150A4E] selection:text-white">

      {/* Poster ground: gradient, halftone field, vignette */}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 95% at 18% -5%, #8B5CFF 0%, #7040FF 22%, #5A27F2 48%, #4517D8 72%, #2E0BA6 100%)',
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(21,10,78,0.62) 1.25px, transparent 1.35px)',
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

            <img
              src="/events/favicon.png"
              alt=""
              className="h-9 w-9 md:h-11 md:w-11"
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
            <div className="font-serif text-base font-bold tracking-wide md:text-2xl">
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

            <div
              className="select-none leading-[0.86] tracking-[-0.02em]"
              style={{ color: INK }}
            >
              {wordmarkRows.map((row, index) => (
                <div
                  key={index}
                  className="flex whitespace-nowrap text-[clamp(2.5rem,13vw,7.5rem)] lg:text-[min(9.4vw,13.4vh)]"
                  style={{ paddingLeft: row.indent }}
                >
                  <span className={row.gitty}>
                    gitty
                  </span>

                  <span
                    className={row.up}
                    style={{ marginLeft: row.gap }}
                  >
                    up
                  </span>
                </div>
              ))}
            </div>

            {/* Toggle mark */}

            <div className="mt-7 flex items-center gap-6 lg:mt-6">

              <div
                aria-hidden="true"
                className="flex w-[clamp(6rem,13vw,9.5rem)] items-center justify-end rounded-full border-[3px] p-[0.3rem] md:border-4"
                style={{ borderColor: INK }}
              >
                <div
                  className="aspect-square w-[clamp(1.4rem,3.2vw,2.3rem)] rounded-full"
                  style={{ backgroundColor: INK }}
                />
              </div>

              <div
                className="font-black leading-none text-[clamp(3rem,9vw,6rem)] lg:text-[min(6vw,9vh)]"
                style={{ color: INK }}
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

              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                Introductory Session
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

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-5 text-[11px] font-light text-white/70 md:text-xs">

          <span className="font-medium text-white/90">
            oscvitap.com/gittyup26
          </span>

          <span>
            Open Source Community · VIT-AP University
          </span>

        </footer>

      </div>

    </EventPageFrame>
  );
};

export default GittyUp26;
