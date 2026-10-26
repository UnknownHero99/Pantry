<script>
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { amount, daysUntil } from '$lib/format.js';

	let { data } = $props();

	let search = $state('');
	let searchBox = $state();
	let place = $state(0); // top-level place id within the space, 0 = all
	let open = $state(''); // `${product}-${location}` whose −/+ is showing
	let showEmpty = $state(false);
	let picking = $state(false); // the space switcher sheet

	const byId = $derived(new Map(data.tree.map((l) => [l.id, l])));
	const space = $derived(byId.get(data.spaceId));
	const spaces = $derived(data.tree.filter((l) => l.kind === 'space'));
	const garage = $derived(space?.list === 'garage');
	const children = (id) => data.tree.filter((l) => l.parent_id === id);
	/** A location and everything inside it. */
	function within(id) {
		const out = [id];
		for (let i = 0; i < out.length; i++) for (const c of children(out[i])) out.push(c.id);
		return new Set(out);
	}
	const inSpace = (p, sid) => Object.keys(p.at).some((k) => byId.get(Number(k))?.space_id === sid);

	const match = (p) => {
		const s = search.trim().toLowerCase();
		return [p.name, p.brand, p.fits, p.category].some((v) => (v || '').toLowerCase().includes(s));
	};

	// Top-level places of this space, each with its own rows and its boxes / sub-places.
	let sections = $derived(
		children(data.spaceId).map((pl) => ({
			...pl,
			rows: data.products.filter((p) => p.at[pl.id]).map((p) => ({ ...p, here: p.at[pl.id] })),
			inner: children(pl.id).map((b) => {
				const ids = within(b.id);
				const things = data.products.filter((p) => Object.keys(p.at).some((k) => ids.has(Number(k))));
				return { ...b, things };
			})
		}))
	);
	let shown = $derived(sections.filter((s) => (s.rows.length || s.inner.length) && (!place || s.id === place)));
	let items = $derived(data.products.filter((p) => inSpace(p, data.spaceId)).reduce((n, p) => n + (p.counted ? p.total : 1), 0));

	// Search looks everywhere, and answers with the path.
	let found = $derived(search.trim() ? data.products.filter((p) => p.total > 0 && match(p)) : []);
	const paths = (p) => Object.keys(p.at).map((k) => byId.get(Number(k))?.path).filter(Boolean);

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
	let empty = $derived(data.products.filter((p) => p.total === 0 && p.list === space?.list && match(p)));
	const unsorted = $derived(children(data.spaceId).find((l) => /unsorted/i.test(l.name)));
	const unsortedCount = $derived(unsorted ? data.products.filter((p) => p.at[unsorted.id]).length : 0);
	const addTo = $derived(unsorted ?? children(data.spaceId)[0]);

	const low = (p) => p.min_stock > 0 && p.total < p.min_stock;
	const pretty = (c) => (c?.length === 13 ? `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}` : c);
	const title = (p) => (p.needs_review ? 'New item · name it' : p.name);
	const meta = (p) =>
		p.needs_review
			? pretty(p.name.replace(/^Unknown /, ''))
			: p.homemade
				? amount(p.amount_total, p.unit) || 'packages'
				: [p.brand?.toLowerCase() === p.name.toLowerCase() ? '' : p.brand, p.size, p.fits ? `fits ${p.fits}` : ''].filter(Boolean).join(' · ');
	const status = (p) => (p.loan ? `Lent to ${p.loan.person}` : p.taken_at ? 'In use' : '');
	const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	const keep = () => async ({ update }) => update({ reset: false, invalidateAll: true });
	const days = (d) => (d < 0 ? 'expired' : d === 0 ? 'today' : `${d} d`);
	const spaceSub = (s) => children(s.id).filter((c) => !/unsorted/i.test(c.name)).map((c) => c.name).join(' · ');
	const spaceCount = (s) => data.products.filter((p) => inSpace(p, s.id)).length;

	function pickSpace(s) {
		picking = false;
		place = 0;
		goto(s.id === data.homeId ? '/' : `/?space=${s.id}`, { noScroll: true, keepFocus: true });
	}
</script>

{#snippet thumb(p)}
	{#if p.image}<img class="thumb" src={p.image} alt="" loading="lazy" />{:else if p.needs_review}<span class="thumb" style="background: var(--warn-bg); color: var(--warn)">?</span>{:else}<span class="thumb">{initials(p.name)}</span>{/if}
{/snippet}

{#snippet row(p, locId, sub = meta(p))}
	{@const key = `${p.id}-${locId}`}
	<div class="row">
		<a class="info" href="/product/{p.id}" style="display: flex; align-items: center; gap: 12px">
			{@render thumb(p)}
			<span style="min-width: 0">
				<div class="nm" style:color={p.needs_review ? 'var(--warn)' : null}>{title(p)}</div>
				<div class="sm">{sub}</div>
			</span>
		</a>
		{#if !p.counted}
			{#if status(p)}<span class="tag-chip" class:lent={p.loan}>{status(p)}</span>{/if}
		{:else if open === key && !p.homemade}
			<form method="POST" action="?/adjust" use:enhance={keep} class="stepper">
				<input type="hidden" name="product_id" value={p.id} />
				<input type="hidden" name="location_id" value={locId} />
				<button name="delta" value="-1" aria-label="One less {p.name}">−</button>
				<span class="n">{p.at[locId]}</span>
				<button name="delta" value="1" aria-label="One more {p.name}">+</button>
			</form>
		{:else}
			<button class="qty" class:low={low(p)} aria-label="{p.at[locId]} {p.name}{p.homemade ? '' : ', tap to change'}" onclick={() => !p.homemade && (open = key)}>
				{p.at[locId]}
				{#if low(p)}<span class="tag">LOW · MIN {p.min_stock}</span>{/if}
			</button>
		{/if}
	</div>
{/snippet}

<div class="head">
	<button class="space-pick" onclick={() => (picking = true)} aria-haspopup="dialog">
		{space?.name}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
	</button>
	<span class="aside">{items} {garage ? 'things' : `item${items === 1 ? '' : 's'}`}</span>
</div>

<div class="tiles">
	{#if garage}
		<a class="tile" href="/shopping?list=garage"><div class="k">TO BUY</div><div class="v">{data.garageLow}</div></a>
		<a class="tile" href="#lent" onclick={() => (search = '', place = 0)}><div class="k">LENT OUT</div><div class="v" class:warn={data.lentOut}>{data.lentOut}</div></a>
		<a class="tile" class:warn={unsortedCount} href={unsorted ? `/place/${unsorted.id}` : '#'}><div class="k">UNSORTED</div><div class="v">{unsortedCount}</div></a>
	{:else}
		<a class="tile" href="/shopping"><div class="k">TO BUY</div><div class="v">{data.shopCount - data.garageLow}</div></a>
		<a class="tile" href="#soon"><div class="k">USE SOON</div><div class="v" class:warn={data.expiring.length}>{data.expiring.length}</div></a>
		<a class="tile" class:warn={data.inboxCount} href="/inbox"><div class="k">TO NAME</div><div class="v">{data.inboxCount}</div></a>
	{/if}
</div>

<label class="search">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
	<input type="search" bind:this={searchBox} placeholder={garage ? 'Where’s the…' : 'Search everywhere…'} bind:value={search} aria-label="Search everywhere" />
</label>

{#if found.length || search.trim()}
	<div class="caps"><span>{found.length} found · everywhere</span></div>
	<div class="rows">
		{#each found as p (p.id)}
			{@render row(p, Number(Object.keys(p.at)[0]), [status(p), ...paths(p)].filter(Boolean).join(' · '))}
		{:else}
			<p class="muted">Nothing called “{search.trim()}” anywhere.</p>
		{/each}
	</div>
{:else}
	{#if garage}
		<div class="row2" style="margin-top: 12px">
			<a class="btn" href="/scan">Scan a box</a>
			{#if addTo}<a class="btn ghost" href="/place/{addTo.id}?fill=1">+ Add a thing</a>{/if}
		</div>
	{/if}

	{#if sections.filter((s) => s.rows.length || s.inner.length).length > 1}
		<div class="chips" role="group" aria-label="Place">
			<button class="chip" class:on={!place} onclick={() => (place = 0)}>All</button>
			{#each sections.filter((s) => s.rows.length || s.inner.length) as s (s.id)}
				<button class="chip" class:on={place === s.id} onclick={() => (place = place === s.id ? 0 : s.id)}>{s.name} <span class="n">{s.rows.length + s.inner.length}</span></button>
			{/each}
		</div>
	{/if}

	{#if !garage && soon.length && !place}
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

	{#if garage && data.lentOut && !place}
		<section id="lent" class="panel warn" style="margin-top: 14px">
			<div class="caps"><span>Lent out</span></div>
			{#each data.products.filter((p) => p.loan) as p (p.id)}
				<a class="line" href="/product/{p.id}" style="color: inherit">
					<span>{p.name} <span class="dim">· {p.loan.person}</span></span>
					<span class="dim">{p.loan.since.slice(0, 10).split('-').reverse().join('.')}</span>
				</a>
			{/each}
		</section>
	{/if}

	{#each shown as s (s.id)}
		<div class="caps"><span>{s.name}</span><span>{s.rows.length + s.inner.length || ''}</span></div>
		{#if s.inner.length}
			<div class="boxes">
				{#each s.inner as b (b.id)}
					<a class="box" href="/place/{b.id}">
						<span class="code">{b.kind === 'box' ? b.code || '□' : '▤'}</span>
						<span style="flex: 1; min-width: 0">
							<span class="nm">{b.name}</span>
							<span class="sm">{b.things.length ? b.things.slice(0, 4).map((t) => t.name).join(', ') + (b.things.length > 4 ? '…' : '') : 'Empty'}</span>
						</span>
						<span class="muted">{b.things.length}</span>
					</a>
				{/each}
			</div>
		{/if}
		{#if s.rows.length}
			<div class="rows">
				{#each s.rows as p (p.id)}{@render row(p, s.id)}{/each}
			</div>
		{/if}
	{:else}
		<section class="panel" style="margin-top: 14px">
			{#if garage}
				<b>Nothing here yet</b>
				<p class="muted" style="margin: 4px 0 0">Add shelves in <a href="/settings">Settings</a>, print box labels, then <a href={addTo ? `/place/${addTo.id}?fill=1` : '/settings'}>add things</a> one box at a time.</p>
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
						{@render thumb(p)}
						<span class="info"><div class="nm">{title(p)}</div><div class="sm">{meta(p)}</div></span>
						<span class="qty" class:low={low(p)}>0</span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
{/if}

{#if picking}
	<button class="scrim" aria-label="Close" onclick={() => (picking = false)}></button>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Choose a space">
		<div class="grip"></div>
		<div class="caps" style="margin-top: 0"><span>Spaces</span></div>
		{#each spaces as s (s.id)}
			<button class="space" class:on={s.id === data.spaceId} onclick={() => pickSpace(s)}>
				<span style="flex: 1; min-width: 0">
					<span class="nm">{s.name}{#if s.home}<span class="home">HOME</span>{/if}</span>
					<span class="sm">{spaceSub(s) || 'No places yet'} · {spaceCount(s)} {s.list === 'garage' ? 'things' : 'items'}</span>
				</span>
				{#if s.list === 'garage' && data.lentOut}<span class="muted" style="color: var(--warn)">{data.lentOut} lent out</span>{/if}
			</button>
		{/each}
		<button class="linkish" style="font-size: 16px; padding: 14px 4px; text-align: left" onclick={() => { picking = false; searchBox?.focus(); }}>Search everywhere</button>
		<a href="/settings#places" class="muted" style="padding: 4px 4px 0">+ Add a space or place</a>
	</div>
{/if}

<style>
	.space-pick {
		width: auto; min-height: 44px; padding: 0; background: none; color: var(--ink);
		font-size: 30px; font-weight: 700; letter-spacing: -0.5px; gap: 6px;
	}
	.space-pick svg { width: 22px; height: 22px; color: var(--muted); }
	.tag-chip { flex: none; font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 8px; background: var(--surface-2); color: var(--ink-2); }
	.tag-chip.lent { background: var(--warn-bg); color: var(--warn); }
	.boxes { display: flex; flex-direction: column; gap: 6px; }
	.box { display: flex; align-items: center; gap: 12px; background: var(--surface); border-radius: 14px; padding: 10px 12px; color: inherit; }
	.box .code { width: 42px; height: 42px; border-radius: 10px; background: var(--surface-3); display: grid; place-items: center; flex: none; font-size: 13px; font-weight: 700; color: var(--ink-2); }
	.box .nm { display: block; font-size: 16px; font-weight: 500; }
	.box .sm { display: block; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.scrim { position: fixed; inset: 0; z-index: 40; background: rgb(0 0 0 / 0.55); border-radius: 0; min-height: 0; padding: 0; }
	.sheet {
		position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; max-width: 620px; margin: 0 auto;
		background: var(--surface); border-radius: 22px 22px 0 0; padding: 10px 16px calc(24px + env(safe-area-inset-bottom));
		display: flex; flex-direction: column; gap: 6px;
	}
	.grip { width: 40px; height: 4px; border-radius: 2px; background: var(--surface-3); align-self: center; margin-bottom: 8px; }
	.space {
		justify-content: flex-start; text-align: left; min-height: 64px; padding: 8px 14px; gap: 12px;
		background: var(--surface-2); color: var(--ink); border: 2px solid transparent; border-radius: 16px; font-weight: 400;
	}
	.space.on { border-color: var(--accent-text); background: var(--accent-soft); }
	.space .nm { display: block; font-size: 17px; font-weight: 700; }
	.space .sm { display: block; font-size: 13px; color: var(--muted); }
	.home { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: var(--accent-text); margin-left: 8px; }
</style>
