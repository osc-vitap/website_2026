import {
  useEffect,
  useState,
} from 'react';
import {
  Download,
  FileImage,
  Loader2,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

/*
 * The printed run, downloadable at print quality.
 *
 * The thirty sheets are A3 at 300dpi and total 235MB, so they live in
 * R2 rather than in the site's public folder — that much PNG in git
 * would be carried by every clone forever and shipped on every deploy.
 * The Worker streams them from the bucket behind the same admin gate as
 * everything else on this page.
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

const AdminPosters = () => {
  const [posters, setPosters] = useState<
    Poster[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [failed, setFailed] = useState('');

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

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-accent text-sm font-semibold uppercase tracking-widest">
            <FileImage size={16} />
            Print posters
          </div>

          <p className="text-gray-400 mt-2 text-sm">
            {posters.length} sheets, A3 at 300 dpi.
            Every QR verified against the page it
            opens.
          </p>
        </div>

        <div className="font-mono text-xs text-gray-500">
          {(total / 1024 / 1024).toFixed(0)} MB total
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {posters.map((poster) => (
          <a
            key={poster.key}
            href={`${API_BASE_URL}/api/admin/posters/${poster.name}`}
            /*
             * Not download-attribute driven: the Worker sends
             * Content-Disposition: attachment, which works the same on
             * a cross-origin link where the attribute is ignored.
             */
            className="glass-card group flex items-center justify-between gap-2 p-3 transition-colors hover:border-brand-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-white">
                {pageOf(poster.name)}
                <span className="text-gray-600">
                  /{posters.length}
                </span>
              </div>

              <div className="mt-0.5 font-mono text-[10px] text-gray-500">
                {(
                  poster.size /
                  1024 /
                  1024
                ).toFixed(1)}{' '}
                MB
              </div>
            </div>

            <Download
              size={15}
              aria-hidden="true"
              className="shrink-0 text-gray-600 transition-colors group-hover:text-brand-accent"
            />

            <span className="sr-only">
              Download poster{' '}
              {pageOf(poster.name)} of{' '}
              {posters.length}, print quality
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

export default AdminPosters;
