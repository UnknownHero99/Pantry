<script>
	import { enhance } from '$app/forms';
	let { data } = $props();

	const verb = { in: 'In', out: 'Out', adjust: 'Adjusted', pack: 'Packed' };
	const when = (ts) => new Date(ts.replace(' ', 'T') + 'Z').toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
</script>

<h1 class="page">History</h1>

<section class="card">
	<ul class="list">
		{#each data.events as e (e.id)}
			<li style="opacity: {e.undone ? 0.45 : 1}">
				<span class="pip" style="background: {e.delta > 0 ? 'var(--good)' : e.delta < 0 ? 'var(--bad)' : 'var(--muted)'}"></span>
				<div class="what">
					<a href="/product/{e.product_id}">{e.name ?? 'Deleted product'}</a>
					<div class="when">
						{verb[e.type] ?? e.type}{e.location ? ` · ${e.location}` : ''} · {e.device ?? ''} · {when(e.ts)}
						{#if e.delta === 0 && e.type === 'out'} · <b>nothing in stock</b>{/if}
						{#if e.undone} · undone{/if}
					</div>
				</div>
				<span class="amt">{e.delta > 0 ? '+' : ''}{e.delta || ''}</span>
				{#if !e.undone && e.delta}
					<form method="POST" action="?/undo" use:enhance>
						<input type="hidden" name="id" value={e.id} />
						<button class="linkish">Undo</button>
					</form>
				{/if}
			</li>
		{:else}
			<li class="muted">No scans yet.</li>
		{/each}
	</ul>
</section>
