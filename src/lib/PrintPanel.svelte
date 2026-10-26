<script>
	import { onMount } from 'svelte';
	import { renderLabel } from './label.js';
	import { print, supported, connectedName, explain } from './catprinter.js';

	/** labels: rows from labelData() */
	let { labels } = $props();

	let previews = $state();
	let busy = $state(false);
	let msg = $state('');
	let ok = $state(false);

	$effect(() => {
		if (!previews) return;
		previews.replaceChildren(...labels.map((l) => renderLabel(l)));
	});

	async function go() {
		busy = true;
		msg = '';
		ok = false;
		try {
			const energy = Number(localStorage.getItem('printer.energy')) || undefined;
			await print(labels.map((l) => renderLabel(l)), { energy });
			ok = true;
			msg = `Printed ${labels.length} label${labels.length === 1 ? '' : 's'} on ${connectedName() ?? 'printer'}`;
		} catch (e) {
			msg = explain(e);
			console.warn('print failed', e);
		} finally {
			busy = false;
		}
	}

	let canPrint = $state(true);
	onMount(() => (canPrint = supported()));
</script>

<div class="previews" bind:this={previews}></div>

{#if canPrint}
	<button onclick={go} disabled={busy}>
		{#if busy}<span class="spin"></span> Printing…{:else}🖨 Print {labels.length} label{labels.length === 1 ? '' : 's'}{/if}
	</button>
{:else}
	<p class="note warn">Bluetooth printing needs Chrome on Android over HTTPS.</p>
{/if}
{#if msg}<p class="note {ok ? 'good' : 'bad'}">{msg}</p>{/if}

<style>
	.previews { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; max-height: 50vh; overflow: auto; }
	.previews :global(canvas) {
		width: 100%; max-width: 384px; height: auto; display: block;
		border: 1px solid var(--border); border-radius: 6px; image-rendering: pixelated;
	}
</style>
