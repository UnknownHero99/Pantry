<script>
	import { enhance } from '$app/forms';
	import { signOut } from '$lib/signout.js';

	let { data, form } = $props();

	// "Mozilla/5.0 (Linux; Android 14; Pixel 8) … Chrome/131…" → "Chrome · Android"
	function device(ua = '') {
		const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
		const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
		return os ? `${browser} · ${os}` : browser;
	}
	const when = (ts) => new Date(ts.replace(' ', 'T') + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Account · Pantry</title></svelte:head>

<a class="back" href="/more">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
	More
</a>
<h1 class="page">{data.me.username}</h1>
<p class="lede">{data.me.admin ? 'Admin' : 'Member'}{#if data.me.admin} · <a href="/users">Users &amp; devices</a>{/if}</p>

<section class="card">
	<h2>Change password</h2>
	<div class="sub">Signs you out everywhere else.</div>
	<form method="POST" action="?/password" use:enhance>
		<input type="text" name="username" value={data.me.username} autocomplete="username" hidden />
		<label class="lbl" for="current">Current password</label>
		<input id="current" name="current" type="password" autocomplete="current-password" required />
		<label class="lbl" for="password">New password <span class="hint">6+ characters</span></label>
		<input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required />
		<label class="lbl" for="password2">New password again</label>
		<input id="password2" name="password2" type="password" autocomplete="new-password" minlength="6" required />
		{#if form?.pwError}<p class="note bad" role="alert">{form.pwError}</p>{/if}
		{#if form?.pwDone}<p class="note good">Password changed.</p>{/if}
		<button style="margin-top: 14px">Change password</button>
	</form>
</section>

<section class="card">
	<h2>Signed in on</h2>
	<div class="sub">Sessions last 30 days from the last visit.</div>
	<div class="rows">
		{#each data.sessions as s (s.id)}
			<div class="line" style="align-items: center; border-bottom: 1px solid var(--surface-2); padding: 8px 0">
				<span>
					<b>{device(s.agent ?? '')}</b>{#if s.current} <span class="muted">· this device</span>{/if}
					<div class="muted" style="font-size: 13px">{s.ip ?? ''} · last seen {when(s.seen_at)}</div>
				</span>
				{#if !s.current}
					<form method="POST" action="?/end" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						<button class="ghost" style="width: auto; min-height: 40px">Sign out</button>
					</form>
				{/if}
			</div>
		{/each}
	</div>
	<div class="actions">
		{#if data.sessions.length > 1}
			<form method="POST" action="?/endOthers" use:enhance><button class="ghost">Sign out others</button></form>
		{/if}
		<button class="danger" onclick={signOut}>Sign out</button>
	</div>
</section>

<style>
	/* Fields sit on a card, so they take the next surface up (as in Settings). */
	input { background: var(--surface-2); }
</style>
