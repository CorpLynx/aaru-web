<!-- AARU: full-bleed "Reeds gathering" backdrop for the sign-in page. See reeds.ts. -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { startReeds, type ReedsHandle } from './reeds';

	/** Seconds for the reeds to gather into the word. */
	export let formSeconds = 18;

	let canvas: HTMLCanvasElement;
	let scene: ReedsHandle | null = null;

	onMount(() => {
		let reduceMotion = false;
		try {
			reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch {
			// matchMedia unavailable: animate normally
		}
		scene = startReeds(canvas, { formSeconds, reduceMotion });
	});

	onDestroy(() => {
		scene?.destroy();
		scene = null;
	});
</script>

<canvas bind:this={canvas} class="aaru-reeds" aria-hidden="true"></canvas>

<style>
	.aaru-reeds {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		background: var(--aaru-auth-bg);
	}
</style>
