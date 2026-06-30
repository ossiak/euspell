// Minimal HTTPS static server for the Euspell Word add-in, serving this
// word-addin/ folder at https://localhost:3000 (the URL the manifest points to).
// Office add-ins must be served over HTTPS; the dev certificate comes from
// office-addin-dev-certs (run `npx office-addin-dev-certs install` once to trust
// localhost). Node built-ins only.
import https from 'node:https';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

async function httpsOptions() {
  try {
    const certs = await import('office-addin-dev-certs');
    await certs.ensureCertificatesAreInstalled();
    const o = await certs.getHttpsServerOptions();
    return { key: o.key, cert: o.cert };
  } catch (e) {
    // Fallback: read the certs office-addin-dev-certs writes to the home dir.
    const dir = join(homedir(), '.office-addin-dev-certs');
    const key = join(dir, 'localhost.key');
    const crt = join(dir, 'localhost.crt');
    if (existsSync(key) && existsSync(crt)) {
      return { key: readFileSync(key), cert: readFileSync(crt) };
    }
    console.error('No HTTPS dev certificate found.\n  Run:  npx office-addin-dev-certs install');
    process.exit(1);
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.xml': 'text/xml',
};

const options = await httpsOptions();
https.createServer(options, (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/src/taskpane.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(readFileSync(file));
}).listen(PORT, () => {
  console.log(`Euspell add-in dev server: https://localhost:${PORT}/`);
  console.log('Leave this running, then sideload word-addin/manifest.xml in Word.');
});
