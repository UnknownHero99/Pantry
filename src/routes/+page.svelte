<script>
	import { enhance } from '$app/forms';
	import { amount, daysUntil, fmtDate } from '$lib/format.js';

	let { data } = $props();

	let search = $state('');
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
				rows: data.products.filter((p) => p.at[l.id] && match(p)).map((p) => ({ ...p, here: p.at[l.id] }))
			}))
			.filter((g) => g.rows.length)
	);
	// One row per product + use-by date: "Beef mince ×3", not three identical lines.
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

	const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	const keep = () => async ({ update }) => update({ reset: false, invalidateAll: true });
</script>

<h1 class="page">Stock</h1>
<input type="text" placeholder="Search…" bind:value={search} />

{#if data.expiring.length}
	<section class="card">
		<h2>Use soon</h2>
		<div class="sub">Home-made packages expiring in the next 2 weeks</div>
		<ul class="list">
			{#each soon as i}
				{@const d = daysUntil(i.best_before)}
				<li>
					<span class="pip" style="background: {d < 0 ? 'var(--bad)' : 'var(--warn)'}"></span>
					<div class="what">
						<a href="/product/{i.product_id}">{i.name}</a>{i.n > 1 ? ` ×${i.n}` : ''} · {amount(i.sum, i.unit)}
						<div class="when">{i.location} · use by {fmtDate(i.best_before)}</div>
					</div>
					<span class="amt" style="color: {d < 0 ? 'var(--bad)' : 'var(--warn)'}">{d < 0 ? 'expired' : d === 0 ? 'today' : `${d} d`}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#each groups as g (g.id)}
	<section class="card">
		<div class="loc-h"><h2>{g.name}</h2><span>{g.rows.length} products</span></div>
		{#each g.rows as p (p.id)}
			<div class="prod">
				{#if p.image}<img class="thumb" src={p.image} alt="" loading="lazy" />{:else}<div class="thumb">{initials(p.name)}</div>{/if}
				<a class="info" href="/product/{p.id}">
					<div class="nm">{p.name}</div>
					<div class="sm">
						{#if p.homemade}{amount(p.amount_total, p.unit) || 'packages'}{:else}{p.brand || ''}{/if}
						{#if p.min_stock}· min {p.min_stock}{/if}
					</div>
				</a>
				{#if p.homemade}
					<span class="qty" class:low={p.min_stock && p.total < p.min_stock}>{p.here}</span>
				{:else}
					<form method="POST" action="?/adjust" use:enhance={keep} class="step">
						<input type="hidden" name="product_id" value={p.id} />
						<input type="hidden" name="location_id" value={g.id} />
						<button name="delta" value="-1" aria-label="Remove one">−</button>
						<span class="qty" class:low={p.min_stock && p.total < p.min_stock}>{p.here}</span>
						<button name="delta" value="1" aria-label="Add one">+</button>
					</form>
				{/if}
			</div>
		{/each}
	</section>
{:else}
	<section class="card">
		<h2>Nothing in stock yet</h2>
		<div class="sub">Scan something in at the wall, use <a href="/scan">Scan</a> here, or <a href="/pack">pack &amp; label</a> your own goods.</div>
	</section>
{/each}

{#if empty.length}
	<section class="card">
		<div class="loc-h">
			<h2>Out of stock</h2>
			<button class="linkish" onclick={() => (showEmpty = !showEmpty)}>{showEmpty ? 'Hide' : `Show ${empty.length}`}</button>
		</div>
		{#if showEmpty}
			{#each empty as p (p.id)}
				<div class="prod">
					{#if p.image}<img class="thumb" src={p.image} alt="" loading="lazy" />{:else}<div class="thumb">{initials(p.name)}</div>{/if}
					<a class="info" href="/product/{p.id}"><div class="nm">{p.name}</div><div class="sm">{p.brand || ''}</div></a>
					<span class="qty low">0</span>
				</div>
			{/each}
		{/if}
	</section>
{/if}
