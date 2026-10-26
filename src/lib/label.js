import QRCode from 'qrcode';
import { WIDTH } from './catprinter.js';
import { itemCode, amount, fmtDate } from './format.js';

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
 * Draw one package label as a pure black/white canvas, WIDTH px wide.
 *
 *  ┌────────┬──────────────────────┐
 *  │ ▓▓▓▓▓▓ │ BEEF MINCE           │
 *  │ ▓ QR ▓ │ 500 g                │
 *  │ ▓▓▓▓▓▓ │ Packed 26.10.2026    │
 *  │ #000123│ Use by 26.02.2027    │
 *  └────────┴──────────────────────┘
 */
export function renderLabel(item) {
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

	// Threshold the anti-aliased text so the preview matches what prints.
	const img = ctx.getImageData(0, 0, WIDTH, H);
	for (let i = 0; i < img.data.length; i += 4) {
		const v = img.data[i] < 140 ? 0 : 255;
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return cv;
}
