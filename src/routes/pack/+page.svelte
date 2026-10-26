<script>
	import { enhance } from '$app/forms';
	import PrintPanel from '$lib/PrintPanel.svelte';
	import { today, addDays } from '$lib/format.js';

	let { data, form } = $props();

	let productId = $state('');
	let newName = $state('');
	let unit = $state('g');
	let locationId = $state(data.locations.find((l) => /freez/i.test(l.name))?.id ?? data.locations[0]?.id);
	let packedAt = $state(today());
	let bestBefore = $state('');
	let busy = $state(false);

	function pick() {
		const p = data.products.find((x) => x.id === Number(productId));
		if (!p) return;
		unit = p.unit;
		if (p.location_id) locationId = p.location_id;
		bestBefore = p.shelf_days ? addDays(packedAt, p.shelf_days) : '';
	}

	const presets = [
		['1 wk', 7], ['1 mo', 30], ['3 mo', 91], ['6 mo', 182], ['1 yr', 365]
	];
</script>

<h1 class="page">Pack &amp; label</h1>
<p class="muted">Your own goods: harvest, bulk meat, meal prep. Each package gets a QR label and is in stock immediately.</p>

{#if form?.labels}
	<section class="card">
		<h2>{form.labels.length} package{form.labels.length === 1 ? '' : 's'} added</h2>
		<div class="sub">Stick the labels on before freezing — frost stops them sticking.</div>
		<PrintPanel labels={form.labels} />
		<a class="btn ghost" href="/pack" style="margin-top: 10px" data-sveltekit-reload>Pack something else</a>
	</section>
{:else}
	<form
		method="POST"
		class="card"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<label class="lbl" for="product">What</label>
		<select id="product" name="product_id" bind:value={productId} onchange={pick}>
			<option value="">＋ New product…</option>
			{#each data.products as p}<option value={p.id}>{p.name}</option>{/each}
		</select>
		{#if !productId}
			<input type="text" name="new_name" placeholder="e.g. Beef mince, Tomato sauce" bind:value={newName} style="margin-top: 8px" required />
		{/if}

		<div class="row3">
			<div>
				<label class="lbl" for="count">Packages</label>
				<input id="count" type="number" name="count" value="1" min="1" max="100" inputmode="numeric" />
			</div>
			<div>
				<label class="lbl" for="amount">Each</label>
				<input id="amount" type="number" name="amount" step="any" min="0" inputmode="decimal" placeholder="500" />
			</div>
			<div>
				<label class="lbl" for="unit">Unit</label>
				<select id="unit" name="unit" bind:value={unit}>
					<option value="g">g</option><option value="ml">ml</option><option value="pcs">pcs</option>
				</select>
			</div>
		</div>

		<label class="lbl" for="loc">Where</label>
		<select id="loc" name="location_id" bind:value={locationId}>
			{#each data.locations as l}<option value={l.id}>{l.name}</option>{/each}
		</select>

		<div class="row2">
			<div>
				<label class="lbl" for="packed">Packed</label>
				<input id="packed" type="date" name="packed_at" bind:value={packedAt} />
			</div>
			<div>
				<label class="lbl" for="bb">Use by <span class="hint">optional</span></label>
				<input id="bb" type="date" name="best_before" bind:value={bestBefore} />
			</div>
		</div>
		<div class="pills">
			{#each presets as [label, days]}
				<button type="button" class="pill" style="width: auto" onclick={() => (bestBefore = addDays(packedAt, days))}>+{label}</button>
			{/each}
		</div>

		<label class="lbl" for="note">Note <span class="hint">optional, printed on the label</span></label>
		<input id="note" type="text" name="note" placeholder="e.g. Harvest 2026, San Marzano" />

		{#if form?.error}<p class="note bad">{form.error}</p>{/if}
		<button class="sticky-save" disabled={busy}>{busy ? 'Saving…' : 'Add to stock & make labels'}</button>
	</form>
{/if}
