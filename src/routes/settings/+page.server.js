import { fail } from '@sveltejs/kit';
import { locations, addLocation, renameLocation, deleteLocation } from '$lib/server/inventory.js';
import { haEnabled } from '$lib/server/ha.js';

export function load() {
	return { locations: locations(), ha: haEnabled() };
}

export const actions = {
	add: async ({ request }) => {
		const name = String((await request.formData()).get('name') || '').trim();
		if (!name) return fail(400);
		try {
			addLocation(name);
		} catch {
			return fail(400, { error: `“${name}” already exists` });
		}
	},
	rename: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') || '').trim();
		if (name) renameLocation(Number(f.get('id')), name);
	},
	delete: async ({ request }) => {
		try {
			deleteLocation(Number((await request.formData()).get('id')));
		} catch (e) {
			return fail(400, { error: e.message });
		}
	}
};
