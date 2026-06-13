# VideoMaker — générateur de vidéos documentaires de crise

Un studio HTML qui transforme une timeline de crise (ou n'importe quel récit)
en **vidéo documentaire 1080p de ~2 minutes** : voix off neurale, musique
originale synthétisée, scènes animées (cartes, statistiques, leçons, photos).

**Philosophie : le moins d'IA possible.** L'IA (Claude ou OpenAI, votre clé,
stockée uniquement dans votre navigateur) ne sert qu'à rédiger le *brouillon*
de scénario — étape même optionnelle (gabarit déterministe). Toute la
production (voix, images, musique, montage) est déterministe, en local ou
sur GitHub Actions.

## Utiliser le studio

**Dans CrisisMaker** : ouvrez l’onglet **Video Debrief**.

**En local** :
```sh
cd video-debrief/pipeline
python3 server.py            # → http://localhost:8765/studio
```
Pré-requis locaux : `brew install ffmpeg node` (ou apt), `pip3 install edge-tts numpy scipy`.

## Les 3 étapes

1. **Scénario** — collez votre matière première (timeline JSON, notes,
   compte-rendu) ; réglez durée, langue, ton, public, style, voix. Générez
   par IA (sélecteur de modèles dynamique) ou par gabarit sans IA.
2. **Adaptation** — éditez chaque scène (voix off, textes, photos),
   réordonnez ; l'aperçu live (scrubber + lecture) utilise le *même moteur*
   que le rendu final.
3. **Production** — trois modes :
   - **Cloud GitHub** *(recommandé)* : le studio pousse le projet dans
     `video-debrief/requests/`, le workflow [produce-video](../.github/workflows/produce-video.yml)
     fabrique le MP4 (~12 min) et le publie dans la release
     [`videos`](../../releases/tag/videos). Il vous faut un *fine-grained PAT*
     du repo avec **Contents read/write** et **Actions read**.
   - **Serveur local** : un clic, progression en direct.
   - **Ligne de commande** : `python3 pipeline/build.py mon-projet.json`.

On peut aussi lancer une production à la main : onglet *Actions* →
*produce-video* → *Run workflow* avec un chemin de projet (ex.
`video-debrief/examples/notpetya.json`).

## Schéma d'un projet

```jsonc
{
  "meta":   { "title", "slug", "lang" },          // lang: fr en es de it pt
  "theme":  { "preset": "wavestone" | "cyber-dark", "overrides": { … } },
  "audio":  { "voice": "fr-FR-DeniseNeural", "rate": "+6%",
              "musicLevel": -8.5, "voGain": 7 },  // voice optionnelle (auto)
  "target": { "duration": 120 },                  // auto-ajustement du débit
  "pacing": { "lead": 0.8, "gap": 0.55, "tail": 1.6, "fps": 24 },
  "scenes": [ /* types ci-dessous */ ]
}
```

### Types de scènes

| Type | Usage | Champs propres |
|------|-------|----------------|
| `cold-open` | accroche (date, citation, titre glitché) | `dateLine, kicker, title, titleSize?, titleAt?, subtitle` |
| `chain` | chronologie à jalons (3-5 nœuds) | `heading, nodes:[{date,title,sub,at?}]` |
| `map-focus` | carte régionale + statistique + liste | `camera:{center:[lon,lat],scale}, epicenter, impactAt?, dotAnchors, stat:{value,suffix?}, statAt?, statLabel, bullets` |
| `map-spread` | carte monde + arcs + estampilles | `origin, stamps:[{name,fig,coords,at?}], bottom:{text,strong}` |
| `map-trace` | piste d'enquête (points reliés) | `trail:[{coords,label,dx?,dy?,at?}], big, bigAt?, sub, strip, footer` |
| `stat-grid` | grille 2×2 de faits/chiffres | `facts:[{tag,big,sub,at?,counter?:{to,suffix}}]` |
| `lessons` | leçons numérotées + chute | `lessons:[{text,at?}], finalLine1, finalLine2, finalAt?` |
| `image` | photo plein écran (Ken Burns) + légende | `src` (dataURL via le studio), `caption, kenburns?` |
| `endcard` | carton de fin (sans VO) | `title, subtitle, brand, minDuration` |

Champs communs : `id`, `type`, `vo` (voix off), `eyebrow`, `mood` (musique :
`dark tension impact grim hope cold resolve`, défaut intelligent par type).
Cues `at` en secondes depuis le début de la VO de la scène (réparties
uniformément si absentes). `coords` = `[longitude, latitude]`.

## Arborescence

```
video-debrief/
├── index.html            ← le studio intégré / server.py
├── engine/scene.html     ← moteur de rendu déterministe (aperçu ET rendu final)
├── pipeline/
│   ├── build.py          ← VO → timing → frames → musique → mix → MP4
│   ├── server.py         ← serveur local (production en un clic)
│   ├── render.js         ← capture Playwright 1080p24
│   └── make_music.py     ← musique paramétrique par moods (synthèse pure)
├── examples/             ← stonawave.json (EN, défaut) · notpetya.json (EN) · helios-leaks.json (FR)
└── requests/             ← projets poussés par le studio (déclenche le workflow)
```

Le workflow de production se trouve à la racine de CrisisMaker dans
`.github/workflows/produce-video.yml`.
