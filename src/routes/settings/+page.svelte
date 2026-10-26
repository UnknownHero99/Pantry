<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import PrintPanel from '$lib/PrintPanel.svelte';
	import { forget } from '$lib/catprinter.js';
	import { today, addDays } from '$lib/format.js';

	let { data, form } = $props();

	let energy = $state(0x3000);
	onMount(() => {
		energy = Number(localStorage.getItem('printer.energy')) || 0x3000;
	});
	function saveEnergy() {
		try { localStorage.setItem('printer.energy', String(energy)); } catch {}
	}

	const sample = [{ id: 0, name: 'Test label', amount: 500, unit: 'g', packed_at: today(), best_before: addDays(today(), 120), location: 'Freezer', note: 'Darkness check' }];
	const keep = () => async ({ update }) => update({ reset: false });
</script>

<a class="back" href="/more">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
	More
</a>
<h1 class="page">Settings</h1>

<section class="card">
	<h2>Locations</h2>
	<div class="sub">The wall scanner sends its location by name.</div>
	{#each data.locations as l (l.id)}
		<div style="display: flex; gap: 8px; margin-top: 8px">
			<form method="POST" action="?/rename" use:enhance={keep} style="display: flex; gap: 8px; flex: 1; min-width: 0">
				<input type="hidden" name="id" value={l.id} />
				<input type="text" name="name" value={l.name} aria-label="Location name" style="background: var(--surface-2)" />
				<button class="ghost" style="flex: none; width: auto">Rename</button>
			</form>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={l.id} />
				<button class="icon-btn" style="height: 48px; width: 48px" aria-label="Delete {l.name}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
				</button>
			</form>
		</div>
	{/each}
	<form method="POST" action="?/add" use:enhance class="actions">
		<input type="text" name="name" placeholder="New location, e.g. Garage" aria-label="New location" style="background: var(--surface-2)" />
		<button style="flex: 0 0 auto; width: auto">Add</button>
	</form>
	{#if form?.error}<p class="note bad">{form.error}</p>{/if}
</section>

<section class="card">
	<h2>Label printer</h2>
	<div class="sub">Bluetooth “cat” printer (C15, Fun Print models). Pick it from the list on first print.</div>
	<label class="lbl" for="energy">Darkness <span class="hint">{energy}</span></label>
	<input id="energy" type="range" min="4096" max="24576" step="1024" bind:value={energy} onchange={saveEnergy} style="width: 100%" />
	<PrintPanel labels={sample} />
	<button class="ghost" style="margin-top: 8px" onclick={forget}>Forget printer</button>
</section>

<section class="card">
	<h2>Home Assistant</h2>
	<div class="sub">
		{#if data.ha}Shopping list syncs to your HA to-do list.{:else}Not configured — set HA_URL, HA_TOKEN and HA_TODO_ENTITY to sync the shopping list.{/if}
		REST sensor endpoint: <code>/api/summary</code>
	</div>
</section>
