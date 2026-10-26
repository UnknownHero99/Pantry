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

	// Scan sits in the middle as the big button: it's what the app is for.
	const tabs = [
		{ href: '/', label: 'Stock', icon: 'M4 7h16M4 12h16M4 17h10' },
		{ href: '/shopping', label: 'Shop', icon: 'M3 4h2l2.4 11h11.2L21 7H6.2M9 20h.01M18 20h.01', badge: 'shopCount' },
		{ href: '/scan', label: 'Scan', icon: 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v5M17 8v8', scan: true },
		{ href: '/pack', label: 'Pack', icon: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM8 8h.01' },
		{ href: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01', badge: 'inboxCount', dots: true }
	];
	// Inbox, history and settings live under More; a product page under Stock.
	const under = { '/more': ['/inbox', '/history', '/settings'], '/': ['/product'] };
	const on = (href) =>
		href === '/'
			? page.url.pathname === '/' || under['/'].some((p) => page.url.pathname.startsWith(p))
			: page.url.pathname.startsWith(href) || (under[href] ?? []).some((p) => page.url.pathname.startsWith(p));
</script>

<div class="shell">
	{@render children()}
</div>

<nav class="nav" aria-label="Main">
	<div class="nav-in">
		{#each tabs as t}
			<a href={t.href} class:on={on(t.href)} class:scan={t.scan} aria-current={on(t.href) ? 'page' : undefined}>
				{#if t.scan}
					<span class="fab">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
					</span>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={t.dots ? 3.2 : 2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
				{/if}
				{t.label}
				{#if t.badge && data[t.badge]}<span class="badge">{data[t.badge]}</span>{/if}
			</a>
		{/each}
	</div>
</nav>
