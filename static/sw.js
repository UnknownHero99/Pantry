/* Service worker.
 *
 * Pages and their data are network-first with a cached fallback, so the last
 * stock list and shopping list still open in a shop with no signal. Writes are
 * never faked here — the scan screen queues offline scans itself and replays
 * them, which keeps the "it's queued" state visible to you.
 */

const CACHE = 'pantry-v1';
const ASSETS = ['/icons/app-192.png', '/icons/app-512.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
	self.clients.claim();
});

function put(req, res) {
	if (res.ok) {
		const copy = res.clone();
		caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
	}
	return res;
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== 'GET' || url.origin !== location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	if (url.pathname.startsWith('/_app/immutable/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/img/')) {
		event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
		return;
	}

	// Pages + SvelteKit's __data.json: fresh when online, last copy when not.
	event.respondWith(
		fetch(req)
			.then((res) => put(req, res))
			.catch(() => caches.match(req).then((hit) => hit || Response.error()))
	);
});
