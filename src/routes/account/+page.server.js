import { fail } from '@sveltejs/kit';
import { authenticate, checkPassword, setPassword, listSessions, endSessionOf, endOtherSessions, throttled, recordFailure } from '$lib/server/auth.js';
import { clientIp } from '$lib/server/request.js';

export function load({ locals }) {
	return {
		me: locals.user,
		sessions: listSessions(locals.user.id).map((s) => ({ ...s, current: s.id === locals.sessionId }))
	};
}

export const actions = {
	password: async (event) => {
		const { locals, request } = event;
		const f = await request.formData();
		const ip = clientIp(event);
		if (throttled(ip, locals.user.username)) return fail(429, { pwError: 'Too many tries. Wait a few minutes.' });
		if (!(await authenticate(locals.user.username, String(f.get('current') ?? '')))) {
			recordFailure(ip, locals.user.username);
			return fail(400, { pwError: 'Your current password is wrong' });
		}
		const pw = String(f.get('password') ?? '');
		const bad = checkPassword(pw) || (pw !== f.get('password2') ? "The new passwords don't match" : null);
		if (bad) return fail(400, { pwError: bad });
		await setPassword(locals.user.id, pw, locals.sessionId);
		return { pwDone: true };
	},
	end: async ({ locals, request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (id !== locals.sessionId) endSessionOf(locals.user.id, id);
	},
	endOthers: ({ locals }) => {
		endOtherSessions(locals.user.id, locals.sessionId);
	}
};
