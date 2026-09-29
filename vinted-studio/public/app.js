const $ = (id) => document.getElementById(id);
const state = { images: { front: null, back: null }, decor: 'studio', views: new Set(), results: new Map(), config: null };

const MAX_SIDE = 1536;

// Réduit la photo du téléphone (souvent 4000 px+) avant l'envoi.
async function resizeImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function chip(label, pressed, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = label;
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', () => onClick(b));
  return b;
}

function renderOptions() {
  const { decors, views } = state.config;
  const decorBox = $('decors');
  for (const [id, label] of Object.entries(decors)) {
    decorBox.append(
      chip(label, id === state.decor, (b) => {
        state.decor = id;
        decorBox.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      }),
    );
  }
  const viewBox = $('views');
  for (const [id, label] of Object.entries(views)) {
    viewBox.append(
      chip(label, state.views.has(id), (b) => {
        state.views.has(id) ? state.views.delete(id) : state.views.add(id);
        b.setAttribute('aria-pressed', String(state.views.has(id)));
        updateButton();
      }),
    );
  }
}

function updateButton() {
  $('go').disabled = !state.images.front || state.views.size === 0;
}

const DROP_LABELS = { front: '📷 Photo de face', back: '📷 Photo du dos' };

function renderSlot(slot) {
  const drop = $(`drop-${slot}`);
  const img = drop.querySelector('img');
  const text = drop.querySelector('.drop-text');
  const data = state.images[slot];
  img.hidden = !data;
  text.hidden = !!data;
  if (data) img.src = data;
  else img.removeAttribute('src');
  if (slot === 'back') $('removeBack').hidden = !data;
}

async function setFile(slot, file) {
  if (!file || !file.type.startsWith('image/')) return;
  const text = $(`drop-${slot}`).querySelector('.drop-text');
  text.hidden = false;
  text.textContent = 'Préparation…';
  try {
    state.images[slot] = await resizeImage(file);
    text.textContent = DROP_LABELS[slot];
  } catch {
    state.images[slot] = null;
    text.textContent = 'Impossible de lire cette image. Essaie en JPEG ou PNG.';
  }
  renderSlot(slot);
  updateButton();
}

function setupDrop(slot) {
  const drop = $(`drop-${slot}`);
  const input = drop.querySelector('input');
  input.addEventListener('change', () => {
    setFile(slot, input.files[0]);
    input.value = ''; // permet de reprendre la même photo
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragover');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    setFile(slot, e.dataTransfer.files[0]);
  });
}

function makeTile(viewId) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.innerHTML = `<div class="frame"><div class="spinner"></div></div><footer><span></span></footer>`;
  tile.querySelector('footer span').textContent = state.config.views[viewId];
  return tile;
}

function fileName(viewId) {
  return `vinted-${viewId}.png`;
}

function showResult(tile, viewId, dataUrl) {
  const frame = tile.querySelector('.frame');
  frame.className = 'frame';
  frame.innerHTML = '';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = state.config.views[viewId];
  frame.append(img);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName(viewId);
  a.textContent = 'Télécharger';
  tile.querySelector('footer').append(a);
}

function showError(tile, viewId, message) {
  const frame = tile.querySelector('.frame');
  frame.className = 'frame error';
  frame.textContent = message;
  const retry = document.createElement('button');
  retry.textContent = 'Réessayer';
  retry.addEventListener('click', () => {
    retry.remove();
    frame.className = 'frame';
    frame.innerHTML = '<div class="spinner"></div>';
    generateOne(tile, viewId, state.lastParams);
  });
  tile.querySelector('footer').append(retry);
}

async function generateOne(tile, viewId, { image, backImage, decor, note }) {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, backImage, view: viewId, decor, note }),
    });
    const json = await res.json().catch(() => ({ error: `Erreur serveur (${res.status})` }));
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    state.results.set(viewId, json.image);
    showResult(tile, viewId, json.image);
  } catch (err) {
    showError(tile, viewId, err.message);
  }
}

async function generateAll() {
  const views = Object.keys(state.config.views).filter((id) => state.views.has(id));
  state.results.clear();
  const params = {
    image: state.images.front,
    backImage: state.images.back || undefined,
    decor: state.decor,
    note: $('note').value,
  };
  state.lastParams = params;

  const grid = $('grid');
  grid.innerHTML = '';
  $('results').hidden = false;
  const tiles = new Map(views.map((id) => [id, makeTile(id)]));
  tiles.forEach((t) => grid.append(t));
  $('results').scrollIntoView({ behavior: 'smooth' });

  $('go').disabled = true;
  let done = 0;
  const status = () => ($('status').textContent = `Génération en cours… ${done}/${views.length}`);
  status();

  // File d'attente avec nombre limité de requêtes simultanées.
  const queue = [...views];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      await generateOne(tiles.get(id), id, params);
      done++;
      status();
    }
  };
  await Promise.all(Array.from({ length: Math.min(state.config.concurrency, views.length) }, worker));

  const ok = state.results.size;
  $('status').textContent =
    ok === views.length ? `✅ ${ok} photos prêtes !` : `${ok}/${views.length} photos générées. Tu peux réessayer celles en erreur.`;
  updateButton();
}

async function shareAll() {
  const entries = [...state.results.entries()];
  if (!entries.length) return;
  const files = await Promise.all(
    entries.map(async ([id, url]) => {
      const blob = await (await fetch(url)).blob();
      return new File([blob], fileName(id), { type: blob.type });
    }),
  );
  // Sur mobile : ouvre le menu de partage (enregistrer dans la galerie, Vinted…).
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: 'Photos Vinted' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function init() {
  state.config = await (await fetch('/api/config')).json();
  state.config.defaultViews.forEach((v) => state.views.add(v));
  renderOptions();

  setupDrop('front');
  setupDrop('back');
  $('removeBack').addEventListener('click', () => {
    state.images.back = null;
    renderSlot('back');
  });
  $('go').addEventListener('click', generateAll);
  $('shareAll').addEventListener('click', shareAll);
}

init().catch(() => ($('status').textContent = 'Serveur injoignable. As-tu lancé « npm start » ?'));
