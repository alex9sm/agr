<script lang="ts">
	import { resolve } from '$app/paths';
	import Boxes from '$lib/site/Boxes.svelte';
	import Box from '$lib/site/Box.svelte';
	import SpecTable from '$lib/site/SpecTable.svelte';
	import SpecRow from '$lib/site/SpecRow.svelte';
</script>

<svelte:head><title>Products - AGR</title></svelte:head>

<h2>Products</h2>

<Boxes>
	<Box num="AGR-NME" title="NORMAL MAP EDITOR">Free web based normal map editor for computer renderers and games.</Box>
</Boxes>

<h2>NORMAL MAP EDITOR</h2>
<p>Free, fast, client side. <a href={resolve('/tools/normal-map')} data-sveltekit-reload>Launch &raquo;</a></p>
<SpecTable>
	<SpecRow label="Version">0.1</SpecRow>
	<SpecRow label="Platforms">Web</SpecRow>
	<SpecRow label="Licensing">Free</SpecRow>
</SpecTable>