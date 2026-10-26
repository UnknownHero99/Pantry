<script>
	import { enhance } from '$app/forms';
	import { amount, daysUntil } from '$lib/format.js';

	let { data } = $props();

	let search = $state('');
	let place = $state(0); // location id, 0 = all
	let open = $state(''); // `${product}-${location}` whose −/+ is showing
	let showEmpty = $state(false);

	const match = (p) => {
		const s = search.trim().toLowerCase();
		return !s || p.name.toLowerCase().includes(s) || (p.brand || '').toLowerCase().includes(s);
	};

	// Group by location; a product on two shelves appears under both.
	let groups = $derived(
		data.locations
			.map((l) => ({
				...l,
				all: data.products.filter((p) => p.at[l.id]),
				rows: data.products.filter((p) => p.at[l.id] && match(p)).map((p) => ({ ...p, here: p.at[l.id] }))
			}))
	);
	let shown = $derived(groups.filter((g) => g.rows.length && (!place || g.id === place)));
	let items = $derived(data.products.reduce((n, p) => n + p.total, 0));
	let places = $derived(groups.filter((g) => g.all.length).length);

	// One line per product + use-by date: "Beef mince ×3", not three identical lines.
	let soon = $derived.by(() => {
		const m = new Map();
		for (const i of data.expiring) {
			const k = `${i.product_id}|${i.best_before}`;
			const g = m.get(k) ?? { ...i, n: 0, sum: 0 };
			g.n++;
			g.sum += i.amount || 0;
			m.set(k, g);
		}
		return [...m.values()];
	});
	let empty = $derived(data.products.filter((p) => p.total === 0 && match(p)));

	const low = (p) => p.min_stock > 0 && p.total < p.min_stock;
	const pretty = (c) => (c?.length === 13 ? `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}` : c);
	// Unknown barcodes read as what they are, with a nudge to name them.
	const title = (p) => (p.needs_review ? 'New item · name it' : p.name);
	const meta = (p) =>
		p.needs_review
			? pretty(p.name.replace(/^Unknown /, ''))
			: p.homemade
			? amount(p.amount_total, p.unit) || 'packages'
			: [p.brand?.toLowerCase() === p.name.toLowerCase() ? '' : p.brand, p.size].filter(Boolean).join(' · ');
	const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	const keep = () => async ({ update }) => update({ reset: false, invalidateAll: true });
	const days = (d) => (d < 0 ? 'expired' : d === 0 ? 'today' : `${d} d`);
</script>

<div class="head">
	<h1 class="page">Stock</h1>
	<span class="aside">{items} item{items === 1 ? '' : 's'} · {places} place{places === 1 ? '' : 's'}</span>
</div>

<div class="tiles">
	<a class="tile" href="/shopping"><div class="k">TO BUY</div><div class="v">{data.shopCount}</div></a>
	<a class="tile" href="#soon"><div class="k">USE SOON</div><div class="v" class:warn={data.expiring.length}>{data.expiring.length}</div></a>
	<a class="tile" class:warn={data.inboxCount} href="/inbox"><div class="k">TO NAME</div><div class="v">{data.inboxCount}</div></a>
</div>

<label class="search">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
	<input type="search" placeholder="Search {data.locations.map((l) => l.name.toLowerCase()).join(', ')}…" bind:value={search} aria-label="Search stock" />
</label>

<div class="chips" role="group" aria-label="Location">
	<button class="chip" class:on={!place} onclick={() => (place = 0)}>All</button>
	{#each groups.filter((g) => g.all.length) as g (g.id)}
		<button class="chip" class:on={place === g.id} onclick={() => (place = place === g.id ? 0 : g.id)}>{g.name} <span class="n">{g.all.length}</span></button>
	{/each}
</div>

{#if soon.length && !search && !place}
	<section id="soon" class="panel warn" style="margin-top: 14px">
		<div class="caps"><span>Use soon</span><span>Home-made</span></div>
		{#each soon as i}
			{@const d = daysUntil(i.best_before)}
			<a class="line" href="/product/{i.product_id}" style="color: inherit">
				<span>{i.name} ×{i.n} <span class="dim">· {amount(i.sum, i.unit)}{i.location ? ` · ${i.location}` : ''}</span></span>
				<b class="warn" style="color: {d < 0 ? 'var(--bad)' : ''}">{days(d)}</b>
			</a>
		{/each}
	</section>
{/if}

{#each shown as g (g.id)}
	<div class="caps"><span>{g.name} · {g.rows.length}</span></div>
	<div class="rows">
		{#each g.rows as p (p.id)}
			{@const key = `${p.id}-${g.id}`}
			<div class="row">
				<a class="info" href="/product/{p.id}" style="display: flex; align-items: center; gap: 12px">
					{#if p.image}<img class="thumb" src={p.image} alt="" loading="lazy" />{:else if p.needs_review}<span class="thumb" style="background: var(--warn-bg); color: var(--warn)">?</span>{:else}<span class="thumb">{initials(p.name)}</span>{/if}
					<span style="min-width: 0">
						<div class="nm" style:color={p.needs_review ? 'var(--warn)' : null}>{title(p)}</div>
						<div class="sm">{meta(p)}</div>
					</span>
				</a>
				{#if open === key && !p.homemade}
					<form method="POST" action="?/adjust" use:enhance={keep} class="stepper">
						<input type="hidden" name="product_id" value={p.id} />
						<input type="hidden" name="location_id" value={g.id} />
						<button name="delta" value="-1" aria-label="One less {p.name}">−</button>
						<span class="n">{p.here}</span>
						<button name="delta" value="1" aria-label="One more {p.name}">+</button>
					</form>
				{:else}
					<button
						class="qty"
						class:low={low(p)}
						aria-label="{p.here} {p.name}{p.homemade ? '' : ', tap to change'}"
						onclick={() => !p.homemade && (open = key)}
					>
						{p.here}
						{#if low(p)}<span class="tag">LOW · MIN {p.min_stock}</span>{/if}
					</button>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<section class="panel" style="margin-top: 14px">
		{#if search || place}
			<p class="muted" style="margin: 0">Nothing matches.</p>
		{:else}
			<b>Nothing in stock yet</b>
			<p class="muted" style="margin: 4px 0 0">Scan something in at the wall, use <a href="/scan">Scan</a> here, or <a href="/pack">pack &amp; label</a> your own goods.</p>
		{/if}
	</section>
{/each}

{#if empty.length && !place}
	<div class="caps">
		<span>Out of stock · {empty.length}</span>
		<button class="linkish" onclick={() => (showEmpty = !showEmpty)}>{showEmpty ? 'Hide' : 'Show'}</button>
	</div>
	{#if showEmpty}
		<div class="rows">
			{#each empty as p (p.id)}
				<a class="row" href="/product/{p.id}">
					{#if p.image}<img class="thumb" src={p.image} alt="" loading="lazy" />{:else if p.needs_review}<span class="thumb" style="background: var(--warn-bg); color: var(--warn)">?</span>{:else}<span class="thumb">{initials(p.name)}</span>{/if}
					<span class="info"><div class="nm" style:color={p.needs_review ? 'var(--warn)' : null}>{title(p)}</div><div class="sm">{meta(p)}</div></span>
					<span class="qty" class:low={low(p)}>0</span>
				</a>
			{/each}
		</div>
	{/if}
{/if}
