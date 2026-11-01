import * as off from './off.js';
import * as vkj from './vkj.js';

/**
 * Name a new barcode. Open Food Facts and Veš kaj ješ are asked at the same
 * time, so this takes no longer than the slower of the two (both time out
 * at 6 s). Open Food Facts brings the photo, size and category; Veš kaj ješ
 * knows more Slovenian products and names them in Slovenian, so its name and
 * brand win unless Open Food Facts has a Slovenian name of its own. Returns
 * null when neither knows it.
 */
export async function lookup(code) {
	const [o, v] = await Promise.all([off.lookup(code), vkj.lookup(code)]);
	if (!o) return v && { ...v, size: null, category: null, imageUrl: null };
	const { slovenian, ...info } = o;
	return v && !slovenian ? { ...info, name: v.name, brand: v.brand ?? info.brand } : info;
}
