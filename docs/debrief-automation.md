# Debrief generation and automation

The Debrief tab creates a separate reconstruction of what truly happened in the scenario. It deliberately does not create one debrief step per stimulus and does not expose stimuli to the final audience.

## Current model

The project stores a `debrief` object beside the scenario stimuli:

- `meta`, `theme`, and `layout` configure the exported interactive timeline.
- `phases` organize the story into the hidden pre-crisis, the visible crisis, and its aftermath.
- `events` are editable canonical story events with a time label, location, coordinates, narrative explanation, impact, damage, and evidence.

Two generation paths are available:

1. **Deterministic generation without an LLM** creates a causal story skeleton from the scenario synopsis and detailed context. Rich built-in examples such as StonaWave contain a fully authored reconstruction.
2. **Optional LLM generation** receives the complete scenario and only uses injects as secondary consistency context. Its prompt explicitly forbids turning injects into debrief events and asks for the complete hidden story, including preparation, detonation, impact, recovery, and root causes.

The HTML export uses the interactive renderer extracted from `NotPetyaTimeline/CrisisDebrifier.html`. The generated artifact loads its configuration through `window.TIMELINE_CONFIG`.

## Recommended next automation steps

The strongest future input is structured scenario-design information:

- Hidden attacker or incident actions.
- Causal links between weaknesses, propagation, and business impacts.
- Locations, affected assets, evidence, financial exposure, and recovery dependencies.
- Expected decisions and alternate branches, stored separately from the canonical story.

Participant actions can later be overlaid on the canonical reconstruction as a separate after-action-review layer. They should not replace or distort the scenario story itself.

## Renderer synchronization

`js/debrief-renderer.js` is generated from the `tpl-renderer` block in `NotPetyaTimeline/CrisisDebrifier.html`. When that renderer changes, regenerate the file from the updated source and rerun the JavaScript syntax and browser checks.
