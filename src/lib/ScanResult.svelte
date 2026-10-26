<script>
	/**
	 * One scan reply, drawn like the wall's result card (see scanReply in
	 * src/lib/server/inventory.js for the fields).
	 */
	let { r, onadjust, onundo, onfix } = $props();

	const pkg = $derived(!!r.pkg);
	const ok = $derived(r.status === 'ok');
	const undo = $derived(r.mode === 'undo');
	const kind = $derived(r.status === 'pending' ? 'pending' : undo ? 'undo' : r.status === 'queued' ? 'unknown' : r.status);
	const label = $derived(
		r.status === 'pending' ? 'LOOKING IT UP…'
		: r.status === 'queued' ? 'SAVED OFFLINE · WILL SYNC'
		: undo ? 'UNDONE'
		: r.status === 'unknown' ? 'NEW BARCODE'
		: r.status === 'empty' ? (pkg || !r.event_id ? 'ALREADY REMOVED' : 'NONE IN STOCK')
		: !ok ? 'ERROR'
		: (r.mode === 'in' ? (pkg ? 'PUT BACK' : 'ADDED') : 'TAKEN OUT') + (pkg ? ' · HOME-MADE' : '')
	);
	// Nothing left to take more of, unless you already said you took several.
	const stepper = $derived(ok && !undo && !pkg && !!r.event_id && !(r.mode === 'out' && r.count === 0 && r.units <= 1));
	const code = (c) => (c?.length === 13 ? `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}` : c);
</script>

<section class="result {kind}" aria-live="polite">
	<div class="top">
		{#if r.image && !pkg}
			<img class="ph" src={r.image} alt="" />
		{:else}
			<span class="ph">
				{#if r.status === 'pending'}
					<span class="spin" style="color: var(--accent-text)"></span>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						{#if pkg}<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="8" cy="8" r="1.6" />
						{:else}<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v5M17 8v8" />{/if}
					</svg>
				{/if}
			</span>
		{/if}
		<div style="min-width: 0">
			<div class="chip-l">{label}</div>
			<div class="t">{r.status === 'unknown' || r.status === 'pending' || r.status === 'queued' ? code(r.code || r.title) : r.title}</div>
			{#if r.status === 'unknown'}
				<div class="m">Not in the food database</div>
			{:else if r.meta}
				<div class="m">{r.meta}{pkg && r.pkg ? ` · ${r.pkg}` : ''}</div>
			{/if}
		</div>
	</div>

	{#if pkg && ok && !undo}
		<div class="text">Packed {r.packed}{#if r.use_by} · use by <b style="color: {r.use_by_days < 0 ? 'var(--bad)' : r.use_by_days <= 7 ? 'var(--warn)' : 'inherit'}">{r.use_by}</b>{/if}</div>
	{/if}

	{#if ok}
		<div class="counts">
			{#if !pkg}
				<span class="was">{r.prev}</span>
				<span class="was" style="font-size: 20px" aria-hidden="true">→</span>
			{/if}
			<span class="now" class:zero={r.count === 0 && r.mode !== 'in'}>{r.count}</span>
			<span class="m">{pkg ? r.left_text : r.mode === 'out' ? 'left' : ''}</span>
			{#if stepper}
				<span class="more">{r.mode === 'in' ? 'Bought' : 'Took'}<br />more?</span>
				<div class="stepper">
					<button aria-label="One less" onclick={() => onadjust(r, -1)}>−</button>
					<button aria-label="One more" onclick={() => onadjust(r, 1)}>+</button>
				</div>
			{/if}
		</div>
	{:else if r.status === 'unknown'}
		<div class="text">{r.mode === 'in' ? `Counted as 1${r.location ? ` in ${r.location}` : ''}. ` : ''}Name it now while it's in your hand.</div>
		<a class="btn" href="/product/{r.product_id}">Name it</a>
	{:else if r.status === 'empty' && r.event_id && !pkg}
		<div class="text">The app thinks there were none left, so this one was probably never scanned in.</div>
		<button onclick={() => onfix(r)}>It was there, fix count</button>
	{:else if r.detail}
		<div class="text">{r.detail}</div>
	{/if}

	{#if r.event_id && (ok || r.status === 'unknown') && !undo}
		<button class="linkish" style="align-self: flex-start" onclick={() => onundo(r)}>Undo this scan</button>
	{/if}
</section>

{#if ok && !undo && r.last_one}
	<div class="banner warn" style="margin-top: 10px">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11h11.2L21 7H6.2M9 20h.01M18 20h.01" /></svg>
		<span><b>That was the last one</b>{r.on_list ? `On the shopping list · ${r.list_count} to buy` : 'Set a min stock on it to have it go on the list'}</span>
	</div>
{:else if ok && !undo && r.older}
	<div class="banner blue" style="margin-top: 10px">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
		<span><b>Older pack waiting: {r.older}</b>Use that one next</span>
	</div>
{/if}
