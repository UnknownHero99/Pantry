/**
 * Web Bluetooth driver for the Marklife / Pristar P15 label maker (and the
 * P12 / L13, same protocol): 12–15 mm die-cut or continuous labels, a 96-dot
 * head across the tape. Reached through printer.js.
 *
 * Protocol facts as verified on a P15 by the LaBLEr project
 * (github.com/toolicious/labler) and documented by thermoprint
 * (github.com/tomLadder/thermoprint); this is our own implementation:
 *   service 0xFF00, write job bytes to 0xFF02 (without response), status
 *   notifications on 0xFF01. A job is
 *     10 FF 40                 init
 *     00 × 15                  wake-up padding
 *     10 FF F1 02              print start
 *     1D 76 30 00 0C 00 nL nH  ESC/POS raster: 12 bytes per line, n lines
 *     <n × 12 bytes>           one line per dot along the tape
 *     1D 0C                    feed to the gap after a die-cut label
 *     10 FF F1 45              print end
 *     10 FF 40, 10 FF 40
 */

export const SERVICE = 0xff00;
const WRITE = 0xff02;
const NOTIFY = 0xff01;

/** Dots across the tape. A label image is HEAD dots high and as long as the label. */
export const HEAD = 96;
/** The tape advances at 200 dpi, although the head is sold as 203 dpi. */
export const FEED_DOTS_PER_MM = 200 / 25.4;

const CHUNK = 96;
const CHUNK_DELAY_MS = 30;
const LABEL_GAP_MS = 500;

// Status notifications: FF <code>.
const STATUS = { 0x01: 'The printer is out of labels.', 0x02: 'The printer cover is open.', 0x03: 'The printer is too hot; give it a minute.' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Use this connection if it's a P15-family printer; null if it isn't one. */
export async function attach(server) {
	let svc;
	try {
		svc = await server.getPrimaryService(SERVICE);
	} catch {
		return null;
	}
	const conn = { tx: await svc.getCharacteristic(WRITE), problem: null };
	try {
		const rx = await svc.getCharacteristic(NOTIFY);
		await rx.startNotifications();
		rx.addEventListener('characteristicvaluechanged', (e) => {
			const v = new Uint8Array(e.target.value.buffer);
			if (v[0] === 0xff && STATUS[v[1]]) conn.problem = STATUS[v[1]];
		});
	} catch {
		// Printing works without status; we just can't say "out of labels".
	}
	return { kind: 'p15', print: (canvases) => print(conn, canvases) };
}

/**
 * The image runs along the tape: x is the position along the label, y across
 * it. Each line along the tape is 12 bytes, starting from the bottom of the
 * image, least significant bit first within each group of 8 rows. That is
 * the 90° turn that makes a label drawn sideways come out readable.
 */
function pack(canvas) {
	const { width, height } = canvas;
	if (height !== HEAD) throw new Error(`P15 label must be ${HEAD} dots high, was ${height}`);
	const px = canvas.getContext('2d').getImageData(0, 0, width, height).data;
	const black = (x, y) => {
		const i = (y * width + x) * 4;
		return px[i + 3] > 127 && 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 128;
	};
	const out = new Uint8Array(width * (HEAD / 8));
	let o = 0;
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < HEAD; y += 8) {
			const top = HEAD - 8 - y;
			let b = 0;
			for (let bit = 0; bit < 8; bit++) if (black(x, top + bit)) b |= 1 << bit;
			out[o++] = b;
		}
	}
	return out;
}

/** The whole byte stream for one die-cut label. Exported for tests. */
export function job(canvas) {
	const payload = pack(canvas);
	const n = canvas.width;
	const head = [0x10, 0xff, 0x40, ...new Array(15).fill(0), 0x10, 0xff, 0xf1, 0x02, 0x1d, 0x76, 0x30, 0x00, HEAD / 8, 0x00, n & 0xff, (n >> 8) & 0xff];
	const tail = [0x1d, 0x0c, 0x10, 0xff, 0xf1, 0x45, 0x10, 0xff, 0x40, 0x10, 0xff, 0x40];
	const out = new Uint8Array(head.length + payload.length + tail.length);
	out.set(head, 0);
	out.set(payload, head.length);
	out.set(tail, head.length + payload.length);
	return out;
}

async function print(conn, canvases) {
	conn.problem = null;
	for (const [i, cv] of canvases.entries()) {
		if (i) await sleep(LABEL_GAP_MS);
		const bytes = job(cv);
		for (let o = 0; o < bytes.length; o += CHUNK) {
			await conn.tx.writeValueWithoutResponse(bytes.subarray(o, o + CHUNK));
			await sleep(CHUNK_DELAY_MS);
		}
		if (conn.problem) throw Object.assign(new Error(conn.problem), { name: 'PrinterProblem' });
	}
}
