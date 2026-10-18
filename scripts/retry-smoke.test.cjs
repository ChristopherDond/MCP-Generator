const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-retry-tls-'));
const key = path.join(tmp, 'key.pem');
const cert = path.join(tmp, 'cert.pem');

execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', key, '-out', cert, '-days', '1',
  '-subj', '/CN=127.0.0.1',
  '-addext', 'subjectAltName=IP:127.0.0.1',
], { stdio: 'ignore' });

const spec = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'RetrySmoke', version: '1.0.0' },
  paths: {},
});

let hits = 0;
const server = https.createServer(
  { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
  (req, res) => {
    hits++;
    if (hits < 3) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end('{"error":"temporarily unavailable"}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(spec);
  }
);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const url = `https://127.0.0.1:${port}/spec.json`;

  const { fetchWithRetry, readBodyWithLimit, parseContentLength, validateContentType } =
    await import('../dist/core/security.js');

  let result;
  try {
    const res = await fetchWithRetry(url, { retries: 3, baseDelayMs: 20 });
    validateContentType(res.headers.get('content-type'));
    const body = await readBodyWithLimit(res, parseContentLength(res.headers.get('content-length')));
    result = { fetched: JSON.parse(body).info.title, hits };
  } catch (e) {
    result = { error: String(e), hits };
  }

  server.close();
  const ok = result.fetched === 'RetrySmoke' && result.hits === 3;
  console.log(JSON.stringify({ ...result, ok }, null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exitCode = ok ? 0 : 1;
});
