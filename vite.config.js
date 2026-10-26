import { sveltekit } from '@sveltejs/kit/vite';

export default {
	plugins: [sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5190,
		// esphome/.esphome holds the whole ESP-IDF toolchain after a firmware
		// build: far too many files to watch, and none of them are the app.
		watch: { ignored: ['**/esphome/**', '**/data/**'] }
	}
};
