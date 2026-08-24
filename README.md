# CrisisMaker

CrisisMaker by Wavestone is a static browser application for designing and exporting cyber crisis exercise stimuli.

## Ollama

The AI connection settings support both Ollama modes:

- **Local models:** start Ollama on the default `http://localhost:11434` endpoint, pull a model with `ollama pull <model>`, then refresh the model list in CrisisMaker. No API key is required.
- **Ollama Cloud:** select Ollama Cloud, create a key at [ollama.com/settings/keys](https://ollama.com/settings/keys), enter it in CrisisMaker, then refresh the model list.

Ollama Cloud requests use the existing DeckSeeder Cloudflare relay because Ollama's direct API does not accept browser CORS preflight requests from a static GitHub Pages application. The relay only accepts HTTPS requests to `ollama.com`, filters forwarded headers, and streams the response back without storing the credential. The same restricted relay implementation is included in [`functions/api/llm.js`](functions/api/llm.js) for a future standalone Cloudflare Pages deployment.

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
