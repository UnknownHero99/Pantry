<script>
	import { onMount } from 'svelte';

	/** onscan(code) fires once per barcode; the same code is ignored for `cooldown` ms. */
	let { onscan, cooldown = 2500 } = $props();

	let video = $state();
	let err = $state('');
	let typing = $state(false);
	let manual = $state('');
	let input = $state();
	let track = $state(null);
	let torch = $state(false);
	let canTorch = $state(false);

	onMount(() => {
		if (!('BarcodeDetector' in window)) {
			err = 'This browser can’t read barcodes with the camera. Chrome on Android can; here, type the code.';
			typing = true;
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
				track = stream.getVideoTracks()[0];
				canTorch = !!track?.getCapabilities?.().torch;
				tick();
			} catch (e) {
				err = `Camera unavailable: ${e.message}`;
				typing = true;
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

	async function toggleTorch() {
		torch = !torch;
		try {
			await track.applyConstraints({ advanced: [{ torch }] });
		} catch {
			torch = false;
		}
	}

	function openTyping() {
		typing = !typing;
		if (typing) setTimeout(() => input?.focus(), 0);
	}

	function submit(e) {
		e.preventDefault();
		if (manual.trim()) onscan(manual.trim());
		manual = '';
	}
</script>

<div class="cam" class:off={err}>
	{#if !err}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted></video>
		<div class="frame" aria-hidden="true"><span class="laser"></span></div>
		<button class="over left" onclick={openTyping}>{typing ? 'Close' : 'Type a code'}</button>
		{#if canTorch}
			<button class="over right" class:lit={torch} onclick={toggleTorch} aria-label={torch ? 'Torch off' : 'Torch on'} aria-pressed={torch}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2h8l-2 6v4l-2 10-2-10V8z" /></svg>
			</button>
		{/if}
	{:else}
		<p>{err}</p>
	{/if}
</div>
{#if typing}
	<form class="manual" onsubmit={submit}>
		<input bind:this={input} type="text" inputmode="numeric" placeholder="Barcode or PNTRY label code" bind:value={manual} aria-label="Barcode" />
		<button style="width: auto">Go</button>
	</form>
{/if}

<style>
	/* Full width under the top of the screen, like a camera app. */
	.cam { position: relative; margin: 0 -16px; height: min(300px, 38vh); background: #000; overflow: hidden; }
	.cam.off { height: auto; background: var(--surface-2); padding: 18px 16px; color: var(--ink-2); font-size: 14px; }
	.cam.off p { margin: 0; }
	video { width: 100%; height: 100%; object-fit: cover; display: block; }
	.frame {
		position: absolute; left: 15%; right: 15%; top: 28%; bottom: 28%;
		border-radius: 14px; box-shadow: 0 0 0 999px rgb(0 0 0 / 0.3);
		background:
			linear-gradient(#fff, #fff) top left / 28px 4px no-repeat,
			linear-gradient(#fff, #fff) top left / 4px 28px no-repeat,
			linear-gradient(#fff, #fff) top right / 28px 4px no-repeat,
			linear-gradient(#fff, #fff) top right / 4px 28px no-repeat,
			linear-gradient(#fff, #fff) bottom left / 28px 4px no-repeat,
			linear-gradient(#fff, #fff) bottom left / 4px 28px no-repeat,
			linear-gradient(#fff, #fff) bottom right / 28px 4px no-repeat,
			linear-gradient(#fff, #fff) bottom right / 4px 28px no-repeat;
	}
	.laser { position: absolute; left: 12px; right: 12px; top: 50%; height: 3px; border-radius: 2px; background: #6fb0ff; animation: sweep 1.6s ease-in-out infinite alternate; }
	@keyframes sweep { from { transform: translateY(-28px); } to { transform: translateY(28px); } }
	@media (prefers-reduced-motion: reduce) { .laser { animation: none; } }
	.over {
		position: absolute; top: 14px; width: auto; min-height: 44px; padding: 0 14px;
		border-radius: 22px; background: rgb(14 17 22 / 0.7); color: #fff; font-size: 14px; font-weight: 500;
	}
	.over.left { left: 14px; }
	.over.right { right: 14px; width: 44px; padding: 0; }
	.over.right svg { width: 22px; height: 22px; }
	.over.lit { background: #fff; color: #0e1116; }
	.manual { display: flex; gap: 8px; margin-top: 12px; }
</style>
