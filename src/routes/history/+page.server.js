import { history, undo } from '$lib/server/inventory.js';

const FILTERS = {
	all: () => true,
	wall: (e) => e.device === 'wall',
	phones: (e) => e.device !== 'wall', // 'phone' scans and 'app' (packing, manual ±)
	issues: (e) => drift(e)
};
// An OUT that found nothing on the shelf: the counts had drifted.
const drift = (e) => e.type === 'out' && e.delta === 0 && !e.undone;

const pad = (n) => String(n).padStart(2, '0');
const local = (ts) => new Date(ts.replace(' ', 'T') + 'Z'); // events are stored in UTC
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayLabel(d, now = new Date()) {
	const y = new Date(now);
	y.setDate(y.getDate() - 1);
	if (dayKey(d) === dayKey(now)) return 'Today';
	if (dayKey(d) === dayKey(y)) return 'Yesterday';
	return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Back-to-back events that read as one: packing 8 bags, tapping + six times,
 * scanning four cans in. Same product, place, device and direction, a few
 * minutes apart at most (`prev` is the newer one: history runs newest first).
 */
function sameRun(prev, e) {
	if (!prev || prev.type !== e.type || prev.product_id !== e.product_id || !!prev.undone !== !!e.undone) return false;
	if (e.type === 'pack') return prev.ts.slice(0, 16) === e.ts.slice(0, 16);
	if (!['adjust', 'in', 'out'].includes(e.type) || drift(e) || drift(prev)) return false;
	const gap = local(prev.firstTs ?? prev.ts) - local(e.ts);
	return prev.location_id === e.location_id && prev.device === e.device && Math.sign(prev.delta) === Math.sign(e.delta) && gap <= 5 * 60000;
}

/**
 * History grouped by day, with runs of the same thing as one row ("Beef mince
 * ×8 packed", "Argeta · count fixed +6"); undo takes the whole run back.
 */
export function load({ url }) {
	const filter = FILTERS[url.searchParams.get('f')] ? url.searchParams.get('f') : 'all';
	const all = history(300);
	const rows = [];
	for (const e of all.filter(FILTERS[filter])) {
		const prev = rows.at(-1);
		if (sameRun(prev, e)) {
			prev.firstTs = e.ts;
			prev.ids.push(e.id);
			prev.delta += e.delta;
			continue;
		}
		rows.push({ ...e, ids: [e.id] });
	}

	const days = [];
	for (const e of rows) {
		const d = local(e.ts);
		const label = dayLabel(d);
		if (days.at(-1)?.label !== label) days.push({ label, rows: [] });
		days.at(-1).rows.push({
			ids: e.ids.join(','),
			product_id: e.product_id,
			kind: drift(e) ? 'drift' : ['pack', 'adjust', 'move', 'took', 'back'].includes(e.type) ? e.type : e.delta > 0 ? 'in' : 'out',
			name: e.name == null ? 'Deleted product'
				: e.needs_review ? `New item · ${e.code ?? ''}`
				: e.type === 'pack' ? `${e.name}${e.ids.length > 1 ? ` ×${e.ids.length}` : ''} packed`
				: e.type === 'adjust' ? `${e.name} · count fixed`
				: e.type === 'move' ? `${e.name} moved`
				: e.type === 'took' ? `${e.name} taken out to use`
				: e.type === 'back' ? `${e.name} put back`
				: e.name,
			unknown: !!e.needs_review,
			sub: [drift(e) ? 'Nothing in stock' : e.type === 'move' ? `to ${e.location}` : e.location, e.device === 'app' ? 'phone' : e.device, `${pad(d.getHours())}:${pad(d.getMinutes())}`]
				.filter(Boolean)
				.join(' · '),
			delta: e.delta,
			undone: !!e.undone
		});
	}
	return { days, filter, issues: all.filter(drift).length };
}

export const actions = {
	undo: async ({ request }) => {
		const ids = String((await request.formData()).get('ids') || '').split(',').map(Number).filter(Boolean);
		for (const id of ids) undo(id);
	}
};
