import { fail, redirect } from '@sveltejs/kit';
import { checkSetupCode, checkUsername, checkPassword, createUser, createSession, userCount, throttled, recordFailure } from '$lib/server/auth.js';
import { clientIp, setSessionCookie } from '$lib/server/request.js';

/** First run: the first admin, with the one-time code from the server log. */
export const actions = {
	default: async (event) => {
		const f = await event.request.formData();
		const username = String(f.get('username') ?? '').trim();
		const password = String(f.get('password') ?? '');
		const ip = clientIp(event);

		const wait = throttled(ip, '(setup)');
		if (wait) return fail(429, { username, error: `Too many tries. Try again in ${Math.ceil(wait / 60)} min.` });
		if (userCount() > 0) redirect(303, '/login');
		if (!checkSetupCode(f.get('code'))) {
			recordFailure(ip, '(setup)');
			return fail(400, { username, error: 'That setup code is wrong. It is in the server log (docker logs pantry).' });
		}
		const bad = checkUsername(username) || checkPassword(password) || (password !== f.get('password2') ? "The passwords don't match" : null);
		if (bad) return fail(400, { username, error: bad });

		const id = await createUser(username, password, true);
		console.log(`[pantry] first admin "${username}" created from ${ip}`);
		setSessionCookie(event, createSession(id, { agent: event.request.headers.get('user-agent'), ip }));
		redirect(303, '/users');
	}
};
