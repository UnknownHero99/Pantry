import { env } from '$env/dynamic/private';
import { getMeta, setMeta } from './db.js';

/**
 * Mirror the shopping list into a Home Assistant to-do list.
 *
 * Only items this app added are ever removed, tracked in meta.ha_synced, so
 * things you put on the list by hand in HA are left alone. Ticking an item off
 * in HA is fine too — remove_item on a missing item just errors and is ignored.
 */
export function haEnabled() {
	return Boolean(env.HA_URL && env.HA_TOKEN && env.HA_TODO_ENTITY);
}

async function call(service, item) {
	const res = await fetch(`${env.HA_URL.replace(/\/$/, '')}/api/services/todo/${service}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.HA_TOKEN}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ entity_id: env.HA_TODO_ENTITY, item }),
		signal: AbortSignal.timeout(5000)
	});
	if (!res.ok) throw new Error(`HA ${service} ${res.status}`);
}

let timer;
export function scheduleHaSync(getNames) {
	if (!haEnabled()) return;
	clearTimeout(timer);
	timer = setTimeout(() => sync(getNames()).catch((e) => console.warn('[pantry] HA sync:', e.message)), 3000);
}

async function sync(names) {
	// Saved even on failure, so a half-finished sync doesn't re-add duplicates.
	const synced = new Set(JSON.parse(getMeta('ha_synced') || '[]'));
	try {
		for (const n of names) {
			if (synced.has(n)) continue;
			await call('add_item', n);
			synced.add(n);
		}
		for (const n of [...synced]) {
			if (names.includes(n)) continue;
			await call('remove_item', n).catch(() => {});
			synced.delete(n);
		}
	} finally {
		setMeta('ha_synced', JSON.stringify([...synced]));
	}
}
