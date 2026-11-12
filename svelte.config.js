import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: adapter(),
		// The phone also reaches this over plain HTTP on the LAN, where SvelteKit's
		// own origin check (against ORIGIN) would reject form POSTs. hooks.server.js
		// does the check instead, for every POST, allowing the LAN address too.
		csrf: { checkOrigin: false },
		// Scripts only from this site (SvelteKit adds a nonce to its own inline
		// bootstrap); no framing. Inline styles stay: the pages use style="".
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'media-src': ['self', 'blob:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};
