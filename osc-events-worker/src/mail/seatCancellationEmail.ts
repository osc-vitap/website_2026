import { EmailShell, escapeHtml, firstName, renderShell } from './layout';

export interface SeatCancellationMailData {
	name: string;
	seatId: string;
	seatLabel: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	venue: string;
	registrationNumber: string;
}

const SUBJECT = 'Your seat at gitty up has been released';
const SEATING_URL = 'https://www.oscvitap.com/seat-reservation-gittyup26';
const SEATING_LABEL = 'oscvitap.com/seat-reservation-gittyup26';

const NOTE =
	'If you were not expecting this, reply to this email and we will sort it out. If you still have your reservation code, you can choose another seat.';

function renderHtml(data: SeatCancellationMailData): string {
	const name = escapeHtml(data.name);
	const greeting = escapeHtml(firstName(data.name));
	const seatLabel = escapeHtml(data.seatLabel);
	const eventTitle = escapeHtml(data.eventTitle);
	const eventDate = escapeHtml(data.eventDate);
	const eventTime = escapeHtml(data.eventTime);
	const venue = escapeHtml(data.venue);
	const registrationNumber = escapeHtml(data.registrationNumber);

	const parts: EmailShell = {
		subject: SUBJECT,
		preheader: `${seatLabel} &middot; no longer reserved`,
		eyebrow: 'Seat reservation',
		title: 'Your seat has been released.',
		deck: `${greeting}, the seat we were holding for you at ${eventTitle} is no longer reserved.`,
		cardBig: seatLabel,
		cardSmall: `${name} &nbsp;&middot;&nbsp; ${registrationNumber}`,
		detailsHead: eventDate,
		detailsBody: `${eventTime}<br />${venue}`,
		note: escapeHtml(NOTE),
		ctaLabel: 'Choose another seat',
		ctaUrl: SEATING_URL,
		ctaCaption: SEATING_LABEL,
	};

	return renderShell(parts);
}

function renderText(data: SeatCancellationMailData): string {
	return `YOUR SEAT HAS BEEN RELEASED


${firstName(data.name)}, the seat we were holding for you at
${data.eventTitle} is no longer reserved.


${data.seatLabel.toUpperCase()}
${data.name} · ${data.registrationNumber}


....................................................................

${data.eventDate}
${data.eventTime}
${data.venue}

If you were not expecting this, reply to this email and we will sort
it out. If you still have your reservation code, you can choose
another seat.

Choose another seat: ${SEATING_URL}

....................................................................

Faculty Coordinator · Dr. Asish Kumar Dalai

For more details
Faariz, President · +91 70106 16263
Izhaan, Vice President · +91 99051 58193

Open Source Community · Campus Club at VIT-AP`;
}

export function renderSeatCancellationEmail(data: SeatCancellationMailData): { subject: string; html: string; text: string } {
	return {
		subject: SUBJECT,
		html: renderHtml(data),
		text: renderText(data),
	};
}
