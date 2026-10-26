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
 * History grouped by day. Packing 8 bags logs 8 events; they show as one
 * "Beef mince ×8 packed" row, and undo takes them all back.
 */
export function load({ url }) {
	const filter = FILTERS[url.searchParams.get('f')] ? url.searchParams.get('f') : 'all';
	const all = history(300);
	const rows = [];
	for (const e of all.filter(FILTERS[filter])) {
		const prev = rows.at(-1);
		if (
			e.type === 'pack' && prev?.type === 'pack' && prev.product_id === e.product_id &&
			prev.ts.slice(0, 16) === e.ts.slice(0, 16) && !!prev.undone === !!e.undone
		) {
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
