import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IMG_DIR } from '$lib/server/db.js';

export async function GET({ params }) {
	if (!/^\d+\.jpg$/.test(params.file)) error(404);
	try {
		const data = await readFile(join(IMG_DIR, params.file));
		// Content-Length, not chunked: the wall scanner's image downloader needs the size
		// up front to know when the photo is complete, or it never shows it.
		return new Response(data, {
			headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(data.length), 'Cache-Control': 'private, max-age=86400' }
		});
	} catch {
		error(404);
	}
}
