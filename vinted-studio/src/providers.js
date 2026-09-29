// Appels aux modèles de génération / retouche d'image.
// Chaque fournisseur reçoit les images de référence (face, puis dos facultatif)
// sous forme [{ mimeType, data }] (base64) + un prompt, et renvoie { mimeType, data }.

async function geminiGenerate({ images, prompt }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY manquante dans .env');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const imageParts = images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [...imageParts, { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${json.error?.message || 'erreur inconnue'}`);

  const parts = json.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const reason = json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || 'aucune image renvoyée';
    throw new Error(`Gemini : ${reason}`);
  }
  const data = img.inlineData || img.inline_data;
  return { mimeType: data.mimeType || data.mime_type || 'image/png', data: data.data };
}

async function openaiGenerate({ images, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY manquante dans .env');
  const form = new FormData();
  form.append('model', process.env.OPENAI_MODEL || 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1536');
  images.forEach((img, i) => {
    const blob = new Blob([Buffer.from(img.data, 'base64')], { type: img.mimeType });
    form.append('image[]', blob, i === 0 ? 'front.jpg' : 'back.jpg');
  });

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status} : ${json.error?.message || 'erreur inconnue'}`);
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI : aucune image renvoyée');
  return { mimeType: 'image/png', data: b64 };
}

// Fournisseur de test : renvoie la photo de face d'origine après un court délai.
async function mockGenerate({ images }) {
  await new Promise((r) => setTimeout(r, 400));
  return { mimeType: images[0].mimeType, data: images[0].data };
}

const PROVIDERS = { gemini: geminiGenerate, openai: openaiGenerate, mock: mockGenerate };

export function getProvider(name = process.env.PROVIDER || 'gemini') {
  const fn = PROVIDERS[name];
  if (!fn) throw new Error(`PROVIDER inconnu : ${name} (gemini, openai ou mock)`);
  return fn;
}
