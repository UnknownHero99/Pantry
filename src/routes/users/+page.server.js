import { error, fail } from '@sveltejs/kit';
import {
	listUsers, createUser, setPassword, setAdmin, deleteUser, checkUsername, checkPassword,
	listDeviceTokens, createDeviceToken, deleteDeviceToken
} from '$lib/server/auth.js';

// The hook already turns non-admins away; this is the second lock.
const admin = (locals) => {
	if (!locals.user?.admin) error(403, 'Only an admin can manage users');
};

export function load({ locals }) {
	admin(locals);
	return { me: locals.user, users: listUsers(), devices: listDeviceTokens() };
}

export const actions = {
	add: async ({ locals, request }) => {
		admin(locals);
		const f = await request.formData();
		const username = String(f.get('username') ?? '').trim();
		const password = String(f.get('password') ?? '');
		const bad = checkUsername(username) || checkPassword(password);
		if (bad) return fail(400, { userError: bad, username });
		try {
			await createUser(username, password, f.get('admin') === 'on');
		} catch (e) {
			return fail(400, { userError: e.message, username });
		}
		return { userDone: `${username} can sign in now.` };
	},
	reset: async ({ locals, request }) => {
		admin(locals);
		const f = await request.formData();
		const id = Number(f.get('id'));
		const password = String(f.get('password') ?? '');
		const bad = checkPassword(password);
		if (bad) return fail(400, { rowError: bad, rowId: id });
		await setPassword(id, password, id === locals.user.id ? locals.sessionId : null);
		return { rowDone: 'Password set; signed out on their devices.', rowId: id };
	},
	role: async ({ locals, request }) => {
		admin(locals);
		const f = await request.formData();
		try {
			setAdmin(Number(f.get('id')), f.get('admin') === '1');
		} catch (e) {
			return fail(400, { rowError: e.message, rowId: Number(f.get('id')) });
		}
	},
	remove: async ({ locals, request }) => {
		admin(locals);
		const id = Number((await request.formData()).get('id'));
		if (id === locals.user.id) return fail(400, { rowError: "You can't remove yourself", rowId: id });
		try {
			deleteUser(id);
		} catch (e) {
			return fail(400, { rowError: e.message, rowId: id });
		}
	},
	addDevice: async ({ locals, request }) => {
		admin(locals);
		const name = String((await request.formData()).get('name') ?? '').trim().slice(0, 60);
		if (!name) return fail(400, { deviceError: 'Name the device, e.g. Wall scanner' });
		return { token: createDeviceToken(name), tokenName: name };
	},
	removeDevice: async ({ locals, request }) => {
		admin(locals);
		deleteDeviceToken(Number((await request.formData()).get('id')));
	}
};
