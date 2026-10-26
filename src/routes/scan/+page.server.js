import { locations, shoppingList } from '$lib/server/inventory.js';

export function load() {
	// toBuy: "still to buy" under the put-away trip, like the wall.
	return { locations: locations(), toBuy: shoppingList().map((p) => p.name) };
}
