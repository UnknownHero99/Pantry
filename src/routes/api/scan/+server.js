import { json } from '@sveltejs/kit';
import { scan } from '$lib/server/inventory.js';

/**
 * POST { code, mode: 'in'|'out', device?, location?, default_location?, async_lookup? }
 * Used by both the wall scanner (ESPHome http_request) and the PWA camera.
 */
export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	return json(await scan(body));
}
