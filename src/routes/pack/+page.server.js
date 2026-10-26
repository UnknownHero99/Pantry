import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { locations, newProduct, pack, product } from '$lib/server/inventory.js';

export function load() {
	return {
		locations: locations(),
		// Most recently packed first, with the last amount used: the chips at the
		// top of the form are usually the right answer.
		products: db.prepare(
			`SELECT p.id, p.name, p.unit, p.location_id, p.shelf_days,
			   (SELECT MAX(i.id) FROM items i WHERE i.product_id = p.id) AS last_item,
			   (SELECT i.amount FROM items i WHERE i.product_id = p.id ORDER BY i.id DESC LIMIT 1) AS last_amount
			 FROM products p WHERE p.homemade = 1
			 ORDER BY last_item IS NULL, last_item DESC, p.name COLLATE NOCASE`
		).all(),
		nextId: (db.prepare('SELECT MAX(id) AS n FROM items').get().n ?? 0) + 1
	};
}

export const actions = {
	default: async ({ request }) => {
		const f = Object.fromEntries(await request.formData());
		const count = Math.min(Math.max(parseInt(f.count) || 0, 1), 100);
		const locationId = Number(f.location_id) || null;
		const packedAt = f.packed_at || new Date().toISOString().slice(0, 10);
		const bestBefore = f.best_before || null;
		const shelfDays = bestBefore ? Math.round((new Date(bestBefore) - new Date(packedAt)) / 86400000) : null;

		let p = Number(f.product_id) ? product(Number(f.product_id)) : null;
		if (!p) {
			const name = String(f.new_name || '').trim();
			if (!name) return fail(400, { error: 'Pick a product or type a new name' });
			p = newProduct({ name, homemade: true, unit: f.unit || 'g', location_id: locationId, shelf_days: shelfDays });
		} else if (!p.shelf_days && shelfDays) {
			// First time we learn how long this keeps — remember it for next time.
			db.prepare('UPDATE products SET shelf_days = ? WHERE id = ?').run(shelfDays, p.id);
		}

		const labels = pack({
			productId: p.id,
			count,
			amount: f.amount === '' ? null : Number(f.amount),
			unit: f.unit || p.unit,
			locationId,
			bestBefore,
			note: String(f.note || '').trim(),
			packedAt
		});
		return { labels };
	}
};
