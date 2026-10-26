import { bus } from '$lib/server/bus.js';

/** Server-sent "something changed" pings so open phones refresh live. */
export function GET({ request }) {
	let onChange, ping;
	const stream = new ReadableStream({
		start(ctrl) {
			const send = (s) => {
				try {
					ctrl.enqueue(s);
				} catch {}
			};
			onChange = () => send('data: change\n\n');
			bus.on('change', onChange);
			// Keeps reverse proxies from closing an idle stream.
			ping = setInterval(() => send(': ping\n\n'), 25000);
			send(': hello\n\n');
		},
		cancel() {
			bus.off('change', onChange);
			clearInterval(ping);
		}
	});
	request.signal.addEventListener('abort', () => {
		bus.off('change', onChange);
		clearInterval(ping);
	});
	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' }
	});
}
