<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<h1 class="page">Inbox</h1>
<p class="muted">Barcodes Open Food Facts didn't know. Name them, or merge into a product you already have (same thing, different pack).</p>

{#each data.items as p (p.id)}
	<section class="card">
		<div class="sub">Barcode {p.codes} · scanned {p.created_at.slice(0, 16)}</div>
		{#if form?.notFound === p.id}<p class="note warn">Still not on Open Food Facts — name it yourself.</p>{/if}
		<form method="POST" action="?/name" use:enhance>
			<input type="hidden" name="id" value={p.id} />
			<input type="text" name="name" placeholder="Name, e.g. Spaghetti 500 g" required />
			<input type="text" name="brand" placeholder="Brand (optional)" style="margin-top: 8px" />
			<button style="margin-top: 8px">Save name</button>
		</form>
		{#if data.products.length}
			<form method="POST" action="?/merge" use:enhance class="actions">
				<input type="hidden" name="id" value={p.id} />
				<select name="into" required>
					<option value="">Same as…</option>
					{#each data.products as o}<option value={o.id}>{o.name}</option>{/each}
				</select>
				<button class="ghost" style="flex: 0 0 auto; width: auto">Merge</button>
			</form>
		{/if}
		<div class="actions">
			<form method="POST" action="?/lookup" use:enhance>
				<input type="hidden" name="id" value={p.id} />
				<button class="ghost">Look up again</button>
			</form>
			<a class="btn ghost" href="/product/{p.id}">Full edit</a>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={p.id} />
				<button class="ghost">Delete</button>
			</form>
		</div>
	</section>
{:else}
	<section class="card"><p class="muted">Inbox is empty 🎉</p></section>
{/each}
