// Receives client-side error reports and writes one structured log line each.
// Read them in Cloudflare: Workers & Pages → talaqqa → Functions → Real-time logs.
// Nothing is stored and no IP address is logged.

const MAX_BODY = 4096;
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);

export async function onRequestPost({ request }) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  let report;
  try { report = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (!report || typeof report.message !== 'string') return new Response(null, { status: 400 });

  console.log(JSON.stringify({
    type: 'client_error',
    message: clip(report.message, 500),
    source: clip(report.source, 300),
    line: Number.isInteger(report.line) ? report.line : undefined,
    column: Number.isInteger(report.column) ? report.column : undefined,
    stack: clip(report.stack, 2000),
    page: clip(report.page, 300),
    userAgent: clip(request.headers.get('user-agent'), 200)
  }));
  return new Response(null, { status: 204 });
}
