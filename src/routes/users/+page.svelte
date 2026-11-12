<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let copied = $state(false);
	const day = (ts) => (ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString([], { dateStyle: 'medium' }) : 'never');
	async function copy() {
		try {
			await navigator.clipboard.writeText(form.token);
			copied = true;
		} catch {}
	}
	const confirmIt = (msg) => (e) => {
		if (!confirm(msg)) e.preventDefault();
	};
</script>

<svelte:head><title>Users & devices · Pantry</title></svelte:head>

<a class="back" href="/more">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
	More
</a>
<h1 class="page">Users &amp; devices</h1>

<section class="card">
	<h2>People</h2>
	<div class="sub">Everyone sees and changes the same stock. Admins also manage this page.</div>
	{#each data.users as u (u.id)}
		<details class="user">
			<summary class="line">
				<span><b>{u.username}</b>{#if u.id === data.me.id} <span class="muted">· you</span>{/if}</span>
				<span class="muted">{u.is_admin ? 'Admin' : 'Member'}</span>
			</summary>
			<form method="POST" action="?/reset" use:enhance class="actions">
				<input type="hidden" name="id" value={u.id} />
				<input type="text" name="username" value={u.username} autocomplete="username" hidden />
				<input type="password" name="password" placeholder="New password" aria-label="New password for {u.username}" autocomplete="new-password" minlength="6" required />
				<button style="flex: 0 0 auto; width: auto">Set</button>
			</form>
			<div class="actions">
				<form method="POST" action="?/role" use:enhance>
					<input type="hidden" name="id" value={u.id} />
					<input type="hidden" name="admin" value={u.is_admin ? '0' : '1'} />
					<button class="ghost">{u.is_admin ? 'Make member' : 'Make admin'}</button>
				</form>
				{#if u.id !== data.me.id}
					<form method="POST" action="?/remove" use:enhance onsubmit={confirmIt(`Remove ${u.username}? They are signed out at once.`)}>
						<input type="hidden" name="id" value={u.id} />
						<button class="danger">Remove</button>
					</form>
				{/if}
			</div>
			{#if form?.rowId === u.id && form?.rowError}<p class="note bad">{form.rowError}</p>{/if}
			{#if form?.rowId === u.id && form?.rowDone}<p class="note good">{form.rowDone}</p>{/if}
		</details>
	{/each}

	<form method="POST" action="?/add" use:enhance class="add">
		<div class="lbl">Add a person</div>
		<input type="text" name="username" placeholder="Username" aria-label="Username" autocomplete="off" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} />
		<input type="password" name="password" placeholder="Password, 6+ characters" aria-label="Password" autocomplete="new-password" minlength="6" required style="margin-top: 8px" />
		<div class="pills"><label class="pill"><input type="checkbox" name="admin" />Admin</label></div>
		<button style="margin-top: 12px">Add</button>
		{#if form?.userError}<p class="note bad">{form.userError}</p>{/if}
		{#if form?.userDone}<p class="note good">{form.userDone}</p>{/if}
	</form>
</section>

<section class="card">
	<h2>Devices</h2>
	<div class="sub">
		The wall scanner and Home Assistant sign in with a token instead of a password, sent as
		<code>Authorization: Bearer …</code>. A token only opens the API, not these pages.
	</div>

	{#if form?.token}
		<div class="note warn">
			<b>{form.tokenName}</b>: copy this now, it isn't shown again.
			<code class="token">{form.token}</code>
			<button class="ghost" style="margin-top: 8px" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
		</div>
	{/if}

	{#each data.devices as d (d.id)}
		<div class="line" style="align-items: center; border-bottom: 1px solid var(--surface-2); padding: 8px 0">
			<span><b>{d.name}</b><div class="muted" style="font-size: 13px">added {day(d.created_at)} · last used {day(d.used_at)}</div></span>
			<form method="POST" action="?/removeDevice" use:enhance onsubmit={confirmIt(`Revoke ${d.name}? It stops working at once.`)}>
				<input type="hidden" name="id" value={d.id} />
				<button class="ghost" style="width: auto; min-height: 40px">Revoke</button>
			</form>
		</div>
	{:else}
		<p class="muted">No devices yet.</p>
	{/each}

	<form method="POST" action="?/addDevice" use:enhance class="actions">
		<input type="text" name="name" placeholder="e.g. Wall scanner, Home Assistant" aria-label="Device name" />
		<button style="flex: 0 0 auto; width: auto">New token</button>
	</form>
	{#if form?.deviceError}<p class="note bad">{form.deviceError}</p>{/if}
</section>

<style>
	input[type='text'], input[type='password'] { background: var(--surface-2); }
	.user { border-bottom: 1px solid var(--surface-2); padding: 10px 0; }
	.user summary { padding: 0; }
	.add { border-top: 1px solid var(--surface-2); margin-top: 6px; }
	.add .lbl { margin-top: 14px; }
	.token { display: block; margin-top: 8px; padding: 10px; border-radius: 8px; background: var(--surface); color: var(--ink); word-break: break-all; font-size: 14px; user-select: all; }
</style>
