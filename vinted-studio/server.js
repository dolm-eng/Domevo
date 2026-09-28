import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWS, DECORS, DEFAULT_VIEWS, buildPrompt } from './src/prompts.js';
import { getProvider } from './src/providers.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const MAX_BODY = 20 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Image trop lourde (max 20 Mo)'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON invalide'), { status: 400 });
  }
}

export function parseDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw Object.assign(new Error('Image invalide (JPEG, PNG ou WebP attendu)'), { status: 400 });
  return { mimeType: m[1], imageBase64: m[2] };
}

async function handleGenerate(req, res) {
  const body = await readJsonBody(req);
  const { mimeType, imageBase64 } = parseDataUrl(body.image);
  if (!VIEWS[body.view] || !DECORS[body.decor]) {
    return sendJson(res, 400, { error: 'Vue ou décor inconnu' });
  }
  const prompt = buildPrompt(body.view, body.decor, body.note);
  const result = await getProvider()({ imageBase64, mimeType, prompt });
  sendJson(res, 200, { view: body.view, image: `data:${result.mimeType};base64,${result.data}` });
}

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(PUBLIC_DIR, path === '/' ? 'index.html' : path));
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Interdit' });
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Introuvable' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/config') {
      return sendJson(res, 200, {
        provider: process.env.PROVIDER || 'gemini',
        concurrency: Number(process.env.CONCURRENCY) || 3,
        defaultViews: DEFAULT_VIEWS,
        views: Object.fromEntries(Object.entries(VIEWS).map(([id, v]) => [id, v.label])),
        decors: Object.fromEntries(Object.entries(DECORS).map(([id, d]) => [id, d.label])),
      });
    }
    if (req.method === 'POST' && req.url === '/api/generate') return await handleGenerate(req, res);
    if (req.method === 'GET') return await serveStatic(req, res);
    sendJson(res, 405, { error: 'Méthode non autorisée' });
  } catch (err) {
    console.error(err);
    sendJson(res, err.status || 502, { error: err.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  getProvider(); // échoue tout de suite si PROVIDER est invalide
  server.listen(PORT, () => {
    console.log(`Vinted Studio prêt sur http://localhost:${PORT} (fournisseur : ${process.env.PROVIDER || 'gemini'})`);
  });
}

export { server };
