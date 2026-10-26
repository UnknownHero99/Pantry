import { shoppingList } from '$lib/server/inventory.js';
import { haEnabled } from '$lib/server/ha.js';

export function load() {
	return { items: shoppingList(), ha: haEnabled() };
}
