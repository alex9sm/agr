<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { origin } from '$lib/site/origin';
	import NormalMapApp from './NormalMapApp.svelte';

	const url = origin + resolve('/tools/normal-map');
	const image = origin + asset('/resources/nme-preview.png');
	const description =
		'Free online normal map editor. Adjust strength, flip the green channel (DirectX ↔ OpenGL), blend detail maps, and preview lighting. Runs in the browser.';
	const app = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'AGR Normal Map Editor',
		url,
		description,
		screenshot: image,
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Any',
		browserRequirements: 'Requires WebGPU',
		isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		publisher: { '@type': 'Organization', name: 'AGR Holdings LLC', url: origin + resolve('/') }
	};
	// Escape < so the data can never close its <script> early.
	const jsonLd = JSON.stringify(app).replaceAll('<', '\\u003c');
</script>

<svelte:head>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="AGR" />
	<meta property="og:title" content="AGR Normal Map Editor" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1293" />
	<meta property="og:image:height" content="714" />
	<meta property="og:image:alt" content="The editor showing a normal map split between the lit preview and the raw colors" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<NormalMapApp />
