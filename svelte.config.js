import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: adapter(),
		// The phone reaches this over plain HTTP on the LAN, where SvelteKit's
		// default origin check would reject form POSTs.
		csrf: { checkOrigin: false }
	}
};
