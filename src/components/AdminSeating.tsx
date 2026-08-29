import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Armchair,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

const EVENT_SLUG = 'gittyup26';

interface SeatCodeUse {
  seat_id: string;
  name: string;
  college_registration_number: string;
  email: string;
  created_at: string;
}

interface SeatCode {
  code: string;
  created_at: string;
  revoked_at: string | null;
  used_by: SeatCodeUse | null;
}

interface SeatReservation {
  id: number;
  seat_id: string;
  code: string;
  name: string;
  college_registration_number: string;
  email: string;
  email_status: string;
  created_at: string;
}

type CodeStatus =
  | 'Available'
  | 'Used'
  | 'Revoked';

const statusOf = (
  code: SeatCode,
): CodeStatus => {
  if (code.used_by) return 'Used';
  if (code.revoked_at) return 'Revoked';
  return 'Available';
};

/* R2 must come before R10, so the digits are compared as numbers */
const seatOrder = (seatId: string): number => {
  const parts = /^R(\d+)-S(\d+)$/.exec(seatId);
  if (!parts) return Number.MAX_SAFE_INTEGER;
  return (
    Number(parts[1]) * 1000 + Number(parts[2])
  );
};

const seatLabel = (seatId: string): string => {
  const parts = /^R(\d+)-S(\d+)$/.exec(seatId);
  if (!parts) return seatId;
  return `Row ${parts[1]} · Seat ${parts[2]}`;
};

const when = (value: string): string => {
  const parsed = new Date(
    /* SQLite writes the timestamp in UTC with no zone marker */
    /^\d{4}-\d{2}-\d{2} /.test(value)
      ? `${value.replace(' ', 'T')}Z`
      : value,
  );

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString();
};

const messageFrom = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data = await response.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
};

const saveBlob = (
  blob: Blob,
  filename: string,
) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.URL.revokeObjectURL(url);
};

const statusPill = (status: CodeStatus): string => {
  if (status === 'Used') {
    return 'border-green-500/30 bg-green-500/10 text-green-400';
  }

  if (status === 'Revoked') {
    return 'border-dark-600 bg-dark-700 text-gray-500 line-through';
  }

  return 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent';
};

const emailPill = (status: string): string => {
  if (status === 'sent') {
    return 'border-green-500/30 bg-green-500/10 text-green-400';
  }

  if (status === 'failed') {
    return 'border-red-500/30 bg-red-500/10 text-red-400';
  }

  return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
};

const EmailStatus = ({
  status,
}: {
  status: string;
}) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${emailPill(
      status,
    )}`}
  >
    {status}
  </span>
);

const AdminSeating = () => {
  const [codes, setCodes] = useState<SeatCode[]>(
    [],
  );

  const [reservations, setReservations] =
    useState<SeatReservation[]>([]);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] =
    useState(false);

  const [failed, setFailed] = useState('');
  const [actionError, setActionError] =
    useState('');
  const [actionNote, setActionNote] =
    useState('');

  const [open, setOpen] = useState(false);

  const [count, setCount] = useState('20');
  const [generating, setGenerating] =
    useState(false);
  const [freshCodes, setFreshCodes] = useState<
    string[]
  >([]);
  const [copied, setCopied] = useState(false);

  const [confirmRevoke, setConfirmRevoke] =
    useState('');
  const [revoking, setRevoking] = useState('');

  const [confirmRemove, setConfirmRemove] =
    useState(0);
  const [removing, setRemoving] = useState(0);
  const [notifyOnRemove, setNotifyOnRemove] =
    useState(true);

  const [search, setSearch] = useState('');
  const [downloading, setDownloading] =
    useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');

    try {
      const [codeResponse, seatResponse] =
        await Promise.all([
          fetch(
            `${API_BASE_URL}/api/admin/events/${EVENT_SLUG}/seat-codes`,
            { credentials: 'include' },
          ),
          fetch(
            `${API_BASE_URL}/api/admin/events/${EVENT_SLUG}/seats`,
            { credentials: 'include' },
          ),
        ]);

      if (
        codeResponse.status === 401 ||
        seatResponse.status === 401
      ) {
        setUnauthorized(true);
        return;
      }

      if (!codeResponse.ok) {
        throw new Error(
          await messageFrom(
            codeResponse,
            `Could not load seat codes (${codeResponse.status})`,
          ),
        );
      }

      if (!seatResponse.ok) {
        throw new Error(
          await messageFrom(
            seatResponse,
            `Could not load seat reservations (${seatResponse.status})`,
          ),
        );
      }

      const codeData =
        await codeResponse.json();
      const seatData =
        await seatResponse.json();

      setCodes(codeData.codes ?? []);
      setReservations(
        seatData.reservations ?? [],
      );
    } catch (error: unknown) {
      setFailed(
        error instanceof Error
          ? error.message
          : 'Could not load seat reservations',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    let available = 0;
    let used = 0;
    let revoked = 0;

    for (const code of codes) {
      const status = statusOf(code);
      if (status === 'Used') used += 1;
      else if (status === 'Revoked')
        revoked += 1;
      else available += 1;
    }

    return {
      total: codes.length,
      available,
      used,
      revoked,
    };
  }, [codes]);

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort(
        (a, b) =>
          seatOrder(a.seat_id) -
          seatOrder(b.seat_id),
      ),
    [reservations],
  );

  const visibleReservations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sortedReservations;

    return sortedReservations.filter(
      (reservation) =>
        [
          reservation.name,
          reservation.college_registration_number,
          reservation.email,
          reservation.seat_id,
        ].some((field) =>
          (field ?? '')
            .toLowerCase()
            .includes(needle),
        ),
    );
  }, [search, sortedReservations]);

  const generate = async () => {
    const wanted = Number(count);

    if (
      !Number.isInteger(wanted) ||
      wanted < 1 ||
      wanted > 200
    ) {
      setActionError(
        'Enter a whole number between 1 and 200.',
      );
      return;
    }

    setGenerating(true);
    setActionError('');
    setActionNote('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${EVENT_SLUG}/seat-codes`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            count: wanted,
          }),
        },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(
            response,
            `Could not generate codes (${response.status})`,
          ),
        );
      }

      const data = await response.json();

      setFreshCodes(data.codes ?? []);
      setCopied(false);

      await load();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not generate codes',
      );
    } finally {
      setGenerating(false);
    }
  };

  const copyFresh = async () => {
    try {
      await navigator.clipboard.writeText(
        freshCodes.join('\n'),
      );

      setCopied(true);
      window.setTimeout(
        () => setCopied(false),
        2000,
      );
    } catch {
      setActionError(
        'The browser would not let the page copy. Select the codes and copy them by hand.',
      );
    }
  };

  const downloadFresh = () => {
    saveBlob(
      new Blob([`${freshCodes.join('\n')}\n`], {
        type: 'text/plain',
      }),
      `${EVENT_SLUG}-seat-codes.txt`,
    );
  };

  const revoke = async (code: string) => {
    setRevoking(code);
    setActionError('');
    setActionNote('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${EVENT_SLUG}/seat-codes/${encodeURIComponent(
          code,
        )}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (response.status === 409) {
        setActionNote(
          await messageFrom(
            response,
            `${code} was already used for a seat, so it cannot be revoked. The list below has been refreshed.`,
          ),
        );

        await load();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(
            response,
            `Could not revoke ${code} (${response.status})`,
          ),
        );
      }

      setFreshCodes((was) =>
        was.filter((one) => one !== code),
      );

      await load();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Could not revoke ${code}`,
      );
    } finally {
      setRevoking('');
      setConfirmRevoke('');
    }
  };

  const remove = async (
    reservation: SeatReservation,
  ) => {
    setRemoving(reservation.id);
    setActionError('');
    setActionNote('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${EVENT_SLUG}/seats/${reservation.id}?notify=${notifyOnRemove}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (response.status === 404) {
        setActionNote(
          `${reservation.seat_id} was already removed. The list below has been refreshed.`,
        );

        await load();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(
            response,
            `Could not remove ${reservation.seat_id} (${response.status})`,
          ),
        );
      }

      setActionNote(
        `Removed ${reservation.seat_id}. The seat is free again and code ${reservation.code} can be used once more.${
          notifyOnRemove
            ? ` ${reservation.name} has been emailed about it.`
            : ' Nobody was emailed.'
        }`,
      );

      await load();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Could not remove ${reservation.seat_id}`,
      );
    } finally {
      setRemoving(0);
      setConfirmRemove(0);
    }
  };

  const downloadCsv = async () => {
    setDownloading(true);
    setActionError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/events/${EVENT_SLUG}/seats.csv`,
        { credentials: 'include' },
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await messageFrom(
            response,
            'Unable to download the seat reservations.',
          ),
        );
      }

      const blob = await response.blob();

      const disposition =
        response.headers.get(
          'Content-Disposition',
        );

      const match = disposition?.match(
        /filename="?([^"]+)"?/i,
      );

      saveBlob(
        blob,
        match?.[1] ||
          `${EVENT_SLUG}-seats.csv`,
      );
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to download the seat reservations.',
      );
    } finally {
      setDownloading(false);
    }
  };

  if (unauthorized) return null;

  if (
    loading &&
    codes.length === 0 &&
    reservations.length === 0
  ) {
    return (
      <div
        role="status"
        className="glass-card mb-8 flex items-center gap-3 p-6 text-gray-400 md:mb-10"
      >
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading seat reservations…
      </div>
    );
  }

  if (
    failed &&
    codes.length === 0 &&
    reservations.length === 0
  ) {
    return (
      <div
        role="alert"
        className="glass-card mb-8 border border-red-500/30 p-6 text-red-400 md:mb-10"
      >
        {failed}
      </div>
    );
  }

  return (
    <section className="mb-8 md:mb-10">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="admin-seating-panel"
        className="glass-card flex min-h-[44px] w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        <Armchair
          size={16}
          aria-hidden="true"
          className="shrink-0 text-brand-accent"
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold uppercase tracking-widest text-brand-accent">
            Seat reservations
          </span>

          <span className="mt-1 block text-xs text-gray-500">
            {reservations.length} seats taken ·{' '}
            {counts.available} codes available ·{' '}
            {counts.total} issued
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
        <div
          id="admin-seating-panel"
          className="mt-3 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-dark-600 px-4 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <RefreshCw
                size={16}
                className={
                  loading ? 'animate-spin' : ''
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={downloading}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-dark-600 px-4 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <Download size={16} />
              {downloading
                ? 'Preparing…'
                : 'Download CSV'}
            </button>
          </div>

          {failed && (
            <div
              role="alert"
              className="glass-card border border-red-500/30 p-4 text-sm text-red-400"
            >
              {failed}
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="glass-card border border-red-500/30 p-4 text-sm text-red-400"
            >
              {actionError}
            </div>
          )}

          {actionNote && (
            <div
              role="status"
              className="glass-card border border-amber-500/30 p-4 text-sm text-amber-400"
            >
              {actionNote}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                label: 'Total',
                value: counts.total,
                tone: 'text-white',
              },
              {
                label: 'Available',
                value: counts.available,
                tone: 'text-brand-accent',
              },
              {
                label: 'Used',
                value: counts.used,
                tone: 'text-green-400',
              },
              {
                label: 'Revoked',
                value: counts.revoked,
                tone: 'text-gray-500',
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="glass-card p-4"
              >
                <div
                  className={`text-2xl font-semibold tabular-nums leading-none ${tile.tone}`}
                >
                  {tile.value}
                </div>

                <div className="mt-1.5 text-xs uppercase tracking-wider text-gray-500">
                  {tile.label}
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-accent">
              Generate codes
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              One code books one seat for one
              person. Generate as many as there
              are people.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label
                htmlFor="seat-code-count"
                className="sr-only"
              >
                How many codes
              </label>

              <input
                id="seat-code-count"
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                value={count}
                onChange={(event) =>
                  setCount(event.target.value)
                }
                className="min-h-[44px] w-24 rounded-lg border border-dark-600 bg-dark-900 px-3 text-white tabular-nums focus:border-brand-primary focus:outline-none"
              />

              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                {generating && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}
                {generating
                  ? 'Generating…'
                  : 'Generate codes'}
              </button>
            </div>

            {freshCodes.length > 0 && (
              <div className="mt-5 rounded-lg border border-brand-accent/30 bg-brand-accent/[0.04] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {freshCodes.length} new
                    code
                    {freshCodes.length === 1
                      ? ''
                      : 's'}
                  </span>

                  <div className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyFresh}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-dark-600 px-4 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                    >
                      {copied ? (
                        <Check
                          size={16}
                          className="text-green-400"
                        />
                      ) : (
                        <Copy size={16} />
                      )}
                      {copied
                        ? 'Copied'
                        : 'Copy all'}
                    </button>

                    <button
                      type="button"
                      onClick={downloadFresh}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-dark-600 px-4 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                    >
                      <Download size={16} />
                      Download .txt
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {freshCodes.map((code) => (
                    <span
                      key={code}
                      className="select-all rounded-md border border-dark-700 bg-dark-900 px-2 py-2 text-center font-mono text-sm tracking-wider text-white"
                    >
                      {code}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Copy them now. They stay in
                  the table below, but this list
                  clears when the page reloads.
                </p>
              </div>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-dark-700 px-4 py-4 sm:px-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-accent">
                Codes
              </h3>

              <span className="rounded-full bg-dark-700 px-2.5 py-1 text-xs text-gray-300">
                {codes.length}
              </span>
            </div>

            {codes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
                No codes yet. Generate a batch
                above.
              </p>
            ) : (
              <>
                {/* One block per code on a phone, because five columns
                    with a registration number in them cannot fit */}
                <ul className="divide-y divide-dark-700/50 md:hidden">
                  {codes.map((code) => {
                    const status =
                      statusOf(code);

                    return (
                      <li
                        key={code.code}
                        className="px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="select-all font-mono text-sm tracking-wider text-white">
                            {code.code}
                          </span>

                          <span
                            className={`ml-auto rounded-full border px-2 py-0.5 text-xs ${statusPill(
                              status,
                            )}`}
                          >
                            {status}
                          </span>
                        </div>

                        <dl className="mt-2.5 space-y-1.5 text-sm">
                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                              Created
                            </dt>

                            <dd className="min-w-0 text-gray-300">
                              {when(
                                code.created_at,
                              )}
                            </dd>
                          </div>

                          {code.used_by && (
                            <>
                              <div className="flex gap-2">
                                <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                                  Seat
                                </dt>

                                <dd className="min-w-0 font-mono text-gray-300">
                                  {
                                    code
                                      .used_by
                                      .seat_id
                                  }
                                </dd>
                              </div>

                              <div className="flex gap-2">
                                <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                                  Name
                                </dt>

                                <dd className="min-w-0 break-words text-gray-300">
                                  {
                                    code
                                      .used_by
                                      .name
                                  }
                                </dd>
                              </div>

                              <div className="flex gap-2">
                                <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                                  Reg. no.
                                </dt>

                                <dd className="min-w-0 break-all text-gray-300">
                                  {
                                    code
                                      .used_by
                                      .college_registration_number
                                  }
                                </dd>
                              </div>
                            </>
                          )}
                        </dl>

                        {status ===
                          'Available' && (
                          <div className="mt-3">
                            {confirmRevoke ===
                            code.code ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-400">
                                  Revoke this
                                  code?
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    revoke(
                                      code.code,
                                    )
                                  }
                                  disabled={
                                    revoking ===
                                    code.code
                                  }
                                  className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                >
                                  {revoking ===
                                  code.code
                                    ? 'Revoking…'
                                    : 'Yes, revoke'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmRevoke(
                                      '',
                                    )
                                  }
                                  className="rounded-lg border border-dark-600 px-3 py-2 text-xs text-gray-400 transition-colors hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmRevoke(
                                    code.code,
                                  )
                                }
                                className="flex items-center gap-2 text-xs text-gray-500 transition-colors hover:text-red-400"
                              >
                                <Trash2
                                  size={14}
                                />
                                Revoke
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="border-b border-dark-700 text-left">
                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Code
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Created
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Status
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Used by
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {codes.map((code) => {
                        const status =
                          statusOf(code);

                        return (
                          <tr
                            key={code.code}
                            className="border-b border-dark-700/50 hover:bg-white/[0.02]"
                          >
                            <td className="px-5 py-4">
                              <span className="select-all font-mono text-sm tracking-wider text-white">
                                {code.code}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-400">
                              {when(
                                code.created_at,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusPill(
                                  status,
                                )}`}
                              >
                                {status}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              {code.used_by ? (
                                <>
                                  <div className="text-sm font-medium text-white">
                                    {
                                      code
                                        .used_by
                                        .name
                                    }
                                  </div>

                                  <div className="mt-1 text-xs text-gray-500">
                                    <span className="font-mono text-gray-400">
                                      {
                                        code
                                          .used_by
                                          .seat_id
                                      }
                                    </span>{' '}
                                    ·{' '}
                                    {
                                      code
                                        .used_by
                                        .college_registration_number
                                    }
                                  </div>
                                </>
                              ) : (
                                <span className="text-sm text-gray-600">
                                  Not used
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {status !==
                              'Available' ? (
                                <span className="text-sm text-gray-600">
                                  Not available
                                </span>
                              ) : confirmRevoke ===
                                code.code ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      revoke(
                                        code.code,
                                      )
                                    }
                                    disabled={
                                      revoking ===
                                      code.code
                                    }
                                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                  >
                                    {revoking ===
                                    code.code
                                      ? 'Revoking…'
                                      : 'Yes, revoke'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmRevoke(
                                        '',
                                      )
                                    }
                                    className="text-xs text-gray-500 transition-colors hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmRevoke(
                                      code.code,
                                    )
                                  }
                                  className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-red-400"
                                >
                                  <Trash2
                                    size={14}
                                  />
                                  Revoke
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-dark-700 px-4 py-4 sm:px-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-accent">
                Reserved seats
              </h3>

              <span className="rounded-full bg-dark-700 px-2.5 py-1 text-xs text-gray-300">
                {reservations.length}
              </span>

              <div className="relative ml-auto w-full sm:w-64">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <label
                  htmlFor="seat-search"
                  className="sr-only"
                >
                  Search reservations
                </label>

                <input
                  id="seat-search"
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Name, reg. no., email, seat"
                  className="min-h-[44px] w-full rounded-lg border border-dark-600 bg-dark-900 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            {visibleReservations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
                {reservations.length === 0
                  ? 'No seats reserved yet.'
                  : 'No reservation matches that search.'}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-dark-700/50 md:hidden">
                  {visibleReservations.map(
                    (reservation) => (
                      <li
                        key={reservation.id}
                        className="px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-white">
                            {
                              reservation.seat_id
                            }
                          </span>

                          <EmailStatus
                            status={
                              reservation.email_status
                            }
                          />
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {seatLabel(
                            reservation.seat_id,
                          )}
                        </div>

                        <dl className="mt-2.5 space-y-1.5 text-sm">
                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                              Name
                            </dt>

                            <dd className="min-w-0 break-words text-white">
                              {reservation.name}
                            </dd>
                          </div>

                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                              Reg. no.
                            </dt>

                            <dd className="min-w-0 break-all text-gray-300">
                              {
                                reservation.college_registration_number
                              }
                            </dd>
                          </div>

                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                              Email
                            </dt>

                            <dd className="min-w-0 break-all text-gray-300">
                              {reservation.email}
                            </dd>
                          </div>

                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                              Code
                            </dt>

                            <dd className="min-w-0 break-all font-mono text-gray-300">
                              {reservation.code}
                            </dd>
                          </div>

                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-gray-500">
                              Reserved
                            </dt>

                            <dd className="min-w-0 text-gray-300">
                              {when(
                                reservation.created_at,
                              )}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-3">
                          {confirmRemove ===
                          reservation.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-gray-400">
                                Free this seat
                                and its code?
                              </span>

                              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                                <input
                                  type="checkbox"
                                  checked={
                                    notifyOnRemove
                                  }
                                  onChange={(
                                    changed,
                                  ) =>
                                    setNotifyOnRemove(
                                      changed
                                        .target
                                        .checked,
                                    )
                                  }
                                  className="h-3.5 w-3.5 rounded border-dark-700 bg-transparent"
                                />
                                Email them
                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  remove(
                                    reservation,
                                  )
                                }
                                disabled={
                                  removing ===
                                  reservation.id
                                }
                                className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                              >
                                {removing ===
                                reservation.id
                                  ? 'Removing…'
                                  : 'Yes, remove'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmRemove(
                                    0,
                                  )
                                }
                                className="rounded-lg border border-dark-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmRemove(
                                  reservation.id,
                                )
                              }
                              className="rounded-lg border border-dark-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ),
                  )}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1080px]">
                    <thead>
                      <tr className="border-b border-dark-700 text-left">
                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Seat
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Name
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Reg. no.
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Email
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Code
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Mail
                        </th>

                        <th className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500">
                          Reserved
                        </th>

                        <th className="px-5 py-3 text-right text-xs uppercase tracking-wider text-gray-500">
                          Remove
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleReservations.map(
                        (reservation) => (
                          <tr
                            key={reservation.id}
                            className="border-b border-dark-700/50 hover:bg-white/[0.02]"
                          >
                            <td className="px-5 py-4">
                              <div className="font-mono text-sm text-white">
                                {
                                  reservation.seat_id
                                }
                              </div>

                              <div className="mt-1 text-xs text-gray-500">
                                {seatLabel(
                                  reservation.seat_id,
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm font-medium text-white">
                              {reservation.name}
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-300">
                              {
                                reservation.college_registration_number
                              }
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-300">
                              {reservation.email}
                            </td>

                            <td className="px-5 py-4 font-mono text-sm text-gray-400">
                              {reservation.code}
                            </td>

                            <td className="px-5 py-4">
                              <EmailStatus
                                status={
                                  reservation.email_status
                                }
                              />
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-400">
                              {when(
                                reservation.created_at,
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              {confirmRemove ===
                              reservation.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-400">
                                    <input
                                      type="checkbox"
                                      checked={
                                        notifyOnRemove
                                      }
                                      onChange={(
                                        changed,
                                      ) =>
                                        setNotifyOnRemove(
                                          changed
                                            .target
                                            .checked,
                                        )
                                      }
                                      className="h-3.5 w-3.5 rounded border-dark-700 bg-transparent"
                                    />
                                    Email them
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      remove(
                                        reservation,
                                      )
                                    }
                                    disabled={
                                      removing ===
                                      reservation.id
                                    }
                                    className="whitespace-nowrap rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                  >
                                    {removing ===
                                    reservation.id
                                      ? 'Removing…'
                                      : 'Yes, remove'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmRemove(
                                        0,
                                      )
                                    }
                                    className="rounded-lg border border-dark-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5"
                                  >
                                    Keep
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmRemove(
                                      reservation.id,
                                    )
                                  }
                                  aria-label={`Remove the reservation for ${reservation.seat_id}`}
                                  className="rounded-lg border border-dark-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/5"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminSeating;
