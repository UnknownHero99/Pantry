import { redirect } from '@sveltejs/kit';

/** A box label scanned with any phone's camera: open the box. */
export function load({ params }) {
	redirect(307, `/place/${Number(params.id)}`);
}
