<script>
	import { enhance } from '$app/forms';
	import PrintPanel from '$lib/PrintPanel.svelte';
	import { amount, fmtDate, age, daysUntil } from '$lib/format.js';

	let { data, form } = $props();
	const p = $derived(data.product);

	let picked = $state(new Set());
	let reprint = $state(null);
	const qtyAt = (locId) => data.stock.find((s) => s.location_id === locId)?.qty ?? 0;
	const keep = () => async ({ update }) => update({ reset: false });

	function togglePick(id) {
		const n = new Set(picked);
		n.has(id) ? n.delete(id) : n.add(id);
		picked = n;
	}
	function doReprint(all) {
		reprint = data.items.filter((i) => all || picked.has(i.id)).map((i) => ({ ...i, name: p.name }));
	}
</script>

<h1 class="page" style="display: flex; gap: 12px; align-items: center">
	{#if p.image}<img src={p.image} alt="" style="width: 52px; height: 52px; border-radius: 12px; object-fit: cover" />{/if}
	{p.name}
</h1>
{#if p.needs_review}<p class="note warn">Unknown barcode — give it a proper name and save.</p>{/if}

{#if data.items.length}
	<section class="card">
		<h2>Packages ({data.items.length})</h2>
		<div class="sub">Oldest first · total {amount(data.items.reduce((s, i) => s + (i.amount || 0), 0), p.unit)}</div>
		<ul class="list">
			{#each data.items as i (i.id)}
				{@const d = daysUntil(i.best_before)}
				<li>
					<input type="checkbox" checked={picked.has(i.id)} onchange={() => togglePick(i.id)} style="width: 20px; height: 20px; margin-top: 2px" />
					<div class="what">
						#{String(i.id).padStart(6, '0')} · {amount(i.amount, i.unit)} · {i.location ?? ''}
						<div class="when">
							packed {fmtDate(i.packed_at)} ({age(i.packed_at)} ago){#if i.best_before} · use by <span style="color: {d < 0 ? 'var(--bad)' : d < 14 ? 'var(--warn)' : 'inherit'}">{fmtDate(i.best_before)}</span>{/if}
							{#if i.note}<br />{i.note}{/if}
						</div>
					</div>
					<form method="POST" action="?/removeItem" use:enhance={keep}>
						<input type="hidden" name="item_id" value={i.id} />
						<button class="linkish">Used</button>
					</form>
				</li>
			{/each}
		</ul>
		<div class="actions">
			<button class="ghost" disabled={!picked.size} onclick={() => doReprint(false)}>Reprint {picked.size || ''}</button>
			<button class="ghost" onclick={() => doReprint(true)}>Reprint all</button>
		</div>
		{#if reprint}<PrintPanel labels={reprint} />{/if}
	</section>
{/if}

{#if !p.homemade || data.stock.some((s) => s.qty > 0)}
	<section class="card">
		<h2>Stock</h2>
		{#each data.locations as l (l.id)}
			<div class="prod">
				<div class="info"><div class="nm">{l.name}</div></div>
				<form method="POST" action="?/adjust" use:enhance={keep} class="step">
					<input type="hidden" name="location_id" value={l.id} />
					<button name="delta" value="-1" aria-label="Remove one">−</button>
					<span class="qty">{qtyAt(l.id)}</span>
					<button name="delta" value="1" aria-label="Add one">+</button>
				</form>
			</div>
		{/each}
	</section>
{/if}

<form method="POST" action="?/save" class="card" use:enhance={keep}>
	<h2>Details</h2>
	<label class="lbl" for="name">Name</label>
	<input id="name" type="text" name="name" value={p.needs_review ? '' : p.name} placeholder={p.name} required />
	<div class="row2">
		<div><label class="lbl" for="brand">Brand</label><input id="brand" type="text" name="brand" value={p.brand ?? ''} /></div>
		<div><label class="lbl" for="size">Pack size</label><input id="size" type="text" name="size" value={p.size ?? ''} placeholder="500 g" /></div>
	</div>
	<label class="lbl" for="cat">Category</label>
	<input id="cat" type="text" name="category" value={p.category ?? ''} />
	<div class="row2">
		<div>
			<label class="lbl" for="loc">Usual place</label>
			<select id="loc" name="location_id" value={p.location_id ?? ''}>
				<option value="">—</option>
				{#each data.locations as l}<option value={l.id}>{l.name}</option>{/each}
			</select>
		</div>
		<div>
			<label class="lbl" for="min">Min stock <span class="hint">0 = off</span></label>
			<input id="min" type="number" name="min_stock" min="0" value={p.min_stock} inputmode="numeric" />
		</div>
	</div>
	<div class="row2">
		<div>
			<label class="lbl" for="unit">Unit</label>
			<select id="unit" name="unit" value={p.unit}>
				<option value="pcs">pcs</option><option value="g">g</option><option value="ml">ml</option>
			</select>
		</div>
		<div>
			<label class="lbl" for="shelf">Keeps (days)</label>
			<input id="shelf" type="number" name="shelf_days" min="0" value={p.shelf_days ?? ''} inputmode="numeric" />
		</div>
	</div>
	<div class="pills">
		<label class="pill"><input type="checkbox" name="homemade" checked={!!p.homemade} /> Home-made (labelled packages)</label>
	</div>
	{#if form?.error}<p class="note bad">{form.error}</p>{/if}
	{#if form?.saved}<p class="note good">Saved</p>{/if}
	<button style="margin-top: 14px">Save</button>
</form>

<section class="card">
	<h2>Barcodes</h2>
	<div class="sub">Scanning any of these counts as this product.</div>
	{#each data.barcodes as code}
		<form method="POST" action="?/removeBarcode" use:enhance={keep} class="prod">
			<input type="hidden" name="code" value={code} />
			<div class="info"><div class="nm" style="font-family: ui-monospace, monospace">{code}</div></div>
			<button class="linkish">Remove</button>
		</form>
	{/each}
	<form method="POST" action="?/addBarcode" use:enhance class="actions">
		<input type="text" name="code" inputmode="numeric" placeholder="Add barcode" />
		<button class="ghost" style="flex: 0 0 auto; width: auto">Add</button>
	</form>
</section>

<section class="card">
	<h2>Merge or delete</h2>
	<div class="sub">Merging moves barcodes, stock and history into the other product.</div>
	<form method="POST" action="?/merge" class="actions">
		<select name="into" required>
			<option value="">Merge into…</option>
			{#each data.others as o}<option value={o.id}>{o.name}</option>{/each}
		</select>
		<button class="ghost" style="flex: 0 0 auto; width: auto">Merge</button>
	</form>
	<form method="POST" action="?/delete" onsubmit={(e) => confirm(`Delete ${p.name} and all its history?`) || e.preventDefault()}>
		<button class="danger" style="margin-top: 12px">Delete product</button>
	</form>
</section>
