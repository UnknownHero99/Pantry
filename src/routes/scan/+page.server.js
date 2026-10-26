import { locations } from '$lib/server/inventory.js';

export function load() {
	return { locations: locations() };
}
