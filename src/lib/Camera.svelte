<script>
	import { onMount } from 'svelte';

	/** onscan(code) fires once per barcode; the same code is ignored for `cooldown` ms. */
	let { onscan, cooldown = 2500 } = $props();

	let video = $state();
	let err = $state('');
	let manual = $state('');

	onMount(() => {
		if (!('BarcodeDetector' in window)) {
			err = 'This browser can’t read barcodes from the camera — use Chrome on Android, or type the code below.';
			return;
		}
		let stream, raf, stopped = false;
		let last = '', lastAt = 0;
		const detector = new window.BarcodeDetector({
			formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']
		});

		(async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment', width: { ideal: 1280 } },
					audio: false
				});
				if (stopped) return stream.getTracks().forEach((t) => t.stop());
				video.srcObject = stream;
				await video.play();
				tick();
			} catch (e) {
				err = `Camera unavailable: ${e.message}`;
			}
		})();

		async function tick() {
			if (stopped) return;
			try {
				const [hit] = await detector.detect(video);
				const now = Date.now();
				if (hit && (hit.rawValue !== last || now - lastAt > cooldown)) {
					last = hit.rawValue;
					lastAt = now;
					navigator.vibrate?.(40);
					onscan(hit.rawValue);
				}
			} catch {}
			raf = setTimeout(tick, 150);
		}

		return () => {
			stopped = true;
			clearTimeout(raf);
			stream?.getTracks().forEach((t) => t.stop());
		};
	});

	function submit(e) {
		e.preventDefault();
		if (manual.trim()) onscan(manual.trim());
		manual = '';
	}
</script>

<div class="cam">
	{#if !err}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted></video>
		<div class="frame"></div>
	{:else}
		<p class="note warn">{err}</p>
	{/if}
</div>
<form class="manual" onsubmit={submit}>
	<input type="text" inputmode="numeric" placeholder="…or type a barcode" bind:value={manual} />
	<button class="ghost" style="width:auto">Go</button>
</form>

<style>
	.cam { position: relative; border-radius: var(--r); overflow: hidden; background: #000; aspect-ratio: 4 / 3; }
	.cam:has(.note) { background: none; aspect-ratio: auto; }
	video { width: 100%; height: 100%; object-fit: cover; display: block; }
	.frame {
		position: absolute; inset: 22% 12%;
		border: 3px solid rgb(255 255 255 / 0.85); border-radius: 14px;
		box-shadow: 0 0 0 999px rgb(0 0 0 / 0.25);
	}
	.manual { display: flex; gap: 8px; margin-top: 10px; }
</style>
