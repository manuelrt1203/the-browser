/** Cache-compatible baseline. Inline scripts/styles are required by Next's
 * static/PPR output: this is deliberately not advertised as a strict nonce CSP. */
export function securityHeaders(development = false) {
  const csp = [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https://image.tmdb.org", "font-src 'self'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`, "frame-src 'none'",
  ].join("; ");
  return [
    {key: "Content-Security-Policy", value: csp},
    {key: "X-Content-Type-Options", value: "nosniff"},
    {key: "X-Frame-Options", value: "DENY"},
    {key: "Referrer-Policy", value: "no-referrer"},
    {key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()"},
    ...(!development ? [{key: "Strict-Transport-Security", value: "max-age=31536000"}] : []),
  ];
}
