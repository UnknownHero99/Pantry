import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';

export const DATA_DIR = env.DATA_DIR || 'data';
export const IMG_DIR = join(DATA_DIR, 'img');
mkdirSync(IMG_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'pantry.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

/*
 * Two ways a product can be in stock:
 *  - store-bought: counted in `stock` (product × location → qty), identified by
 *    its EAN in `barcodes`. Packs of the same product are interchangeable.
 *  - home-made: every package is a row in `items` with its own printed QR
 *    label, because each one has its own weight and packed date.
 * A product's on-hand count is stock.qty + active items.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS locations (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	brand TEXT,
	image TEXT,
	category TEXT,
	location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
	min_stock INTEGER NOT NULL DEFAULT 0,
	shelf_days INTEGER,
	unit TEXT NOT NULL DEFAULT 'g',
	homemade INTEGER NOT NULL DEFAULT 0,
	needs_review INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS barcodes (
	code TEXT PRIMARY KEY,
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stock (
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
	qty INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (product_id, location_id)
);
CREATE TABLE IF NOT EXISTS items (
	id INTEGER PRIMARY KEY,
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
	amount REAL,
	unit TEXT,
	note TEXT,
	packed_at TEXT NOT NULL,
	best_before TEXT,
	status TEXT NOT NULL DEFAULT 'in',
	removed_at TEXT
);
CREATE TABLE IF NOT EXISTS events (
	id INTEGER PRIMARY KEY,
	ts TEXT NOT NULL DEFAULT (datetime('now')),
	type TEXT NOT NULL,
	product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
	item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
	location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
	delta INTEGER NOT NULL DEFAULT 0,
	code TEXT,
	device TEXT,
	undone INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS items_active ON items(product_id) WHERE status = 'in';
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
`);

// Added after v1: pack size from Open Food Facts ("500 g"), shown on the wall display.
if (!db.prepare("SELECT 1 FROM pragma_table_info('products') WHERE name = 'size'").get()) {
	db.exec('ALTER TABLE products ADD COLUMN size TEXT');
}

if (!db.prepare('SELECT 1 FROM locations LIMIT 1').get()) {
	const add = db.prepare('INSERT INTO locations (name, sort) VALUES (?, ?)');
	['Pantry', 'Fridge', 'Freezer'].forEach((n, i) => add.run(n, i));
}

/** Run fn inside a transaction; node:sqlite has no helper for this. */
export function tx(fn) {
	db.exec('BEGIN');
	try {
		const out = fn();
		db.exec('COMMIT');
		return out;
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

export function getMeta(key) {
	return db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value;
}
export function setMeta(key, value) {
	db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
