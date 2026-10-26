<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Camera from '$lib/Camera.svelte';
	import ScanResult from '$lib/ScanResult.svelte';

	let { data } = $props();

	// Same rule as the wall unit: PUT AWAY stays on while you unload a bag,
	// then falls back to TAKE OUT because single removals are the everyday case.
	const REVERT_MS = 2 * 60 * 1000;
	let mode = $state('out');
	let location = $state('');
	let last = $state(null);        // the big card
	let recent = $state([]);        // take-out: what this phone scanned before
	let trip = $state([]);          // put-away: this session, newest first
	let queued = $state(0);
	let deadline = $state(0);
	let now = $state(Date.now());

	const left = $derived(Math.max(0, Math.ceil((deadline - now) / 1000)));
	const tripItems = $derived(trip.reduce((n, r) => n + (r.units || 1), 0));
	const stillToBuy = $derived(data.toBuy.filter((n) => !trip.some((r) => r.title === n)));

	function setMode(m) {
		if (m === 'in' && mode !== 'in') trip = [];
		mode = m;
		deadline = m === 'in' ? Date.now() + REVERT_MS : 0;
	}

	const QKEY = 'scan.queue';
	const readQ = () => {
		try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; }
	};
	const writeQ = (q) => {
		try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {}
		queued = q.length;
	};

	async function api(url, body) {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body ?? {})
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	async function onscan(code) {
		if (mode === 'in') deadline = Date.now() + REVERT_MS; // restart the countdown
		const body = { code, mode, device: 'phone', location: location || undefined };
		// A first-time barcode waits on Open Food Facts; say so instead of looking stuck.
		const slow = setTimeout(() => show({ status: 'pending', code, title: code, mode }), 400);
		try {
			show(await api('/api/scan', body));
		} catch {
			// Offline (cellar, garage…): keep it and replay when we're back.
			writeQ([...readQ(), body]);
			show({ status: 'queued', code, title: code, mode });
		} finally {
			clearTimeout(slow);
		}
	}

	function show(r) {
		if (r.status === 'pending') return void (last = r);
		if (last && last.status !== 'pending' && last.event_id !== r.event_id && last.mode !== 'undo') {
			recent = [last, ...recent].slice(0, 5);
		}
		last = r;
		if (r.mode === 'in' && r.event_id) {
			trip = [r, ...trip.filter((t) => t.event_id !== r.event_id)];
		}
		if (r.status !== 'ok' && r.status !== 'queued') navigator.vibrate?.([60, 60, 60]);
	}

	async function onadjust(r, by) {
		if (mode === 'in') deadline = Date.now() + REVERT_MS;
		try { show(await api(`/api/scan/${r.event_id}/adjust`, { by })); } catch {}
	}
	async function onfix(r) {
		try { show(await api(`/api/scan/${r.event_id}/fix`)); } catch {}
	}
	async function onundo(r) {
		try {
			const u = await api('/api/undo', { event_id: r.event_id });
			trip = trip.filter((t) => t.event_id !== r.event_id);
			recent = recent.filter((t) => t.event_id !== r.event_id);
			last = u;
		} catch {}
	}

	async function flush() {
		const q = readQ();
		if (!q.length) return;
		const rest = [];
		for (const b of q) {
			try { show(await api('/api/scan', b)); } catch { rest.push(b); }
		}
		writeQ(rest);
	}

	onMount(() => {
		queued = readQ().length;
		flush();
		addEventListener('online', flush);
		// "Back home? Put away" on the shopping list lands here with ?mode=in.
		if (page.url.searchParams.get('mode') === 'in') setMode('in');
		const t = setInterval(() => {
			now = Date.now();
			if (mode === 'in' && deadline && now >= deadline) setMode('out');
		}, 1000);
		return () => {
			removeEventListener('online', flush);
			clearInterval(t);
		};
	});

	const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

<div class="edge" class:putting-away={mode === 'in'}>
	<Camera {onscan} />

	{#if mode === 'in'}
		<div class="band">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
			<b>PUTTING AWAY</b>
			{#if tripItems}<span>· {tripItems} item{tripItems === 1 ? '' : 's'}</span>{/if}
			<span class="t">take-out in <b>{mmss(left)}</b></span>
			<span class="drain" style="width: {(left / (REVERT_MS / 1000)) * 100}%"></span>
		</div>
	{/if}

	<div class="stack" style="margin-top: 14px">
		<div class="seg mode" role="group" aria-label="Mode">
			<button class:on={mode === 'out'} aria-pressed={mode === 'out'} onclick={() => setMode('out')}>TAKE OUT</button>
			<button class="in" class:on={mode === 'in'} aria-pressed={mode === 'in'} onclick={() => setMode('in')}>PUT AWAY</button>
		</div>

		{#if mode === 'in'}
			<div class="chips" style="margin-top: 0" role="group" aria-label="Put where">
				<button class="chip pick" class:on={!location} onclick={() => (location = '')}>Usual place</button>
				{#each data.locations as l (l.id)}
					<button class="chip pick" class:on={location === l.id} onclick={() => (location = l.id)}>{l.name}</button>
				{/each}
			</div>
		{/if}

		{#if queued}<p class="note warn">{queued} scan{queued === 1 ? '' : 's'} saved offline, sending when you're back on Wi-Fi.</p>{/if}

		{#if last}
			<div><ScanResult r={last} {onadjust} {onundo} {onfix} /></div>
		{:else}
			<p class="muted" style="text-align: center; margin: 22px 0">
				{mode === 'in' ? 'Scan each item as you put it away.' : 'Point the camera at a barcode or a PNTRY label.'}
			</p>
		{/if}

		{#if mode === 'in' && (trip.length || stillToBuy.length)}
			<div>
				{#if trip.length}<div class="caps" style="margin-top: 4px"><span>This trip · {tripItems}</span></div>{/if}
				<div class="rows">
					{#each trip.filter((t) => t.event_id !== last?.event_id) as t (t.event_id)}
						<div class="line" style="border-bottom: 1px solid var(--putaway-line); padding: 7px 0">
							{#if t.status === 'unknown'}
								<a href="/product/{t.product_id}" style="color: var(--warn)">New item · name it</a>
							{:else}
								<span>{t.title}</span>
							{/if}
							<b style="color: {t.status === 'unknown' ? 'var(--warn)' : 'var(--good)'}">+{t.units || 1}</b>
						</div>
					{/each}
				</div>
				{#if stillToBuy.length}
					<p class="muted" style="margin: 8px 0 0">Still to buy: {stillToBuy.slice(0, 4).join(', ')}{stillToBuy.length > 4 ? '…' : ''}</p>
				{/if}
			</div>
		{:else if mode === 'out' && recent.length}
			<div>
				<div class="caps" style="margin-top: 4px"><span>Earlier</span></div>
				{#each recent as t (t.event_id ?? t.code)}
					<div class="line" style="border-bottom: 1px solid var(--surface-2); padding: 7px 0">
						<span>{t.status === 'unknown' ? 'New item' : t.title}</span>
						<span class="dim">{t.mode === 'undo' ? 'undone' : t.status === 'empty' ? 'none in stock' : `${t.mode === 'in' ? '+' : '−'}${t.units || 1}`}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.band {
		position: relative; margin: 0 -16px; padding: 10px 16px; display: flex; align-items: center; gap: 8px;
		background: var(--accent); color: #fff; font-size: 14px;
	}
	.band svg { width: 20px; height: 20px; }
	.band b { letter-spacing: 1px; font-size: 15px; }
	.band span { color: #d6e6ff; }
	.band .t { margin-left: auto; }
	.band .t b { color: #fff; letter-spacing: 0; }
	.band .drain { position: absolute; left: 0; bottom: 0; height: 3px; background: #fff; transition: width 1s linear; }
</style>
