import { API_BASE_URL } from './eventsApi';

/* Seat reservations for the gitty up seating page */

export { API_BASE_URL };

export const SEAT_EVENT_SLUG = 'gittyup26';

export const MAX_SEATS = 30;

const SEAT_CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const SEAT_CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

export const SEAT_CODE_HINT =
  'A reservation code looks like AB3D-7K2M';

/* Uppercased with all spaces removed, the form the server stores */
export const normalizeSeatCode = (value: string): string =>
  value.toUpperCase().replace(/\s+/g, '');

/* What the input shows while typing, bad characters are dropped
   and the hyphen goes back in after four */
export const formatSeatCode = (value: string): string => {
  const body = normalizeSeatCode(value)
    .split('')
    .filter((character) =>
      SEAT_CODE_ALPHABET.includes(character),
    )
    .join('')
    .slice(0, 8);

  return body.length > 4
    ? `${body.slice(0, 4)}-${body.slice(4)}`
    : body;
};

/* Empty when valid, otherwise a message for the user */
export const seatCodeError = (value: string): string => {
  const normalized = normalizeSeatCode(value);

  if (!normalized) {
    return 'Reservation code is required';
  }

  return SEAT_CODE_PATTERN.test(normalized)
    ? ''
    : `"${normalized}" is not a reservation code. ${SEAT_CODE_HINT}.`;
};

/* Turns a seat id into a label a person can read */
export const seatLabel = (seatId: string): string => {
  const match = /^R(\d+)-S(\d+)$/.exec(seatId);

  return match
    ? `Row ${match[1]} Seat ${match[2]}`
    : seatId;
};

/* The front rows are held back for the club, so nobody can pick them */
export const TEAM_ROWS = [1, 2];

export const seatRow = (seatId: string): number => {
  const match = /^R(\d+)-S\d+$/.exec(seatId);
  return match ? Number(match[1]) : 0;
};

export const isTeamSeat = (seatId: string): boolean =>
  TEAM_ROWS.includes(seatRow(seatId));

export interface ReserveSeatRow {
  seat_id: string;
  code: string;
  college_registration_number: string;
}

export interface ReservedSeat {
  seat_id: string;
  name: string;
}

export type ReserveFieldName =
  | 'code'
  | 'seat_id'
  | 'college_registration_number';

export interface ReserveFieldError {
  index: number;
  field: ReserveFieldName;
  message: string;
}

export type ReserveResult =
  | { ok: true; reserved: ReservedSeat[] }
  | {
      ok: false;
      error: string;
      fieldErrors: ReserveFieldError[];
    };

const GENERIC_ERROR =
  'Could not reach the reservation service. Check your connection and try again.';

const FIELD_NAMES: ReserveFieldName[] = [
  'code',
  'seat_id',
  'college_registration_number',
];

/* Unknown shapes are dropped so an error can never land
   on the wrong input */
const readFieldErrors = (
  value: unknown,
): ReserveFieldError[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const row = entry as Partial<ReserveFieldError>;

    return typeof row?.index === 'number' &&
      typeof row?.message === 'string' &&
      FIELD_NAMES.includes(row.field as ReserveFieldName)
      ? [
          {
            index: row.index,
            field: row.field as ReserveFieldName,
            message: row.message,
          },
        ]
      : [];
  });
};

/* Taken seat ids only, the response carries no personal details */
export const fetchTakenSeats = async (): Promise<string[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/events/${SEAT_EVENT_SLUG}/seats`,
  );

  if (!response.ok) {
    throw new Error(
      'Could not load which seats are already taken.',
    );
  }

  const data = await response
    .json()
    .catch(() => null);

  return Array.isArray(data?.seats)
    ? data.seats.filter(
        (seat: unknown): seat is string =>
          typeof seat === 'string',
      )
    : [];
};

/* A refused reservation is an answer, not a failure, so it comes
   back in the ok false branch */
export const reserveSeats = async (
  rows: ReserveSeatRow[],
): Promise<ReserveResult> => {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/events/${SEAT_EVENT_SLUG}/seats/reserve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seats: rows }),
      },
    );
  } catch {
    return {
      ok: false,
      error: GENERIC_ERROR,
      fieldErrors: [],
    };
  }

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok || !data?.ok) {
    return {
      ok: false,
      error:
        typeof data?.error === 'string' && data.error
          ? data.error
          : 'That reservation could not be completed. Try again in a moment.',
      fieldErrors: readFieldErrors(
        data?.field_errors,
      ),
    };
  }

  return {
    ok: true,
    reserved: Array.isArray(data.reserved)
      ? data.reserved.map((seat: ReservedSeat) => ({
          seat_id: String(seat.seat_id),
          name: String(seat.name ?? ''),
        }))
      : [],
  };
};
