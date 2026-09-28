# CrisisMaker

CrisisMaker by Wavestone is a static browser application for designing and exporting cyber crisis exercise stimuli.

## Azure OpenAI

Use the endpoint, API key, and deployment name from the same Azure resource.
No separate region parameter is needed. The deployment name may differ from the
model name.

- URLs ending in `/openai/v1` and Foundry resource roots
  (`https://<resource>.services.ai.azure.com`) use the v1 Chat Completions API,
  with the deployment in `model` and no dated `api-version` query parameter.
- Classic Azure resource roots (`*.openai.azure.com` and
  `*.cognitiveservices.azure.com`) retain the dated API version in Settings.
  Append `/openai/v1` to use the same v1 URL convention as DeckSeeder.
- Use the resource endpoint, not a Foundry project URL (`/api/projects/...`).

If a direct request fails at the browser network/CORS layer, CrisisMaker retries
through the existing DeckSeeder Cloudflare relay. This forwards the API key and
prompt through that relay, as Ollama Cloud already does. It applies to connection
tests, generation, and streaming, including the standalone HTML. HTTP errors
(such as invalid keys, missing deployments, and rate limits) are shown without a
relay retry. A corporate firewall or private Azure resource may still prevent
connectivity; both the resource endpoint and `deckseeder.pages.dev` must be reachable
from the networks used for those requests.

The bundled `functions/api/llm.js` also permits these Azure host suffixes and the
`api-key` header for a future Cloudflare deployment. GitHub Pages uses the existing
DeckSeeder relay; it does not execute the bundled function.

## Ollama

The AI connection settings support both Ollama modes:

- **Local models:** start Ollama on the default `http://localhost:11434` endpoint, pull a model with `ollama pull <model>`, then refresh the model list in CrisisMaker. No API key is required.
- **Ollama Cloud:** select Ollama Cloud, create a key at [ollama.com/settings/keys](https://ollama.com/settings/keys), enter it in CrisisMaker, then refresh the model list.

Ollama Cloud requests use the existing DeckSeeder Cloudflare relay because Ollama's direct API does not accept browser CORS preflight requests from a static GitHub Pages application. Ollama requests target `https://ollama.com`; the relay filters forwarded headers and streams the response back without application-level credential storage. The same restricted relay implementation is included in [`functions/api/llm.js`](functions/api/llm.js) for a future standalone Cloudflare Pages deployment.

For the deployed site, allow its origin in the Ollama service environment and restart Ollama:

```sh
OLLAMA_ORIGINS=https://gbillois.github.io ollama serve
```

## Video Debrief

The **Video Debrief** tab embeds the complete documentary video studio from
VideoMaker. Its deterministic rendering engine, examples, local production
server, and pipeline live in [`video-debrief/`](video-debrief/).

To run local MP4 production:

```sh
cd video-debrief/pipeline
python3 server.py
```

Local production requires `ffmpeg`, `node`, and the Python packages documented in [`video-debrief/README.md`](video-debrief/README.md).

Cloud production pushes project files to `video-debrief/requests/` and is
handled by [`.github/workflows/produce-video.yml`](.github/workflows/produce-video.yml).

## Single-file build (standalone HTML)

For hosts that can only serve one `.html` file, `tools/build_inline_html.mjs`
consolidates the whole app — CSS, fonts, JS modules, third-party libs and the
default news video — into a single self-contained document:

```sh
node tools/build_inline_html.mjs                   # -> crisismaker.html (~3 MB)
INCLUDE_VIDEO=1 node tools/build_inline_html.mjs   # -> ~8 MB, embeds the default video
```

Or run the **Build inline HTML** GitHub Action (Actions tab → *Run workflow*)
and download the generated file from the run's artifacts.

The Video Debrief tab is not included in this build (it relies on a nested
iframe sub-app) and shows a placeholder instead; use the full app for it.

## Security documentation

- [MITRE ATT&CK / D3Fend threat and mitigation document](docs/mitre-attack-d3fend-threat-mitigation.md)
- [Debrief generation and automation](docs/debrief-automation.md)

## Scenario context and Phase Builder

An exercise starts in **Scenario context** (first tab): pick a ready-made scenario
from the library or generate a skeleton with AI, then frame the exercise (name,
designer brief, synopsis, threat, objectives, narrative arc), the client, the threat
and the actors.

The **Phase Builder** (second tab) storyboards the crisis phases on a multi-track
timeline, in the spirit of a video editing suite. Side panels (blocks, cast,
inspector) fold into icon rails and the program monitor collapses to a single strip,
so the timeline can use the whole screen on a laptop (`[`, `]` and `M` toggle them;
the layout is remembered per browser):

- **Timeline:** a *main storyline* of sequential crisis stages (trigger & detection,
  investigation, containment, eradication, business continuity, recovery, crisis
  exit, twists) plus parallel *workstream* tracks (crisis cell & governance,
  communication, legal & regulatory, HR, logistics, customers & partners). Blocks are
  dragged from the **Bin**, moved and resized with the mouse (snap, ripple mode,
  multi-selection, zoom), duplicated and locked. The **Program monitor** shows what
  happens at the playhead and the injects around it.
- **Blocks** carry a duration, a number of injects, a brief, objectives and notes, and
  are refined by layers of detail: *structure* → *narrative* (hidden story, what
  players know, dilemmas) → *inject plan* (time, channel, sender, intent) →
  *injects* (generated stimuli linked to their block).
- **AI** (optional, same provider settings as the rest of the app): generate a
  complete skeleton from a brief, deepen every block or one block to the next layer,
  rewrite a block from an instruction, suggest roles, and run a global coherence
  review (deterministic checks plus an AI critique with one-click fixes). Every AI
  operation saves a version first and is a single undo step.
- **History:** undo/redo of every storyboard edit (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z),
  automatic versions (before AI operations, generations and restores, and every five
  minutes while editing, kept in the browser's IndexedDB), named versions and
  "validated" milestones saved with the project, and a diff against the current
  storyboard before restoring.
- **Generate injects** (whole storyboard or selected blocks): plans missing injects,
  creates actors for the cast roles, creates one stimulus per planned inject through
  the Agent's `createActor`/`createStimulus` tools, then writes each one with the
  storyboard as context, in the inject language. A checkpoint allows undoing the whole
  generation. **Send to Agent** prepares a brief scoped to one block for the Agent tab.
- **Sync** keeps injects and actors coherent when the scenario evolves: moved blocks
  reschedule their injects, changed briefs/narratives/plans flag injects as outdated
  (regenerated if untouched, *adapted* with minimal changes if edited by hand), removed
  blocks leave orphans to unlink or delete, and new planned injects are created.
  Locked injects are never modified. Injects moved by hand in the Timeline keep their
  time unless you choose otherwise. Link status also appears in the Injects tab.
- **Library** (in Scenario context): eight ready-made storyboards (ransomware with double extortion,
  personal data breach, software supply chain, DDoS & hacktivism, CEO fraud with
  deepfake, destructive wiper, insider threat, OT/industrial incident), each with
  objectives, cast, tracks and a complete inject plan. They can be previewed, used,
  inserted after the current storyline, or adapted to the organisation with AI. Your
  own storyboards can be saved as templates in the browser and exchanged as
  `.crisisscenario.json` files.

The storyboard is saved with the project (`storyboard`, `storyboard_versions`);
`scenario.phases` is derived from the main storyline so the Agent and the Checker keep
working, and older projects with phases are converted automatically. Stimuli and
actors keep a `scenario_link` (block, planned inject, content hashes, lock).

Implementation: `js/scenario-model.js` (schema, presets, checks, diff),
`js/scenario-library-data.js` and `js/scenario-library.js` (library),
`js/scenario-history.js` (undo/redo and versions), `js/scenario-ai.js` (AI
operations), `js/scenario-sync.js` (links, generation pipeline, sync),
`js/scenario-builder-view.js` and `js/scenario-builder-events.js` (UI).

## Agent mode

The **Agent** tab provides **Build my exercise** and **Challenge my exercise**.
Enter a brief or review objective, choose an autonomy mode, and select **Start**.
The agent works on the currently open exercise and uses the existing AI connection
settings, including local/cloud Ollama and all other supported providers. A model
must be able to return structured JSON reliably; no additional backend, framework,
or runtime dependency is required.

- **Assist:** each modification waits for approval, with its exact arguments and
  current context available for inspection.
- **Agent** (default): normal edits are automatic; scenario/phase replacement and
  batch rescheduling require approval.
- **Auto-build:** broad edits are automatic. Deletion always requires approval.

**Stop** aborts the current request and prevents late results from changing the
exercise. Runs stop after 40 steps, repeated tool loops, three consecutive invalid
responses/calls, or an unrecoverable failure. Requests have a 90-second timeout.
The activity stream shows actions, results and remaining issues, without exposing
reasoning transcripts. Other exercise editing pauses while a run is active.

**Undo agent changes** restores the entire exercise to immediately before the
latest run, including edits made subsequently. AI settings are preserved. A single
checkpoint is saved in browser storage (or retained in memory if storage is full).
Uploaded audio/video references can be restored in the same tab; temporary media
URLs do not survive a browser reload. Starting a new run replaces the checkpoint.
Completed edits continue to use normal local saving, project files and exports.
Exercise objectives, narrative arc and timed phases are optional fields inside
`scenario`; they also appear in the normal Scenario view and Checker context.
Existing project files remain compatible, including projects with no actors.

Implementation is separated into `js/agent-prompts.js` (editable designer/reviewer
instructions), `js/agent-tools.js` (23 controlled tools, including storyboard read/edit, validation and bounded
context), `js/agent-runner.js` (execution, approvals, cancellation and checkpoint),
and `js/agent-view.js` (UI). Tools reuse existing actor/stimulus constructors,
stimulus version history, generation prompts, provider transport and persistence.
Structural checks flag missing data, timing gaps and duplicate content; the agent's
critical content review evaluates decisions, pressure, realism and objectives.
The agent scripts are automatically included by the existing standalone builder.

Verification:

```sh
node --test tests/*.test.js
node tools/build_inline_html.mjs
# Optional browser smoke, using an existing Playwright installation and local test host:
BROWSER_CHANNEL=chrome node tests/agent-browser-smoke.cjs http://127.0.0.1:8765/
BROWSER_CHANNEL=chrome node tests/scenario-builder-browser-smoke.cjs http://127.0.0.1:8765/
# Or test the generated standalone document directly:
BROWSER_CHANNEL=chrome node tests/agent-browser-smoke.cjs file:///absolute/path/to/crisismaker.html
```

Set `PLAYWRIGHT_MODULE` to the absolute Playwright module path if it is not on the
normal Node search path. Browser/provider tests use mocked AI responses and never
require a real API key or spend provider credits.
