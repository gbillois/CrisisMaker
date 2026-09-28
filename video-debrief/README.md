# VideoMaker — générateur de vidéos documentaires de crise

Un studio HTML qui transforme une timeline de crise (ou n'importe quel récit)
en **vidéo documentaire 1080p de ~2 minutes** : voix off neurale, musique
originale synthétisée, scènes animées (cartes, statistiques, leçons, photos).

**Philosophie : le moins d'IA possible.** L'IA (la connexion configurée dans
CrisisMaker) ne sert qu'à rédiger le *brouillon* de scénario, étape optionnelle.
Toute la production (voix, images, musique, montage) est déterministe et se fait
dans le navigateur.

## Utiliser le studio

Dans CrisisMaker, ouvrez l’onglet **Video Debrief**. Le studio lit l’exercice
ouvert : sa timeline de debrief, son scénario, sa chronologie de l’incident, ses
phases et ses stimuli clés.

## Les 3 étapes

1. **Scénario** : réglez durée, langue, style, voix, ton et public, puis
   **Créer le scénario par génération IA** (à partir de l’exercice) ou
   **Création manuelle** (un premier découpage en scènes depuis la timeline du
   debrief, sans IA).
2. **Adaptation** : éditez chaque scène (voix off, textes, photos), réordonnez ;
   l'aperçu live (scrubber + lecture) utilise le *même moteur* que le rendu
   final. Le JSON du projet reste accessible dans les options avancées.
3. **Production**, entièrement dans le navigateur : le bouton **Charger la voix**
   télécharge une fois le moteur vocal Piper (ONNX Runtime Web, phonétiseur
   espeak-ng) et la voix choisie, gardés ensuite dans le navigateur ; rien n'est
   chargé tant qu'on ne clique pas. Puis : voix off, timing réel (auto-ajustement
   du débit), musique synthétisée, mixage avec ducking, rendu des images par le
   même moteur que l'aperçu, encodage WebCodecs (H.264 + AAC, sinon VP9) et MP4
   assemblé dans la page. Sans voix chargée, la vidéo sort avec la musique et des
   sous-titres incrustés. Chrome ou Edge récents recommandés ; ~1 min de rendu
   par 30 s de vidéo.

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
├── index.html            ← le studio intégré à CrisisMaker
├── engine/scene.html     ← moteur de rendu déterministe (aperçu ET rendu final)
├── browser/              ← production dans le navigateur : voice.js (Piper),
│                           music.js, produce.js (timing, mixage, rendu), encode.js
│                           (WebCodecs), mp4.js (multiplexeur MP4)
└── examples/             ← stonawave.json (EN, défaut) · notpetya.json (EN) · helios-leaks.json (FR)
```
