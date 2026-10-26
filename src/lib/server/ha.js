import { env } from '$env/dynamic/private';
import { getMeta, setMeta } from './db.js';

/**
 * Mirror the shopping lists into Home Assistant to-do lists: groceries (Pantry
 * and Kitchen) into HA_TODO_ENTITY, garage into HA_TODO_ENTITY_GARAGE.
 *
 * Only items this app added are ever removed, tracked in meta, so things you
 * put on a list by hand in HA are left alone. Ticking an item off in HA is
 * fine too — remove_item on a missing item just errors and is ignored.
 */
const LISTS = {
	groceries: { entity: () => env.HA_TODO_ENTITY, meta: 'ha_synced' },
	garage: { entity: () => env.HA_TODO_ENTITY_GARAGE, meta: 'ha_synced_garage' }
};

const connected = () => Boolean(env.HA_URL && env.HA_TOKEN);

/** Groceries sync is set up (what the shopping page and settings report). */
export function haEnabled(list = 'groceries') {
	return connected() && Boolean(LISTS[list].entity());
}

async function service(domain, name, body) {
	const res = await fetch(`${env.HA_URL.replace(/\/$/, '')}/api/services/${domain}/${name}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.HA_TOKEN}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(5000)
	});
	if (!res.ok) throw new Error(`HA ${domain}.${name} ${res.status}`);
}

let timer;
/** getLists() → { groceries: [names], garage: [names] } */
export function scheduleHaSync(getLists) {
	if (!connected()) return;
	clearTimeout(timer);
	timer = setTimeout(async () => {
		const lists = getLists();
		for (const [key, cfg] of Object.entries(LISTS)) {
			if (!cfg.entity()) continue;
			await sync(lists[key] ?? [], cfg.entity(), cfg.meta).catch((e) => console.warn(`[pantry] HA ${key} sync:`, e.message));
		}
	}, 3000);
}

async function sync(names, entity_id, metaKey) {
	// Saved even on failure, so a half-finished sync doesn't re-add duplicates.
	const synced = new Set(JSON.parse(getMeta(metaKey) || '[]'));
	try {
		for (const n of names) {
			if (synced.has(n)) continue;
			await service('todo', 'add_item', { entity_id, item: n });
			synced.add(n);
		}
		for (const n of [...synced]) {
			if (names.includes(n)) continue;
			await service('todo', 'remove_item', { entity_id, item: n }).catch(() => {});
			synced.delete(n);
		}
	} finally {
		setMeta(metaKey, JSON.stringify([...synced]));
	}
}

/** Phone notifications go through HA_NOTIFY, e.g. notify.mobile_app_pixel_8. */
export function notifyEnabled() {
	return connected() && /^notify\.\w+$/.test(env.HA_NOTIFY || '');
}

export async function notify(title, message) {
	if (!notifyEnabled()) return false;
	await service('notify', env.HA_NOTIFY.split('.')[1], { title, message });
	return true;
}
