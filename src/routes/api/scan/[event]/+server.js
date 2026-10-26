import { error, json } from '@sveltejs/kit';
import { scanReply } from '$lib/server/inventory.js';

/** The wall polls this while a new barcode is being looked up (status "lookup"). */
export function GET({ params }) {
	const r = scanReply(Number(params.event));
	if (!r) error(404, 'No such scan');
	return json(r);
}
