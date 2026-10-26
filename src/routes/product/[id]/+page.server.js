import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import {
	product, updateProduct, deleteProduct, mergeProduct, barcodesFor, addBarcode, removeBarcode,
	itemsFor, removeItem, locations, adjust
} from '$lib/server/inventory.js';

export function load({ params }) {
	const p = product(Number(params.id));
	if (!p) error(404, 'No such product');
	return {
		product: p,
		barcodes: barcodesFor(p.id),
		items: itemsFor(p.id),
		stock: db.prepare('SELECT location_id, qty FROM stock WHERE product_id = ?').all(p.id),
		locations: locations(),
		others: db.prepare('SELECT id, name FROM products WHERE id != ? ORDER BY name COLLATE NOCASE').all(p.id)
	};
}

const id = (params) => Number(params.id);

export const actions = {
	save: async ({ request, params }) => {
		const f = Object.fromEntries(await request.formData());
		if (!String(f.name || '').trim()) return fail(400, { error: 'Name is required' });
		updateProduct(id(params), {
			name: f.name.trim(),
			brand: f.brand?.trim(),
			size: f.size?.trim(),
			category: f.category?.trim(),
			location_id: Number(f.location_id) || null,
			min_stock: parseInt(f.min_stock) || 0,
			shelf_days: parseInt(f.shelf_days) || null,
			unit: f.unit,
			homemade: f.homemade === 'on'
		});
		return { saved: true };
	},
	addBarcode: async ({ request, params }) => {
		const code = String((await request.formData()).get('code') || '').trim();
		if (!code) return fail(400);
		try {
			addBarcode(id(params), code);
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	removeBarcode: async ({ request }) => {
		removeBarcode(String((await request.formData()).get('code')));
	},
	adjust: async ({ request, params }) => {
		const f = await request.formData();
		adjust(id(params), Number(f.get('location_id')), Number(f.get('delta')));
	},
	removeItem: async ({ request }) => {
		removeItem(Number((await request.formData()).get('item_id')));
	},
	merge: async ({ request, params }) => {
		const into = Number((await request.formData()).get('into'));
		if (!into) return fail(400);
		mergeProduct(id(params), into);
		redirect(303, `/product/${into}`);
	},
	delete: async ({ params }) => {
		deleteProduct(id(params));
		redirect(303, '/');
	}
};
