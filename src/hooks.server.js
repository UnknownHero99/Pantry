import { env } from '$env/dynamic/private';
import { DATA_DIR } from '$lib/server/db.js';
import { haEnabled, notifyEnabled, notify } from '$lib/server/ha.js';
import { overdueLoans, markReminded } from '$lib/server/inventory.js';
import { redirect, error } from '@sveltejs/kit';
import { COOKIE, sessionUser, deviceFor, getSetupCode } from '$lib/server/auth.js';
import { sameOrigin, setSessionCookie } from '$lib/server/request.js';

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

// ── sign-in ─────────────────────────────────────────────────────────────
// Pages need a signed-in person (session cookie). /api/* and /img/* also take
// a device token (Authorization: Bearer …): the wall scanner, Home Assistant.
// Static files (/_app, /icons, /fonts, sw.js, the manifest) are public.

if (getSetupCode()) {
	console.log('[pantry] ─────────────────────────────────────────────────');
	console.log('[pantry] No users yet. Open /setup and enter this code to');
	console.log(`[pantry] create the first admin:  ${getSetupCode()}`);
	console.log('[pantry] ─────────────────────────────────────────────────');
}
if (!env.ORIGIN) console.warn('[pantry] ORIGIN is not set: set it to the public https:// address behind your proxy.');

const PUBLIC = ['/login', '/setup'];
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const isApi = (p) => p.startsWith('/api/') || p.startsWith('/img/');
const deny = (status, message) =>
	new Response(JSON.stringify({ status: 'error', message }), {
		status,
		headers: { 'Content-Type': 'application/json', ...(status === 401 ? { 'WWW-Authenticate': 'Bearer realm="pantry"' } : {}) }
	});

export async function handle({ event, resolve }) {
	const path = event.url.pathname;
	const { request, cookies, locals } = event;
	locals.user = null;
	locals.device = null;

	const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
	if (bearer) {
		// Devices only reach the API, and a wrong token is a plain 401.
		if (!isApi(path)) return deny(403, 'Device tokens only open /api/ and /img/');
		locals.device = deviceFor(bearer);
		if (!locals.device) return deny(401, 'Unknown device token');
	} else {
		if (!SAFE.has(request.method) && !sameOrigin(event)) return deny(403, 'Cross-site request refused');
		const s = sessionUser(cookies.get(COOKIE));
		if (s) {
			locals.user = { id: s.id, username: s.username, admin: s.admin };
			locals.sessionId = s.sessionId;
			if (s.renewed) setSessionCookie(event, cookies.get(COOKIE));
		} else if (cookies.get(COOKIE)) {
			cookies.delete(COOKIE, { path: '/' });
		}
	}

	if (!locals.user && !locals.device) {
		const setup = getSetupCode();
		if (isApi(path)) return deny(401, setup ? 'Pantry has no users yet: open /setup' : 'Sign in, or send a device token');
		if (setup && path !== '/setup') redirect(303, '/setup');
		if (!setup && path === '/setup') redirect(303, '/login');
		if (!PUBLIC.includes(path)) {
			const next = path + event.url.search;
			redirect(303, next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
		}
	}
	if (locals.user && PUBLIC.includes(path)) redirect(303, '/');
	if (path.startsWith('/users') && !locals.user?.admin) {
		if (locals.device) return deny(403, 'Admins only');
		error(403, 'Only an admin can manage users');
	}

	const res = await resolve(event);
	try {
		const h = res.headers;
		h.set('X-Content-Type-Options', 'nosniff');
		h.set('X-Frame-Options', 'DENY');
		h.set('Referrer-Policy', 'same-origin');
		h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
		// Someone's stock list isn't for shared caches.
		if (!h.has('Cache-Control')) h.set('Cache-Control', 'private, no-cache');
	} catch {
		// Some responses (e.g. ones passed through from fetch) are immutable.
	}
	return res;
}
