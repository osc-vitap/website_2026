import { EmailShell, escapeHtml, firstName, renderShell } from './layout';

export interface SeatReservationMailData {
	name: string;
	seatId: string;
	seatLabel: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	venue: string;
	registrationNumber: string;
}

const SUBJECT = 'Your seat at gitty up is reserved';
const EVENT_URL = 'https://www.oscvitap.com/gittyup26';

function renderHtml(data: SeatReservationMailData): string {
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
		preheader: `${seatLabel} &middot; ${eventDate} &middot; ${venue}`,
		eyebrow: 'Seat reservation',
		title: 'You&rsquo;re all set.',
		deck: `${greeting}, your seat at ${eventTitle} is reserved. Everything you need is below.`,
		cardBig: seatLabel,
		cardSmall: `${name} &nbsp;&middot;&nbsp; ${registrationNumber}`,
		detailsHead: eventDate,
		detailsBody: `${eventTime}<br />${venue}`,
		note: 'Bring your student ID. Check in with a volunteer before taking your seat.',
		ctaLabel: 'Event details',
		ctaUrl: EVENT_URL,
		ctaCaption: 'oscvitap.com/gittyup26',
	};

	return renderShell(parts);
}

function renderText(data: SeatReservationMailData): string {
	return `YOU'RE ALL SET


${firstName(data.name)}, your seat at ${data.eventTitle} is reserved.
Everything you need is below.


${data.seatLabel.toUpperCase()}
${data.name} · ${data.registrationNumber}


....................................................................

${data.eventDate}
${data.eventTime}
${data.venue}

Bring your student ID. Check in with a volunteer before taking your
seat.

Event details: ${EVENT_URL}

....................................................................

Faculty Coordinator · Dr. Asish Kumar Dalai

For more details
Faariz, President · +91 70106 16263
Izhaan, Vice President · +91 99051 58193

Open Source Community · Campus Club at VIT-AP`;
}

export function renderSeatReservationEmail(
	data: SeatReservationMailData,
): { subject: string; html: string; text: string } {
	return {
		subject: SUBJECT,
		html: renderHtml(data),
		text: renderText(data),
	};
}
