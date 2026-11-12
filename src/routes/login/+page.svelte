<script>
	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · Pantry</title></svelte:head>

<div class="gate">
	<div class="brand"><img src="/logo.svg" alt="" /><span class="wordmark">pantry</span></div>

	<form method="POST" onsubmit={() => (busy = true)}>
		<input type="hidden" name="next" value={data.next} />
		<label class="lbl" for="username">Username</label>
		<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required defaultValue={form?.username ?? ''} />
		<label class="lbl" for="password">Password</label>
		<input id="password" name="password" type="password" autocomplete="current-password" required />
		{#if form?.error}<p class="note bad" role="alert">{form.error}</p>{/if}
		<button class="cta" style="margin-top: 20px" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
	</form>
</div>
