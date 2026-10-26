import { history, undo } from '$lib/server/inventory.js';

export function load() {
	return { events: history(150) };
}

export const actions = {
	undo: async ({ request }) => {
		undo(Number((await request.formData()).get('id')));
	}
};
