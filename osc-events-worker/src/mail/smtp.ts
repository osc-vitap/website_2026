import { connect } from 'cloudflare:sockets';

export interface SmtpConfig {
	host: string;
	port: number;
	user: string;
	pass: string;
}

export interface MailMessage {
	to: string;
	toName?: string;
	fromName: string;
	replyTo?: string;
	subject: string;
	html: string;
	text: string;
}

interface SmtpReply {
	code: number;
	text: string;
}

const CRLF = '\r\n';
const READ_TIMEOUT_MS = 15000;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function stripBreaks(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').trim();
}

function isAscii(value: string): boolean {
	return !/[^\x20-\x7e]/.test(value);
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const step = 0x8000;
	for (let index = 0; index < bytes.length; index += step) {
		binary += String.fromCharCode(...bytes.subarray(index, index + step));
	}
	return btoa(binary);
}

function textToBase64(value: string): string {
	return bytesToBase64(new TextEncoder().encode(value));
}

/* MIME text parts are encoded from the canonical form, so every
   line break has to be a carriage return and a line feed */
function toCanonicalText(value: string): string {
	return value.replace(/\r\n|\r|\n/g, CRLF);
}

function wrapBase64(value: string): string {
	const lines = value.match(/.{1,76}/g);
	return lines ? lines.join(CRLF) : '';
}

function encodeHeaderText(value: string): string {
	const clean = stripBreaks(value);
	if (isAscii(clean)) return clean;
	const encoder = new TextEncoder();
	const words: string[] = [];
	let chunk = '';
	for (const character of clean) {
		const candidate = chunk + character;
		if (encoder.encode(candidate).length > 42 && chunk) {
			words.push(`=?UTF-8?B?${textToBase64(chunk)}?=`);
			chunk = character;
		} else {
			chunk = candidate;
		}
	}
	if (chunk) words.push(`=?UTF-8?B?${textToBase64(chunk)}?=`);
	return words.join(`${CRLF} `);
}

function formatAddress(email: string, name?: string): string {
	const address = stripBreaks(email);
	const display = name ? stripBreaks(name) : '';
	if (!display) return `<${address}>`;
	if (isAscii(display)) {
		return `"${display.replace(/(["\\])/g, '\\$1')}" <${address}>`;
	}
	return `${encodeHeaderText(display)} <${address}>`;
}

function formatDate(now: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	const day = DAY_NAMES[now.getUTCDay()];
	const month = MONTH_NAMES[now.getUTCMonth()];
	const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
	return `${day}, ${pad(now.getUTCDate())} ${month} ${now.getUTCFullYear()} ${time} +0000`;
}

function domainOf(user: string): string {
	const at = user.lastIndexOf('@');
	const domain = at === -1 ? '' : user.slice(at + 1).trim();
	return /^[a-zA-Z0-9.-]+$/.test(domain) ? domain : 'localhost';
}

function buildBody(config: SmtpConfig, message: MailMessage): string {
	const domain = domainOf(config.user);
	const boundary = `=_osc_${crypto.randomUUID().replace(/-/g, '')}`;
	const headers = [
		`From: ${formatAddress(config.user, message.fromName)}`,
		`To: ${formatAddress(message.to, message.toName)}`,
		`Subject: ${encodeHeaderText(message.subject)}`,
		`Date: ${formatDate(new Date())}`,
		`Message-ID: <${crypto.randomUUID()}@${domain}>`,
		'MIME-Version: 1.0',
		`Reply-To: ${formatAddress(message.replyTo ?? config.user, message.fromName)}`,
		'X-Apple-Color-Scheme: dark',
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
	];
	const parts = [
		`--${boundary}`,
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		wrapBase64(textToBase64(toCanonicalText(message.text))),
		`--${boundary}`,
		'Content-Type: text/html; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		wrapBase64(textToBase64(toCanonicalText(message.html))),
		`--${boundary}--`,
	];
	return `${headers.join(CRLF)}${CRLF}${CRLF}${parts.join(CRLF)}`;
}

class SmtpStream {
	private buffer = '';
	private readonly decoder = new TextDecoder();
	private readonly encoder = new TextEncoder();

	constructor(
		private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
		private readonly writer: WritableStreamDefaultWriter<Uint8Array>,
	) {}

	release(): void {
		this.reader.releaseLock();
		this.writer.releaseLock();
	}

	async write(data: string): Promise<void> {
		await this.writer.write(this.encoder.encode(data));
	}

	async read(): Promise<SmtpReply> {
		for (;;) {
			const reply = this.takeReply();
			if (reply) return reply;
			const chunk = await this.readChunk();
			if (chunk === null) {
				throw new Error('SMTP connection closed before a reply arrived');
			}
			this.buffer += chunk;
		}
	}

	async command(line: string, label: string, expected: number[]): Promise<SmtpReply> {
		await this.write(`${line}${CRLF}`);
		return this.expect(label, expected);
	}

	async expect(label: string, expected: number[]): Promise<SmtpReply> {
		const reply = await this.read();
		if (!expected.includes(reply.code)) {
			throw new Error(`SMTP ${label} failed with ${reply.code} ${reply.text}`);
		}
		return reply;
	}

	private takeReply(): SmtpReply | null {
		let start = 0;
		for (;;) {
			const end = this.buffer.indexOf(CRLF, start);
			if (end === -1) return null;
			const line = this.buffer.slice(start, end);
			if (line.length === 3 || (line.length > 3 && line[3] === ' ')) {
				const raw = this.buffer.slice(0, end);
				this.buffer = this.buffer.slice(end + CRLF.length);
				const code = Number.parseInt(line.slice(0, 3), 10);
				const text = raw
					.split(CRLF)
					.map((entry) => entry.slice(4))
					.join(' ')
					.trim();
				return { code: Number.isNaN(code) ? 0 : code, text };
			}
			start = end + CRLF.length;
		}
	}

	private async readChunk(): Promise<string | null> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => reject(new Error('SMTP read timed out')), READ_TIMEOUT_MS);
		});
		try {
			const result = await Promise.race([this.reader.read(), timeout]);
			if (result.done) return null;
			return result.value ? this.decoder.decode(result.value, { stream: true }) : '';
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	}
}

export async function sendMail(config: SmtpConfig, message: MailMessage): Promise<void> {
	const recipient = stripBreaks(message.to);
	const sender = stripBreaks(config.user);
	const body = buildBody(config, message);
	const socket = connect(
		{ hostname: config.host, port: config.port },
		{ secureTransport: 'starttls', allowHalfOpen: false },
	);
	let active: Socket = socket;
	let stream = new SmtpStream(socket.readable.getReader(), socket.writable.getWriter());
	try {
		await stream.expect('greeting', [220]);
		const helo = domainOf(config.user);
		await stream.command(`EHLO ${helo}`, 'EHLO', [250]);
		await stream.command('STARTTLS', 'STARTTLS', [220]);
		stream.release();
		const secure = socket.startTls();
		active = secure;
		stream = new SmtpStream(secure.readable.getReader(), secure.writable.getWriter());
		await stream.command(`EHLO ${helo}`, 'EHLO', [250]);
		await stream.command('AUTH LOGIN', 'AUTH LOGIN', [334]);
		await stream.command(textToBase64(sender), 'AUTH LOGIN username', [334]);
		await stream.command(textToBase64(config.pass), 'AUTH LOGIN password', [235]);
		await stream.command(`MAIL FROM:<${sender}>`, 'MAIL FROM', [250]);
		await stream.command(`RCPT TO:<${recipient}>`, 'RCPT TO', [250, 251]);
		await stream.command('DATA', 'DATA', [354]);
		await stream.write(`${body}${CRLF}.${CRLF}`);
		await stream.expect('message', [250]);
		await stream.write(`QUIT${CRLF}`);
	} finally {
		await active.close().catch(() => undefined);
	}
}
