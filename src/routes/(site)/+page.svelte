<script lang="ts">
	import { resolve } from '$app/paths';
	import Boxes from '$lib/site/Boxes.svelte';
	import Box from '$lib/site/Box.svelte';
</script>

<svelte:head><title>AGR</title></svelte:head>

<h2>Welcome to AGR</h2>

<p>AGR provides cutting edge software solutions for logistics, computer graphics, and military applications.
	We build well-documented software and offer consulting services for organizations. Regardless of your
	mission, AGR is ready to tackle any challenge.</p>

<Boxes>
	<Box title="Logistics">Routing, inventory, and supply chain visibility software for fleets and warehouses.</Box>
	<Box title="Graphics">Our graphics division pushes the boundaries of what's possible on modern GPUs.</Box>
	<Box title="Defense">Auditable systems for mission planning and asset management.</Box>
</Boxes>

<h2>Why AGR</h2>

<ul class="list">
	<li>Our software is designed for long service lives and are rigorously maintained.</li>
	<li>We approach our solutions for a security first mindset for critical services that can't fail.</li>
	<li>We support partners across the east coast and deliver first class service for our clients.</li>
</ul>

<p><a href={resolve('/contact')}>Contact &raquo;</a></p>
