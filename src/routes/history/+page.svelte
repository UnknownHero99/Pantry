<script>
	import { enhance } from '$app/forms';
	let { data } = $props();

	const icons = {
		out: 'M12 5v14M6 13l6 6 6-6',
		in: 'M12 19V5M6 11l6-6 6 6',
		pack: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z',
		adjust: 'M4 12h16M12 4v16',
		drift: 'M12 3l10 18H2L12 3zM12 10v4M12 17.5h.01',
		move: 'M5 12h14M13 6l6 6-6 6',
		took: 'M12 5v14M6 13l6 6 6-6',
		back: 'M12 19V5M6 11l6-6 6 6'
	};
	const filters = [['all', 'All'], ['wall', 'Wall'], ['phones', 'Phones']];
	const keep = () => async ({ update }) => update({ reset: false });
</script>

<a class="back" href="/more">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
	More
</a>
<h1 class="page">History</h1>

<nav class="chips" aria-label="Filter">
	{#each filters as [f, label]}
		<a class="chip" class:on={data.filter === f} href="?f={f}" data-sveltekit-replacestate data-sveltekit-noscroll>{label}</a>
	{/each}
	{#if data.issues || data.filter === 'issues'}
		<a class="chip" class:on={data.filter === 'issues'} class:warn={data.filter !== 'issues'} href="?f=issues" data-sveltekit-replacestate data-sveltekit-noscroll>
			Count issues <span class="n">{data.issues}</span>
		</a>
	{/if}
</nav>

{#each data.days as day (day.label)}
	<div class="caps"><span>{day.label}</span></div>
	<div class="rows">
		{#each day.rows as e (e.ids)}
			<div class="row {e.kind}" style="min-height: 60px; opacity: {e.undone ? 0.45 : 1}">
				<span class="ic" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d={icons[e.kind]} /></svg>
				</span>
				<a class="info" href="/product/{e.product_id}">
					<div class="nm" style="color: {e.unknown ? 'var(--warn)' : 'inherit'}">{e.name}</div>
					<div class="sm">{e.sub}{e.undone ? ' · undone' : ''}</div>
				</a>
				<span class="d">{['move', 'took', 'back'].includes(e.kind) ? '' : `${e.delta > 0 ? '+' : e.delta < 0 ? '−' : ''}${Math.abs(e.delta)}`}</span>
				{#if !e.undone && e.delta}
					<form method="POST" action="?/undo" use:enhance={keep}>
						<input type="hidden" name="ids" value={e.ids} />
						<button class="icon-btn" aria-label="Undo {e.name}">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
						</button>
					</form>
				{:else}
					<span style="width: 40px; flex: none"></span>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<p class="muted" style="margin-top: 18px">{data.filter === 'all' ? 'No scans yet.' : 'Nothing here.'}</p>
{/each}

<style>
	.ic { width: 36px; height: 36px; border-radius: 18px; flex: none; display: grid; place-items: center; background: var(--surface-2); color: var(--ink-2); }
	.ic svg { width: 18px; height: 18px; }
	.d { font-size: 17px; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
	.in .ic { background: var(--putaway-card); color: var(--accent-text); }
	.in .d { color: var(--accent-text); }
	.pack .ic { background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good); }
	.pack .d { color: var(--good); }
	.drift .ic { background: var(--warn-bg); color: var(--warn); }
	.drift .d { color: var(--warn); }
</style>
