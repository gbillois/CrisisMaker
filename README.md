# CrisisMaker

CrisisMaker by Wavestone is a platform to design and run cyber crisis exercises,
in the browser. The scenario is the core: its main storyline and phases, the player
cells and their learning objectives, and the attack path. Injects (stimuli) serve
the phases: each belongs to a phase, is addressed to a cell and is written from the
scenario. The exercise is then played phase by phase and debriefed.

## Context tab: generate the exercise from what you have

The Context tab starts with **Scenario generation**:

1. **Existing exercise, proposal or exercise brief**: a deck (.pptx), a Word document (.docx),
   a chronogram (.xlsx, .xls) or plain text (.txt, .md). A deck is read slide by slide in the
   presentation order: titles, bullets with their levels, tables (merged cells repeated down, so
   a phase spanning several rows stays on each), grouped shapes in reading order, charts, SmartArt,
   picture descriptions, speaker notes and hidden slides. A Word or text document is split into
   sections at its headings. Each slide or section is tagged with what it is about (context,
   objectives, players and cells, phases, incident timeline, chronogram and injects, facilitation,
   rules, debrief, proposal). Chronogram tables continued over several slides are joined, and
   injects written one per slide ("From:", "To:", "Channel:", a time) become rows, so Check &
   Challenge can audit them.
   An example deck of a fictitious company (`docs/examples/example-crisis-exercise-deck.pptx`,
   built by `tools/make-example-deck.py`) can be downloaded or loaded next to the upload zone: it
   holds every essential point and a table of sequences drawn with shapes, without a
   chronogram: the AI writes the stimuli from the key events and the context.
2. **Generic scenario**: a library scenario the AI adapts to the client, or that you use
   without AI adaptation (**Use without AI adaptation**).
3. **What you want in this exercise**: your own notes; they win over the file.

**AI generation** reads these sources, fills the empty Context fields (name, client, sector,
duration, simulated start, cells and their players, learning objectives, incident timeline,
context), then the builder agent builds the framing. The agent can read the whole file with its
`getReferenceFile` tool. Without AI, **Fill the fields from the file** copies the sections found
into the empty fields.

Amend any field afterwards, then select **Update** under the fields: the agent carries the changes
into the phases, cells and cast, and the injects follow in cascade.

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

## AI local server

**AI local server** (in the AI provider list of Settings > AI connection) connects to an
OpenAI-compatible server on your machine: CoPro Desktop's Local API, which relays to
Microsoft 365, or LM Studio, the llama.cpp server, vLLM or Ollama's `/v1`.

- **Server URL**: the base of the API, by default `http://127.0.0.1:11434/v1`. The app calls
  `<Server URL>/models` and `<Server URL>/chat/completions`. A URL without `/v1` is used as typed.
- **API key**: optional. It is sent as `Authorization: Bearer <key>` only when filled, and kept
  like the other provider keys (for the browser session only, never in project files).
- **Model**: the list loaded from the server; the refresh button loads it again. A model
  already chosen stays selected when the list cannot be loaded.

The provider is ready once the URL and the model are set. Requests go straight from the page
to the server, never through the DeckSeeder relay. Replies are asked for in JSON mode; no
native tool calling and no images are sent. The page's security policy allows servers on
`localhost` and `127.0.0.1`.

With CoPro Desktop:

1. In CoPro, open Settings > Local API: turn it on, keep port 11434 (or note the port you
   choose), and add this app's page address to the allowed web pages:
   `https://gbillois.github.io` for the hosted version, `null` for the standalone HTML opened
   from disk. Settings > AI connection in CrisisMaker shows the address of the open page.
2. In CrisisMaker, Settings > AI connection: AI provider **AI local server**, Server URL
   `http://127.0.0.1:11434/v1`, API key empty, then pick the model from the refreshed list
   (for example `gpt-5.5`) and select **Test connection**.

If Ollama also runs on the machine, it holds port 11434: choose another port in CoPro and use
it in the Server URL (for example `http://127.0.0.1:11500/v1`).

When the server cannot be reached, the error gives the URL tried: check that the server is
running and, for CoPro, that Local API is on and lists the page's address.

Chrome also asks each site for permission to reach programs on this computer. If the page
says "Failed to fetch" while `http://127.0.0.1:11434/v1/models` opens fine in a tab, allow
**Apps on device** ("Applis sur l'appareil" in French) for the page: icon left of the address,
then Site settings. **Local network access** alone is not enough: it covers other machines of
the network, not this one. CoPro answers 401
when it is not signed in to Microsoft 365, 403 when the page's address is not allowed, 404
for an unknown model and 503 when it is not available.

## Video Debrief

The **Video Debrief** tab embeds the documentary video studio from VideoMaker
([`video-debrief/`](video-debrief/)), in three steps:

1. **Scenario**: set the duration, language, style, voice, tone and audience,
   then create the scenario with AI from the open exercise (its debrief
   timeline, scenario, phases and key stimuli), or create it manually.
2. **Editing**: adjust each scene with a live preview.
3. **Production**: the MP4 is produced entirely in the browser (voice-over,
   images, music and encoding); nothing is sent anywhere.

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

## Designing and running an exercise

The tabs follow the life of an exercise, in three groups: **Prepare** (Context, Main
storyline, Cells & actors, Detailed storyline, Injects library), **Run** (Check &
Challenge, Play) and **After** (Evaluation, Debrief). The design itself is done in two
stages, as with a client: first the **framing** (the phases of the Main storyline,
their main events and the consequences to manage), reviewed and validated with the
client; then the **stimuli of each cell** (Detailed storyline).

1. **Project** (the menu on the project name, in the header): a summary with key
   figures; project data (new, create from the library, open, import an Excel
   timeline, load the demo, save locally, export the text content as JSON, export all
   injects); and the **scenario library** (preview, load, export the current storyline
   as a template, import a template file). **Load** selects a scenario and opens
   Context. Every built-in scenario plays in 3 hours.
2. **Context**: the exercise frame (client, sector, logo; play duration, simulated
   start and end dates, timezone, number of crisis cells and players; primary and
   inject languages), then **Scenario generation**: your context, objectives and ideas;
   the **learning objectives by player category** (all players, then each cell); and
   the **attack path**, the technical steps the attacker follows, in order. These feed
   every AI operation: the agent, the storyline AI, the writing of each stimulus
   (the recipient cell's objectives and the attack path) and the debrief. Then
   either **Use without AI adaptation** (the loaded library scenario as written;
   greyed when none is loaded) or **Build my exercise**, in three steps:
   **Build the framing** starts the builder agent with all of the above and adapts the
   loaded library scenario: the agent asks you a few questions, then builds the main
   storyline (ending with a closing phase), its main events, the cells and players,
   the cast and its actors, without planning injects yet, and the Main storyline opens
   for review. **Validate the framing** once the client agrees: a named version is
   kept, and the Main and Detailed storylines then say whether a phase changed since
   (with a comparison). **Build the stimuli** plans and writes the injects of every
   cell, nudges included, then challenges the exercise in Check & Challenge.
   **Everything at once** chains the three steps for a first draft. The scenario details (name, type, summary,
   objectives, synopsis, threat) stay editable in a collapsed block.
   **Existing crisis exercise file** (optional): load the chronogram of a previous
   exercise (.xlsx, .xls or .pptx). The agent uses it as a reference when it generates
   the scenario, and **Challenge it** audits the file as it is in Check & Challenge.
3. **Main storyline**: the macro view. The phases of the crisis sit on a single time
   line (trigger & detection, investigation, containment, eradication, business
   continuity, recovery, crisis exit, twists). They are moved and resized with the
   mouse (snap, ripple, zoom), duplicated and locked. Selecting a phase opens its
   editor **at the bottom of the screen**: **what happens during the phase**, in plain
   text (the main field), then its planned injects per cell, the hidden story and
   facilitation notes (folded), and AI rewrite.
4. **Cells & actors**: the player cells (decision, operational, communication, IT,
   legal, business continuity, HR, or your own) with their players, and the simulated
   actors who send injects, grouped by type (attackers, press, authorities, customers,
   partners, experts, internal senders). Storyline roles are linked to actors here.
   **Update** (on Main storyline, Cells & actors and Detailed storyline) reflects every
   change in cascade in one dialog: a phase whose "what happens" changed is re-planned
   with AI (its inject plan follows the new text, the designer's text is kept), then
   its injects follow (timing, rewritten content, new injects, removed ones); an actor
   or a cell edited in Cells & actors adapts the injects it sends or receives; roles
   update their actors. Manual edits are adapted, never overwritten; locked injects
   are untouched; one undo restores everything.
5. **Detailed storyline**: the main storyline stays on top; below it, one row of
   injects per cell. Pick a cell to work on its injects: drag a card to change its
   time or its recipient cell, plan new injects for the cell with AI, create and
   write them, and keep them in sync. The inject editor also opens at the bottom.
   **Injects library**: every written inject, phase by phase, with filters. **Create
   injects in bulk with AI** is for a designer who only wants injects, without building
   the storyline: describe them and how many ("Create 20 injects from H+0 to H+2…"), and
   optionally impose the recipient cell and the phase. The AI writes them directly with
   their sender, time and recipient cell, from the context, cells and phases of the
   exercise; senders missing from the cast are added to it. Large requests are written in
   parts of 8 (up to 60 injects per request, with Stop); the batch is one undo step, and
   **Remove them** takes it out in one click.
6. **Check & Challenge**: is the exercise ready to play? One **readiness** verdict
   (Ready to play, Almost ready, Needs work) and score from three signals, each with
   its gauge: the automatic checks, the AI challenge and the ready-to-play checklist,
   with the next steps that actually hold the score down. Below: key figures, a
   cells × phases heatmap with the load per 30 minutes, the **automatic checks**
   (always up to date: idle cells, dead times, overloads, empty phases, missing
   recipients or senders, orphans; each finding opens the inject or cell concerned),
   and **Challenge with AI**: one click runs the five-axis quality analysis (coverage,
   structure, pacing, actors, realism) with priority actions and verdicts, plus the
   cell-by-cell timing review, whose findings join the automatic checks. The challenge
   targets the current scenario, or the existing exercise file loaded in Context; the
   last result of each is kept, and the last challenge of the scenario is saved with the
   project (it is cleared when the exercise changes). On the scenario, each priority
   action has a **Fix** button, and **Fix all with the agent** applies them all: the
   agent edits the exercise within its autonomy mode (this is the only challenge of the
   app). The report exports to Markdown or Word. Then the ready-to-play checklist, also saved with the project.

7. **Play**: runs the exercise live, for its pilot.
   - The stimuli to send come from the Injects library (**Download all stimuli**: a ZIP
     with every stimulus numbered in play order, `01_H+00-00_…`, the chronogram as a CSV
     for Excel, and the project file).
   - A **control bar** that stays visible: Start/Pause (Space), clock shifts (±1, ±5
     min), speed (real time, or faster for rehearsals), **Add inject now**, the
     exercise time and simulated time, the current phase and time left, the next
     inject with its countdown, sent/to send/late counters, progress over the phases,
     and **Reset play** (two confirmations: clock, sent statuses and log).
   - **Add inject now** creates a blank inject at the current time with the next free
     number; the other injects keep theirs. When the exercise time is over, the clock
     pauses once and the log records it.
   - Smart filters: to send now, late, next 15 minutes, to validate, sent; search,
     phase, cell, channel, sender; sort; follow the clock; show planned injects.
   - A vertical **chronogram** by phase with a moving NOW line: each inject shows its
     time, number, channel, sender and recipient cell, and its status (Draft,
     Validated, Sent; statuses can go back to resend), with Modify to open the editor.
     Due and late injects stand out and trigger an alert.
   - The **exercise log** records starts, pauses, clock and speed changes, phases,
     status changes (with the delay and re-sends) and the pilot's notes; **Save
     log** downloads it as a CSV. The run state is saved with the project.

Every inject has a **recipient cell** (`cell_id` on planned injects and stimuli).
Cells replace the parallel workstreams of earlier versions: when an older project or
a library scenario is loaded, workstream injects move into the main phase covering
their time, addressed to the matching cell, and their objectives and briefs are kept
on that phase.

Under the hood:

- **Layers of detail**: *structure* → *narrative* (hidden story, what players know,
  dilemmas) → *inject plan* (time, cell, channel, sender, intent) → *injects*
  (generated stimuli linked to their phase).
- **AI** (optional, same provider settings as the rest of the app): draft the main
  storyline, detail every phase or one phase, rewrite a phase from an instruction,
  plan injects for one cell, suggest roles, and review the whole exercise. Every AI
  operation saves a version first and is a single undo step.
- **History**: undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, on Main storyline, Cells & actors
  and Detailed storyline; a text field keeps its own undo). An edit that also changes cells,
  actors or written injects (moving or deleting an inject, adding or deleting a cell,
  deleting an actor) is one undo step for all of them. Automatic versions (before
  AI operations, generations and restores, and every five minutes while editing, kept
  in the browser's IndexedDB), named and "validated" versions saved with the project,
  and a diff before restoring.
- **Generate injects** (whole exercise, one phase or one cell): plans missing injects,
  creates actors for the roles, creates one stimulus per planned inject through the
  Agent's `createActor`/`createStimulus` tools, then writes each one with the storyline
  and its recipient cell as context, in the inject language. A checkpoint allows
  undoing the whole generation.
- **Sync** keeps injects and actors coherent when the scenario evolves: moved phases
  reschedule their injects, changed briefs, plans or recipients flag injects as
  outdated (regenerated if untouched, *adapted* with minimal changes if edited by
  hand), removed phases leave orphans to unlink or delete, and new planned injects are
  created. Locked injects are never modified.
- **Library**: eight ready-made scenarios (ransomware with double extortion, personal
  data breach, software supply chain, DDoS & hacktivism, CEO fraud with deepfake,
  destructive wiper, insider threat, OT/industrial incident), each with objectives,
  roles, cells and a complete inject plan. They can be previewed, used, inserted after
  the current storyline, or adapted to the organisation with AI. Your own storylines
  can be saved as templates and exchanged as `.crisisscenario.json` files.

### Exercise model (the pivot)

`js/exercise-model.js` (`ExerciseModel`) is the single place every tab reads the
exercise from, over the project data as it is saved (no separate copy):

- **Entities**: the exercise and its context; **phases** (main storyline blocks, with
  what happens, hidden story, notes); **planned injects** (per phase and cell: time,
  role, channel, title, intent); **cells**; **roles** and the **actors** who play them;
  **injects** (the written stimuli, linked to their planned inject); the **run** (Play).
- **Shared rules**: an inject's phase is its linked phase, else the phase at its time;
  written injects are numbered #01..#NN in play order (Play, ZIP names, chronogram),
  frozen once the run starts (an inject added during play takes the next number, until
  Reset play);
  two statuses never mixed, `run` (planned, draft, validated, sent) and `sync` (in
  sync, outdated, time changed, orphan, locked, manual edit, unlinked); the sender is
  the actor who signs a written inject, else the role of the planned one.
- **Dependencies** (what **Update** reflects, in order): phase text → inject plan
  (`plan_hash`) → injects (`source_hash`, time); role → actor; actor → the injects it
  sends (`actor_hash`); cell → the injects it receives (`cell_hash`).

Play, Injects, Check & Challenge, the export, the Checker and the agent's consistency
check use it, so they agree on every inject.

The storyboard is saved with the project (`storyboard`, `storyboard_versions`, `cells`,
`exercise`);
`scenario.phases` is derived from the main storyline so the Agent and Check & Challenge keep
working, and older projects with phases are converted automatically. Stimuli and
actors keep a `scenario_link` (block, planned inject, content hashes, lock).

Implementation: `js/scenario-model.js` (schema, presets, checks, diff),
`js/scenario-library-data.js` and `js/scenario-library.js` (library),
`js/scenario-history.js` (undo/redo and versions), `js/scenario-ai.js` (AI
operations), `js/scenario-sync.js` (links, generation pipeline, sync),
`js/scenario-builder-view.js` and `js/scenario-builder-events.js` (shared timeline,
modals and events), `js/scenario-tabs.js` (Main storyline, Cells & actors, Detailed
storyline and Check & Challenge tabs), `js/checker.js` (AI challenge, file import,
checklist, report).

## Assistant

A support chat sits at the bottom right of every tab (the round button). Ask a
question about the exercise ("which cell receives the fewest injects?", "which
objectives are not covered?") or ask for a change ("add a journalist to the cast",
"make the second phase more intense"). Suggestions are offered on an empty
conversation. The assistant runs on the same agent and tools as the rest of the
app: it reads the whole exercise to answer, applies changes with the agent tools,
asks before broad changes, can ask you a clarifying question, and offers **Undo
these changes** after a run that changed something. The conversation stays in the
current tab session; **Clear the conversation** starts over.

The CrisisMaker icon (`img/crisismaker-icon.svg`, also used as the favicon and in the
header) draws the letters from the bundled Poppins ExtraBold (SIL Open Font License).

## Agent mode

The agent is a core component rather than a tab. Tabs start it where the content
lives (for example **Build the framing** in Context, or **Fix** on a priority action
of Check & Challenge) and show a compact panel with its progress, its questions,
approvals, Stop and Undo. The full **agent console** is in **Settings → AI agent**; it
offers **Build from the context** and **Design the whole exercise**. Enter a brief,
choose an autonomy mode, and select **Start**. To challenge the exercise, use Check &
Challenge: its priority actions can be fixed with the agent, one by one or all at once.

The agent knows the storyline model: the exercise frame, the main storyline phases,
player cells and players, the cast of simulated senders and their actors, and the
planned injects of each phase addressed to a cell. It can reply with **questions**
(at most two rounds); you answer or skip, and it proceeds with disclosed
assumptions.
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
`scenario`; they also appear in the normal Scenario view and Check & Challenge context.
Existing project files remain compatible, including projects with no actors.

Implementation is separated into `js/agent-prompts.js` (editable builder/designer/reviewer
instructions), `js/agent-tools.js` (33 controlled tools, including the exercise frame, main storyline,
cells, cast and per-cell inject plan, validation and bounded context), `js/agent-runner.js` (execution, approvals, cancellation and checkpoint),
and `js/agent-view.js` (UI) and `js/assistant.js` (the support chat). Tools reuse existing actor/stimulus constructors,
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
