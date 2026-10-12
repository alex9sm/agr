// Production server for `npm start`: serves the prerendered site in build/.
// Binds to localhost only; cloudflared on the same machine forwards public traffic here.
import { createServer } from 'node:http';
import sirv from 'sirv';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

// sirv indexes build/ once at startup, so restart after every `npm run build`.
const assets = sirv('build', {
	etag: true,
	setHeaders(res, pathname) {
		// Hashed filenames: content never changes, so browsers and Cloudflare can keep them.
		if (pathname.startsWith('/_app/immutable/')) {
			res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		}
	}
});

createServer((req, res) => {
	assets(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
})
	// Fail loudly (e.g. port already taken) rather than moving ports behind the tunnel's back.
	.on('error', (err) => {
		console.error(err.message);
		process.exit(1);
	})
	.listen(port, host, () => console.log(`Serving build/ on http://${host}:${port}`));
