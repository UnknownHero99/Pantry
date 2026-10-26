<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import PrintPanel from '$lib/PrintPanel.svelte';
	import { forget, printerKind, labelLength } from '$lib/printer.js';
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

<section class="card" id="places">
	<h2>Spaces and places</h2>
	<div class="sub">Pantry is home: the app opens there and the wall scanner files into its first place. Boxes are added on a shelf's own page.</div>
	{#each data.tree.filter((l) => l.kind === 'space') as sp (sp.id)}
		<div class="space-block">
			<div style="display: flex; align-items: center; gap: 8px">
				<form method="POST" action="?/rename" use:enhance={keep} style="display: flex; gap: 8px; flex: 1; min-width: 0">
					<input type="hidden" name="id" value={sp.id} />
					<input type="text" name="name" value={sp.name} aria-label="Space name" style="font-weight: 700; background: var(--surface-2)" />
					<button class="icon-btn" style="height: 48px; width: 48px" aria-label="Save name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg></button>
				</form>
				<span class="badge-list">{sp.home ? 'HOME · ' : ''}{sp.list === 'garage' ? 'GARAGE LIST' : 'GROCERIES'}</span>
			</div>
			{#each data.tree.filter((l) => l.space_id === sp.id && l.kind === 'place') as pl (pl.id)}
				<div style="display: flex; gap: 8px; margin: 8px 0 0 {Math.min(pl.depth, 3) * 14}px">
					<form method="POST" action="?/rename" use:enhance={keep} style="display: flex; gap: 8px; flex: 1; min-width: 0">
						<input type="hidden" name="id" value={pl.id} />
						<input type="text" name="name" value={pl.name} aria-label="Place name" style="background: var(--surface-2)" />
						<button class="icon-btn" style="height: 48px; width: 48px" aria-label="Save name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg></button>
					</form>
					<a class="icon-btn" href="/place/{pl.id}" aria-label="Open {pl.name}" style="height: 48px; width: 48px; display: grid; place-items: center">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
					</a>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={pl.id} />
						<button class="icon-btn" style="height: 48px; width: 48px" aria-label="Delete {pl.name}">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
						</button>
					</form>
				</div>
			{/each}
			<form method="POST" action="?/addPlace" use:enhance class="actions" style="margin-top: 8px">
				<input type="hidden" name="parent_id" value={sp.id} />
				<input type="text" name="name" placeholder={sp.list === 'garage' ? 'New place, e.g. Shelf A, Workbench' : 'New place, e.g. Top shelf'} aria-label="New place in {sp.name}" style="background: var(--surface-2)" />
				<button style="flex: 0 0 auto; width: auto">Add</button>
			</form>
		</div>
	{/each}
	<form method="POST" action="?/addSpace" use:enhance class="space-block">
		<div style="display: flex; gap: 8px">
			<input type="text" name="name" placeholder="New space, e.g. Basement" aria-label="New space" style="background: var(--surface-2)" />
			<select name="list" aria-label="Shopping list" style="flex: 0 0 130px; background: var(--surface-2)">
				<option value="garage">Garage list</option>
				<option value="groceries">Groceries</option>
			</select>
		</div>
		<button style="margin-top: 8px">Add space</button>
	</form>
	{#if form?.error}<p class="note bad">{form.error}</p>{/if}
</section>

<section class="card">
	<h2>Label printer</h2>
	<div class="sub">Pick it from Chrome's list on the first print; the app recognises which kind it is.</div>
	<div class="seg" role="radiogroup" aria-label="Printer">
		<label><input type="radio" name="kind" value="p15" bind:group={$printerKind} />P15 labels</label>
		<label><input type="radio" name="kind" value="cat" bind:group={$printerKind} />C15 receipt</label>
	</div>
	{#if $printerKind === 'p15'}
		<div class="lbl">Label length <span class="hint">die-cut labels, 12–15 mm wide</span></div>
		<div class="seg" role="radiogroup" aria-label="Label length">
			{#each [30, 40, 50] as mm}
				<label><input type="radio" name="len" value={mm} bind:group={$labelLength} />{mm} mm</label>
			{/each}
		</div>
		<p class="muted" style="font-size: 13px; margin: 8px 0 0">Marklife / Pristar P15, P12, L13. Close the Marklife app first: the printer takes one connection at a time.</p>
	{:else}
		<label class="lbl" for="energy">Darkness <span class="hint">{energy}</span></label>
		<input id="energy" type="range" min="4096" max="24576" step="1024" bind:value={energy} onchange={saveEnergy} style="width: 100%" />
		<p class="muted" style="font-size: 13px; margin: 8px 0 0">C15 and other Fun Print “cat” printers, 57 mm sticker rolls.</p>
	{/if}
	<PrintPanel labels={sample} />
	<button class="ghost" style="margin-top: 8px" onclick={forget}>Forget printer</button>
</section>

<section class="card">
	<h2>Home Assistant</h2>
	<div class="sub">
		Groceries list: {data.ha ? 'synced' : 'off (HA_TODO_ENTITY)'} · Garage list: {data.haGarage ? 'synced' : 'off (HA_TODO_ENTITY_GARAGE)'} ·
		Lending reminders: {data.haNotify ? 'on' : 'off (HA_NOTIFY, e.g. notify.mobile_app_phone)'}.
		REST sensor endpoint: <code>/api/summary</code>
	</div>
</section>

<style>
	.space-block { border-top: 1px solid var(--surface-2); padding-top: 12px; margin-top: 12px; }
	.badge-list { flex: none; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: var(--muted); }
</style>
