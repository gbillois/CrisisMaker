# Debrief generation and automation

The Debrief tab creates a separate timeline of major discussion milestones. It deliberately does not create one debrief step per stimulus.

## Current model

The project stores a `debrief` object beside the scenario stimuli:

- `meta`, `theme`, and `layout` configure the exported interactive timeline.
- `phases` organize milestones into detection, escalation, and response.
- `events` are editable debrief milestones. An event can reference its source stimulus with `stimulus_id`.

Two generation paths are available:

1. **Deterministic generation without an LLM** selects a small set of chronologically distributed, high-signal stimuli. It scores channels and crisis keywords, removes duplicates, and creates editable milestone drafts.
2. **Optional LLM generation** receives the complete scenario and a compact representation of every stimulus. Its prompt explicitly asks for 5 to 10 decisive milestones, discussion angles, and possible lessons learned rather than a summary of every inject.

The HTML export uses the interactive renderer extracted from `NotPetyaTimeline/CrisisDebrifier.html`. The generated artifact loads its configuration through `window.TIMELINE_CONFIG`.

## Recommended next automation steps

The strongest future input is not more generated text. It is structured evidence captured while the exercise runs:

- Facilitator markers: decision made, escalation requested, communication approved, recovery started.
- Participant actions: action, owner, timestamp, rationale, and outcome.
- Expected-versus-observed links: connect a milestone to the planned stimulus and to what participants actually did.
- Evidence: notes, decisions, produced communications, screenshots, and exported artifacts.
- Scoring signals: response delay, missing owner, contradictory decisions, repeated escalation, or an unaddressed inject.

With those inputs, CrisisMaker can deterministically propose debrief milestones from actual exercise behavior. An LLM can remain optional and focus on drafting concise lessons learned, grouping related observations, and suggesting facilitator questions.

## Renderer synchronization

`js/debrief-renderer.js` is generated from the `tpl-renderer` block in `NotPetyaTimeline/CrisisDebrifier.html`. When that renderer changes, regenerate the file from the updated source and rerun the JavaScript syntax and browser checks.
