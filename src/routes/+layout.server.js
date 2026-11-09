import { env } from '$env/dynamic/private';
import { summary } from '$lib/server/inventory.js';

/** Tab badges: things to buy, barcodes to name; and the public address label QR codes link to. */
export function load({ url }) {
	const s = summary();
	return { inboxCount: s.inbox_count, shopCount: s.low_count + s.garage_low_count, origin: env.ORIGIN || url.origin };
}
