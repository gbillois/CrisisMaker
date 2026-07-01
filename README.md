# CrisisMaker

CrisisMaker by Wavestone is a static browser application for designing and exporting cyber crisis exercise stimuli.

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
