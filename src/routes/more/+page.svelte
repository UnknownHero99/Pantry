<script>
	let { data } = $props();
	const s = $derived(data.summary);
</script>

<h1 class="page">More</h1>

<div class="pick" style="display: grid; gap: 10px; margin-top: 14px">
	<a class="card prod" href="/inbox" style="margin: 0; text-decoration: none; color: inherit">
		<div class="info"><div class="nm">Inbox</div><div class="sm">Barcodes that need a name</div></div>
		<span class="qty" class:low={s.inbox_count}>{s.inbox_count}</span>
	</a>
	<a class="card prod" href="/history" style="margin: 0; text-decoration: none; color: inherit">
		<div class="info"><div class="nm">History</div><div class="sm">Every scan, with undo</div></div>
	</a>
	<a class="card prod" href="/settings" style="margin: 0; text-decoration: none; color: inherit">
		<div class="info"><div class="nm">Settings</div><div class="sm">Locations, label printer</div></div>
	</a>
</div>
