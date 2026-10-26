<script>
	import { onMount } from 'svelte';
	import { printLabels, drawLabel, printerKind, labelLength, supported, connectedName, explain } from './printer.js';

	/** labels: rows from labelData() */
	let { labels } = $props();

	let previews = $state();
	let busy = $state(false);
	let msg = $state('');
	let ok = $state(false);

	// Redraw when the labels, the printer kind or the P15 label length change.
	$effect(() => {
		if (!previews) return;
		void $printerKind, $labelLength;
		previews.replaceChildren(...labels.map((l) => drawLabel(l)));
	});

	async function go() {
		busy = true;
		msg = '';
		ok = false;
		try {
			const energy = Number(localStorage.getItem('printer.energy')) || undefined;
			await printLabels(labels, { energy });
			ok = true;
			msg = `Printed ${labels.length} label${labels.length === 1 ? '' : 's'} on ${connectedName() ?? 'the printer'}`;
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

<div class="previews" class:strip={$printerKind === 'p15'} bind:this={previews}></div>

{#if canPrint}
	<button onclick={go} disabled={busy}>
		{#if busy}<span class="spin"></span> Printing…{:else}Print {labels.length} label{labels.length === 1 ? '' : 's'}{/if}
	</button>
{:else}
	<p class="note warn">Bluetooth printing needs Chrome on Android over HTTPS.</p>
{/if}
{#if msg}<p class="note {ok ? 'good' : 'bad'}">{msg}</p>{/if}

<style>
	.previews { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; max-height: 50vh; overflow: auto; }
	.previews :global(canvas) {
		width: 100%; max-width: 384px; height: auto; display: block;
		border-radius: 6px; image-rendering: pixelated;
	}
	/* P15 labels are small: show them at a size you can read, not stretched. */
	.previews.strip :global(canvas) { width: auto; max-width: 100%; height: 72px; border-radius: 8px; }
</style>
