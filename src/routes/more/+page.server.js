import { summary } from '$lib/server/inventory.js';

export function load() {
	return { summary: summary() };
}
