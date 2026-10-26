import { json } from '@sveltejs/kit';
import { summary } from '$lib/server/inventory.js';

/** Wall display idle screen + Home Assistant REST sensors. */
export function GET() {
	return json(summary());
}
