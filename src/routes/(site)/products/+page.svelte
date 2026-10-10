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
	<Box num="AGR-RT2" title="ROUTE 2.0">Fleet routing and dispatch optimization for ground logistics.</Box>
	<Box num="AGR-SN" title="MAGEN">Active security and audit logging for sensitive embedded systems.</Box>
	<Box num="AGR-NME" title="NORMAL MAP EDITOR">Free web based normal map editor for computer renderers and games.</Box>
</Boxes>

<h2>ROUTE 2.0</h2>
<p>Plans and re-plans delivery routes in real time as conditions change using the largest traffic and logistics databases.</p>
<SpecTable>
	<SpecRow label="Version">2.0</SpecRow>
	<SpecRow label="Platforms">Windows, Linux</SpecRow>
	<SpecRow label="Licensing">Per seat or site license</SpecRow>
</SpecTable>
<p><a href={resolve('/contact')}>Request a demo &raquo;</a></p>

<h2>MAGEN</h2>
<p>Real time hardware accelerated security information, event management, and intrusion prevention for supported embedded devices.</p>
<SpecTable>
	<SpecRow label="Version">0.6 (beta)</SpecRow>
	<SpecRow label="Platforms">Classified</SpecRow>
	<SpecRow label="Licensing">Contact sales</SpecRow>
</SpecTable>
<p><a href={resolve('/contact')}>Request a demo &raquo;</a></p>

<h2>NORMAL MAP EDITOR</h2>
<p>Free, fast, client side. <a href={resolve('/tools/normal-map')} data-sveltekit-reload>Launch &raquo;</a></p>
<SpecTable>
	<SpecRow label="Version">0.1</SpecRow>
	<SpecRow label="Platforms">Web</SpecRow>
	<SpecRow label="Licensing">Free</SpecRow>
</SpecTable>