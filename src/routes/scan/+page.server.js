import { places, shoppingList } from '$lib/server/inventory.js';

export function load() {
	// toBuy: "still to buy" under the put-away trip, like the wall.
	return { locations: places('groceries'), toBuy: shoppingList().map((p) => p.name) };
}
