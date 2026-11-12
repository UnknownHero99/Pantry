/**
 * Sign out: end the session on the server, then drop the pages the service
 * worker kept for offline use, so the stock list doesn't open signed out.
 */
export async function signOut() {
	try {
		await fetch('/logout', { method: 'POST', redirect: 'manual' });
	} catch {}
	try {
		for (const k of await caches.keys()) await caches.delete(k);
	} catch {}
	location.href = '/login';
}
