# Vinted Studio 📸

Prends **une seule photo** de ton vêtement (de face) et l'application crée un shooting complet, prêt pour ton annonce Vinted.
Tu peux aussi ajouter une **photo du dos (facultative)** : l'IA s'en sert alors pour reproduire le vrai dos au lieu de l'imaginer.

Vues disponibles :

| Vue | Description |
| --- | --- |
| Face | vêtement de face, bien centré |
| Dos | le dos : fidèle à ta photo du dos si tu en donnes une, sinon déduit de la face |
| Trois-quarts | vue à 45° pour montrer le volume |
| Porté | porté par un mannequin (visage non visible) |
| Sur cintre | suspendu sur un cintre en bois |
| Plié | plié comme en boutique |
| Détail matière | gros plan sur le tissu et les coutures |
| Détail col / étiquette | gros plan sur le col ou la taille |

Tu choisis aussi le décor : **studio blanc, parquet clair, chambre cosy, mur béton ou extérieur**.

## Installation (5 minutes)

1. Installe [Node.js 22 ou plus](https://nodejs.org).
2. Récupère une clé API gratuite sur **Google AI Studio** : https://aistudio.google.com/apikey
3. Dans ce dossier :

   ```bash
   cp .env.example .env
   # ouvre .env et colle ta clé après GEMINI_API_KEY=
   npm start
   ```

4. Ouvre http://localhost:3000.

### L'utiliser depuis ton téléphone

- Téléphone et ordinateur sur le **même Wi-Fi** : ouvre `http://<IP-de-ton-ordi>:3000` sur le téléphone.
  Le bouton « Prendre une photo » ouvre directement l'appareil photo.
- Une fois les photos générées, **« Partager / tout télécharger »** ouvre le menu de partage du téléphone.
  Tu peux alors enregistrer les photos dans ta galerie et les ajouter à ton annonce Vinted.

## Fournisseurs d'IA

| `PROVIDER` | Modèle par défaut | Remarque |
| --- | --- | --- |
| `gemini` (défaut) | `gemini-2.5-flash-image` | Très bon pour garder le vêtement identique, peu cher. Il existe une offre gratuite limitée. |
| `openai` | `gpt-image-1` | Alternative, plus lente et plus chère. |
| `mock` | aucun | Pour tester sans clé : renvoie la photo d'origine. |

Les modèles peuvent être changés dans `.env` (`GEMINI_MODEL`, `OPENAI_MODEL`).
Chaque vue générée correspond à un appel à l'API, donc 6 photos = 6 appels.

## Conseils pour de meilleurs résultats

- Vêtement **entièrement visible**, bien étalé, sans plis marqués.
- Lumière du jour et pas de flash.
- Si le dos a un motif, un imprimé ou un défaut, **ajoute la photo du dos**.
  À défaut, décris-le dans le champ **« Précisions »**, par exemple « grand logo dans le dos ». Si le dos est uni, écris « dos uni ».

## ⚠️ Honnêteté vis-à-vis des acheteurs

Toutes les vues sont **recréées par l'IA** : elles peuvent ne pas refléter exactement l'article réel.
C'est surtout vrai pour le dos quand tu n'as pas fourni de photo du dos.
Vinted demande que les photos montrent l'article réellement vendu. Vérifie donc chaque image, écarte celles qui ne correspondent pas,
garde ta vraie photo dans l'annonce, et photographie toi-même le dos et les défauts éventuels si tu le peux.

## Développement

```bash
npm test               # tests (serveur en mode mock)
PROVIDER=mock npm start
```

Structure :

- `server.js` : serveur HTTP sans dépendance (API et fichiers statiques)
- `src/prompts.js` : vues, décors et construction des prompts
- `src/providers.js` : appels à Gemini, OpenAI et au mode mock
- `public/` : interface web adaptée au mobile
