<script>
	import { onMount } from 'svelte';
	import Camera from '$lib/Camera.svelte';

	let { data } = $props();

	// Same rule as the wall unit: IN is sticky while you unload a bag, then
	// falls back to OUT because single removals are the everyday case.
	const REVERT_MS = 2 * 60 * 1000;
	let mode = $state('out');
	let location = $state('');
	let results = $state([]);
	let queued = $state(0);
	let revert;

	function setMode(m) {
		mode = m;
		clearTimeout(revert);
		if (m === 'in') revert = setTimeout(() => (mode = 'out'), REVERT_MS);
	}

	const QKEY = 'scan.queue';
	const readQ = () => {
		try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; }
	};
	const writeQ = (q) => {
		try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {}
		queued = q.length;
	};

	async function post(body) {
		const res = await fetch('/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	async function onscan(code) {
		if (mode === 'in') setMode('in'); // restart the revert timer
		const body = { code, mode, device: 'phone', location: location || undefined };
		try {
			show(await post(body));
		} catch {
			// Offline (cellar, garage…): keep it and replay when we're back.
			writeQ([...readQ(), body]);
			show({ status: 'queued', title: code, detail: 'Offline — will sync', count: '…', mode });
		}
	}

	function show(r) {
		results = [{ ...r, at: Date.now() }, ...results].slice(0, 6);
		if (r.status !== 'ok' && r.status !== 'queued') navigator.vibrate?.([60, 60, 60]);
	}

	async function flush() {
		const q = readQ();
		if (!q.length) return;
		const left = [];
		for (const b of q) {
			try { show(await post(b)); } catch { left.push(b); }
		}
		writeQ(left);
	}

	async function undo(r) {
		const res = await fetch('/api/undo', { method: 'POST', body: JSON.stringify({ event_id: r.event_id }), headers: { 'Content-Type': 'application/json' } });
		show(await res.json());
	}

	onMount(() => {
		queued = readQ().length;
		flush();
		addEventListener('online', flush);
		return () => {
			removeEventListener('online', flush);
			clearTimeout(revert);
		};
	});

	const colour = { ok: 'good', unknown: 'warn', empty: 'bad', error: 'bad', queued: 'warn' };
</script>

<h1 class="page">Scan</h1>

<div class="mode">
	<button class="in" class:on={mode === 'in'} onclick={() => setMode('in')}>＋ IN</button>
	<button class="out" class:on={mode === 'out'} onclick={() => setMode('out')}>− OUT</button>
</div>

{#if mode === 'in'}
	<select bind:value={location} style="margin-bottom: 12px">
		<option value="">Product's usual place</option>
		{#each data.locations as l}<option value={l.id}>{l.name}</option>{/each}
	</select>
{/if}

<Camera {onscan} />

{#if queued}<p class="note warn">{queued} scan{queued === 1 ? '' : 's'} waiting to sync</p>{/if}

{#each results as r, i (r.at)}
	<section class="card note {colour[r.status]}" style="margin-top: 12px">
		<div class="result">
			{#if r.image}<img src={r.image} alt="" />{:else}<div class="thumb"></div>{/if}
			<div style="min-width: 0">
				<div class="t">{r.title}</div>
				<div class="d">{r.mode === 'in' ? 'IN' : r.mode === 'out' ? 'OUT' : 'UNDO'} · {r.detail}</div>
				{#if r.status === 'unknown' && r.product_id}<a href="/product/{r.product_id}">Name it now →</a>{/if}
			</div>
			<div class="c">{r.count}</div>
		</div>
		{#if i === 0 && r.event_id}
			<button class="linkish" style="margin-top: 8px" onclick={() => undo(r)}>Undo</button>
		{/if}
	</section>
{/each}
