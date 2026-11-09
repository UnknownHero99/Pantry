/**
 * Label QR codes are upper-case links (HTTPS://PANTRY.EXAMPLE.COM/I/17, see
 * itemLink in $lib/format.js); serve /I/ and /B/ from the lower-case routes.
 */
export function reroute({ url }) {
	const m = /^\/([IB])\/(\d+)\/?$/.exec(url.pathname);
	if (m) return `/${m[1].toLowerCase()}/${m[2]}`;
}
