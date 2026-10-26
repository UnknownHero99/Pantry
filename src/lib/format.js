/** Shared between server responses (wall display) and the PWA. */

export const LABEL_PREFIX = 'PNTRY:I:';

export function itemCode(id) {
	return LABEL_PREFIX + String(id).padStart(6, '0');
}

export function parseItemCode(code) {
	const m = /^PNTRY:I:(\d+)$/i.exec(code.trim());
	return m ? Number(m[1]) : null;
}

export function amount(value, unit) {
	if (value == null || value === '') return '';
	if (unit === 'g' && value >= 1000) return `${+(value / 1000).toFixed(2)} kg`;
	if (unit === 'ml' && value >= 1000) return `${+(value / 1000).toFixed(2)} l`;
	return `${+value} ${unit || ''}`.trim();
}

/** "today", "5 days", "3 weeks", "4 months" — short enough for the wall screen. */
export function age(isoDate, now = new Date()) {
	const days = Math.round((now - new Date(isoDate)) / 86400000);
	return span(days);
}

export function span(days) {
	const d = Math.abs(days);
	if (d < 1) return 'today';
	if (d < 14) return `${d} day${d === 1 ? '' : 's'}`;
	if (d < 60) return `${Math.round(d / 7)} weeks`;
	if (d < 730) return `${Math.round(d / 30.4)} months`;
	return `${+(d / 365).toFixed(1)} years`;
}

export function daysUntil(isoDate, now = new Date()) {
	if (!isoDate) return null;
	const a = new Date(isoDate + 'T00:00:00');
	const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((a - b) / 86400000);
}

export function fmtDate(isoDate) {
	if (!isoDate) return '';
	const [y, m, d] = isoDate.slice(0, 10).split('-');
	return `${+d}.${+m}.${y}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2 Jun" — for the wall screen, where a full date is too long. */
export function shortDate(isoDate) {
	if (!isoDate) return '';
	const [, m, d] = isoDate.slice(0, 10).split('-');
	return `${+d} ${MONTHS[+m - 1]}`;
}

export function today() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(isoDate, days) {
	const d = new Date(isoDate + 'T12:00:00');
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}
