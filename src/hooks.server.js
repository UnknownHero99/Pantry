import { env } from '$env/dynamic/private';
import { DATA_DIR } from '$lib/server/db.js';
import { haEnabled, notifyEnabled, notify } from '$lib/server/ha.js';
import { overdueLoans, markReminded } from '$lib/server/inventory.js';

console.log(`[pantry] data dir        : ${DATA_DIR}`);
console.log(`[pantry] HA groceries    : ${haEnabled() ? `${env.HA_URL} → ${env.HA_TODO_ENTITY}` : 'off'}`);
console.log(`[pantry] HA garage list  : ${haEnabled('garage') ? env.HA_TODO_ENTITY_GARAGE : 'off'}`);
console.log(`[pantry] HA reminders    : ${notifyEnabled() ? env.HA_NOTIFY : 'off'}`);

/**
 * "Lent to…" reminders: once a loan is past its reminder, send a phone
 * notification through Home Assistant, then again weekly until it's back.
 */
async function remindLoans() {
	if (!notifyEnabled()) return;
	const week = 7 * 86400000;
	for (const l of overdueLoans()) {
		if (l.reminded_at && Date.now() - Date.parse(l.reminded_at.replace(' ', 'T') + 'Z') < week) continue;
		const days = Math.floor((Date.now() - Date.parse(l.since.replace(' ', 'T') + 'Z')) / 86400000);
		try {
			await notify('Lent out', `${l.name} has been with ${l.person} for ${days} days.`);
			markReminded(l.id);
		} catch (e) {
			console.warn('[pantry] loan reminder:', e.message);
		}
	}
}
setInterval(remindLoans, 60 * 60 * 1000).unref?.();
setTimeout(remindLoans, 30 * 1000).unref?.();

export async function handle({ event, resolve }) {
	return resolve(event);
}
