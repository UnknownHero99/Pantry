<script>
	import { enhance } from '$app/forms';
	import PrintPanel from '$lib/PrintPanel.svelte';
	import { amount, fmtDate, ago, daysUntil } from '$lib/format.js';

	let { data, form } = $props();
	const p = $derived(data.product);

	let picked = $state(new Set());
	let reprint = $state(null);
	let merging = $state(false);
	let minStock = $state(0);
	let place = $state('');
	$effect.pre(() => {
		minStock = p.min_stock || (p.needs_review ? 1 : 0);
		// An unknown barcode has no usual place yet: suggest where it was first counted.
		const seenAt = data.locations.find((l) => l.name === data.seen?.location)?.id;
		place = String(p.location_id ?? seenAt ?? '');
	});

	const qtyAt = (locId) => data.stock.find((s) => s.location_id === locId)?.qty ?? 0;
	const keep = () => async ({ update }) => update({ reset: false });
	const code = (c) => (c?.length === 13 ? `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}` : c);
	const meta = $derived(
		[p.brand?.toLowerCase() === p.name.toLowerCase() ? '' : p.brand, p.size, p.category].filter(Boolean).join(' · ')
	);
	const where = $derived(data.locations.filter((l) => qtyAt(l.id) > 0).map((l) => `${qtyAt(l.id)} in ${l.name}`).join(', '));

	function togglePick(id) {
		const n = new Set(picked);
		n.has(id) ? n.delete(id) : n.add(id);
		picked = n;
	}
	function doReprint(all) {
		reprint = data.items.filter((i) => all || picked.has(i.id)).map((i) => ({ ...i, name: p.name }));
	}
</script>

{#snippet hidden()}
	<!-- The naming form only shows a few fields; keep the rest as they are. -->
	<input type="hidden" name="category" value={p.category ?? ''} />
	<input type="hidden" name="unit" value={p.unit} />
	<input type="hidden" name="shelf_days" value={p.shelf_days ?? ''} />
	{#if p.homemade}<input type="hidden" name="homemade" value="on" />{/if}
{/snippet}

{#snippet places(name = 'location_id')}
	<div class="seg" role="radiogroup" aria-label="Usually kept in">
		{#each data.locations as l (l.id)}
			<label><input type="radio" {name} value={String(l.id)} bind:group={place} />{l.name}</label>
		{/each}
	</div>
{/snippet}

{#snippet minimum()}
	<div class="panel" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 8px 8px 14px">
		<div>
			<div>Keep at least</div>
			<div class="muted" style="font-size: 13px">{minStock ? 'Goes on the shopping list below this' : 'Off: never on the shopping list'}</div>
		</div>
		<div class="stepper">
			<button type="button" aria-label="Lower minimum" onclick={() => (minStock = Math.max(0, minStock - 1))}>−</button>
			<span class="n">{minStock}</span>
			<button type="button" aria-label="Raise minimum" onclick={() => (minStock += 1)}>+</button>
		</div>
		<input type="hidden" name="min_stock" value={minStock} />
	</div>
{/snippet}

{#if p.needs_review}
	<!-- Naming an unknown barcode, usually straight from the wall's QR code. -->
	<a class="back" href="/inbox">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Inbox · {data.toName} to name
	</a>

	<section class="result unknown" style="gap: 6px">
		<div class="chip-l">
			{`NEW BARCODE${data.seen ? ` · SCANNED ${data.seen.device === 'wall' ? 'AT THE WALL' : 'ON A PHONE'} ${data.seen.ago.toUpperCase()}` : ''}`}
		</div>
		<div class="t" style="letter-spacing: 1px; color: var(--warn-ink)">{code(data.barcodes[0])}</div>
		<div class="text">Not in Open Food Facts.{#if where} {where}.{/if}</div>
	</section>
	{#if form?.notFound}<p class="note warn">Still not on Open Food Facts. Name it yourself.</p>{/if}

	<form method="POST" action="?/save" use:enhance={keep}>
		{@render hidden()}
		<label class="lbl" for="name">What is it?</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input id="name" class="big" type="text" name="name" placeholder="e.g. Ajvar, mild" required autofocus autocomplete="off" />
		<div class="row2">
			<div><label class="lbl" for="brand">Brand</label><input id="brand" type="text" name="brand" value={p.brand ?? ''} /></div>
			<div><label class="lbl" for="size">Pack size</label><input id="size" type="text" name="size" value={p.size ?? ''} placeholder="e.g. 350 g" /></div>
		</div>
		<div class="lbl">Usually kept in</div>
		{@render places()}
		<div style="margin-top: 12px">{@render minimum()}</div>
		{#if form?.error}<p class="note bad">{form.error}</p>{/if}
		<button class="cta" style="margin-top: 16px">Save</button>
	</form>

	<div style="display: flex; justify-content: space-between; margin-top: 14px">
		<button class="linkish" onclick={() => (merging = !merging)}>Same as something I have…</button>
		<form method="POST" action="?/lookup" use:enhance>
			<button class="linkish">Look it up again</button>
		</form>
	</div>
	{#if merging}
		<form method="POST" action="?/merge" class="actions">
			<select name="into" required aria-label="Product it's the same as">
				<option value="">Pick the product…</option>
				{#each data.others as o}<option value={o.id}>{o.name}</option>{/each}
			</select>
			<button style="flex: 0 0 auto; width: auto">Merge</button>
		</form>
		<p class="muted" style="font-size: 13px">The barcode becomes a second barcode of that product; this count moves over too.</p>
	{/if}
{:else}
	<a class="back" href="/">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Stock
	</a>

	{#if form?.saved}
		<p class="note good" style="margin: 0 0 12px">
			Saved.{#if data.nextToName} <a href="/product/{data.nextToName}">Next to name ({data.toName}) →</a>{/if}
		</p>
	{/if}

	<div style="display: flex; gap: 14px; align-items: center">
		{#if p.image}
			<img src={p.image} alt="" style="width: 72px; height: 72px; border-radius: 14px; object-fit: cover; flex: none" />
		{:else}
			<span class="thumb" style="width: 72px; height: 72px; border-radius: 14px">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					{#if p.homemade}<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />{:else}<path d="M8 8v8M11 8v8M14 8v5M17 8v8" />{/if}
				</svg>
			</span>
		{/if}
		<div style="flex: 1; min-width: 0">
			<h1 class="page" style="font-size: 24px">{p.name}</h1>
			{#if meta}<div class="muted">{meta}</div>{/if}
		</div>
		<div style="text-align: right; flex: none">
			<div style="font-size: 34px; font-weight: 700; line-height: 1; color: {p.min_stock && data.total < p.min_stock ? 'var(--warn)' : 'inherit'}">{data.total}</div>
			<div class="muted" style="font-size: 12px">{p.min_stock ? `min ${p.min_stock}` : 'in stock'}</div>
		</div>
	</div>

	{#if data.items.length}
		<div class="caps">
			<span>Packages · oldest first</span>
			<span>{amount(data.items.reduce((s, i) => s + (i.amount || 0), 0), p.unit)}</span>
		</div>
		<div class="rows">
			{#each data.items as i (i.id)}
				{@const d = daysUntil(i.best_before)}
				<div class="row" style="min-height: 0">
					<input type="checkbox" checked={picked.has(i.id)} onchange={() => togglePick(i.id)} style="width: 22px; height: 22px; flex: none" aria-label="Select #{String(i.id).padStart(6, '0')} to reprint" />
					<div class="info">
						<div class="nm">#{String(i.id).padStart(6, '0')} · {amount(i.amount, i.unit)} · {i.location ?? ''}</div>
						<div class="sm" style="white-space: normal">
							packed {fmtDate(i.packed_at)} ({ago(i.packed_at)}){#if i.best_before} · use by <span style="color: {d < 0 ? 'var(--bad)' : d < 14 ? 'var(--warn)' : 'inherit'}">{fmtDate(i.best_before)}</span>{/if}
							{#if i.note}<br />{i.note}{/if}
						</div>
					</div>
					<form method="POST" action="?/removeItem" use:enhance={keep}>
						<input type="hidden" name="item_id" value={i.id} />
						<button class="ghost" style="width: auto; min-height: 40px; padding: 0 12px; font-size: 14px">Used</button>
					</form>
				</div>
			{/each}
		</div>
		<div class="actions">
			<button class="ghost" disabled={!picked.size} onclick={() => doReprint(false)}>Reprint {picked.size || ''}</button>
			<button class="ghost" onclick={() => doReprint(true)}>Reprint all</button>
		</div>
		{#if reprint}<PrintPanel labels={reprint} />{/if}
	{/if}

	{#if !p.homemade || data.stock.some((s) => s.qty > 0)}
		<div class="caps"><span>Where it is</span></div>
		<div class="rows">
			{#each data.locations as l (l.id)}
				<div class="row" style="min-height: 56px">
					<div class="info"><div class="nm">{l.name}</div></div>
					<form method="POST" action="?/adjust" use:enhance={keep} class="stepper">
						<input type="hidden" name="location_id" value={l.id} />
						<button name="delta" value="-1" aria-label="One less in {l.name}">−</button>
						<span class="n">{qtyAt(l.id)}</span>
						<button name="delta" value="1" aria-label="One more in {l.name}">+</button>
					</form>
				</div>
			{/each}
		</div>
	{/if}

	<details class="panel" style="margin-top: 18px" open={!!form?.error}>
		<summary class="caps" style="margin: 0"><span>Edit details</span><span aria-hidden="true">▾</span></summary>
		<form method="POST" action="?/save" use:enhance={keep}>
			<label class="lbl" for="name">Name</label>
			<input id="name" type="text" name="name" value={p.name} required />
			<div class="row2">
				<div><label class="lbl" for="brand">Brand</label><input id="brand" type="text" name="brand" value={p.brand ?? ''} /></div>
				<div><label class="lbl" for="size">Pack size</label><input id="size" type="text" name="size" value={p.size ?? ''} placeholder="500 g" /></div>
			</div>
			<label class="lbl" for="cat">Category</label>
			<input id="cat" type="text" name="category" value={p.category ?? ''} />
			<div class="lbl">Usually kept in</div>
			{@render places()}
			<div style="margin-top: 12px">{@render minimum()}</div>
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
			<button style="margin-top: 14px">Save</button>
		</form>
	</details>

	<details class="panel" style="margin-top: 10px">
		<summary class="caps" style="margin: 0"><span>Barcodes · {data.barcodes.length}</span><span aria-hidden="true">▾</span></summary>
		<div class="sub" style="margin-top: 8px">Scanning any of these counts as this product.</div>
		{#each data.barcodes as c}
			<form method="POST" action="?/removeBarcode" use:enhance={keep} class="line" style="align-items: center">
				<input type="hidden" name="code" value={c} />
				<span style="font-family: ui-monospace, monospace">{c}</span>
				<button class="linkish">Remove</button>
			</form>
		{/each}
		<form method="POST" action="?/addBarcode" use:enhance class="actions">
			<input type="text" name="code" inputmode="numeric" placeholder="Add barcode" aria-label="Add barcode" />
			<button class="ghost" style="flex: 0 0 auto; width: auto">Add</button>
		</form>
	</details>

	<details class="panel" style="margin-top: 10px">
		<summary class="caps" style="margin: 0"><span>Merge or delete</span><span aria-hidden="true">▾</span></summary>
		<div class="sub" style="margin-top: 8px">Merging moves barcodes, stock and history into the other product.</div>
		<form method="POST" action="?/merge" class="actions">
			<select name="into" required aria-label="Merge into">
				<option value="">Merge into…</option>
				{#each data.others as o}<option value={o.id}>{o.name}</option>{/each}
			</select>
			<button class="ghost" style="flex: 0 0 auto; width: auto">Merge</button>
		</form>
		<form method="POST" action="?/delete" onsubmit={(e) => confirm(`Delete ${p.name} and all its history?`) || e.preventDefault()}>
			<button class="danger" style="margin-top: 12px">Delete product</button>
		</form>
	</details>
{/if}
