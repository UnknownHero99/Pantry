import { error, json } from '@sveltejs/kit';
import { bump } from '$lib/server/inventory.js';

/** POST { by: 1 | -1 } — the wall's −/+ after a scan ("bought six", "took two"). */
export async function POST({ params, request }) {
	const { by } = await request.json().catch(() => ({}));
	const r = bump(Number(params.event), Math.sign(Number(by)) || 1);
	if (!r) error(404, 'That scan can’t be changed');
	return json(r);
}
