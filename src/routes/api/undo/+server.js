import { json } from '@sveltejs/kit';
import { undo } from '$lib/server/inventory.js';

export async function POST({ request }) {
	const { event_id } = await request.json().catch(() => ({}));
	return json(undo(event_id) ?? { status: 'error', title: 'Nothing to undo', detail: '', count: 0, image: '' });
}
