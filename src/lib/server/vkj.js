const UA = 'Pantry/0.1 (self-hosted home inventory)';

/**
 * Look a barcode up in Veš, kaj ješ? (veskajjes.si), the Consumers' Association
 * of Slovenia's food database: ~50,000 products from Slovenian shelves, named in
 * Slovenian. ZPS allowed us to use it. There's no API: its web search takes an
 * exact barcode and renders one product page, so this reads the HTML. It has no
 * photo, size or category — off.js supplies those. Returns null when it's
 * unknown or the lookup fails.
 */
export async function lookup(code) {
	try {
		const res = await fetch(
			`https://veskajjes.si/component/finder/search?q=${encodeURIComponent(code)}`,
			{ headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) }
		);
		if (!res.ok) return null;
		const html = await res.text();
		// "Blagovna znamka, ime" is "Brand, description…, MANUFACTURER":
		// "Mu, Jogurt, islandski tip, skyr, LJUBLJANSKE MLEKARNE".
		const m = html.match(/Blagovna znamka, ime:<\/td>[\s\S]*?<td class="fieldvalue"><b>([^<]*)<\/b>/);
		if (!m) return null;
		const parts = decode(m[1]).split(',').map((s) => s.trim()).filter(Boolean);
		// The manufacturer, when it's there, is the all-caps tail — itself sometimes
		// with commas: "ATLANTIC TRADE D.O.O., LJUBLJANA".
		while (parts.length > 2 && /\p{Lu}/u.test(parts.at(-1)) && parts.at(-1) === parts.at(-1).toUpperCase()) parts.pop();
		if (!parts.length) return null;
		return parts.length === 1
			? { name: parts[0], brand: null }
			: { name: parts.slice(1).join(', '), brand: parts[0] };
	} catch {
		return null;
	}
}

function decode(s) {
	return s
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}
