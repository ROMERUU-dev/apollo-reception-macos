import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const page = await readFile(new URL('./recepcion/index.html', import.meta.url));

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  if (request.method === 'POST' && url.pathname === '/__evidence/bridge-roundtrip') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { if (body.length < 16) body += chunk; });
    request.on('end', () => {
      const result = body === 'pass' ? 'pass' : 'fail';
      process.stdout.write(`WKWebView bridge roundtrip: ${result}\n`);
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      response.end();
    });
    return;
  }
  if (request.method !== 'GET' || !url.pathname.startsWith('/recepcion')) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'",
  });
  process.stdout.write(`WKWebView loaded ${url.pathname}\n`);
  response.end(page);
}).listen(port, host, () => {
  process.stdout.write(`Apollo native synthetic harness listening on http://${host}:${port}/recepcion\n`);
});
