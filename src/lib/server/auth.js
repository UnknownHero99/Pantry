/*
 * Users, sessions and device tokens.
 *
 * - People sign in with a username and password (scrypt). The browser gets an
 *   opaque random session id in an HttpOnly cookie; the database keeps only its
 *   SHA-256, so a copy of pantry.db can't be used to sign in.
 * - Devices (the wall scanner, Home Assistant) send `Authorization: Bearer <token>`.
 *   Tokens are made in Users & devices, shown once, stored hashed, and only open
 *   /api/* and /img/*, never the pages.
 * - The first account is made at /setup with a one-time code printed in the
 *   server log, so nobody who finds the site first can claim it.
 */
import { scrypt as scryptCb, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, tx } from './db.js';

const scrypt = promisify(scryptCb);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY,
	username TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password TEXT NOT NULL,
	is_admin INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,                     -- sha256 of the cookie value
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	seen_at TEXT NOT NULL DEFAULT (datetime('now')),
	expires_at TEXT NOT NULL,
	agent TEXT,
	ip TEXT
);
CREATE TABLE IF NOT EXISTS device_tokens (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	token TEXT NOT NULL UNIQUE,              -- sha256 of the token
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	used_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`);

export const COOKIE = 'pantry_session';
/** Sessions last 30 days from the last visit, so a phone stays signed in. */
export const SESSION_DAYS = 30;
export const MIN_PASSWORD = 6;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

// ── passwords ───────────────────────────────────────────────────────────
// scrypt, r=8, p=1. OWASP suggests N=2^17 (128 MB per sign-in); 2^16 (64 MB,
// ~0.1 s) is kinder to a small NAS. Each hash records its own parameters, so
// raising N later only affects new passwords. Stored as scrypt$N$r$p$salt$hash.
const N = 1 << 16, R = 8, P = 1, KEYLEN = 32;
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(pw) {
	const salt = randomBytes(16);
	const key = await scrypt(pw.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
	return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(pw, stored) {
	const [alg, n, r, p, salt, hash] = String(stored).split('$');
	if (alg !== 'scrypt') return false;
	const want = Buffer.from(hash, 'base64');
	const got = await scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, {
		N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2
	});
	return got.length === want.length && timingSafeEqual(got, want);
}

// A wrong username takes as long as a wrong password, so login doesn't say
// which usernames exist.
let dummy;
const DUMMY = () => (dummy ??= hashPassword(randomBytes(16).toString('hex')));

export function checkPassword(pw) {
	if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`;
	if (pw.length > 256) return 'That password is too long';
	return null;
}
/**
 * A username as typed, tidied: phone keyboards and autofill can add invisible
 * characters (zero-width spaces, a trailing non-breaking space) that look like
 * nothing but would fail the check, or fail to match at sign-in.
 */
export function cleanUsername(u) {
	return String(u ?? '').normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim().slice(0, 64);
}
export function checkUsername(u) {
	if (u.length < 2) return 'Usernames need at least 2 characters';
	if (u.length > 32) return 'Usernames can be at most 32 characters';
	const bad = [...new Set(u.match(/[^\p{L}\p{N}._-]/gu) ?? [])];
	if (bad.length) {
		const name = (c) => (c === ' ' ? 'spaces' : `"${c}"`);
		return `Usernames can't contain ${bad.map(name).join(' or ')}: use letters, digits, dots, dashes or underscores`;
	}
	return null;
}

// ── users ───────────────────────────────────────────────────────────────
export const userCount = () => db.prepare('SELECT count(*) AS n FROM users').get().n;
export const listUsers = () => db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY username').all();
const adminCount = () => db.prepare('SELECT count(*) AS n FROM users WHERE is_admin = 1').get().n;

export async function createUser(username, password, isAdmin = false) {
	const hash = await hashPassword(password);
	try {
		return Number(db.prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)').run(username, hash, isAdmin ? 1 : 0).lastInsertRowid);
	} catch (e) {
		if (/UNIQUE/.test(e.message)) throw new Error('That username is taken');
		throw e;
	}
}

/** The user for a username and password, or null. Always does one scrypt. */
export async function authenticate(username, password) {
	const u = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername(username));
	const ok = await verifyPassword(String(password), u?.password ?? (await DUMMY()));
	return ok && u ? u : null;
}

/** New password; signs out every other session of that user. */
export async function setPassword(userId, password, keepSessionId = null) {
	const hash = await hashPassword(password);
	tx(() => {
		db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
		db.prepare('DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?').run(userId, keepSessionId);
	});
}

export function setAdmin(userId, isAdmin) {
	return tx(() => {
		if (!isAdmin && adminCount() === 1 && db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId)?.is_admin) {
			throw new Error('Keep at least one admin');
		}
		db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, userId);
	});
}

export function deleteUser(userId) {
	return tx(() => {
		const u = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
		if (u?.is_admin && adminCount() === 1) throw new Error('Keep at least one admin');
		db.prepare('DELETE FROM users WHERE id = ?').run(userId);
	});
}

// ── sessions ────────────────────────────────────────────────────────────
/** Starts a session; returns the cookie value (never stored). */
export function createSession(userId, { agent, ip } = {}) {
	const token = randomBytes(32).toString('base64url');
	db.prepare('INSERT INTO sessions (id, user_id, expires_at, agent, ip) VALUES (?, ?, ?, ?, ?)').run(
		sha256(token), userId, sqlTime(Date.now() + SESSION_DAYS * 86400000), String(agent ?? '').slice(0, 200), ip ?? null
	);
	return token;
}

/**
 * The signed-in user for a cookie value, or null. Slides the expiry forward,
 * at most once an hour so every page view isn't a write.
 */
export function sessionUser(token) {
	if (!token || token.length > 100) return null;
	const id = sha256(token);
	const row = db.prepare(`
		SELECT s.id AS sid, s.expires_at, s.seen_at, u.id, u.username, u.is_admin
		FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(id);
	if (!row) return null;
	const now = Date.now();
	if (Date.parse(row.expires_at.replace(' ', 'T') + 'Z') < now) {
		db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
		return null;
	}
	if (now - Date.parse(row.seen_at.replace(' ', 'T') + 'Z') > 3600000) {
		db.prepare('UPDATE sessions SET seen_at = ?, expires_at = ? WHERE id = ?').run(sqlTime(now), sqlTime(now + SESSION_DAYS * 86400000), id);
		row.renewed = true;
	}
	return { id: row.id, username: row.username, admin: !!row.is_admin, sessionId: row.sid, renewed: !!row.renewed };
}

export const endSession = (sessionId) => db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
export const listSessions = (userId) =>
	db.prepare('SELECT id, created_at, seen_at, agent, ip FROM sessions WHERE user_id = ? ORDER BY seen_at DESC').all(userId);
export const endSessionOf = (userId, sessionId) => db.prepare('DELETE FROM sessions WHERE user_id = ? AND id = ?').run(userId, sessionId);
export const endOtherSessions = (userId, keep) => db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, keep);

const sweep = () => db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
sweep();
setInterval(sweep, 6 * 3600000).unref?.();

// ── device tokens ───────────────────────────────────────────────────────
/** Returns the token itself, once; only its hash is kept. */
export function createDeviceToken(name) {
	const token = 'pnt_' + randomBytes(32).toString('base64url');
	db.prepare('INSERT INTO device_tokens (name, token) VALUES (?, ?)').run(name, sha256(token));
	return token;
}
export const listDeviceTokens = () => db.prepare('SELECT id, name, created_at, used_at FROM device_tokens ORDER BY name').all();
export const deleteDeviceToken = (id) => db.prepare('DELETE FROM device_tokens WHERE id = ?').run(id);

/** The device for a bearer token, or null. */
export function deviceFor(token) {
	if (!token || token.length > 100) return null;
	const row = db.prepare('SELECT id, name, used_at FROM device_tokens WHERE token = ?').get(sha256(token));
	if (!row) return null;
	if (!row.used_at || Date.now() - Date.parse(row.used_at.replace(' ', 'T') + 'Z') > 3600000) {
		db.prepare("UPDATE device_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
	}
	return { id: row.id, name: row.name };
}

// ── first-run setup code ───────────────────────────────────────────────
let setupCode = null;
/** While there are no users: the code /setup asks for (printed to the log). */
export function getSetupCode() {
	if (userCount() > 0) return (setupCode = null);
	setupCode ??= randomBytes(9).toString('base64url');
	return setupCode;
}
export function checkSetupCode(code) {
	const want = getSetupCode();
	if (!want) return false;
	const a = Buffer.from(sha256(String(code).trim()));
	const b = Buffer.from(sha256(want));
	return timingSafeEqual(a, b);
}

// ── sign-in throttling ─────────────────────────────────────────────────
// In memory: failures per client address and per username in a sliding
// 15 minutes. Past the limit, sign-in is refused without checking the password.
const WINDOW = 15 * 60000;
const LIMITS = { ip: 10, user: 20 };
const fails = new Map(); // key → [timestamps]

function recent(key) {
	const now = Date.now();
	const list = (fails.get(key) ?? []).filter((t) => now - t < WINDOW);
	if (list.length) fails.set(key, list);
	else fails.delete(key);
	return list;
}
/** Seconds until this address / username may try again, or 0. */
export function throttled(ip, username) {
	const keys = [[`ip:${ip}`, LIMITS.ip], [`u:${String(username).toLowerCase()}`, LIMITS.user]];
	let wait = 0;
	for (const [k, max] of keys) {
		const list = recent(k);
		if (list.length >= max) wait = Math.max(wait, Math.ceil((list[0] + WINDOW - Date.now()) / 1000));
	}
	return wait;
}
export function recordFailure(ip, username) {
	for (const k of [`ip:${ip}`, `u:${String(username).toLowerCase()}`]) fails.set(k, [...recent(k), Date.now()]);
}
export function clearFailures(ip, username) {
	fails.delete(`ip:${ip}`);
	fails.delete(`u:${String(username).toLowerCase()}`);
}
setInterval(() => { for (const k of fails.keys()) recent(k); }, WINDOW).unref?.();
