// Définition des vues du shooting et des décors, et construction des prompts
// envoyés au modèle d'image. Les prompts sont en anglais : les modèles d'image
// les suivent plus fidèlement.

export const VIEWS = {
  face: {
    label: 'Face',
    prompt:
      'Show the garment from the FRONT, fully visible, centered, laid flat or neatly presented on an invisible mannequin.',
  },
  dos: {
    label: 'Dos',
    prompt:
      'Show the garment from the BACK, fully visible and centered. Infer the back side logically from the front ' +
      '(same fabric, color, cut, seams and hem). Do not invent prints, logos or text on the back unless clearly implied.',
    promptWithBack:
      'Show the garment from the BACK, fully visible and centered. The back must match the SECOND reference photo exactly ' +
      '(same print, logo, text, seams and any visible wear), only the background, lighting and presentation change.',
  },
  trois_quarts: {
    label: 'Trois-quarts',
    prompt:
      'Show the garment at a three-quarter angle (about 45 degrees) on an invisible mannequin, to show its volume and side seams.',
  },
  porte: {
    label: 'Porté',
    prompt:
      'Show the garment WORN by a neutral model, cropped at the neck (face not visible), natural relaxed pose, full garment visible.',
  },
  cintre: {
    label: 'Sur cintre',
    prompt: 'Show the garment hanging on a simple wooden hanger against the wall, front side visible.',
  },
  plie: {
    label: 'Plié',
    prompt: 'Show the garment neatly folded, as in a clothing store, with the main visible detail (collar, logo or print) on top.',
  },
  detail_matiere: {
    label: 'Détail matière',
    prompt:
      'Close-up macro shot of the fabric texture and stitching of the garment, showing the material quality. Fill most of the frame.',
  },
  detail_etiquette: {
    label: 'Détail col / étiquette',
    prompt:
      'Close-up of the collar / waistband area of the garment. If a label is visible in the original photo, reproduce it faithfully; ' +
      'otherwise show a plain inner collar without inventing any brand name.',
  },
};

export const DECORS = {
  studio: {
    label: 'Studio blanc',
    prompt: 'Clean seamless white studio background, soft diffused lighting, subtle natural shadow, e-commerce style.',
  },
  bois: {
    label: 'Parquet clair',
    prompt: 'Light natural oak wooden floor / table, soft daylight from a window, minimal Scandinavian mood.',
  },
  chambre: {
    label: 'Chambre cosy',
    prompt:
      'Bright cozy bedroom, neutral linen tones, a plant and soft blurred background (shallow depth of field), warm morning daylight.',
  },
  beton: {
    label: 'Mur béton',
    prompt: 'Urban light-grey concrete wall background, soft even daylight, modern streetwear look.',
  },
  exterieur: {
    label: 'Extérieur',
    prompt: 'Outdoors in a quiet street or garden, blurred natural background (bokeh), golden hour light.',
  },
};

export const DEFAULT_VIEWS = ['face', 'dos', 'trois_quarts', 'porte', 'plie', 'detail_matiere'];

const FIDELITY_RULES =
  'The reference photo shows a second-hand clothing item that will be sold on Vinted. ' +
  'Create a new professional product photo of EXACTLY this same item. ' +
  'Strict rules: keep the exact same color, fabric, pattern, print, logo, cut, buttons, zippers, pockets and proportions; ' +
  'do not add or remove design elements; do not beautify or change the item; keep visible wear if any. ' +
  'Remove the original messy background, people and clutter. Photorealistic, sharp focus, high resolution, ' +
  'vertical 3:4 framing, no text, no watermark, no borders.';

const TWO_PHOTOS =
  'You are given TWO reference photos of the same item: the first shows the FRONT, the second shows the BACK. ' +
  'Use both to understand the item; never mix up front and back details.';

export function buildPrompt(viewId, decorId, note = '', { hasBack = false } = {}) {
  const view = VIEWS[viewId];
  const decor = DECORS[decorId];
  if (!view) throw new Error(`Vue inconnue : ${viewId}`);
  if (!decor) throw new Error(`Décor inconnu : ${decorId}`);
  const shot = hasBack && view.promptWithBack ? view.promptWithBack : view.prompt;
  const parts = [FIDELITY_RULES];
  if (hasBack) parts.push(TWO_PHOTOS);
  parts.push(`Shot: ${shot}`, `Setting: ${decor.prompt}`);
  const cleanNote = String(note || '').trim().slice(0, 300);
  if (cleanNote) parts.push(`Extra information from the seller about the item: ${cleanNote}`);
  return parts.join('\n\n');
}
