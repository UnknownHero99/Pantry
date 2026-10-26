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

<h1 class="page">Settings</h1>

<section class="card">
	<h2>Locations</h2>
	<div class="sub">The wall scanner sends its location by name.</div>
	{#each data.locations as l (l.id)}
		<div class="prod">
			<form method="POST" action="?/rename" use:enhance={keep} class="actions" style="margin: 0; flex: 1">
				<input type="hidden" name="id" value={l.id} />
				<input type="text" name="name" value={l.name} />
				<button class="ghost" style="flex: 0 0 auto; width: auto">Rename</button>
			</form>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={l.id} />
				<button class="linkish" aria-label="Delete {l.name}">✕</button>
			</form>
		</div>
	{/each}
	<form method="POST" action="?/add" use:enhance class="actions">
		<input type="text" name="name" placeholder="New location, e.g. Garage" />
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
