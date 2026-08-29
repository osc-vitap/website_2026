import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  FileText,
  Loader2,
  X,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

/*
 * The printed run, previewable and downloadable at print quality.
 *
 * Thirty-six sheets, A3 at 300dpi, near half a gigabyte together — the
 * numbered run of thirty plus the six named sheets that came after it
 * (car keys, committed, restored, rip it down, lift waiting, lift
 * pending), which encode pages 31 to 36. They live in R2 rather than in
 * the site's public folder: that much PNG in git would be carried by
 * every clone forever and shipped on every deploy. The Worker streams
 * them from the bucket behind the same admin gate as everything else on
 * this page.
 *
 * The grid shows small renders of the same artwork rather than the
 * masters. Thumbnails drawn from the print files would mean pulling half
 * a gigabyte to look at thirty-six pictures; these are 16KB each, and
 * the whole grid costs less than one sheet's first megabyte.
 *
 * They are listed rather than hardcoded: the Worker reads the bucket, so
 * a re-export that adds or renames a sheet shows up here without anyone
 * remembering to edit a list.
 */

interface Poster {
  name: string;
  key: string;
  size: number;
  uploaded: string;
}

/** The page number a sheet is for, from its own filename. */
const pageOf = (name: string): string => {
  const m = /pg(\d+)/i.exec(name);
  return m ? String(Number(m[1])) : name;
};

/** A sheet's small render, which is a webp beside the png. */
const derivative = (
  name: string,
  variant: 'thumb' | 'preview',
): string =>
  `${API_BASE_URL}/api/admin/posters/${variant}/${name.replace(
    /\.png$/i,
    '.webp',
  )}`;

const megabytes = (bytes: number): string =>
  `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/*
 * The larger look, before committing to a 20MB download.
 *
 * Portalled to the body: .glass-card carries a backdrop-filter, and an
 * ancestor with one becomes the containing block for position: fixed —
 * a dialog rendered inside the grid would be positioned against the
 * card it came from rather than the window.
 */
const PosterPreview = ({
  poster,
  total,
  onClose,
  onStep,
  hasPrev,
  hasNext,
}: {
  poster: Poster;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
}) => {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();

      /*
       * Thirty-six sheets is too many to browse by closing and
       * reopening, so the arrows walk the run in place — the way every
       * other image viewer on the machine already works.
       */
      if (event.key === 'ArrowLeft') onStep(-1);
      if (event.key === 'ArrowRight') onStep(1);
    };

    document.addEventListener('keydown', onKey);

    /* The page behind must not scroll under the dialog. */
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, onStep]);

  /*
   * A swipe, because on the phone this is mostly used on there are no
   * arrow keys and the step buttons are a reach at the top of a
   * full-height sheet. Touch only: a mouse has the buttons.
   */
  const swipeFrom = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const onTouchStart = (
    event: React.TouchEvent,
  ) => {
    const touch = event.touches[0];
    swipeFrom.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const onTouchEnd = (
    event: React.TouchEvent,
  ) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;

    if (!from) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;

    /*
     * Horizontal and decisive, or nothing. The sheet scrolls
     * vertically, so anything with a real vertical component is
     * someone reading, not someone paging.
     */
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.6) return;

    onStep(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Poster ${pageOf(poster.name)} of ${total}`}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={panel}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        /*
         * pt pays for the status bar the same way the app bar does: at
         * full height on a phone this sheet is the whole window, and
         * under viewport-fit=cover its own header would otherwise sit
         * under the notch.
         */
        className="glass-card relative z-10 flex h-full w-full max-w-3xl flex-col overflow-y-auto p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] focus:outline-none sm:h-auto sm:max-h-[92vh] sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-lg font-bold text-white">
              {pageOf(poster.name)}
              <span className="text-gray-600">
                /{total}
              </span>
            </div>

            <div className="mt-1 font-mono text-xs text-gray-500">
              A3 · 300 dpi ·{' '}
              {megabytes(poster.size)}
            </div>
          </div>

          <div className="-mr-1 -mt-1 flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={!hasPrev}
              aria-label="Previous poster"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={!hasNext}
              aria-label="Next poster"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <ChevronRight size={20} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <img
          /*
           * Keyed on the sheet so stepping swaps the element rather than
           * mutating one. Reusing it left the previous poster on screen
           * at full opacity until the next decoded, which reads as the
           * arrow having done nothing.
           */
          key={poster.key}
          /*
           * use-credentials, because the image is cross-origin to the
           * Worker and behind the admin session. Without it the browser
           * omits the cookie and the request comes back 401 — as a
           * broken image, with nothing in the console to explain it.
           */
          crossOrigin="use-credentials"
          src={derivative(poster.name, 'preview')}
          alt={`Poster ${pageOf(poster.name)} of ${total}`}
          className="w-full rounded-[4px] border border-dark-700 bg-dark-900"
        />

        <a
          href={`${API_BASE_URL}/api/admin/posters/${poster.name}`}
          className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 font-semibold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
        >
          <Download size={17} aria-hidden="true" />
          Download print file ·{' '}
          {megabytes(poster.size)}
        </a>
      </div>
    </div>,
    document.body,
  );
};

const AdminPosters = () => {
  const [posters, setPosters] = useState<
    Poster[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [failed, setFailed] = useState('');

  /*
   * Shut until asked for.
   *
   * Thirty-six cards is twelve rows on a phone and six on a desktop,
   * and open by default they pushed the events table — the reason
   * anyone opens this page on any given day — below the fold on every
   * screen size. It also means the thumbnails are not fetched until
   * someone wants to see them.
   */
  const [open, setOpen] = useState(false);

  /*
   * Which sheet is open, by position rather than by value, so the
   * dialog's arrows have something to step along. Holding the poster
   * itself meant the dialog knew what it was showing but not where it
   * sat in the run.
   */
  const [previewAt, setPreviewAt] = useState<
    number | null
  >(null);

  /* So closing the dialog puts focus back on the tile it came from. */
  const opener = useRef<HTMLElement | null>(
    null,
  );

  /*
   * Declared here, above the early returns, because hooks run in order
   * on every render and a `return` before one is what makes the order
   * change between renders.
   */
  const count = posters.length;

  const step = useCallback(
    (delta: number) => {
      setPreviewAt((at) => {
        if (at === null) return at;

        const next = at + delta;

        /* Stops at both ends rather than wrapping: with thirty-six
           sheets, landing back on the first one reads as a glitch. */
        if (next < 0 || next >= count) return at;

        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    let live = true;

    fetch(
      `${API_BASE_URL}/api/admin/posters`,
      { credentials: 'include' },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Could not list posters (${response.status})`,
          );
        }

        return response.json();
      })
      .then((data) => {
        if (!live) return;
        setPosters(data.posters ?? []);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setFailed(
          error instanceof Error
            ? error.message
            : 'Could not list posters',
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        role="status"
        className="glass-card p-6 text-gray-400 flex items-center gap-3"
      >
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading posters…
      </div>
    );
  }

  if (failed) {
    return (
      <div
        role="alert"
        className="glass-card border border-red-500/30 p-6 text-red-400"
      >
        {failed}
      </div>
    );
  }

  if (posters.length === 0) return null;

  const total = posters.reduce(
    (sum, p) => sum + p.size,
    0,
  );

  const closePreview = () => {
    setPreviewAt(null);
    opener.current?.focus();
  };

  const preview =
    previewAt === null
      ? null
      : posters[previewAt] ?? null;

  return (
    <section className="mb-8 md:mb-10">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="admin-poster-list"
        className="glass-card flex min-h-[44px] w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        <FileImage
          size={16}
          aria-hidden="true"
          className="shrink-0 text-brand-accent"
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold uppercase tracking-widest text-brand-accent">
            Print posters
          </span>

          <span className="mt-1 block text-xs text-gray-500">
            {posters.length} sheets · A3 at 300 dpi ·{' '}
            {(total / 1024 / 1024).toFixed(0)} MB
          </span>
        </span>

        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`ml-auto shrink-0 text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {!open ? null : (
        <>
          <div
            id="admin-poster-list"
            /*
             * Three across on a phone, not two.
             *
             * At two the thirty-six sheets are eighteen rows, and
             * everything under this section — the stats, the events, the
             * registrations someone actually opened the panel for — sits
             * below all of them. Three makes each tile about 110px,
             * which is still a legible poster and halves the scroll.
             */
            className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6"
          >
            {posters.map((poster, index) => (
              <button
                key={poster.key}
                type="button"
                onClick={(event) => {
                  opener.current =
                    event.currentTarget;
                  setPreviewAt(index);
                }}
                className="group relative block overflow-hidden rounded-[4px] border border-dark-700 bg-dark-900 transition-colors hover:border-brand-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                <img
                  crossOrigin="use-credentials"
                  /* Only what is on screen: thirty-six requests fire
                     the moment this section opens otherwise. */
                  loading="lazy"
                  decoding="async"
                  src={derivative(
                    poster.name,
                    'thumb',
                  )}
                  alt=""
                  /* A3's own ratio, reserved before the image lands,
                     so opening the section does not reflow the page
                     thirty times as they arrive. */
                  className="aspect-[1/1.414] w-full object-cover"
                />

                {/*
                  * The page number and nothing else.
                  *
                  * At three across the tile is about 110px, and the file
                  * size that used to sit beside this was set at 10px to
                  * fit — too small to read on the phone it was there
                  * for, in aid of a number nobody needs until they are
                  * deciding whether to download. It is in the dialog and
                  * on the download button, which is where that decision
                  * is actually made.
                  */}
                <span className="absolute inset-x-0 bottom-0 flex items-center bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6">
                  <span className="font-mono text-xs font-bold text-white">
                    {pageOf(poster.name)}
                    <span className="text-gray-500">
                      /{posters.length}
                    </span>
                  </span>
                </span>

                <span className="sr-only">
                  Preview poster{' '}
                  {pageOf(poster.name)} of{' '}
                  {posters.length}
                </span>
              </button>
            ))}
          </div>

          {/*
            * The whole run in one file.
            *
            * A print shop given thirty-six separate downloads is a
            * print shop that ends up with thirty-five, and the missing
            * one is not noticed until the wall is up. Same sheets, same
            * 300dpi, bound in page order.
            */}
          <a
            href={`${API_BASE_URL}/api/admin/posters/bundle`}
            className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 text-sm font-semibold text-brand-accent transition-colors hover:bg-brand-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <FileText size={16} aria-hidden="true" />
            All {posters.length} sheets as one A3 PDF
          </a>

          <p className="mt-3 text-xs text-gray-500">
            Every QR verified against the page it opens.
          </p>
        </>
      )}

      {preview && previewAt !== null && (
        <PosterPreview
          poster={preview}
          total={posters.length}
          onClose={closePreview}
          onStep={step}
          hasPrev={previewAt > 0}
          hasNext={
            previewAt < posters.length - 1
          }
        />
      )}
    </section>
  );
};

export default AdminPosters;
