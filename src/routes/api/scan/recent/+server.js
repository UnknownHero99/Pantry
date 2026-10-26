import { json } from '@sveltejs/kit';
import { recentScans } from '$lib/server/inventory.js';

/** GET ?device=wall — what the wall's UNDO list offers. */
export function GET({ url }) {
	return json(recentScans(url.searchParams.get('device') || 'wall', 5));
}
