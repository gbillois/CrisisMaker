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

## Security documentation

- [MITRE ATT&CK / D3Fend threat and mitigation document](docs/mitre-attack-d3fend-threat-mitigation.md)
- [Debrief generation and automation](docs/debrief-automation.md)
