import QRCode from 'qrcode';
import { WIDTH } from './catprinter.js';
import { HEAD, FEED_DOTS_PER_MM } from './p15printer.js';
import { itemCode, boxCode, amount, fmtDate } from './format.js';

const H = 216; // ≈27 mm at 8 dots/mm

function wrap(ctx, text, maxWidth, maxLines) {
	const words = text.split(/\s+/);
	const lines = [];
	let cur = '';
	for (const w of words) {
		const next = cur ? `${cur} ${w}` : w;
		if (ctx.measureText(next).width <= maxWidth || !cur) cur = next;
		else {
			lines.push(cur);
			cur = w;
		}
	}
	if (cur) lines.push(cur);
	if (lines.length > maxLines) {
		lines.length = maxLines;
		let last = lines[maxLines - 1];
		while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
		lines[maxLines - 1] = last + '…';
	}
	return lines;
}

/**
 * Draw one package label as a pure black/white canvas, in the layout of the
 * printer it's for: 'cat' (48 mm receipt paper) or 'p15' (12 mm label, `lengthMm` long).
 */
export function renderLabel(item, kind = 'cat', lengthMm = 40) {
	if (item.box) return renderBox(item, kind, lengthMm);
	return kind === 'p15' ? renderStrip(item, lengthMm) : renderReceipt(item);
}

/**
 * Box label: QR (PNTRY:B:…), the box number big, its name and where it lives.
 * item = { box: true, id, code: 'A·2', name: 'Power tools', path: 'Garage › Shelf A' }
 */
function renderBox(item, kind, lengthMm) {
	const strip = kind === 'p15';
	const W = strip ? Math.round(lengthMm * FEED_DOTS_PER_MM) : WIDTH;
	const Hh = strip ? HEAD : 150;
	const cv = document.createElement('canvas');
	cv.width = W;
	cv.height = Hh;
	const ctx = cv.getContext('2d');
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, W, Hh);
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'top';

	const modules = QRCode.create(boxCode(item.id), { errorCorrectionLevel: 'M' }).modules.size + 2;
	const scale = Math.floor((Hh - 4) / modules);
	const side = modules * scale;
	const edge = strip ? 8 : 6;
	drawQr(ctx, boxCode(item.id), edge, Math.floor((Hh - side) / 2), scale);

	const x = edge + side + 8;
	const w = W - x - edge;
	let y = strip ? 4 : 10;
	ctx.font = `bold ${strip ? 34 : 56}px sans-serif`;
	ctx.fillText(wrap(ctx, item.code || 'BOX', w, 1)[0], x, y);
	y += strip ? 38 : 62;
	if (item.name) {
		ctx.font = `bold ${strip ? 20 : 30}px sans-serif`;
		ctx.fillText(wrap(ctx, item.name.toUpperCase(), w, 1)[0], x, y);
		y += strip ? 23 : 36;
	}
	if (item.path && y <= Hh - (strip ? 16 : 24)) {
		ctx.font = `${strip ? 15 : 22}px sans-serif`;
		ctx.fillText(wrap(ctx, item.path, w, 1)[0], x, y);
	}
	harden(ctx, W, Hh);
	return cv;
}

/** Threshold anti-aliased drawing to pure black and white, so the preview matches what prints. */
function harden(ctx, w, h) {
	const img = ctx.getImageData(0, 0, w, h);
	for (let i = 0; i < img.data.length; i += 4) {
		const v = img.data[i] < 140 ? 0 : 255;
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
}

function drawQr(ctx, text, x, y, scale) {
	const qr = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
	for (let r = 0; r < qr.size; r++)
		for (let c = 0; c < qr.size; c++)
			if (qr.get(r, c)) ctx.fillRect(x + (c + 1) * scale, y + (r + 1) * scale, scale, scale);
	return (qr.size + 2) * scale;
}

/**
 * P15 label: 96 dots high (the head across the 12 mm tape), as long as the
 * label. The QR fills the height; the text sits beside it.
 *
 *  ┌──────┬───────────────────────────┐
 *  │ ▓▓▓▓ │ BEEF MINCE                │
 *  │ ▓QR▓ │ 500 g                     │
 *  │ ▓▓▓▓ │ Packed 26.10.26           │
 *  │      │ Use by 26.04.27           │
 *  └──────┴───────────────────────────┘
 */
function renderStrip(item, lengthMm) {
	const W = Math.round(lengthMm * FEED_DOTS_PER_MM);
	const cv = document.createElement('canvas');
	cv.width = W;
	cv.height = HEAD;
	const ctx = cv.getContext('2d');
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, W, HEAD);
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'top';

	// One-module quiet zone; integer module size so every module is crisp.
	const modules = QRCode.create(itemCode(item.id), { errorCorrectionLevel: 'M' }).modules.size + 2;
	const scale = Math.floor((HEAD - 4) / modules);
	const side = modules * scale;
	const edge = 8; // ≈1 mm clear of the die-cut edge
	drawQr(ctx, itemCode(item.id), edge, Math.floor((HEAD - side) / 2), scale);

	const x = edge + side + 6;
	const w = W - x - edge;
	const short = (d) => fmtDate(d).replace(/\.\d\d(\d\d)$/, '.$1'); // 26.10.26
	let y = 4;
	ctx.font = 'bold 22px sans-serif';
	ctx.fillText(wrap(ctx, item.name.toUpperCase(), w, 1)[0], x, y);
	y += 25;
	const amt = amount(item.amount, item.unit);
	if (amt) {
		ctx.font = 'bold 20px sans-serif';
		ctx.fillText(wrap(ctx, amt, w, 1)[0], x, y);
		y += 22;
	}
	ctx.font = '17px sans-serif';
	ctx.fillText(wrap(ctx, `Packed ${short(item.packed_at)}`, w, 1)[0], x, y);
	y += 19;
	if (item.best_before && y <= HEAD - 18) {
		ctx.font = 'bold 17px sans-serif';
		ctx.fillText(wrap(ctx, `Use by ${short(item.best_before)}`, w, 1)[0], x, y);
	}
	harden(ctx, W, HEAD);
	return cv;
}

/**
 * Cat-printer label: a pure black/white canvas, WIDTH px wide.
 *
 *  ┌────────┬──────────────────────┐
 *  │ ▓▓▓▓▓▓ │ BEEF MINCE           │
 *  │ ▓ QR ▓ │ 500 g                │
 *  │ ▓▓▓▓▓▓ │ Packed 26.10.2026    │
 *  │ #000123│ Use by 26.02.2027    │
 *  └────────┴──────────────────────┘
 */
function renderReceipt(item) {
	const cv = document.createElement('canvas');
	cv.width = WIDTH;
	cv.height = H;
	const ctx = cv.getContext('2d');
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, WIDTH, H);
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'top';

	// QR, integer module size so every module is crisp on a 1-bit printer.
	const code = itemCode(item.id);
	const qr = QRCode.create(code, { errorCorrectionLevel: 'M' }).modules;
	const scale = Math.floor(170 / (qr.size + 2));
	const qx = 6, qy = 8;
	for (let r = 0; r < qr.size; r++)
		for (let c = 0; c < qr.size; c++)
			if (qr.get(r, c)) ctx.fillRect(qx + (c + 1) * scale, qy + (r + 1) * scale, scale, scale);
	const qrEnd = qx + (qr.size + 2) * scale;

	ctx.font = '600 18px sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('#' + String(item.id).padStart(6, '0'), qx + ((qr.size + 2) * scale) / 2, qy + (qr.size + 2) * scale + 2);
	ctx.textAlign = 'left';

	const x = qrEnd + 8;
	const w = WIDTH - x - 4;
	let y = 8;

	ctx.font = 'bold 30px sans-serif';
	for (const line of wrap(ctx, item.name.toUpperCase(), w, 2)) {
		ctx.fillText(line, x, y);
		y += 33;
	}

	const amt = amount(item.amount, item.unit);
	if (amt) {
		ctx.font = 'bold 34px sans-serif';
		ctx.fillText(amt, x, y + 2);
		y += 40;
	}

	ctx.font = '22px sans-serif';
	ctx.fillText(`Packed ${fmtDate(item.packed_at)}`, x, y);
	y += 26;
	if (item.best_before) {
		ctx.font = 'bold 22px sans-serif';
		ctx.fillText(`Use by ${fmtDate(item.best_before)}`, x, y);
		y += 26;
	}
	const extra = [item.location, item.note].filter(Boolean).join(' · ');
	if (extra && y < H - 22) {
		ctx.font = '20px sans-serif';
		ctx.fillText(wrap(ctx, extra, w, 1)[0], x, y);
	}

	harden(ctx, WIDTH, H);
	return cv;
}
