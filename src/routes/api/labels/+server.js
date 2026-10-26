import { json } from '@sveltejs/kit';
import { labelData } from '$lib/server/inventory.js';

/** GET ?ids=1,2,3 — label contents for reprinting. */
export function GET({ url }) {
	const ids = (url.searchParams.get('ids') || '').split(',').map(Number).filter(Boolean);
	return json(labelData(ids));
}
