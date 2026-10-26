<script>
	import { onMount } from 'svelte';

	let { data } = $props();

	// Ticks live on the phone only: they're "in the trolley", not "in the pantry".
	// Stock changes when you scan the items in at home.
	let done = $state(new Set());
	onMount(() => {
		try { done = new Set(JSON.parse(localStorage.getItem('shop.done') || '[]')); } catch {}
	});
	function toggle(id) {
		const next = new Set(done);
		next.has(id) ? next.delete(id) : next.add(id);
		done = next;
		try { localStorage.setItem('shop.done', JSON.stringify([...next])); } catch {}
	}

	const todo = $derived(data.items.filter((p) => !done.has(p.id)));
	const got = $derived(data.items.filter((p) => done.has(p.id)));
	const meta = (p) =>
		[[p.brand?.toLowerCase() === p.name.toLowerCase() ? '' : p.brand, p.size].filter(Boolean).join(' '), `have ${p.total} of ${p.min}`]
			.filter(Boolean)
			.join(' · ');
	const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
</script>

<div class="head">
	<h1 class="page">Shopping</h1>
	{#if data.items.length}<span class="aside">{got.length} of {data.items.length} in the trolley</span>{/if}
</div>
<nav class="seg" aria-label="List" style="margin-top: 12px">
	<a class:on={data.list === 'groceries'} href="/shopping" data-sveltekit-replacestate style="display: grid; place-items: center; height: 44px; border-radius: 10px; color: inherit">Groceries{data.counts.groceries ? ` · ${data.counts.groceries}` : ''}</a>
	<a class:on={data.list === 'garage'} href="/shopping?list=garage" data-sveltekit-replacestate style="display: grid; place-items: center; height: 44px; border-radius: 10px; color: inherit">Garage{data.counts.garage ? ` · ${data.counts.garage}` : ''}</a>
</nav>
{#if data.ha}
	<p class="lede" style="display: flex; align-items: center; gap: 6px">
		<span style="width: 8px; height: 8px; border-radius: 4px; background: var(--good)"></span>Also on your Home Assistant {data.list === 'garage' ? 'garage' : 'grocery'} list
	</p>
{/if}

{#if data.items.length}
	<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax={data.items.length} aria-valuenow={got.length} aria-label="In the trolley">
		<span style="width: {(got.length / data.items.length) * 100}%"></span>
	</div>
{/if}

{#snippet item(p, ticked)}
	<label class="row" style="cursor: pointer; opacity: {ticked ? 0.55 : 1}">
		<input type="checkbox" class="tick" checked={ticked} onchange={() => toggle(p.id)} aria-label="{p.name} in the trolley" />
		{#if p.image}<img class="thumb" src={p.image} alt="" loading="lazy" />{:else}<span class="thumb">{initials(p.name)}</span>{/if}
		<span class="info">
			<div class="nm" style="text-decoration: {ticked ? 'line-through' : 'none'}">{p.name}</div>
			<div class="sm">{meta(p)}</div>
		</span>
		<span class="need">×{p.need}</span>
	</label>
{/snippet}

{#if todo.length}
	<div class="caps"><span>To buy</span></div>
	<div class="rows">{#each todo as p (p.id)}{@render item(p, false)}{/each}</div>
{/if}

{#if got.length}
	<div class="caps">
		<span>In the trolley</span>
		<button class="linkish" style="font-size: 12px" onclick={() => { done = new Set(); localStorage.removeItem('shop.done'); }}>Clear ticks</button>
	</div>
	<div class="rows">{#each got as p (p.id)}{@render item(p, true)}{/each}</div>
{/if}

{#if !data.items.length}
	<section class="panel" style="margin-top: 14px">
		<b>Nothing to buy</b>
		<p class="muted" style="margin: 4px 0 0">Set a minimum on a {data.list === 'garage' ? 'counted garage thing (bulbs, filters, screws)' : 'product'} and it shows up here when you're running low.</p>
	</section>
{:else if data.list === 'groceries'}
	<section class="banner blue" style="margin-top: 18px">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>
		<span style="flex: 1">Back home? Scan it all in; items leave the list once they're in stock.</span>
		<a class="btn" href="/scan?mode=in" style="width: auto; min-height: 44px; padding: 0 14px; font-size: 14px">Put away</a>
	</section>
{/if}

<style>
	.progress { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; margin-top: 14px; }
	.progress span { display: block; height: 100%; background: var(--good); transition: width 0.25s; }
	.tick { width: 26px; height: 26px; margin: 0; accent-color: var(--good); flex: none; }
	.need { font-size: 18px; font-weight: 700; background: var(--surface-2); border-radius: 10px; padding: 4px 10px; flex: none; }
</style>
