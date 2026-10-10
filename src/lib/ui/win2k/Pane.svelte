<!-- Docked pane: caption bar (active while focus is inside) over a sunken content frame. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();

	const uid = $props.id();
</script>

<section class="w2k-pane" aria-labelledby="{uid}-caption">
	<div class="caption" id="{uid}-caption">{title}</div>
	<div class="frame">
		<div class="content">{@render children()}</div>
	</div>
</section>

<style>
	.w2k-pane {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		height: 100%;
	}
	.caption {
		flex: none;
		height: 16px;
		margin-bottom: 2px;
		padding: 0 4px;
		overflow: hidden;
		background: linear-gradient(to right, var(--title-inactive-a), var(--title-inactive-b));
		color: var(--title-inactive-text);
		font-weight: bold;
		line-height: 16px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.w2k-pane:focus-within > .caption {
		background: linear-gradient(to right, var(--title-a), var(--title-b));
		color: #fff;
	}
	.frame {
		flex: 1;
		min-height: 0;
		padding: 2px;
		background: var(--window);
		box-shadow: var(--sunken);
	}
	.content {
		height: 100%;
		overflow: auto;
	}
</style>
