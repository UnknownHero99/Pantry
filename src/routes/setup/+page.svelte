<script>
	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Set up · Pantry</title></svelte:head>

<div class="gate">
	<div class="brand"><img src="/logo.svg" alt="" /><span class="wordmark">pantry</span></div>
	<h1 class="page" style="font-size: 24px; margin-top: 24px">Create the admin account</h1>
	<p class="lede">The setup code is printed in the server log when Pantry starts: <code>docker logs pantry</code>.</p>

	<form method="POST" onsubmit={() => (busy = true)}>
		<label class="lbl" for="code">Setup code</label>
		<input id="code" name="code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" required />
		<label class="lbl" for="username">Username</label>
		<input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required defaultValue={form?.username ?? ''} />
		<label class="lbl" for="password">Password <span class="hint">6+ characters</span></label>
		<input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required />
		<label class="lbl" for="password2">Password again</label>
		<input id="password2" name="password2" type="password" autocomplete="new-password" minlength="6" required />
		{#if form?.error}<p class="note bad" role="alert">{form.error}</p>{/if}
		<button class="cta" style="margin-top: 20px" disabled={busy}>Create account</button>
	</form>
</div>
