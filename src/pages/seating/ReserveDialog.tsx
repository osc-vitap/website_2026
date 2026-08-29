import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import {
  ReserveFieldError,
  ReservedSeat,
  formatSeatCode,
  normalizeSeatCode,
  reserveSeats,
  seatCodeError,
  seatLabel,
} from '../../data/seatingApi';
import {
  normalizeRegistrationNumber,
  registrationNumberError,
} from '../../data/registrationNumber';

interface ReserveDialogProps {
  seatIds: string[];
  onClose: () => void;
  onReserved: () => void;
  onConflict: () => void;
  onDone: () => void;
}

interface RowValues {
  code: string;
  registrationNumber: string;
}

interface RowErrors {
  seat: string;
  code: string;
  registrationNumber: string;
}

const EMPTY_ERRORS: RowErrors = {
  seat: '',
  code: '',
  registrationNumber: '',
};

const REGISTER_LINK_TEXT = 'oscvitap.com/gittyup26';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* The server tells people to register first, so the address it names
   is rendered as a link they can follow */
const Message = ({ text }: { text: string }) => {
  const parts = text.split(REGISTER_LINK_TEXT);

  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <Link
              to="/gittyup26"
              className="underline underline-offset-2 hover:opacity-80"
            >
              {REGISTER_LINK_TEXT}
            </Link>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
};

const FieldError = ({
  id,
  text,
}: {
  id: string;
  text: string;
}) =>
  text ? (
    <span
      id={id}
      role="alert"
      className="px-4 text-[11px] leading-snug text-[#ffb4b7]"
    >
      <Message text={text} />
    </span>
  ) : null;

const rowErrorId = (index: number) =>
  `seat-row-${index}-error`;

const codeErrorId = (index: number) =>
  `seat-row-${index}-code-error`;

const numberErrorId = (index: number) =>
  `seat-row-${index}-number-error`;

/* Empty when there is nothing to point the reader at */
const describedBy = (...ids: (string | false)[]) => {
  const used = ids.filter(
    (id): id is string => typeof id === 'string',
  );

  return used.length > 0
    ? used.join(' ')
    : undefined;
};

const ReserveDialog = ({
  seatIds,
  onClose,
  onReserved,
  onConflict,
  onDone,
}: ReserveDialogProps) => {
  const [values, setValues] = useState<RowValues[]>(
    () =>
      seatIds.map(() => ({
        code: '',
        registrationNumber: '',
      })),
  );

  const [errors, setErrors] = useState<RowErrors[]>(
    () => seatIds.map(() => EMPTY_ERRORS),
  );

  const [topError, setTopError] = useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [reserved, setReserved] = useState<
    ReservedSeat[] | null
  >(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  const inputRefs = useRef<
    Record<string, HTMLInputElement | null>
  >({});

  const headingId = 'seat-reserve-title';

  /* The button sits in the footer, so the first bad row is scrolled
     into view or the reader would see nothing happen */
  const revealFirstError = (rows: RowErrors[]) => {
    const index = rows.findIndex(
      (row) =>
        row.seat ||
        row.code ||
        row.registrationNumber,
    );

    window.requestAnimationFrame(() => {
      const row = index < 0 ? null : rows[index];

      const field = !row
        ? null
        : row.code
          ? 'code'
          : row.registrationNumber
            ? 'number'
            : null;

      const input = field
        ? inputRefs.current[`${index}-${field}`]
        : null;

      if (input) {
        input.focus();
        input.scrollIntoView({
          block: 'center',
        });
        return;
      }

      bodyRef.current?.scrollTo({ top: 0 });
    });
  };

  useEffect(() => {
    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const first =
      panel.querySelector<HTMLElement>('input') ??
      panel.querySelector<HTMLElement>(FOCUSABLE);

    (first ?? panel).focus();
  }, []);

  /* The page behind the dialog must not scroll under it on a phone */
  useEffect(() => {
    const previous = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const setRow = (
    index: number,
    patch: Partial<RowValues>,
  ) =>
    setValues((current) =>
      current.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    );

  const clearRowError = (
    index: number,
    field: keyof RowErrors,
  ) =>
    setErrors((current) =>
      current.map((row, i) =>
        i === index ? { ...row, [field]: '' } : row,
      ),
    );

  const close = () => {
    if (submitting) {
      return;
    }

    if (reserved) {
      onDone();
      return;
    }

    onClose();
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter(
      (node) => node.offsetParent !== null,
    );

    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last =
      focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = async (
    formEvent: FormEvent,
  ) => {
    formEvent.preventDefault();

    setTopError('');

    const nextErrors = values.map((row) => ({
      seat: '',
      code: seatCodeError(row.code),
      registrationNumber:
        registrationNumberError(
          row.registrationNumber,
        ),
    }));

    setErrors(nextErrors);

    if (
      nextErrors.some(
        (row) => row.code || row.registrationNumber,
      )
    ) {
      setTopError(
        'Check the highlighted seats before reserving.',
      );
      revealFirstError(nextErrors);
      return;
    }

    setSubmitting(true);

    const result = await reserveSeats(
      seatIds.map((seatId, index) => ({
        seat_id: seatId,
        code: normalizeSeatCode(
          values[index].code,
        ),
        college_registration_number:
          normalizeRegistrationNumber(
            values[index].registrationNumber,
          ),
      })),
    );

    setSubmitting(false);

    if (result.ok) {
      setReserved(result.reserved);
      onReserved();
      return;
    }

    const serverErrors = mapFieldErrors(
      seatIds.length,
      result.fieldErrors,
    );

    setTopError(result.error);
    setErrors(serverErrors);
    revealFirstError(serverErrors);

    /* Somebody else may have taken a seat, so the map behind is
       refreshed on every failure */
    onConflict();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      style={{
        fontFamily: "'Objectivity', sans-serif",
      }}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#2e2e33] bg-[#0b0b0d] shadow-2xl outline-none sm:max-h-[86vh] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#2e2e33] px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2
              id={headingId}
              className="text-lg font-bold tracking-[-0.02em] text-white sm:text-xl"
            >
              {reserved
                ? 'Seats reserved'
                : 'Reserve your seats'}
            </h2>

            <p className="mt-1 text-xs text-[#86868b] sm:text-sm">
              {reserved
                ? 'Keep the confirmation email, it is your pass.'
                : 'One reservation code per seat, one seat per person.'}
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            disabled={submitting}
            aria-label="Close"
            className="shrink-0 rounded-full border border-[#2e2e33] p-2 text-[#86868b] transition-colors hover:border-[#3e3e44] hover:text-white disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {reserved ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
                  <Check size={18} />
                </span>
                <span className="text-base font-bold text-white sm:text-lg">
                  You&apos;re in.
                </span>
              </div>

              <ul className="mt-5 flex flex-col gap-2">
                {reserved.map((seat) => (
                  <li
                    key={seat.seat_id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl border border-[#2e2e33] px-4 py-3"
                  >
                    <span className="text-sm font-bold text-white">
                      {seatLabel(seat.seat_id)}
                    </span>
                    <span className="text-xs text-[#86868b] sm:text-sm">
                      {seat.name}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-xs leading-relaxed text-[#86868b] sm:text-sm">
                A confirmation email is on its way to
                the university address on each
                registration. Show it at the door on
                the day.
              </p>
            </div>

            <div className="border-t border-[#2e2e33] px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={onDone}
                className="w-full rounded-full bg-white px-7 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.01] sm:w-auto"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div
              ref={bodyRef}
              className="flex-1 overflow-y-auto px-5 py-5 sm:px-7"
            >
              {topError && (
                <p
                  role="alert"
                  className="mb-5 rounded-2xl bg-[#ff5d63]/15 px-4 py-3 text-xs leading-relaxed text-[#ffd9db] sm:text-sm"
                >
                  <Message text={topError} />
                </p>
              )}

              <div className="flex flex-col gap-4">
                {seatIds.map((seatId, index) => (
                  <div
                    key={seatId}
                    className="rounded-2xl border border-[#2e2e33] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#86868b]">
                      {seatLabel(seatId)}
                    </div>

                    {errors[index].seat && (
                      <p
                        id={rowErrorId(index)}
                        role="alert"
                        className="mt-2 text-[11px] leading-snug text-[#ffb4b7]"
                      >
                        <Message
                          text={errors[index].seat}
                        />
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="px-1 text-[11px] uppercase tracking-[0.16em] text-[#86868b]">
                          Reservation code
                        </span>
                        <input
                          ref={(node) => {
                            inputRefs.current[
                              `${index}-code`
                            ] = node;
                          }}
                          type="text"
                          inputMode="text"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          placeholder="AB3D-7K2M"
                          value={
                            values[index].code
                          }
                          disabled={submitting}
                          aria-label={`Reservation code for ${seatLabel(seatId)}`}
                          aria-invalid={Boolean(
                            errors[index].code,
                          )}
                          aria-describedby={describedBy(
                            Boolean(
                              errors[index].code,
                            ) && codeErrorId(index),
                            Boolean(
                              errors[index].seat,
                            ) && rowErrorId(index),
                          )}
                          onChange={(event) => {
                            setRow(index, {
                              code: formatSeatCode(
                                event.target.value,
                              ),
                            });
                            clearRowError(
                              index,
                              'code',
                            );
                          }}
                          className="w-full rounded-full border-2 border-[#2e2e33] bg-transparent px-4 py-2.5 text-sm tracking-[0.12em] text-white outline-none transition-colors placeholder:text-[#5a5a61] focus:border-[#5a5a61] disabled:opacity-50"
                        />
                        <FieldError
                          id={codeErrorId(index)}
                          text={errors[index].code}
                        />
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="px-1 text-[11px] uppercase tracking-[0.16em] text-[#86868b]">
                          Registration number
                        </span>
                        <input
                          ref={(node) => {
                            inputRefs.current[
                              `${index}-number`
                            ] = node;
                          }}
                          type="text"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          placeholder="22BCE1234"
                          value={
                            values[index]
                              .registrationNumber
                          }
                          disabled={submitting}
                          aria-label={`Registration number for ${seatLabel(seatId)}`}
                          aria-invalid={Boolean(
                            errors[index]
                              .registrationNumber,
                          )}
                          aria-describedby={describedBy(
                            Boolean(
                              errors[index]
                                .registrationNumber,
                            ) && numberErrorId(index),
                            Boolean(
                              errors[index].seat,
                            ) && rowErrorId(index),
                          )}
                          onChange={(event) => {
                            setRow(index, {
                              registrationNumber:
                                event.target.value.toUpperCase(),
                            });
                            clearRowError(
                              index,
                              'registrationNumber',
                            );
                          }}
                          className="w-full rounded-full border-2 border-[#2e2e33] bg-transparent px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#5a5a61] focus:border-[#5a5a61] disabled:opacity-50"
                        />
                        <FieldError
                          id={numberErrorId(index)}
                          text={
                            errors[index]
                              .registrationNumber
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#2e2e33] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <span className="text-xs text-[#86868b]">
                {seatIds.length}{' '}
                {seatIds.length === 1
                  ? 'seat'
                  : 'seats'}{' '}
                selected
              </span>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-white px-7 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100 sm:w-auto"
              >
                {submitting
                  ? 'Reserving…'
                  : 'Confirm reservation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/* Field errors come back keyed by the row they belong to,
   anything out of range is shown at the top instead */
const mapFieldErrors = (
  rowCount: number,
  fieldErrors: ReserveFieldError[],
): RowErrors[] => {
  const rows: RowErrors[] = Array.from(
    { length: rowCount },
    () => ({ ...EMPTY_ERRORS }),
  );

  fieldErrors.forEach((entry) => {
    const row = rows[entry.index];

    if (!row) {
      return;
    }

    if (entry.field === 'college_registration_number') {
      row.registrationNumber = entry.message;
      return;
    }

    if (entry.field === 'seat_id') {
      row.seat = entry.message;
      return;
    }

    row.code = entry.message;
  });

  return rows;
};

export default ReserveDialog;
