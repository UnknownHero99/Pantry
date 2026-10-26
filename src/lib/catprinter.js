/**
 * Web Bluetooth driver for the cheap "cat" thermal printers (Fun Print / iPrint
 * apps: MX05/06/10, GB01-03, C15 …). Android Chrome only; needs HTTPS.
 *
 * Protocol (reverse-engineered by the community, see werwolv.net/blog/cat_printer
 * and NaitLee/Cat-Printer):
 *   51 78 | cmd | 00 | len lo | len hi | data… | crc8(data) | ff
 * written to characteristic 0xAE01 of service 0xAE30. The printer asks us to
 * pause/resume via notifications on 0xAE02 when its buffer fills.
 */

const SERVICE = 0xae30;
const TX = 0xae01;
const RX = 0xae02;
// Other services cheap BLE label/receipt printers use. Web Bluetooth only lets
// us see services we name up front, so these are here to tell the user what
// their printer *does* offer when it isn't the cat-printer one.
const OTHER_SERVICES = [0xaf30, 0xff00, 0xffe0, 0xfee7, 0x18f0, 0xabf0, '49535343-fe7d-4ae5-8fa9-9fafd205e455'];

/** A failure with a message meant for the user, not the console. */
export class PrinterError extends Error {}

export const WIDTH = 384; // dots per line, 48 mm at 203 dpi

const CRC_TABLE = (() => {
	const t = new Uint8Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
		t[i] = c;
	}
	return t;
})();

function crc8(data) {
	let c = 0;
	for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff];
	return c;
}

function cmd(id, data) {
	data = data instanceof Uint8Array ? data : Uint8Array.from(data);
	const out = new Uint8Array(data.length + 8);
	out.set([0x51, 0x78, id, 0x00, data.length & 0xff, data.length >> 8]);
	out.set(data, 6);
	out[out.length - 2] = crc8(data);
	out[out.length - 1] = 0xff;
	return out;
}

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];

const C = {
	state: () => cmd(0xa3, [0x00]),
	dpi200: () => cmd(0xa4, [50]),
	speed: (n) => cmd(0xbd, [n]),
	energy: (n) => cmd(0xaf, u16(n)),
	applyEnergy: () => cmd(0xbe, [0x01]),
	update: () => cmd(0xa9, [0x00]),
	latticeStart: () => cmd(0xa6, [0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c]),
	latticeEnd: () => cmd(0xa6, [0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17]),
	line: (bytes) => cmd(0xa2, bytes),
	feed: (n) => cmd(0xa1, u16(n))
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function supported() {
	return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

let device, tx, paused = false;

async function connect() {
	if (tx && device?.gatt.connected) return;
	if (!device) {
		if (navigator.bluetooth.getAvailability && !(await navigator.bluetooth.getAvailability())) {
			throw new PrinterError('Bluetooth is off, or this device has none. Turn it on and try again.');
		}
		// acceptAllDevices: these printers advertise under many names (C15, MX10,
		// GB03…), and not all of them list 0xAE30 in the advertisement.
		device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [SERVICE, ...OTHER_SERVICES] });
		device.addEventListener('gattserverdisconnected', () => (tx = null));
	}
	try {
		const server = await device.gatt.connect();
		let svc;
		try {
			svc = await server.getPrimaryService(SERVICE);
		} catch {
			const found = await server.getPrimaryServices().catch(() => []);
			const ids = found.map((x) => x.uuid.replace(/^0000(....)-0000-1000-8000-00805f9b34fb$/, '0x$1')).join(', ');
			throw new PrinterError(
				`Connected to “${device.name || 'the printer'}”, but it isn't a cat printer this app knows ` +
					`(no 0xAE30 service${ids ? `; it offers ${ids}` : ''}). Tell Claude these details to add support.`
			);
		}
		tx = await svc.getCharacteristic(TX);
	} catch (e) {
		// Forget a printer that didn't work, so the next try opens the list again.
		forget();
		throw e;
	}
	try {
		const rx = await svc.getCharacteristic(RX);
		await rx.startNotifications();
		rx.addEventListener('characteristicvaluechanged', (e) => {
			const v = new Uint8Array(e.target.value.buffer);
			// Flow control: 51 78 ae 01 01 00 <10 = pause | 00 = resume> …
			if (v[2] === 0xae) paused = v[6] === 0x10;
		});
	} catch {
		// Some models have no notify characteristic; we just pace writes instead.
	}
}

export function connectedName() {
	return device?.gatt.connected ? device.name : null;
}

export function forget() {
	device?.gatt?.disconnect();
	device = tx = null;
}

/**
 * Turn a Web Bluetooth failure into something to do about it. Chrome uses
 * NotFoundError for several unrelated things, so the message decides.
 */
export function explain(e) {
	if (e instanceof PrinterError) return e.message;
	const m = String(e?.message || '');
	if (e?.name === 'NotFoundError' && /cancel/i.test(m)) {
		return 'No printer picked. Tap Print, wait for the list, and choose the printer (often its model, e.g. C15). ' +
			'Not in the list? Switch it on, and close the Fun Print app: the printer takes only one connection.';
	}
	if (e?.name === 'NotFoundError' && /adapter|not available|turned off/i.test(m)) {
		return 'Bluetooth is off, or this device has none. Turn it on and try again.';
	}
	if (e?.name === 'NotFoundError') return `Printer not found: ${m}`;
	if (e?.name === 'SecurityError') return 'Bluetooth printing needs the app over HTTPS, started by tapping Print.';
	if (e?.name === 'NetworkError') {
		return 'Couldn’t connect to the printer. Is it still connected to the Fun Print app or another phone? Close that and try again.';
	}
	return `Print failed: ${m || e}`;
}

async function send(bytes) {
	const CHUNK = 180;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		while (paused) await sleep(20);
		await tx.writeValueWithoutResponse(bytes.subarray(i, i + CHUNK));
		await sleep(12);
	}
}

/**
 * Pack a 1-bit canvas into printer lines. Cat printers want LSB-first bits,
 * i.e. pixel x lives in bit (x % 8) of byte x/8 — the opposite of PBM.
 */
function rows(canvas) {
	const { width, height } = canvas;
	const px = canvas.getContext('2d').getImageData(0, 0, width, height).data;
	const out = [];
	for (let y = 0; y < height; y++) {
		const line = new Uint8Array(WIDTH / 8);
		for (let x = 0; x < Math.min(width, WIDTH); x++) {
			const i = (y * width + x) * 4;
			const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
			if (px[i + 3] > 127 && lum < 128) line[x >> 3] |= 1 << (x & 7);
		}
		out.push(line);
	}
	return out;
}

/**
 * Print canvases (each exactly WIDTH px wide) one after another.
 * `energy` is print darkness; 0x2000–0x4000 is typical. Sticker paper usually
 * needs more than plain receipt paper.
 */
export async function print(canvases, { energy = 0x3000, gap = 40 } = {}) {
	await connect();
	const parts = [C.state(), C.dpi200(), C.speed(32), C.energy(energy), C.applyEnergy(), C.update(), C.latticeStart()];
	for (const cv of canvases) {
		for (const r of rows(cv)) parts.push(C.line(r));
		parts.push(C.feed(gap));
	}
	parts.push(C.latticeEnd(), C.speed(8), C.feed(60), C.state());

	const total = parts.reduce((n, p) => n + p.length, 0);
	const buf = new Uint8Array(total);
	let o = 0;
	for (const p of parts) {
		buf.set(p, o);
		o += p.length;
	}
	await send(buf);
}
