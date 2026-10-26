import { summary } from '$lib/server/inventory.js';

/** Tab badges: things to buy, barcodes to name. */
export function load() {
	const s = summary();
	return { inboxCount: s.inbox_count, shopCount: s.low_count };
}
