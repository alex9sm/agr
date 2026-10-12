import { resolve } from '$app/paths';
import { origin } from '$lib/site/origin';
import { pages } from '$lib/site/pages';

export const prerender = true;

// Every page worth finding in search. /login has nothing to index (it's also marked noindex).
const paths = [...pages.map((p) => p.path).filter((path) => path !== '/login'), '/tools/normal-map' as const];

export function GET() {
	const urls = paths.map((path) => `\t<url><loc>${origin}${resolve(path)}</loc></url>`).join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
