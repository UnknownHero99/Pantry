import { error, json } from '@sveltejs/kit';
import { fixDrift } from '$lib/server/inventory.js';

/** "It was there, fix count" on the wall's nothing-in-stock screen. */
export function POST({ params }) {
	const r = fixDrift(Number(params.event));
	if (!r) error(404, 'Nothing to fix');
	return json(r);
}
