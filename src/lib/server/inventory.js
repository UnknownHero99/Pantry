import { db, tx, IMG_DIR } from './db.js';
import { bus } from './bus.js';
import { lookup, saveImage } from './off.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scheduleHaSync } from './ha.js';
import { env } from '$env/dynamic/private';
import { parseItemCode, parseBoxCode, itemCode, amount, ago, daysUntil, shortDate } from '../format.js';

const q = (sql) => db.prepare(sql);

/** Products whose Open Food Facts lookup is still running in the background. */
const lookingUp = new Set();

/** Tell open PWAs to refresh and push both shopping lists to HA. */
function changed() {
	bus.emit('change');
	scheduleHaSync(() => {
		const all = shoppingList(null);
		return {
			groceries: all.filter((p) => p.list === 'groceries').map((p) => p.name),
			garage: all.filter((p) => p.list === 'garage').map((p) => p.name)
		};
	});
}

// ── storage tree ────────────────────────────────────────────────────────
// Locations form a tree: space › place › box … (docs/storage-design.md).
// Spaces are Pantry (home), Kitchen, Garage; stock always sits in a place or box.

/**
 * Every location, with its space, depth and path ("Garage › Shelf A › A·2 Power tools").
 * The tree is small, so it's rebuilt on each call.
 */
export function tree() {
	const rows = q('SELECT * FROM locations ORDER BY sort, name COLLATE NOCASE').all();
	const byId = new Map(rows.map((r) => [r.id, r]));
	const title = (n) => (n.kind === 'box' && n.code ? `${n.code} ${n.name}`.trim() : n.name);
	for (const r of rows) {
		const chain = [];
		for (let n = r; n && chain.length < 20; n = byId.get(n.parent_id)) chain.unshift(n);
		const top = chain[0];
		r.space_id = top.kind === 'space' ? top.id : null;
		r.space = top.name;
		r.list = top.list || 'groceries';
		r.home = !!top.is_home;
		r.depth = chain.length - 1;
		r.title = title(r);
		r.path = chain.map(title).join(' › ');
		r.order = chain.map((c) => `${String(c.sort).padStart(5, '0')} ${c.name.toLowerCase()}`).join('/');
	}
	// Space by space, then place by place: Pantry › Shelves, Pantry › Freezer, Kitchen › …
	return rows.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}

/** Places and boxes (not spaces), optionally only those feeding one shopping list. */
export function places(list) {
	return tree().filter((l) => l.kind !== 'space' && (!list || l.list === list));
}

export function spaces() {
	return tree().filter((l) => l.kind === 'space');
}

/** Kept for older callers: every place with its path. */
export function locations() {
	return places();
}

function firstPlace(spaceId) {
	return q("SELECT id FROM locations WHERE parent_id = ? AND kind = 'place' ORDER BY sort, name LIMIT 1").get(spaceId)?.id ?? null;
}

/** Where things go when nothing says otherwise: the home space's first place (Pantry › Shelves). */
export function homePlace() {
	const home = q('SELECT id FROM locations WHERE is_home = 1').get() ?? q("SELECT id FROM locations WHERE kind = 'space' ORDER BY sort LIMIT 1").get();
	return firstPlace(home?.id) ?? q("SELECT id FROM locations WHERE kind != 'space' ORDER BY sort LIMIT 1").get()?.id;
}

/**
 * Accepts an id, a path ("Kitchen › Freezer"), a space name (the wall scanner
 * sends "Pantry": that means the space's first place) or a place name
 * (an ambiguous "Freezer" prefers the home space). Never returns a space.
 */
export function resolveLocation(ref, product) {
	if (ref != null && ref !== '') {
		const s = String(ref).trim().toLowerCase();
		const all = tree();
		const hit = /^\d+$/.test(s)
			? all.find((l) => l.id === Number(s))
			: (all.find((l) => l.path.toLowerCase() === s) ??
				all.find((l) => l.kind === 'space' && l.name.toLowerCase() === s) ??
				all.filter((l) => l.kind !== 'space' && l.name.toLowerCase() === s).sort((a, b) => b.home - a.home)[0]);
		if (hit) return hit.kind === 'space' ? (firstPlace(hit.id) ?? homePlace()) : hit.id;
	}
	return product?.location_id ?? homePlace();
}

/** "Pantry › Freezer": how a place is named in replies, lists and History. */
export function placeLabel(id) {
	return id == null ? '' : (tree().find((l) => l.id === id)?.path ?? '');
}

/** New space, place or box. Boxes go inside a place; places inside a space or place. */
export function addLocation({ name, parent_id = null, kind = 'place', list = null, code = null }) {
	if (kind !== 'space' && !parent_id) throw new Error('Pick where it goes');
	// Unsorted sits at 999 so it stays last; new places go before it.
	const sort = q('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM locations WHERE parent_id IS ? AND sort < 900').get(parent_id).s;
	const { lastInsertRowid } = q('INSERT INTO locations (name, parent_id, kind, list, code, sort) VALUES (?, ?, ?, ?, ?, ?)')
		.run(name, parent_id, kind, kind === 'space' ? list || 'garage' : null, code, sort);
	changed();
	return Number(lastInsertRowid);
}

export function renameLocation(id, name, code) {
	if (code === undefined) q('UPDATE locations SET name = ? WHERE id = ?').run(name, id);
	else q('UPDATE locations SET name = ?, code = ? WHERE id = ?').run(name, code || null, id);
	changed();
}

/** Move a place or box (with everything in it) under another place. */
export function moveLocation(id, parentId) {
	const all = tree();
	const node = all.find((l) => l.id === id);
	const target = all.find((l) => l.id === parentId);
	if (!node || !target || node.kind === 'space') throw new Error('Can’t move that there');
	for (let t = target; t; t = all.find((l) => l.id === t.parent_id)) {
		if (t.id === id) throw new Error('Can’t move a box into itself');
	}
	tx(() => {
		q('UPDATE locations SET parent_id = ? WHERE id = ?').run(parentId, id);
		logEvent({ type: 'move', location_id: parentId, code: `box:${id}`, device: 'app' });
	});
	changed();
}

/** Ids of a location and everything inside it. */
function subtree(id) {
	const all = q('SELECT id, parent_id FROM locations').all();
	const out = [id];
	for (let i = 0; i < out.length; i++) for (const r of all) if (r.parent_id === out[i]) out.push(r.id);
	return out;
}

export function deleteLocation(id) {
	const loc = q('SELECT * FROM locations WHERE id = ?').get(id);
	if (!loc) return;
	if (loc.is_home) throw new Error('The home space can’t be deleted');
	const ids = subtree(id);
	const marks = ids.map(() => '?').join(',');
	const used =
		q(`SELECT 1 FROM stock WHERE location_id IN (${marks}) AND qty > 0`).get(...ids) ||
		q(`SELECT 1 FROM items WHERE location_id IN (${marks}) AND status = 'in'`).get(...ids);
	if (used) throw new Error(`${loc.name} still has things in it`);
	q('DELETE FROM locations WHERE id = ?').run(id);
	changed();
}

// ── products ────────────────────────────────────────────────────────────

export function product(id) {
	return q('SELECT * FROM products WHERE id = ?').get(id);
}

function productByBarcode(code) {
	return q('SELECT p.* FROM products p JOIN barcodes b ON b.product_id = p.id WHERE b.code = ?').get(code);
}

export function onHand(productId) {
	return (
		q('SELECT COALESCE(SUM(qty), 0) AS n FROM stock WHERE product_id = ?').get(productId).n +
		q("SELECT COUNT(*) AS n FROM items WHERE product_id = ? AND status = 'in'").get(productId).n
	);
}

function createProduct(fields) {
	const { lastInsertRowid } = q(
		`INSERT INTO products (name, brand, size, category, location_id, homemade, needs_review, unit, shelf_days, counted, fits)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		fields.name,
		fields.brand ?? null,
		fields.size ?? null,
		fields.category ?? null,
		fields.location_id ?? null,
		fields.homemade ? 1 : 0,
		fields.needs_review ? 1 : 0,
		fields.unit ?? (fields.homemade ? 'g' : 'pcs'),
		fields.shelf_days ?? null,
		fields.counted === false ? 0 : 1,
		fields.fits ?? null
	);
	return product(Number(lastInsertRowid));
}

export function newProduct(fields) {
	const p = createProduct(fields);
	changed();
	return p;
}

export function updateProduct(id, f) {
	q(
		`UPDATE products SET name = ?, brand = ?, size = ?, category = ?, location_id = ?, min_stock = ?,
		 shelf_days = ?, unit = ?, homemade = ?, needs_review = 0,
		 counted = COALESCE(?, counted), fits = COALESCE(?, fits) WHERE id = ?`
	).run(f.name, f.brand || null, f.size || null, f.category || null, f.location_id || null, f.min_stock || 0,
		f.shelf_days || null, f.unit || 'pcs', f.homemade ? 1 : 0,
		f.counted === undefined ? null : f.counted ? 1 : 0, f.fits === undefined ? null : f.fits, id);
	changed();
}

export function deleteProduct(id) {
	q('DELETE FROM products WHERE id = ?').run(id);
	changed();
}

export function barcodesFor(productId) {
	return q('SELECT code FROM barcodes WHERE product_id = ? ORDER BY code').all(productId).map((r) => r.code);
}

export function addBarcode(productId, code) {
	const other = productByBarcode(code);
	if (other && other.id !== productId) throw new Error(`Barcode already belongs to “${other.name}”`);
	q('INSERT OR IGNORE INTO barcodes (code, product_id) VALUES (?, ?)').run(code, productId);
	changed();
}

export function removeBarcode(code) {
	q('DELETE FROM barcodes WHERE code = ?').run(code);
	changed();
}

/**
 * Fold `fromId` into `intoId`: barcodes, stock, packages and history move over.
 * This is how an "Unknown 3830…" placeholder becomes a second barcode of a
 * product you already have (e.g. the same pasta in a different pack).
 */
export function mergeProduct(fromId, intoId) {
	if (fromId === intoId) return;
	tx(() => {
		q('UPDATE barcodes SET product_id = ? WHERE product_id = ?').run(intoId, fromId);
		for (const s of q('SELECT * FROM stock WHERE product_id = ?').all(fromId)) {
			addStock(intoId, s.location_id, s.qty);
		}
		q('UPDATE items SET product_id = ? WHERE product_id = ?').run(intoId, fromId);
		q('UPDATE events SET product_id = ? WHERE product_id = ?').run(intoId, fromId);
		q('DELETE FROM products WHERE id = ?').run(fromId);
	});
	changed();
}

/**
 * Retry Open Food Facts for an inbox placeholder — the first lookup may have
 * timed out rather than found nothing.
 */
export async function relookup(id) {
	const p = product(id);
	const code = barcodesFor(id)[0];
	if (!p || !code) return false;
	const info = await lookup(code);
	if (!info) return false;
	applyInfo(id, info);
	if (info.imageUrl) await fetchImage(id, info.imageUrl);
	changed();
	return true;
}

function applyInfo(id, info) {
	q('UPDATE products SET name = ?, brand = ?, size = ?, category = ?, needs_review = 0 WHERE id = ?')
		.run(info.name, info.brand, info.size, info.category, id);
}

async function fetchImage(id, url) {
	const path = await saveImage(id, url);
	if (path) {
		q('UPDATE products SET image = ? WHERE id = ?').run(path, id);
		bus.emit('change');
	}
}

/**
 * The wall unit's background lookup. It polls the scan meanwhile, so the photo
 * gets a few seconds' head start before the product counts as looked up.
 */
function lookupLater(id, code) {
	lookingUp.add(id);
	lookup(code)
		.then(async (info) => {
			if (!info) return;
			applyInfo(id, info);
			if (info.imageUrl) {
				await Promise.race([fetchImage(id, info.imageUrl), new Promise((r) => setTimeout(r, 5000))]);
			}
		})
		.finally(() => {
			lookingUp.delete(id);
			changed();
		});
}

// ── stock movements ─────────────────────────────────────────────────────

function addStock(productId, locationId, delta) {
	q(
		`INSERT INTO stock (product_id, location_id, qty) VALUES (?, ?, MAX(?, 0))
		 ON CONFLICT(product_id, location_id) DO UPDATE SET qty = MAX(qty + ?, 0)`
	).run(productId, locationId, delta, delta);
}

function logEvent(e) {
	return Number(q(
		'INSERT INTO events (type, product_id, item_id, location_id, delta, code, device) VALUES (?, ?, ?, ?, ?, ?, ?)'
	).run(e.type, e.product_id ?? null, e.item_id ?? null, e.location_id ?? null, e.delta ?? 0, e.code ?? null, e.device ?? null).lastInsertRowid);
}

/** Manual +/- from the inventory screen. */
export function adjust(productId, locationId, delta, device = 'app') {
	tx(() => {
		const before = q('SELECT qty FROM stock WHERE product_id = ? AND location_id = ?').get(productId, locationId)?.qty ?? 0;
		addStock(productId, locationId, delta);
		const real = Math.max(before + delta, 0) - before;
		if (real) logEvent({ type: 'adjust', product_id: productId, location_id: locationId, delta: real, device });
	});
	changed();
}

/** Pick which shelf an OUT scan takes from: the scanner's, then the product's home, then the fullest. */
function takeFrom(productId, preferred) {
	const rows = q('SELECT location_id, qty FROM stock WHERE product_id = ? AND qty > 0 ORDER BY qty DESC').all(productId);
	return (rows.find((r) => r.location_id === preferred) ?? rows[0])?.location_id ?? null;
}

function img(p) {
	return p?.image || '';
}

/**
 * The one entry point for every scan, from the wall unit or the phone.
 * The reply is shaped for the 4.3" display (see scanReply); the phone only
 * reads title, detail, status and count from it.
 *
 * `location` is an explicit choice (phone dropdown) and always wins.
 * `default_location` is where the device hangs (wall unit) — used only for
 * products that have no usual place yet, so milk scanned at the pantry wall
 * still lands in the fridge.
 *
 * `async_lookup`: the wall unit can't redraw while it waits for a reply, so it
 * asks for a new barcode's Open Food Facts lookup to run in the background and
 * polls GET /api/scan/<event_id> while the reply says status "lookup".
 */
export async function scan({ code, mode, device, location, default_location, async_lookup }) {
	code = String(code || '').trim();
	if (!code) return { status: 'error', title: 'Empty scan', detail: '', count: 0, image: '' };
	mode = mode === 'in' ? 'in' : 'out';

	const itemId = parseItemCode(code);
	if (itemId != null) return scanItem(itemId, mode, device, location);

	// A box label: nothing moves; the phone opens the box, the wall says so.
	const boxId = parseBoxCode(code);
	if (boxId != null) {
		const b = box(boxId);
		return b
			? { status: 'box', mode, title: b.title, detail: b.path, meta: b.path, box_id: b.id, count: 0, prev: 0, image: '', event_id: null }
			: { status: 'error', mode, title: 'Unknown box label', detail: `No box #${boxId}`, count: 0, image: '' };
	}

	let p = productByBarcode(code);
	let isNew = false;
	if (!p) {
		const background = mode === 'in' && !!async_lookup;
		const info = mode === 'in' && !background ? await lookup(code) : null;
		// Re-check: the lookup awaited, and a double scan may have created it meanwhile.
		p = productByBarcode(code);
		if (!p) {
			isNew = true;
			p = tx(() => {
				const created = createProduct({
					name: info?.name ?? `Unknown ${code}`,
					brand: info?.brand,
					size: info?.size,
					category: info?.category,
					location_id: mode === 'in' ? resolveLocation(location || default_location) : null,
					needs_review: !info
				});
				q('INSERT INTO barcodes (code, product_id) VALUES (?, ?)').run(code, created.id);
				return created;
			});
			if (background) lookupLater(p.id, code);
			else if (info?.imageUrl) fetchImage(p.id, info.imageUrl);
		}
	}

	const loc = location ? resolveLocation(location, p) : (p.location_id ?? resolveLocation(default_location));
	let eventId;
	if (mode === 'in') {
		tx(() => {
			addStock(p.id, loc, 1);
			eventId = logEvent({ type: 'in', product_id: p.id, location_id: loc, delta: 1, code, device });
		});
	} else {
		const from = takeFrom(p.id, loc);
		if (from == null) {
			// Still logged: an OUT with nothing on the shelf means the counts have drifted.
			// The shelf it would have come from is kept so the wall's "fix count" can use it.
			eventId = logEvent({ type: 'out', product_id: p.id, location_id: loc, delta: 0, code, device });
		} else {
			tx(() => {
				addStock(p.id, from, -1);
				eventId = logEvent({ type: 'out', product_id: p.id, location_id: from, delta: -1, code, device });
			});
		}
	}
	changed();
	return scanReply(eventId, { isNew });
}

function scanItem(id, mode, device, location) {
	const it = q('SELECT i.*, p.name, p.image FROM items i JOIN products p ON p.id = i.product_id WHERE i.id = ?').get(id);
	if (!it) return { status: 'error', mode, title: 'Unknown label', detail: `No package #${id}`, count: 0, image: '' };

	let eventId;
	if (mode === 'out') {
		if (it.status === 'in') {
			tx(() => {
				q("UPDATE items SET status = 'out', removed_at = datetime('now') WHERE id = ?").run(id);
				eventId = logEvent({ type: 'out', product_id: it.product_id, item_id: id, location_id: it.location_id, delta: -1, code: String(id), device });
			});
		}
	} else if (it.status !== 'in') {
		const loc = resolveLocation(location, { location_id: it.location_id });
		tx(() => {
			q("UPDATE items SET status = 'in', removed_at = NULL, location_id = ? WHERE id = ?").run(loc, id);
			eventId = logEvent({ type: 'in', product_id: it.product_id, item_id: id, location_id: loc, delta: 1, code: String(id), device });
		});
	}
	if (eventId == null) {
		// Nothing moved: scanning OUT a package that's already gone, or IN one that's already here.
		const count = onHand(it.product_id);
		return mode === 'out'
			? { status: 'empty', mode, title: it.name, detail: 'This package was already removed', count, prev: count, image: it.image || '', product_id: it.product_id, event_id: null }
			: { status: 'ok', mode, title: it.name, detail: 'Already in stock · ' + packageWhat(it), count, prev: count, image: it.image || '', product_id: it.product_id, event_id: null };
	}
	changed();
	return scanReply(eventId);
}

function packageWhat(it) {
	return [amount(it.amount, it.unit), `packed ${ago(it.packed_at)}`].filter(Boolean).join(' · ');
}

const locationName = placeLabel;

/**
 * Everything the wall display shows about one scan, rebuilt from its event so
 * the wall can poll it (background lookup) and get it back after −/+ or "fix count".
 *
 *   status   ok | lookup | unknown | empty (OUT found nothing: counts drifted)
 *   prev → count   on-hand before and after; units = how many this scan moved
 *   meta     "Barilla · 500 g · Pantry"
 *   last_one, on_list, list_count   "That was the last one" banner
 *   pkg, packed, use_by, use_by_days, left_text, older   home-made package card
 *   qr       link that opens the product on the phone, for naming unknowns
 */
export function scanReply(eventId, { isNew = false } = {}) {
	const e = q('SELECT * FROM events WHERE id = ?').get(eventId);
	const p = e && product(e.product_id);
	if (!p) return null;
	const mode = e.type === 'out' || e.delta < 0 ? 'out' : 'in';
	const count = onHand(p.id);
	const moved = e.undone ? 0 : e.delta;
	const location = locationName(e.location_id);
	const r = {
		status: 'ok', mode, title: p.name, detail: '', count, prev: count - moved, units: Math.abs(e.delta),
		image: img(p), product_id: p.id, event_id: e.id, code: e.code ?? '',
		meta: [p.brand?.toLowerCase() === p.name.toLowerCase() ? '' : p.brand, p.size, location].filter(Boolean).join(' · '), location,
		last_one: mode === 'out' && moved !== 0 && count === 0, on_list: p.min_stock > 0,
		list_count: 0, qr: '', pkg: '', packed: '', use_by: '', use_by_days: null, left_text: '', older: ''
	};
	if (r.last_one) r.list_count = shoppingList().length;

	if (lookingUp.has(p.id)) {
		return { ...r, status: 'lookup', title: 'Looking it up…', meta: '' };
	}
	if (p.needs_review) {
		r.status = 'unknown';
		r.title = 'Unknown item';
		r.detail = mode === 'in' ? 'Added to inbox — name it on your phone' : moved ? 'Removed — still needs a name' : 'Not in inventory — added to inbox';
		if (env.ORIGIN) r.qr = `${env.ORIGIN.replace(/\/$/, '')}/product/${p.id}`;
		return r;
	}
	if (mode === 'out' && e.delta === 0 && e.item_id == null) {
		return { ...r, status: 'empty', detail: 'None in stock — counts are off?' };
	}

	if (e.item_id != null) {
		const it = q('SELECT * FROM items WHERE id = ?').get(e.item_id);
		const what = packageWhat(it);
		r.detail = mode === 'out' ? what : 'Put back · ' + what;
		r.pkg = '#' + itemCode(it.id).slice(-6);
		r.meta = amount(it.amount, it.unit);
		r.packed = ago(it.packed_at);
		if (it.best_before) {
			const d = daysUntil(it.best_before);
			r.use_by_days = d;
			r.use_by = `${shortDate(it.best_before)} · ${d < 0 ? 'expired' : d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`}`;
		}
		const left = q(
			`SELECT COUNT(*) AS n, SUM(amount) AS a, COUNT(DISTINCT location_id) AS places, MIN(location_id) AS loc
			 FROM items WHERE product_id = ? AND status = 'in'`
		).get(p.id);
		r.left_text = [
			`left${left.places === 1 ? ' in ' + locationName(left.loc) : ''}`,
			left.a ? amount(left.a, it.unit) : ''
		].filter(Boolean).join(' · ');
		if (mode === 'out') {
			const older = q(
				`SELECT id, packed_at FROM items WHERE product_id = ? AND status = 'in' AND packed_at < ?
				 ORDER BY packed_at, id LIMIT 1`
			).get(p.id, it.packed_at);
			if (older) r.older = `#${itemCode(older.id).slice(-6)}, packed ${shortDate(older.packed_at)}`;
		}
		return r;
	}

	r.detail = mode === 'in' ? (isNew ? 'New product added' : 'Added') : 'Removed';
	return r;
}

/**
 * The wall's −/+ right after a scan: "bought six of these", "took two".
 * It changes that scan's own event, so UNDO still reverses all of it.
 */
export function bump(eventId, by) {
	const e = q('SELECT * FROM events WHERE id = ? AND undone = 0').get(eventId);
	if (!e || e.item_id != null || !e.delta || e.location_id == null || !['in', 'out'].includes(e.type)) return null;
	const sign = Math.sign(e.delta);
	const units = Math.abs(e.delta) + by;
	const shelf = q('SELECT qty FROM stock WHERE product_id = ? AND location_id = ?').get(e.product_id, e.location_id)?.qty ?? 0;
	// Can't scan fewer than one, or take more than the shelf has.
	if (units >= 1 && !(sign < 0 && by > 0 && shelf < by)) {
		tx(() => {
			addStock(e.product_id, e.location_id, sign * by);
			q('UPDATE events SET delta = ? WHERE id = ?').run(sign * units, e.id);
		});
		changed();
	}
	return scanReply(e.id);
}

/**
 * "It was there, fix count": an OUT that found nothing in stock really did
 * take one. Record the one we never knew about, and make the OUT a real one.
 */
export function fixDrift(eventId) {
	const e = q("SELECT * FROM events WHERE id = ? AND type = 'out' AND delta = 0 AND item_id IS NULL AND undone = 0").get(eventId);
	if (!e) return null;
	const loc = e.location_id ?? resolveLocation(null, product(e.product_id));
	tx(() => {
		logEvent({ type: 'adjust', product_id: e.product_id, location_id: loc, delta: 1, device: e.device });
		q('UPDATE events SET delta = -1, location_id = ? WHERE id = ?').run(loc, e.id);
	});
	changed();
	return scanReply(e.id);
}

// ── garage: things, moving, lending ───────────────────────────────────

/**
 * Add something by hand: the garage's "snap a photo, name it" flow. Counted
 * things get a quantity (and can have a minimum); located things just a place.
 */
export function addThing({ name, locationId, counted = false, qty = 1, category, fits, barcode }) {
	const p = tx(() => {
		const created = createProduct({ name, category, fits, location_id: locationId, counted, unit: 'pcs' });
		if (barcode) q('INSERT OR IGNORE INTO barcodes (code, product_id) VALUES (?, ?)').run(barcode, created.id);
		const n = counted ? Math.max(1, qty) : 1;
		addStock(created.id, locationId, n);
		logEvent({ type: 'in', product_id: created.id, location_id: locationId, delta: n, device: 'app' });
		return created;
	});
	changed();
	return p;
}

/** Save a photo taken on the phone (already shrunk to a JPEG there) as the product's image. */
export async function savePhoto(productId, jpeg) {
	await writeFile(join(IMG_DIR, `${productId}.jpg`), jpeg);
	// ?v= so phones don't keep showing an old photo from their cache.
	q('UPDATE products SET image = ? WHERE id = ?').run(`/img/${productId}.jpg?v=${Date.now()}`, productId);
	changed();
}

/**
 * Move a product from one place to another: its stock and packages there, and
 * for a located thing its usual place too. `from` null = from everywhere.
 */
export function moveProduct(productId, from, to) {
	const p = product(productId);
	if (!p || !to) return;
	tx(() => {
		const rows = q('SELECT location_id, qty FROM stock WHERE product_id = ? AND qty > 0').all(productId)
			.filter((r) => from == null || r.location_id === from);
		for (const r of rows) {
			if (r.location_id === to) continue;
			addStock(productId, r.location_id, -r.qty);
			addStock(productId, to, r.qty);
		}
		q(`UPDATE items SET location_id = ? WHERE product_id = ? AND status = 'in' ${from == null ? '' : 'AND location_id = ?'}`)
			.run(...[to, productId, ...(from == null ? [] : [from])]);
		if (!p.counted || from == null || p.location_id === from) q('UPDATE products SET location_id = ? WHERE id = ?').run(to, productId);
		logEvent({ type: 'move', product_id: productId, location_id: to, device: 'app' });
	});
	changed();
}

/** A located thing in use ("took the drill"), or back in its place. */
export function setInUse(productId, inUse) {
	q('UPDATE products SET taken_at = ? WHERE id = ?').run(inUse ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null, productId);
	logEvent({ type: inUse ? 'took' : 'back', product_id: productId, location_id: product(productId)?.location_id, device: 'app' });
	changed();
}

export function lend(productId, person, remindDays = 14) {
	tx(() => {
		q("UPDATE loans SET returned_at = datetime('now') WHERE product_id = ? AND returned_at IS NULL").run(productId);
		q('INSERT INTO loans (product_id, person, remind_days) VALUES (?, ?, ?)').run(productId, person, remindDays);
	});
	changed();
}

export function returned(productId) {
	q("UPDATE loans SET returned_at = datetime('now') WHERE product_id = ? AND returned_at IS NULL").run(productId);
	changed();
}

export function activeLoan(productId) {
	return q('SELECT * FROM loans WHERE product_id = ? AND returned_at IS NULL').get(productId) ?? null;
}

/** Lent out for longer than its reminder: what Home Assistant nags about. */
export function overdueLoans() {
	return q(
		`SELECT l.*, p.name FROM loans l JOIN products p ON p.id = l.product_id
		 WHERE l.returned_at IS NULL AND datetime(l.since, '+' || l.remind_days || ' days') <= datetime('now')
		 ORDER BY l.since`
	).all();
}

export function markReminded(loanId) {
	q("UPDATE loans SET reminded_at = datetime('now') WHERE id = ?").run(loanId);
}

// ── boxes ───────────────────────────────────────────────────────────────

/** A box with its place in the tree, or null. */
export function box(id) {
	const b = tree().find((l) => l.id === id && l.kind === 'box');
	return b ?? null;
}

/** What's in a box (or any place): products with how many are there. */
export function contents(locationId) {
	return inventory()
		.filter((p) => p.at[locationId])
		.map((p) => ({ ...p, here: p.at[locationId] }));
}

/** Next free box number on a shelf: A·1, A·2… from the shelf's first letter. */
export function nextBoxCode(placeId) {
	const place = q('SELECT name FROM locations WHERE id = ?').get(placeId);
	const letter = (place?.name.match(/\b([A-Z0-9])\b/)?.[1] ?? place?.name[0] ?? 'B').toUpperCase();
	const used = q("SELECT code FROM locations WHERE parent_id = ? AND kind = 'box'").all(placeId)
		.map((r) => Number(String(r.code).split('·')[1]) || 0);
	return `${letter}·${Math.max(0, ...used) + 1}`;
}

// ── home-made packages ──────────────────────────────────────────────────

/** Create `count` labelled packages at once — they're in stock straight away. */
export function pack({ productId, count, amount: amt, unit, locationId, bestBefore, note, packedAt }) {
	const ids = tx(() => {
		const ins = q(
			'INSERT INTO items (product_id, location_id, amount, unit, note, packed_at, best_before) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		const out = [];
		for (let i = 0; i < count; i++) {
			const id = Number(ins.run(productId, locationId, amt ?? null, unit ?? null, note || null, packedAt, bestBefore || null).lastInsertRowid);
			logEvent({ type: 'pack', product_id: productId, item_id: id, location_id: locationId, delta: 1, device: 'app' });
			out.push(id);
		}
		return out;
	});
	changed();
	return labelData(ids);
}

/** Everything the phone needs to draw a label for these packages. */
export function labelData(ids) {
	if (!ids.length) return [];
	return q(
		`SELECT i.id, i.amount, i.unit, i.note, i.packed_at, i.best_before, p.name, l.name AS location
		 FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN locations l ON l.id = i.location_id
		 WHERE i.id IN (${ids.map(() => '?').join(',')}) ORDER BY i.id`
	).all(...ids);
}

export function itemsFor(productId) {
	return q(
		`SELECT i.*, l.name AS location FROM items i LEFT JOIN locations l ON l.id = i.location_id
		 WHERE i.product_id = ? AND i.status = 'in' ORDER BY i.packed_at, i.id`
	).all(productId);
}

export function removeItem(id) {
	const it = q("SELECT * FROM items WHERE id = ? AND status = 'in'").get(id);
	if (!it) return;
	tx(() => {
		q("UPDATE items SET status = 'out', removed_at = datetime('now') WHERE id = ?").run(id);
		logEvent({ type: 'out', product_id: it.product_id, item_id: id, location_id: it.location_id, delta: -1, device: 'app' });
	});
	changed();
}

// ── undo / history ──────────────────────────────────────────────────────

export function undo(eventId) {
	const e = eventId
		? q('SELECT * FROM events WHERE id = ? AND undone = 0').get(eventId)
		: q('SELECT * FROM events WHERE undone = 0 AND delta != 0 ORDER BY id DESC LIMIT 1').get();
	if (!e) return null;
	tx(() => {
		if (e.item_id != null) {
			if (e.type === 'pack') q("UPDATE items SET status = 'void' WHERE id = ?").run(e.item_id);
			else if (e.delta < 0) q("UPDATE items SET status = 'in', removed_at = NULL WHERE id = ?").run(e.item_id);
			else if (e.delta > 0) q("UPDATE items SET status = 'out', removed_at = datetime('now') WHERE id = ?").run(e.item_id);
		} else if (e.delta && e.location_id != null) {
			addStock(e.product_id, e.location_id, -e.delta);
		}
		q('UPDATE events SET undone = 1 WHERE id = ?').run(e.id);
	});
	changed();
	const r = scanReply(e.id);
	if (!r) return { status: 'ok', mode: 'undo', title: 'Undone', detail: 'Undone', count: 0, prev: 0, image: '', product_id: e.product_id };
	// prev → count reads as the undo itself, e.g. "2 → 3" after undoing a take-out.
	return { ...r, status: 'ok', mode: 'undo', detail: 'Undone', prev: r.count + e.delta, last_one: false, event_id: null };
}

/**
 * The wall's UNDO list: this device's own scans from the last day that moved
 * stock and haven't been undone, newest first.
 */
export function recentScans(device, limit = 5) {
	return q(
		`SELECT e.id, e.delta, e.ts, e.item_id, e.code, p.name, p.needs_review FROM events e
		 JOIN products p ON p.id = e.product_id
		 WHERE e.device = ? AND e.undone = 0 AND e.delta != 0 AND e.type IN ('in', 'out')
		   AND e.ts >= datetime('now', '-1 day')
		 ORDER BY e.id DESC LIMIT ?`
	).all(device, limit).map((e) => {
		const min = Math.floor((Date.now() - Date.parse(e.ts.replace(' ', 'T') + 'Z')) / 60000);
		return {
			event_id: e.id,
			title: e.needs_review ? `New item ${e.code ?? ''}`.trim()
				: e.item_id != null ? `${e.name} #${itemCode(e.item_id).slice(-6)}` : e.name,
			unknown: !!e.needs_review,
			mode: e.delta > 0 ? 'in' : 'out',
			units: Math.abs(e.delta),
			ago: min < 1 ? 'just now' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h`
		};
	});
}

export function history(limit = 100) {
	const where = new Map(tree().map((l) => [l.id, l]));
	return q(
		`SELECT e.*, p.name, p.image, p.needs_review FROM events e
		 LEFT JOIN products p ON p.id = e.product_id
		 ORDER BY e.id DESC LIMIT ?`
	).all(limit).map((e) => {
		const box = /^box:(\d+)$/.exec(e.code || '');
		return {
			...e,
			location: where.get(e.location_id)?.path ?? '',
			// A moved box has no product: name it after the box.
			name: box ? `Box ${where.get(Number(box[1]))?.title ?? ''}`.trim() : e.name
		};
	});
}

// ── views ───────────────────────────────────────────────────────────────

/** Every product with its per-location counts. */
export function inventory() {
	const counts = q(
		`SELECT product_id, location_id, SUM(n) AS n FROM (
			SELECT product_id, location_id, qty AS n FROM stock WHERE qty > 0
			UNION ALL SELECT product_id, location_id, 1 FROM items WHERE status = 'in'
		 ) GROUP BY product_id, location_id`
	).all();
	const products = q('SELECT * FROM products ORDER BY name COLLATE NOCASE').all();
	const byProduct = new Map(products.map((p) => [p.id, { ...p, total: 0, at: {}, amount_total: 0 }]));
	for (const r of q("SELECT product_id, SUM(amount) AS a FROM items WHERE status = 'in' GROUP BY product_id").all()) {
		const p = byProduct.get(r.product_id);
		if (p) p.amount_total = r.a ?? 0;
	}
	for (const c of counts) {
		const p = byProduct.get(c.product_id);
		if (!p) continue;
		p.total += c.n;
		p.at[c.location_id ?? 0] = c.n;
	}
	const where = new Map(tree().map((l) => [l.id, l]));
	const loans = new Map(q('SELECT * FROM loans WHERE returned_at IS NULL').all().map((l) => [l.product_id, l]));
	for (const p of byProduct.values()) {
		// Which shopping list: the space of its usual place, else of wherever it is.
		const home = where.get(p.location_id) ?? where.get(Number(Object.keys(p.at)[0]));
		p.list = home?.list ?? 'groceries';
		p.loan = loans.get(p.id) ?? null;
	}
	return [...byProduct.values()];
}

/**
 * Below their minimum, for one list ('groceries' — Pantry and Kitchen — or
 * 'garage'), or both with `null`.
 */
export function shoppingList(list = 'groceries') {
	return inventory()
		.filter((p) => p.min_stock > 0 && p.total < p.min_stock && (!list || p.list === list))
		.map((p) => ({
			id: p.id, name: p.name, brand: p.brand, size: p.size, image: p.image, list: p.list,
			total: p.total, min: p.min_stock, need: p.min_stock - p.total
		}));
}

export function expiring(withinDays = 30) {
	const where = new Map(tree().map((l) => [l.id, l.path]));
	return q(
		`SELECT i.*, p.name FROM items i JOIN products p ON p.id = i.product_id
		 WHERE i.status = 'in' AND i.best_before IS NOT NULL AND i.best_before <= date('now', ?)
		 ORDER BY i.best_before`
	).all(`+${withinDays} days`).map((i) => ({ ...i, location: where.get(i.location_id) ?? '' }));
}

export function inbox() {
	return q(
		`SELECT p.*, (SELECT GROUP_CONCAT(code, ', ') FROM barcodes WHERE product_id = p.id) AS codes
		 FROM products p WHERE needs_review = 1 ORDER BY created_at DESC`
	).all();
}

/** Packages expiring soon, one entry per product and use-by date. */
function groupExpiring(items) {
	const groups = new Map();
	for (const i of items) {
		const key = `${i.name}\0${i.best_before}`;
		const g = groups.get(key) ?? { ...i, n: 0 };
		g.n++;
		groups.set(key, g);
	}
	return [...groups.values()].map((g) => ({ name: g.name, n: g.n, days: daysUntil(g.best_before) }));
}

/** Compact status for the wall display's idle screen and HA REST sensors. */
export function summary() {
	const low = shoppingList();
	const soon = expiring(30);
	const groups = groupExpiring(soon);
	return {
		low_count: low.length,
		low: low.map((p) => p.name).slice(0, 8),
		expiring_count: soon.length,
		expiring: groups
			.slice(0, 5)
			.map((g) => `${g.name}${g.n > 1 ? ` ×${g.n}` : ''} (${g.days < 0 ? 'expired' : g.days === 0 ? 'today' : g.days + 'd'})`),
		// The same, structured, for the wall's USE SOON tile.
		soon: groups.slice(0, 5),
		inbox_count: q('SELECT COUNT(*) AS n FROM products WHERE needs_review = 1').get().n,
		garage_low_count: shoppingList('garage').length,
		lent_out: q('SELECT COUNT(*) AS n FROM loans WHERE returned_at IS NULL').get().n,
		overdue: overdueLoans().map((l) => `${l.name} (${l.person})`)
	};
}
