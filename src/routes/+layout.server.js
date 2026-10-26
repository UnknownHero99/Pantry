import { summary } from '$lib/server/inventory.js';

export function load() {
	return { inboxCount: summary().inbox_count };
}
