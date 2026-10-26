/**
 * The app's one front for Bluetooth label printing, over two drivers:
 *   cat — the C15 / Fun Print family on 48 mm receipt-width paper (catprinter.js)
 *   p15 — the Marklife P15 / P12 label maker on 12–15 mm labels (p15printer.js)
 * You pick a printer from Chrome's list; the app works out which kind it is,
 * draws the labels for it and remembers the kind for previews next time.
 */
import { writable, get } from 'svelte/store';
import * as cat from './catprinter.js';
import * as p15 from './p15printer.js';
import { renderLabel } from './label.js';

// Other services cheap BLE printers use. Web Bluetooth only shows services we
// name up front, so these let us tell the user what an unknown printer offers.
const OTHER_SERVICES = [0xaf30, 0xffe0, 0xfee7, 0x18f0, 0xabf0, '49535343-fe7d-4ae5-8fa9-9fafd205e455'];

function stored(key, fallback, parse = (v) => v) {
	let start = fallback;
	try {
		const v = localStorage.getItem(key);
		if (v != null) start = parse(v);
	} catch {}
	const s = writable(start);
	s.subscribe((v) => {
		try { localStorage.setItem(key, String(v)); } catch {}
	});
	return s;
}

/** 'p15' or 'cat': which label layout to draw. Set by Settings, or by connecting. */
export const printerKind = stored('printer.kind', 'p15');
/** Length of one P15 die-cut label, mm. */
export const labelLength = stored('printer.p15.length', 40, Number);

/** Draw a label for the given (or currently chosen) printer. */
export function drawLabel(item, kind = get(printerKind)) {
	return renderLabel(item, kind, get(labelLength));
}

/** A failure with a message meant for the user, not the console. */
export class PrinterError extends Error {}

export function supported() {
	return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

let device = null;
let driver = null;

async function connect() {
	if (driver && device?.gatt.connected) return driver;
	if (!device) {
		if (navigator.bluetooth.getAvailability && !(await navigator.bluetooth.getAvailability())) {
			throw new PrinterError('Bluetooth is off, or this device has none. Turn it on and try again.');
		}
		// acceptAllDevices: these printers advertise under many names (P15_xxxx_BLE,
		// C15, MX10, GB03…), and not all of them list their service in the advertisement.
		device = await navigator.bluetooth.requestDevice({
			acceptAllDevices: true,
			optionalServices: [p15.SERVICE, cat.SERVICE, ...OTHER_SERVICES]
		});
		device.addEventListener('gattserverdisconnected', () => (driver = null));
	}
	try {
		const server = await device.gatt.connect();
		driver = (await p15.attach(server)) ?? (await cat.attach(server));
		if (!driver) {
			const found = await server.getPrimaryServices().catch(() => []);
			const ids = found.map((x) => x.uuid.replace(/^0000(....)-0000-1000-8000-00805f9b34fb$/, '0x$1')).join(', ');
			throw new PrinterError(
				`Connected to “${device.name || 'the printer'}”, but it isn't a printer this app knows ` +
					`(neither the P15 nor the cat-printer protocol${ids ? `; it offers ${ids}` : ''}). Tell Claude these details to add support.`
			);
		}
		printerKind.set(driver.kind);
		return driver;
	} catch (e) {
		// Forget a printer that didn't work, so the next try opens the list again.
		forget();
		throw e;
	}
}

/**
 * Print label rows (from labelData()). They're drawn after connecting, so
 * picking the other kind of printer than the preview showed still works.
 */
export async function printLabels(items, opts) {
	const d = await connect();
	await d.print(items.map((i) => drawLabel(i, d.kind)), opts);
}

export function connectedName() {
	return device?.gatt.connected ? device.name : null;
}

export function forget() {
	device?.gatt?.disconnect();
	device = driver = null;
}

/**
 * Turn a Web Bluetooth failure into something to do about it. Chrome uses
 * NotFoundError for several unrelated things, so the message decides.
 */
export function explain(e) {
	if (e instanceof PrinterError || e?.name === 'PrinterProblem') return e.message;
	const m = String(e?.message || '');
	if (e?.name === 'NotFoundError' && /cancel/i.test(m)) {
		return 'No printer picked. Tap Print, wait for the list, and choose the printer (a P15 shows as P15_…_BLE). ' +
			'Not in the list? Switch it on, and close its own app (Marklife, Fun Print): the printer takes only one connection.';
	}
	if (e?.name === 'NotFoundError' && /adapter|not available|turned off/i.test(m)) {
		return 'Bluetooth is off, or this device has none. Turn it on and try again.';
	}
	if (e?.name === 'NotFoundError') return `Printer not found: ${m}`;
	if (e?.name === 'SecurityError') return 'Bluetooth printing needs the app over HTTPS, started by tapping Print.';
	if (e?.name === 'NetworkError') {
		return 'Couldn’t connect to the printer. Is it still connected to its own app or another phone? Close that and try again.';
	}
	return `Print failed: ${m || e}`;
}
