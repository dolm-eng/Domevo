// Appels aux modèles de génération / retouche d'image.
// Chaque fournisseur reçoit l'image de référence (base64) + un prompt
// et renvoie { mimeType, data } (base64).

async function geminiGenerate({ imageBase64, mimeType, prompt }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY manquante dans .env');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }] }],
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

async function openaiGenerate({ imageBase64, mimeType, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY manquante dans .env');
  const form = new FormData();
  form.append('model', process.env.OPENAI_MODEL || 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1536');
  form.append('image', new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType }), 'reference.jpg');

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

// Fournisseur de test : renvoie la photo d'origine après un court délai.
async function mockGenerate({ imageBase64, mimeType }) {
  await new Promise((r) => setTimeout(r, 400));
  return { mimeType, data: imageBase64 };
}

const PROVIDERS = { gemini: geminiGenerate, openai: openaiGenerate, mock: mockGenerate };

export function getProvider(name = process.env.PROVIDER || 'gemini') {
  const fn = PROVIDERS[name];
  if (!fn) throw new Error(`PROVIDER inconnu : ${name} (gemini, openai ou mock)`);
  return fn;
}
