import { shoppingList } from '$lib/server/inventory.js';
import { haEnabled } from '$lib/server/ha.js';

/** Two lists: groceries (Pantry and Kitchen) and garage, ?list=garage. */
export function load({ url }) {
	const list = url.searchParams.get('list') === 'garage' ? 'garage' : 'groceries';
	return {
		list,
		items: shoppingList(list),
		counts: { groceries: shoppingList('groceries').length, garage: shoppingList('garage').length },
		ha: haEnabled(list)
	};
}
