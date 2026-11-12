import { fail, redirect } from '@sveltejs/kit';
import { authenticate, cleanUsername, createSession, throttled, recordFailure, clearFailures } from '$lib/server/auth.js';
import { clientIp, safeNext, setSessionCookie } from '$lib/server/request.js';

export function load({ url }) {
	return { next: safeNext(url.searchParams.get('next')) };
}

export const actions = {
	default: async (event) => {
		const f = await event.request.formData();
		const username = cleanUsername(f.get('username'));
		const password = String(f.get('password') ?? '').slice(0, 256);
		const ip = clientIp(event);

		const wait = throttled(ip, username);
		if (wait) return fail(429, { username, error: `Too many tries. Try again in ${Math.ceil(wait / 60)} min.` });

		const user = username && password ? await authenticate(username, password) : null;
		if (!user) {
			recordFailure(ip, username);
			console.warn(`[pantry] failed sign-in for "${username}" from ${ip}`);
			return fail(400, { username, error: 'Wrong username or password' });
		}
		clearFailures(ip, username);
		setSessionCookie(event, createSession(user.id, { agent: event.request.headers.get('user-agent'), ip }));
		redirect(303, safeNext(f.get('next')));
	}
};
