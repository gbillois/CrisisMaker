#!/usr/bin/env python3
"""Local production server for Video Debriefer Studio.

    python3 server.py          # http://localhost:8765

The studio (studio.html) detects it and offers one-click production.
Endpoints (CORS restricted to local origins):
  GET  /status    → {ok, busy}
  POST /build     → start a build from the posted project JSON
  GET  /progress  → {stage, pct, done, error, output, log}
  GET  /video     → the finished MP4
Also serves the studio statically: http://localhost:8765/studio
"""
import json, os, threading, traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

import build as builder

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
STATE = {"busy": False, "stage": "", "pct": 0, "done": False,
         "error": None, "output": None, "log": []}
MAX_PROJECT_BYTES = 25 * 1024 * 1024
EXTRA_ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.environ.get("CRISISMAKER_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}


def is_local_origin(origin):
    if not origin:
        return True
    if origin.rstrip("/") in EXTRA_ALLOWED_ORIGINS:
        return True
    try:
        parsed = urlparse(origin)
        return parsed.scheme in ("http", "https") and parsed.hostname in ("localhost", "127.0.0.1", "::1")
    except ValueError:
        return False


def validate_project(project):
    if not isinstance(project, dict):
        return "Le projet doit être un objet JSON."
    scenes = project.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return "Le projet doit contenir au moins une scène."
    if len(scenes) > 100:
        return "Le projet contient trop de scènes."
    for scene in scenes:
        if not isinstance(scene, dict) or not isinstance(scene.get("id"), str) or not scene["id"].strip():
            return "Chaque scène doit avoir un identifiant texte."
    return None


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
        origin = self.headers.get("Origin")
        if origin and is_local_origin(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not is_local_origin(self.headers.get("Origin")):
            return self._send(403, {"error": "origine non autorisée"})
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
            full = os.path.abspath(os.path.join(ROOT, safe))
            if os.path.isfile(full) and os.path.commonpath((ROOT, full)) == ROOT:
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
        if not is_local_origin(self.headers.get("Origin")):
            return self._send(403, {"error": "origine non autorisée"})
        if STATE["busy"]:
            return self._send(409, {"error": "production déjà en cours"})
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            return self._send(400, {"error": "Content-Length invalide"})
        if n <= 0 or n > MAX_PROJECT_BYTES:
            return self._send(413, {"error": "projet vide ou trop volumineux"})
        try:
            project = json.loads(self.rfile.read(n))
        except Exception:
            return self._send(400, {"error": "JSON invalide"})
        validation_error = validate_project(project)
        if validation_error:
            return self._send(400, {"error": validation_error})
        threading.Thread(target=run_build, args=(project,), daemon=True).start()
        self._send(200, {"started": True})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("Video Debriefer server → http://localhost:8765/studio")
    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
