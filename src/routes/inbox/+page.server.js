import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { inbox, product, updateProduct, mergeProduct, deleteProduct, relookup } from '$lib/server/inventory.js';

export function load() {
	return {
		items: inbox(),
		products: db.prepare('SELECT id, name FROM products WHERE needs_review = 0 ORDER BY name COLLATE NOCASE').all()
	};
}

export const actions = {
	name: async ({ request }) => {
		const f = await request.formData();
		const p = product(Number(f.get('id')));
		const name = String(f.get('name') || '').trim();
		if (!p || !name) return fail(400);
		updateProduct(p.id, { ...p, name, brand: String(f.get('brand') || '').trim() || p.brand });
	},
	merge: async ({ request }) => {
		const f = await request.formData();
		const from = Number(f.get('id'));
		const into = Number(f.get('into'));
		if (!from || !into) return fail(400);
		mergeProduct(from, into);
	},
	lookup: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!(await relookup(id))) return fail(404, { notFound: id });
	},
	delete: async ({ request }) => {
		deleteProduct(Number((await request.formData()).get('id')));
	}
};
