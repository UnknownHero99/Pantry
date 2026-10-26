import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import {
	product, updateProduct, deleteProduct, mergeProduct, barcodesFor, addBarcode, removeBarcode,
	itemsFor, removeItem, locations, adjust, onHand, relookup
} from '$lib/server/inventory.js';

function ago(ts) {
	const min = Math.floor((Date.now() - Date.parse(ts.replace(' ', 'T') + 'Z')) / 60000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	if (min < 48 * 60) return `${Math.floor(min / 60)} h ago`;
	return `${Math.floor(min / 1440)} days ago`;
}

export function load({ params }) {
	const p = product(Number(params.id));
	if (!p) error(404, 'No such product');
	return {
		product: p,
		barcodes: barcodesFor(p.id),
		items: itemsFor(p.id),
		stock: db.prepare('SELECT location_id, qty FROM stock WHERE product_id = ?').all(p.id),
		locations: locations(),
		others: db.prepare('SELECT id, name FROM products WHERE id != ? AND needs_review = 0 ORDER BY name COLLATE NOCASE').all(p.id),
		total: onHand(p.id),
		// For naming an unknown barcode: where and when it was first scanned,
		// and what's next in the inbox.
		seen: p.needs_review ? firstSeen(p.id) : null,
		nextToName: db.prepare('SELECT id FROM products WHERE needs_review = 1 AND id != ? ORDER BY created_at LIMIT 1').get(p.id)?.id ?? null,
		toName: db.prepare('SELECT COUNT(*) AS n FROM products WHERE needs_review = 1').get().n
	};
}

function firstSeen(id) {
	const e = db.prepare(
		`SELECT e.ts, e.device, l.name AS location FROM events e LEFT JOIN locations l ON l.id = e.location_id
		 WHERE e.product_id = ? ORDER BY e.id LIMIT 1`
	).get(id);
	return e ? { ago: ago(e.ts), device: e.device, location: e.location } : null;
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
	lookup: async ({ params }) => {
		if (!(await relookup(id(params)))) return fail(404, { notFound: true });
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
