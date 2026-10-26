<script>
	import { enhance } from '$app/forms';
	import PrintPanel from '$lib/PrintPanel.svelte';
	import { drawLabel, printerKind, labelLength, supported } from '$lib/printer.js';
	import { today, addDays, fmtDate, span } from '$lib/format.js';

	let { data, form } = $props();

	// Start on the most recently packed product with its usual amount, place and shelf life.
	const start = (() => {
		const p = data.products[0];
		const freezer = data.locations.find((l) => /freez/i.test(l.name)) ?? data.locations[0];
		return {
			id: p ? String(p.id) : '',
			amount: p?.last_amount ?? '',
			unit: p?.unit ?? 'g',
			location: String(p?.location_id ?? freezer?.id),
			bestBefore: p?.shelf_days ? addDays(today(), p.shelf_days) : ''
		};
	})();
	let productId = $state(start.id);
	let newName = $state('');
	let count = $state(1);
	let amountEach = $state(start.amount);
	let unit = $state(start.unit);
	let locationId = $state(start.location);
	let packedAt = $state(today());
	let bestBefore = $state(start.bestBefore);
	let note = $state('');
	let editPacked = $state(false);
	let editUseBy = $state(false);
	let addNote = $state(false);
	let busy = $state(false);
	let canPrint = $state(true);
	let preview = $state();

	const picked = $derived(data.products.find((p) => String(p.id) === productId));
	const name = $derived(picked?.name ?? newName.trim());

	function pick(p) {
		productId = p ? String(p.id) : '';
		if (!p) return;
		unit = p.unit;
		if (p.last_amount) amountEach = p.last_amount;
		if (p.location_id) locationId = String(p.location_id);
		bestBefore = p.shelf_days ? addDays(packedAt, p.shelf_days) : bestBefore;
	}

	const presets = [['1 mo', 30], ['3 mo', 91], ['6 mo', 182], ['1 yr', 365]];
	const daysFromPacked = $derived(bestBefore ? Math.round((new Date(bestBefore) - new Date(packedAt)) / 86400000) : null);
	const longDate = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

	// Live preview of the first label, exactly as the printer will get it.
	$effect(() => {
		canPrint = supported();
		if (!preview) return;
		void $printerKind, $labelLength;
		const cv = drawLabel({
			id: data.nextId,
			name: name || 'Your product',
			amount: amountEach === '' ? null : Number(amountEach),
			unit,
			packed_at: packedAt,
			best_before: bestBefore || null,
			note,
			location: data.locations.find((l) => String(l.id) === locationId)?.name
		});
		preview.replaceChildren(cv);
	});
</script>

{#if form?.labels}
	<h1 class="page">{form.labels.length} pack{form.labels.length === 1 ? '' : 's'} added</h1>
	<p class="lede">{form.labels[0].name} is in stock. Stick the labels on before freezing; frost stops them sticking.</p>
	<section class="panel" style="margin-top: 14px">
		<PrintPanel labels={form.labels} />
		<a class="btn ghost" href="/pack" style="margin-top: 10px" data-sveltekit-reload>Pack something else</a>
	</section>
{:else}
	<h1 class="page">Pack &amp; label</h1>
	<p class="lede">Harvest, bulk meat, meal prep. In stock right away.</p>

	<form
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<label class="lbl" for="new-name">What</label>
		<div class="chips" style="margin-top: 0" role="radiogroup" aria-label="Product">
			{#each data.products.slice(0, 8) as p (p.id)}
				<button type="button" class="chip pick" class:on={productId === String(p.id)} role="radio" aria-checked={productId === String(p.id)} onclick={() => pick(p)}>{p.name}</button>
			{/each}
			<button type="button" class="chip pick" class:on={!productId} role="radio" aria-checked={!productId} onclick={() => pick(null)}>+ New</button>
		</div>
		{#if data.products.length > 8}
			<select style="margin-top: 8px" aria-label="All home-made products" onchange={(e) => pick(data.products.find((p) => String(p.id) === e.currentTarget.value))}>
				<option value="">More…</option>
				{#each data.products.slice(8) as p}<option value={p.id}>{p.name}</option>{/each}
			</select>
		{/if}
		<input type="hidden" name="product_id" value={productId} />
		{#if !productId}
			<input id="new-name" type="text" name="new_name" class="big" placeholder="e.g. Beef mince, Tomato sauce" bind:value={newName} style="margin-top: 10px" required />
		{/if}

		<div class="row2">
			<div>
				<label class="lbl" for="count">Packs</label>
				<div class="stepper big">
					<button type="button" aria-label="One pack fewer" onclick={() => (count = Math.max(1, count - 1))}>−</button>
					<input id="count" name="count" type="number" min="1" max="100" bind:value={count} inputmode="numeric" class="n" style="width: 56px; height: 44px; padding: 0; text-align: center; background: none; border: 0; font-size: 26px; font-weight: 700" />
					<button type="button" aria-label="One pack more" onclick={() => (count = Math.min(100, count + 1))}>+</button>
				</div>
			</div>
			<div>
				<label class="lbl" for="amount">Each</label>
				<div style="display: flex; gap: 6px">
					<input id="amount" type="number" name="amount" step="any" min="0" inputmode="decimal" placeholder="500" bind:value={amountEach} style="height: 54px; font-size: 22px; font-weight: 700; min-width: 0" />
					<select name="unit" bind:value={unit} aria-label="Unit" style="width: 72px; height: 54px; padding: 0 8px">
						<option value="g">g</option><option value="ml">ml</option><option value="pcs">pcs</option>
					</select>
				</div>
			</div>
		</div>

		<div class="lbl">Where</div>
		<div class="seg" role="radiogroup" aria-label="Where">
			{#each data.locations as l (l.id)}
				<label><input type="radio" name="location_id" value={String(l.id)} bind:group={locationId} />{l.name}</label>
			{/each}
		</div>

		<label class="lbl" for="bb">
			Use by
			<span class="hint">
				{bestBefore ? longDate(bestBefore) : 'no date'} ·
				<button type="button" class="linkish" style="font-size: 12px" onclick={() => (editUseBy = !editUseBy)}>{editUseBy ? 'done' : 'pick date'}</button>
			</span>
		</label>
		<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">
			{#each presets as [label, days]}
				<button type="button" class="chip pick" style="justify-content: center" class:on={daysFromPacked != null && Math.abs(daysFromPacked - days) < 3} onclick={() => (bestBefore = addDays(packedAt, days))}>{label}</button>
			{/each}
		</div>
		{#if editUseBy}
			<input id="bb" type="date" name="best_before" bind:value={bestBefore} style="margin-top: 8px" />
		{:else}
			<input type="hidden" name="best_before" value={bestBefore} />
		{/if}
		<p class="muted" style="font-size: 12px; margin: 6px 0 0">
			{#if picked?.shelf_days}{picked.name} usually keeps {span(picked.shelf_days)}; remembered from last time.{:else}The app remembers this for next time.{/if}
			Packed {packedAt === today() ? 'today' : fmtDate(packedAt)} ·
			<button type="button" class="linkish" style="font-size: 12px" onclick={() => (editPacked = !editPacked)}>{editPacked ? 'done' : 'change'}</button>
		</p>
		{#if editPacked}
			<input type="date" name="packed_at" bind:value={packedAt} style="margin-top: 8px" aria-label="Packed on" />
		{:else}
			<input type="hidden" name="packed_at" value={packedAt} />
		{/if}

		<div style="display: flex; gap: 14px; align-items: center; margin-top: 18px">
			<div class="label-preview" class:strip={$printerKind === 'p15'} bind:this={preview} role="img" aria-label="Label preview"></div>
			<div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted)">
				<span>×{count} label{count === 1 ? '' : 's'}, #{String(data.nextId).padStart(6, '0')}{count > 1 ? `–${String(data.nextId + count - 1).padStart(6, '0')}` : ''}</span>
				{#if !addNote}<button type="button" class="linkish" style="font-size: 13px; align-self: flex-start" onclick={() => (addNote = true)}>Add a note</button>{/if}
				<span>{!canPrint ? 'Printing needs Chrome on Android' : $printerKind === 'p15' ? `P15 · ${$labelLength} mm labels` : 'C15 · receipt paper'} · <a href="/settings">change</a></span>
			</div>
		</div>
		{#if addNote}
			<input type="text" name="note" placeholder="e.g. Harvest 2026, San Marzano" bind:value={note} style="margin-top: 10px" aria-label="Note on the label" />
		{/if}

		{#if form?.error}<p class="note bad">{form.error}</p>{/if}
		<button class="cta" style="margin-top: 16px" disabled={busy}>{busy ? 'Saving…' : `Add ${count} pack${count === 1 ? '' : 's'} & make labels`}</button>
	</form>
{/if}

<style>
	.label-preview { flex: none; width: 196px; }
	.label-preview :global(canvas) { width: 100%; height: auto; display: block; border-radius: 6px; box-shadow: var(--shadow); image-rendering: pixelated; }
	.label-preview.strip { width: 210px; }
</style>
