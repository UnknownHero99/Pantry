import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IMG_DIR } from './db.js';

const UA = 'Pantry/0.1 (self-hosted home inventory)';

/**
 * Look a barcode up on Open Food Facts. Returns null when it's unknown or the
 * lookup fails — a scan must never block on the internet, so the caller falls
 * back to an "Unknown …" placeholder that lands in the inbox.
 */
export async function lookup(code) {
	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,product_name_sl,brands,quantity,categories,image_front_small_url,image_front_url`,
			{ headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) }
		);
		if (!res.ok) return null;
		const { status, product: p } = await res.json();
		if (status !== 1 || !p) return null;
		const name = p.product_name_sl || p.product_name || p.product_name_en;
		if (!name) return null;
		return {
			name: name.trim(),
			brand: p.brands?.split(',')[0]?.trim() || null,
			// Drop the EU estimated-quantity mark: "400 g e" / "400 g ℮".
			size: p.quantity?.replace(/\s*[e℮]$/, '').trim() || null,
			// The last (most specific) category, without a language tag like "fr:".
			category: p.categories?.split(',').at(-1)?.trim().replace(/^[a-z]{2}:/, '') || null,
			imageUrl: p.image_front_small_url || p.image_front_url || null
		};
	} catch {
		return null;
	}
}

/**
 * Keep a local copy of the product photo. The wall scanner sits on the IoT
 * VLAN without internet, so it can only show images this server hosts.
 */
export async function saveImage(productId, url) {
	try {
		// Generous: this runs after the scan has already answered.
		const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
		if (!res.ok) return null;
		await writeFile(join(IMG_DIR, `${productId}.jpg`), Buffer.from(await res.arrayBuffer()));
		return `/img/${productId}.jpg`;
	} catch {
		return null;
	}
}
