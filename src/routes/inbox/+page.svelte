<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
	const code = (c) => (c?.length === 13 ? `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}` : c);
</script>

<a class="back" href="/more">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
	More
</a>
<h1 class="page">Inbox</h1>
<p class="lede">Barcodes Open Food Facts and its sister databases didn't know. Name each one once; after that it's recognised.</p>

<div class="rows" style="margin-top: 10px">
	{#each data.items as p (p.id)}
		<div class="row">
			<a class="info" href="/product/{p.id}" style="display: flex; align-items: center; gap: 12px">
				<span class="thumb" style="background: var(--warn-bg); color: var(--warn)">?</span>
				<span style="min-width: 0">
					<div class="nm" style="letter-spacing: 0.5px">{code(p.codes?.split(', ')[0])}</div>
					<div class="sm">scanned {p.created_at.slice(0, 10).split('-').reverse().join('.')}</div>
				</span>
			</a>
			<a class="btn" href="/product/{p.id}" style="width: auto; min-height: 40px; padding: 0 14px; font-size: 14px">Name it</a>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={p.id} />
				<button class="icon-btn" aria-label="Delete {p.codes}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
				</button>
			</form>
		</div>
	{:else}
		<section class="panel"><b>All named</b><p class="muted" style="margin: 4px 0 0">New barcodes the food database doesn't know will show up here.</p></section>
	{/each}
</div>
