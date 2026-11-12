import { redirect } from '@sveltejs/kit';
import { COOKIE, endSession } from '$lib/server/auth.js';

/** POST only, so a link or an image on another site can't sign you out. */
export function POST({ locals, cookies }) {
	if (locals.sessionId) endSession(locals.sessionId);
	cookies.delete(COOKIE, { path: '/' });
	redirect(303, '/login');
}
