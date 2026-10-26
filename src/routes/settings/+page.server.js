import { fail } from '@sveltejs/kit';
import { tree, addLocation, renameLocation, deleteLocation } from '$lib/server/inventory.js';
import { haEnabled, notifyEnabled } from '$lib/server/ha.js';

export function load() {
	return {
		// Spaces and places; boxes are managed on their shelf's page.
		tree: tree().filter((l) => l.kind !== 'box'),
		ha: haEnabled(),
		haGarage: haEnabled('garage'),
		haNotify: notifyEnabled()
	};
}

const name = (f) => String(f.get('name') || '').trim();

export const actions = {
	addSpace: async ({ request }) => {
		const f = await request.formData();
		if (!name(f)) return fail(400, { error: 'Name the space' });
		addLocation({ name: name(f), kind: 'space', list: f.get('list') === 'groceries' ? 'groceries' : 'garage' });
	},
	addPlace: async ({ request }) => {
		const f = await request.formData();
		if (!name(f)) return fail(400, { error: 'Name the place' });
		try {
			addLocation({ name: name(f), parent_id: Number(f.get('parent_id')) });
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	rename: async ({ request }) => {
		const f = await request.formData();
		if (name(f)) renameLocation(Number(f.get('id')), name(f));
	},
	delete: async ({ request }) => {
		try {
			deleteLocation(Number((await request.formData()).get('id')));
		} catch (e) {
			return fail(400, { error: e.message });
		}
	}
};
