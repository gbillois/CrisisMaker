#!/usr/bin/env python3
"""Local production server for Video Debriefer Studio.

    python3 server.py          # http://localhost:8765

The studio (studio.html) detects it and offers one-click production.
Endpoints (CORS open, localhost only):
  GET  /status    → {ok, busy}
  POST /build     → start a build from the posted project JSON
  GET  /progress  → {stage, pct, done, error, output, log}
  GET  /video     → the finished MP4
Also serves the studio statically: http://localhost:8765/studio
"""
import json, os, threading, traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

import build as builder

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
STATE = {"busy": False, "stage": "", "pct": 0, "done": False,
         "error": None, "output": None, "log": []}


def run_build(project):
    STATE.update(busy=True, stage="démarrage", pct=0, done=False, error=None, output=None, log=[])
    orig_log = builder.log
    def capture_log(stage, msg):
        STATE["log"].append(f"[{stage}] {msg}")
        STATE["log"][:] = STATE["log"][-40:]
        orig_log(stage, msg)
    builder.log = capture_log
    try:
        out = builder.build(project, progress=lambda s, p: STATE.update(stage=s, pct=p))
        STATE.update(output=out, done=True, stage="terminé", pct=100)
    except SystemExit as e:
        STATE.update(error=str(e), done=True)
    except Exception:
        STATE.update(error=traceback.format_exc()[-1500:], done=True)
    finally:
        builder.log = orig_log
        STATE["busy"] = False


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, b"")

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/status":
            self._send(200, {"ok": True, "busy": STATE["busy"]})
        elif p == "/progress":
            self._send(200, {k: STATE[k] for k in ("stage", "pct", "done", "error", "output", "log", "busy")})
        elif p == "/video":
            out = STATE.get("output")
            if out and os.path.exists(out):
                with open(out, "rb") as f:
                    self._send(200, f.read(), "video/mp4")
            else:
                self._send(404, {"error": "pas de vidéo"})
        elif p in ("/", "/studio"):
            with open(os.path.join(ROOT, "index.html"), "rb") as f:
                self._send(200, f.read(), "text/html; charset=utf-8")
        else:
            # static: engine assets for the preview iframe
            safe = os.path.normpath(p).lstrip("/")
            full = os.path.join(ROOT, safe)
            if os.path.isfile(full) and full.startswith(ROOT):
                ctype = {"html": "text/html; charset=utf-8", "js": "text/javascript",
                         "css": "text/css", "json": "application/json",
                         "woff2": "font/woff2", "png": "image/png"}.get(full.rsplit(".", 1)[-1], "application/octet-stream")
                with open(full, "rb") as f:
                    self._send(200, f.read(), ctype)
            else:
                self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/build":
            return self._send(404, {"error": "not found"})
        if STATE["busy"]:
            return self._send(409, {"error": "production déjà en cours"})
        n = int(self.headers.get("Content-Length", 0))
        try:
            project = json.loads(self.rfile.read(n))
        except Exception:
            return self._send(400, {"error": "JSON invalide"})
        threading.Thread(target=run_build, args=(project,), daemon=True).start()
        self._send(200, {"started": True})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("Video Debriefer server → http://localhost:8765/studio")
    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
