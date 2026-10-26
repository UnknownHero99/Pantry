import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { inventory, tree, expiring, adjust, shoppingList } from '$lib/server/inventory.js';

export function load({ url }) {
	const all = tree();
	const spaces = all.filter((l) => l.kind === 'space');
	const home = spaces.find((s) => s.home) ?? spaces[0];
	const asked = Number(url.searchParams.get('space'));
	const space = spaces.find((s) => s.id === asked) ?? home;
	return {
		products: inventory(),
		tree: all,
		spaceId: space.id,
		homeId: home.id,
		expiring: expiring(14),
		garageLow: shoppingList('garage').length,
		lentOut: db.prepare('SELECT COUNT(*) AS n FROM loans WHERE returned_at IS NULL').get().n
	};
}

export const actions = {
	adjust: async ({ request }) => {
		const f = await request.formData();
		const productId = Number(f.get('product_id'));
		const locationId = Number(f.get('location_id'));
		const delta = Number(f.get('delta'));
		if (!productId || !locationId || !delta) return fail(400);
		adjust(productId, locationId, delta);
	}
};
