import { env } from '$env/dynamic/private';
import { DATA_DIR } from '$lib/server/db.js';
import { haEnabled } from '$lib/server/ha.js';

console.log(`[pantry] data dir        : ${DATA_DIR}`);
console.log(`[pantry] HA shopping sync : ${haEnabled() ? `${env.HA_URL} → ${env.HA_TODO_ENTITY}` : 'off'}`);

export async function handle({ event, resolve }) {
	return resolve(event);
}
