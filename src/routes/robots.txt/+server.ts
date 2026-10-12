import { origin } from '$lib/site/origin';

export const prerender = true;

// Everything is crawlable, including /_app/: Google needs the scripts and styles to render pages.
export function GET() {
	const text = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
	return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
}
