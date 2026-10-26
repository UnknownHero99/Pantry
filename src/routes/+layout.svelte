<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';

	let { data, children } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

		// A scan at the wall shows up on every open phone without a refresh.
		const es = new EventSource('/api/events');
		let t;
		es.onmessage = () => {
			clearTimeout(t);
			t = setTimeout(() => invalidateAll(), 300);
		};
		return () => es.close();
	});

	const tabs = [
		{ href: '/', label: 'Stock', icon: 'M4 7h16M4 12h16M4 17h10' },
		{ href: '/scan', label: 'Scan', icon: 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8' },
		{ href: '/pack', label: 'Pack', icon: 'M6 3h12v4H6zM5 7h14v13H5zM9 12h6M9 16h4' },
		{ href: '/shopping', label: 'Shop', icon: 'M5 6h15l-2 9H7L5 3H2M8 20h.01M17 20h.01' },
		{ href: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' }
	];
	const on = (href) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<div class="shell">
	{@render children()}
</div>

<nav class="nav">
	<div class="nav-in">
		{#each tabs as t}
			<a href={t.href} class:on={on(t.href)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d={t.icon} /></svg>
				{t.label}
				{#if t.href === '/more' && data.inboxCount}<span class="badge-n">{data.inboxCount}</span>{/if}
			</a>
		{/each}
	</div>
</nav>
