<script lang="ts">
	import SpecTable from '$lib/site/SpecTable.svelte';
	import SpecRow from '$lib/site/SpecRow.svelte';
</script>

<svelte:head><title>Services - AGR</title></svelte:head>

<h2>Services</h2>

<p>Beyond our products, AGR offers forward deployed consulting services and commission for custom software solutions.</p>

<SpecTable>
	<SpecRow label="Custom Development">Software built to your specification.</SpecRow>
	<SpecRow label="Systems Integration">Connecting new software to systems already running.</SpecRow>
	<SpecRow label="Consulting">Architecture reviews, technical due diligence, and modernization plans.</SpecRow>
	<SpecRow label="Support & Maintenance">Long-term support contracts.</SpecRow>
	<SpecRow label="Training">On-site and remote training for AGR products and custom systems.</SpecRow>
</SpecTable>
