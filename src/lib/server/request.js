/*
 * What the reverse proxy tells us about a request: the real client address,
 * whether it came in over HTTPS, and whether a form post came from this site.
 *
 * The app is reached two ways: through the HTTPS reverse proxy, and directly
 * over plain HTTP on the LAN (the wall scanner, sometimes a phone). Forwarded
 * headers are only believed from a proxy: an address in TRUSTED_PROXIES, or
 * by default any private / loopback address (a proxy on the LAN or in Docker).
 */
import { env } from '$env/dynamic/private';
import { COOKIE, SESSION_DAYS } from './auth.js';

const PRIVATE = [
	/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./,
	/^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i
];
const bare = (ip) => String(ip ?? '').replace(/^::ffff:/, '').trim();
const trusted = (ip) => {
	const list = (env.TRUSTED_PROXIES ?? '').split(',').map((s) => bare(s)).filter(Boolean);
	return list.length ? list.includes(bare(ip)) : PRIVATE.some((re) => re.test(bare(ip)));
};

function peer(event) {
	try {
		return bare(event.getClientAddress());
	} catch {
		return '';
	}
}

/** The client's address: the proxy's X-Forwarded-For entry when it came through one. */
export function clientIp(event) {
	const p = peer(event);
	if (!trusted(p)) return p;
	// Walk X-Forwarded-For from the right (the entry our proxy added) past any
	// further trusted proxies; entries to the left are the client's to invent.
	const hops = (event.request.headers.get('x-forwarded-for') ?? '').split(',').map(bare).filter(Boolean);
	for (let i = hops.length - 1; i >= 0; i--) if (!trusted(hops[i]) || i === 0) return hops[i];
	return p;
}

/** Did the browser reach us over HTTPS? Decides the cookie's Secure flag. */
export function isHttps(event) {
	const h = event.request.headers;
	if (trusted(peer(event))) {
		const proto = (h.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
		if (proto) return proto === 'https';
	}
	// No proxy header: adapter-node fills url from ORIGIN, so compare hosts.
	if (env.ORIGIN?.startsWith('https:')) {
		try {
			return new URL(env.ORIGIN).host === h.get('host');
		} catch {}
	}
	return event.url.protocol === 'https:' && !env.ORIGIN;
}

/**
 * Cross-site request forgery: a POST from a browser must come from a page of
 * this site. Same host as the request (LAN), the public ORIGIN, or the host
 * the proxy says it was asked for.
 */
export function sameOrigin(event) {
	const h = event.request.headers;
	const origin = h.get('origin');
	if (!origin || origin === 'null') {
		// Browsers send Origin on every POST; Sec-Fetch-Site is the fallback.
		return h.get('sec-fetch-site') === 'same-origin';
	}
	let o;
	try {
		o = new URL(origin);
	} catch {
		return false;
	}
	if (env.ORIGIN && origin === new URL(env.ORIGIN).origin) return true;
	const hosts = [h.get('host')];
	if (trusted(peer(event))) hosts.push((h.get('x-forwarded-host') ?? '').split(',')[0].trim());
	return hosts.filter(Boolean).includes(o.host);
}

/** A redirect target after sign-in: only a path on this site. */
export function safeNext(next) {
	const s = String(next ?? '');
	return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') && !/[\r\n]/.test(s) ? s : '/';
}

/** Sets the session cookie: HttpOnly, SameSite=Lax, Secure over HTTPS. */
export function setSessionCookie(event, token) {
	event.cookies.set(COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isHttps(event),
		maxAge: SESSION_DAYS * 86400
	});
}
