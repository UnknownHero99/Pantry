import { error, fail, redirect } from '@sveltejs/kit';
import {
	tree, contents, addThing, savePhoto, setInUse, moveLocation, renameLocation, addLocation, nextBoxCode, deleteLocation
} from '$lib/server/inventory.js';

export function load({ params }) {
	const all = tree();
	const node = all.find((l) => l.id === Number(params.id));
	if (!node || node.kind === 'space') error(404, 'No such place');
	return {
		node,
		things: contents(node.id),
		inner: all.filter((l) => l.parent_id === node.id),
		// Where a box can move to: any place (not a space, not itself or inside it).
		targets: all.filter((l) => l.kind === 'place' && l.id !== node.id && !l.path.startsWith(node.path + ' ›'))
	};
}

const num = (v) => Number(v) || 0;

export const actions = {
	/** Fill-a-box: one thing, with an optional photo the phone already shrank to a JPEG. */
	putIn: async ({ request, params }) => {
		const f = await request.formData();
		const name = String(f.get('name') || '').trim();
		if (!name) return fail(400, { error: 'Give it a name' });
		const kind = String(f.get('kind') || '');
		const p = addThing({
			name,
			locationId: num(params.id),
			counted: f.get('counted') === '1',
			qty: num(f.get('qty')) || 1,
			category: { tool: 'Tool', spare: 'Spare part' }[kind] ?? null,
			fits: kind === 'spare' ? String(f.get('fits') || '').trim() || null : null,
			barcode: String(f.get('barcode') || '').trim() || null
		});
		const photo = String(f.get('photo') || '');
		const m = /^data:image\/jpeg;base64,(.+)$/.exec(photo);
		if (m) await savePhoto(p.id, Buffer.from(m[1], 'base64'));
		return { added: p.name };
	},
	took: async ({ request }) => setInUse(num((await request.formData()).get('id')), true),
	back: async ({ request }) => setInUse(num((await request.formData()).get('id')), false),
	move: async ({ request, params }) => {
		try {
			moveLocation(num(params.id), num((await request.formData()).get('to')));
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	rename: async ({ request, params }) => {
		const f = await request.formData();
		const name = String(f.get('name') || '').trim();
		if (!name && !f.get('code')) return fail(400);
		renameLocation(num(params.id), name, f.has('code') ? String(f.get('code')).trim() : undefined);
	},
	/** Several numbered boxes at once, so their labels print in one go. */
	addBoxes: async ({ request, params }) => {
		const n = Math.min(Math.max(num((await request.formData()).get('count')), 1), 20);
		const ids = [];
		for (let i = 0; i < n; i++) ids.push(addLocation({ name: '', parent_id: num(params.id), kind: 'box', code: nextBoxCode(num(params.id)) }));
		return { newBoxes: ids };
	},
	delete: async ({ params }) => {
		const node = tree().find((l) => l.id === num(params.id));
		try {
			deleteLocation(num(params.id));
		} catch (e) {
			return fail(400, { error: e.message });
		}
		const parent = tree().find((l) => l.id === node.parent_id);
		redirect(303, parent?.kind === 'space' ? `/?space=${parent.id}` : `/place/${node.parent_id}`);
	}
};
