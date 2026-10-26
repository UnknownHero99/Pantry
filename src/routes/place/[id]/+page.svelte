<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PrintPanel from '$lib/PrintPanel.svelte';

	let { data, form } = $props();
	const n = $derived(data.node);
	const isBox = $derived(n.kind === 'box');
	const where = $derived(n.path.split(' › ').slice(0, -1).join(' › '));

	let filling = $state(page.url.searchParams.get('fill') === '1');
	let showLabel = $state(false);
	let moving = $state(false);
	let renaming = $state(false);

	// Fill-a-box form
	let name = $state('');
	let kind = $state('tool');
	let fits = $state('');
	let counted = $state(false);
	let qty = $state(1);
	let barcode = $state('');
	let photo = $state('');
	let busy = $state(false);
	let nameBox = $state();

	/** Shrink the phone's photo to 640 px before it leaves the phone. */
	async function onPhoto(e) {
		const file = e.currentTarget.files?.[0];
		if (!file) return;
		const bmp = await createImageBitmap(file);
		const s = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
		const cv = document.createElement('canvas');
		cv.width = Math.round(bmp.width * s);
		cv.height = Math.round(bmp.height * s);
		cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
		photo = cv.toDataURL('image/jpeg', 0.8);
		setTimeout(() => nameBox?.focus(), 0);
	}

	const boxLabel = (b) => ({ box: true, id: b.id, code: b.code, name: b.name, path: b.path.split(' › ').slice(0, -1).join(' › ') });
	const newLabels = $derived(form?.newBoxes ? data.inner.filter((b) => form.newBoxes.includes(b.id)).map(boxLabel) : null);
	const backHref = $derived(n.depth > 1 ? `/place/${n.parent_id}` : `/?space=${n.space_id}`);
	const keep = () => async ({ update }) => update({ reset: false });
	const initials = (s) => s.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
</script>

<a class="back" href={backHref}>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
	{where}
</a>

<div style="display: flex; gap: 14px; align-items: center">
	<span class="code-tile" class:box={isBox}>{isBox ? n.code || '□' : '▤'}</span>
	<div style="flex: 1; min-width: 0">
		<div class="caps" style="margin: 0; color: var(--accent-text)"><span>{isBox ? 'Box' : 'Place'} · {data.things.length} thing{data.things.length === 1 ? '' : 's'}</span></div>
		<h1 class="page" style="font-size: 26px">{n.name || (isBox ? 'Unnamed box' : n.title)}</h1>
		<div class="muted">{where}</div>
	</div>
</div>

<div class="acts">
	<button onclick={() => { filling = !filling; showLabel = moving = false; }}>{filling ? 'Done' : '+ Put in'}</button>
	{#if isBox}
		<button class="ghost" onclick={() => { moving = !moving; filling = showLabel = false; }}>Move box</button>
		<button class="ghost" onclick={() => { showLabel = !showLabel; filling = moving = false; }}>Label</button>
	{:else}
		<button class="ghost" onclick={() => { renaming = !renaming; }}>Rename</button>
	{/if}
</div>

{#if form?.error}<p class="note bad">{form.error}</p>{/if}

{#if isBox && (renaming || !n.name)}
	<form method="POST" action="?/rename" use:enhance={() => async ({ update }) => { await update({ reset: false }); renaming = false; }} class="actions">
		<input type="text" name="code" value={n.code ?? ''} aria-label="Box number" style="width: 80px; flex: none" />
		<input type="text" name="name" value={n.name} placeholder="What's in it, e.g. Power tools" aria-label="Box name" />
		<button style="flex: none; width: auto">Save</button>
	</form>
{:else if renaming}
	<form method="POST" action="?/rename" use:enhance={() => async ({ update }) => { await update({ reset: false }); renaming = false; }} class="actions">
		<input type="text" name="name" value={n.name} aria-label="Place name" />
		<button style="flex: none; width: auto">Save</button>
	</form>
{/if}

{#if moving}
	<form method="POST" action="?/move" use:enhance={() => async ({ update }) => { await update({ reset: false }); moving = false; }} class="actions">
		<select name="to" required aria-label="Move to">
			<option value="">Move to…</option>
			{#each data.targets as t (t.id)}<option value={t.id}>{t.path}</option>{/each}
		</select>
		<button style="flex: none; width: auto">Move</button>
	</form>
	<p class="muted" style="font-size: 13px">Everything inside moves with it.</p>
{/if}

{#if showLabel}
	<section class="panel" style="margin-top: 12px"><PrintPanel labels={[boxLabel(n)]} /></section>
{/if}

{#if filling}
	<section class="fill">
		<div class="band"><b>FILLING {isBox ? `BOX ${n.code ?? ''}` : n.name.toUpperCase()}</b><span>· {data.things.length} so far</span></div>
		{#if form?.added}<p class="note good" style="margin: 0">Added {form.added}. Next one?</p>{/if}
		<form
			method="POST"
			action="?/putIn"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					busy = false;
					if (result.type === 'success') {
						name = fits = barcode = photo = '';
						qty = 1;
					}
				};
			}}
		>
			<div style="display: flex; gap: 12px; align-items: center">
				<label class="snap" aria-label="Take a photo">
					{#if photo}<img src={photo} alt="" />{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
					{/if}
					<input type="file" accept="image/*" capture="environment" onchange={onPhoto} />
				</label>
				<input bind:this={nameBox} type="text" name="name" class="big" placeholder="What is it?" bind:value={name} required autocomplete="off" style="flex: 1; min-width: 0" />
			</div>
			<input type="hidden" name="photo" value={photo} />

			<div class="seg" role="radiogroup" aria-label="Kind" style="margin-top: 10px">
				<label><input type="radio" name="kind" value="tool" bind:group={kind} />Tool</label>
				<label><input type="radio" name="kind" value="spare" bind:group={kind} />Spare part</label>
				<label><input type="radio" name="kind" value="other" bind:group={kind} />Other</label>
			</div>
			{#if kind === 'spare'}
				<input type="text" name="fits" placeholder="Fits… e.g. Gorenje WA74 washer" bind:value={fits} aria-label="What it fits" style="margin-top: 10px" />
			{/if}

			<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px">
				<span class="muted">How many?</span>
				<div class="seg" style="flex: none">
					<button type="button" class:on={!counted} onclick={() => (counted = false)}>Just 1</button>
					<button type="button" class:on={counted} onclick={() => (counted = true)}>Count them</button>
				</div>
			</div>
			<input type="hidden" name="counted" value={counted ? '1' : '0'} />
			{#if counted}
				<div class="stepper big" style="margin-top: 8px">
					<button type="button" aria-label="Fewer" onclick={() => (qty = Math.max(1, qty - 1))}>−</button>
					<input name="qty" type="number" min="1" bind:value={qty} class="n" aria-label="How many" style="width: 70px; height: 44px; padding: 0; text-align: center; background: none; border: 0; font-size: 26px; font-weight: 700" />
					<button type="button" aria-label="More" onclick={() => (qty += 1)}>+</button>
				</div>
			{/if}
			<details style="margin-top: 10px">
				<summary class="linkish" style="font-size: 14px">Has a barcode?</summary>
				<input type="text" name="barcode" inputmode="numeric" bind:value={barcode} placeholder="Barcode (then scanning it finds this)" aria-label="Barcode" style="margin-top: 8px" />
			</details>
			<button class="cta" style="margin-top: 12px" disabled={busy}>{busy ? 'Saving…' : 'Save, next thing'}</button>
		</form>
		{#if data.things.some((t) => t.image)}
			<div class="peek">{#each data.things.filter((t) => t.image).slice(-10) as t (t.id)}<img src={t.image} alt={t.name} />{/each}</div>
		{/if}
	</section>
{/if}

{#if data.inner.length || !isBox}
	<div class="caps"><span>{isBox ? 'Inside' : 'Boxes and places'}</span></div>
	<div style="display: flex; flex-direction: column; gap: 6px">
		{#each data.inner as b (b.id)}
			<a class="boxrow" href="/place/{b.id}">
				<span class="code-tile small">{b.kind === 'box' ? b.code || '□' : '▤'}</span>
				<span style="flex: 1">{b.name || 'Unnamed box'}</span>
			</a>
		{/each}
	</div>
	{#if !isBox}
		<form method="POST" action="?/addBoxes" use:enhance={keep} class="actions">
			<select name="count" aria-label="How many boxes" style="flex: 0 0 90px">
				{#each [1, 2, 3, 4, 5, 6, 8, 10] as c}<option value={c}>{c}</option>{/each}
			</select>
			<button class="ghost">+ New numbered boxes</button>
		</form>
		{#if newLabels?.length}
			<section class="panel" style="margin-top: 12px">
				<b>{newLabels.length} new box{newLabels.length === 1 ? '' : 'es'}</b>
				<p class="muted" style="margin: 2px 0 0">Print the labels, stick them on, then open a box to name it and fill it.</p>
				<PrintPanel labels={newLabels} />
			</section>
		{/if}
	{/if}
{/if}

<div class="caps"><span>{isBox ? 'In this box' : 'Here'} · {data.things.length}</span></div>
<div class="rows">
	{#each data.things as t (t.id)}
		<div class="row">
			<a class="info" href="/product/{t.id}" style="display: flex; align-items: center; gap: 12px">
				{#if t.image}<img class="thumb" src={t.image} alt="" loading="lazy" />{:else}<span class="thumb">{initials(t.name)}</span>{/if}
				<span style="min-width: 0">
					<div class="nm">{t.name}</div>
					<div class="sm">{[t.loan ? `Lent to ${t.loan.person}` : t.taken_at ? 'In use' : '', t.fits ? `fits ${t.fits}` : t.category].filter(Boolean).join(' · ')}</div>
				</span>
			</a>
			{#if t.counted}
				<span class="qty" class:low={t.min_stock && t.total < t.min_stock}>{t.here}</span>
			{:else if !t.loan}
				<form method="POST" action={t.taken_at ? '?/back' : '?/took'} use:enhance={keep}>
					<input type="hidden" name="id" value={t.id} />
					<button class="ghost" style="width: auto; min-height: 40px; padding: 0 12px; font-size: 14px">{t.taken_at ? 'Put back' : 'Took it'}</button>
				</form>
			{/if}
		</div>
	{:else}
		<p class="muted">Empty. Tap <b>+ Put in</b> to add things.</p>
	{/each}
</div>

{#if !data.things.length && !data.inner.length}
	<form method="POST" action="?/delete" style="margin-top: 18px" onsubmit={(e) => confirm(`Delete ${n.title}?`) || e.preventDefault()}>
		<button class="linkish" style="color: var(--bad)">Delete this {isBox ? 'box' : 'place'}</button>
	</form>
{/if}

<style>
	.code-tile { width: 64px; height: 64px; border-radius: 14px; flex: none; display: grid; place-items: center; font-size: 18px; font-weight: 700; background: var(--surface-3); color: var(--ink-2); }
	.code-tile.box { background: var(--accent); color: #fff; }
	.code-tile.small { width: 40px; height: 40px; border-radius: 10px; font-size: 13px; }
	.acts { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; margin-top: 14px; }
	.fill { margin-top: 14px; background: var(--putaway-card); border-radius: 18px; padding: 0 14px 14px; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
	.fill .band { margin: 0 -14px; padding: 10px 14px; background: var(--accent); color: #fff; font-size: 14px; display: flex; gap: 6px; }
	.fill .band b { letter-spacing: 1px; }
	.fill .band span { color: #d6e6ff; }
	.snap { position: relative; width: 72px; height: 72px; flex: none; border-radius: 14px; background: var(--surface-2); display: grid; place-items: center; color: var(--ink-2); overflow: hidden; cursor: pointer; }
	.snap svg { width: 30px; height: 30px; }
	.snap img { width: 100%; height: 100%; object-fit: cover; }
	.snap input { position: absolute; inset: 0; opacity: 0; }
	.peek { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
	.peek img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; }
	.boxrow { display: flex; align-items: center; gap: 12px; background: var(--surface); border-radius: 14px; padding: 8px 12px; color: inherit; }
</style>
