<script>
	let { data } = $props();
	const s = $derived(data.summary);

	const links = [
		{ href: '/inbox', title: 'Inbox', sub: 'Barcodes that need a name', icon: 'M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z', badge: true },
		{ href: '/history', title: 'History', sub: 'Every scan, with undo', icon: 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
		{ href: '/settings', title: 'Settings', sub: 'Locations, label printer, Home Assistant', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' }
	];
</script>

<h1 class="page">More</h1>

<div class="rows" style="margin-top: 14px">
	{#each links as l}
		<a class="row" href={l.href}>
			<span class="thumb" style="width: 44px; height: 44px; color: var(--ink-2)">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={l.icon} /></svg>
			</span>
			<span class="info"><div class="nm">{l.title}</div><div class="sm">{l.sub}</div></span>
			{#if l.badge && s.inbox_count}<span class="badge" style="position: static">{s.inbox_count}</span>{/if}
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
		</a>
	{/each}
</div>
