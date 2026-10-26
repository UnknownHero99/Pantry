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
</script>

<h1 class="page">Shopping list</h1>
<p class="muted">
	Everything below its minimum stock.
	{#if data.ha}Synced to Home Assistant.{/if}
</p>

<section class="card">
	{#each data.items as p (p.id)}
		<label class="prod" style="cursor: pointer; opacity: {done.has(p.id) ? 0.45 : 1}">
			<input type="checkbox" checked={done.has(p.id)} onchange={() => toggle(p.id)} style="width: 22px; height: 22px" />
			<div class="info">
				<div class="nm" style="text-decoration: {done.has(p.id) ? 'line-through' : 'none'}">{p.name}</div>
				<div class="sm">{p.brand || ''} · have {p.total}</div>
			</div>
			<span class="qty">×{p.need}</span>
		</label>
	{:else}
		<p class="muted">Nothing needed. Set a minimum stock on a product to have it show up here.</p>
	{/each}
</section>
{#if done.size}
	<button class="ghost" style="margin-top: 12px" onclick={() => { done = new Set(); localStorage.removeItem('shop.done'); }}>Clear ticks</button>
{/if}
