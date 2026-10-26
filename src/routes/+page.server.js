import { fail } from '@sveltejs/kit';
import { inventory, locations, expiring, adjust } from '$lib/server/inventory.js';

export function load() {
	return { products: inventory(), locations: locations(), expiring: expiring(14) };
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
