#!/usr/bin/env python3
"""Video Debriefer — one-command production pipeline.

    python3 build.py mon-projet.json [--preview-only]

Steps: voiceover (edge-tts) → timing (auto-fit to target duration) →
frames (Playwright on engine/scene.html) → music (parametric synth) →
mix (sidechain ducking) → H.264 MP4 in ../out/<slug>.mp4

Only the scenario text is ever AI-generated (in the studio); this whole
pipeline is deterministic.
"""
import argparse, asyncio, json, os, re, shutil, subprocess, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "..", "engine")
OUT = os.path.join(HERE, "..", "out")
sys.path.insert(0, os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))

VOICES = {
    "fr": "fr-FR-HenriNeural", "fr-f": "fr-FR-DeniseNeural",
    "en": "en-US-AndrewNeural", "en-f": "en-US-AriaNeural",
    "es": "es-ES-AlvaroNeural", "de": "de-DE-ConradNeural",
    "it": "it-IT-DiegoNeural", "pt": "pt-BR-AntonioNeural",
}

def which(name):
    p = shutil.which(name) or ("/opt/homebrew/bin/" + name if os.path.exists("/opt/homebrew/bin/" + name) else None)
    if not p:
        sys.exit(f"ERROR: {name} introuvable. Installez-le (brew install ffmpeg).")
    return p

FFMPEG = which("ffmpeg"); FFPROBE = which("ffprobe")

def slugify(s):
    s = unicodedata.normalize("NFKD", s or "video").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "video"

def log(stage, msg):
    print(f"[{stage}] {msg}", flush=True)

def probe_duration(path):
    r = subprocess.run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())

# ── 1. voiceover ─────────────────────────────────────────────────────
def gen_vo(project, work, rate_bump=0):
    import edge_tts
    audio = project.get("audio", {})
    lang = project.get("meta", {}).get("lang", "fr")
    voice = audio.get("voice") or VOICES.get(lang, VOICES["fr"])
    base_rate = int(re.sub(r"[^\-\d]", "", audio.get("rate", "+6%")) or 6)
    rate = f"{base_rate + rate_bump:+d}%"
    vodir = os.path.join(work, "vo"); os.makedirs(vodir, exist_ok=True)

    async def run():
        for s in project["scenes"]:
            vo = (s.get("vo") or "").strip()
            if not vo:
                continue
            await edge_tts.Communicate(vo, voice, rate=rate).save(os.path.join(vodir, f"{s['id']}.mp3"))
    asyncio.run(run())
    durs = {}
    for s in project["scenes"]:
        p = os.path.join(vodir, f"{s['id']}.mp3")
        durs[s["id"]] = probe_duration(p) if os.path.exists(p) else 0.0
    log("vo", f"voix={voice} rate={rate} total={sum(durs.values()):.1f}s")
    return durs

# ── 2. timing ────────────────────────────────────────────────────────
def compute_timing(project, durs):
    pac = project.get("pacing", {})
    lead, gap, tail = pac.get("lead", 0.8), pac.get("gap", 0.55), pac.get("tail", 4.8)
    t = lead; scenes = []
    for s in project["scenes"]:
        d = max(durs.get(s["id"], 0.0), float(s.get("minDuration", 3.0)))
        scenes.append({"id": s["id"], "voStart": round(t, 3), "voEnd": round(t + d, 3)})
        t += d + gap
    return {"scenes": scenes, "total": round(t - gap + tail, 3), "fps": pac.get("fps", 24)}

# ── 3. frames ────────────────────────────────────────────────────────
def ensure_playwright():
    if not os.path.isdir(os.path.join(HERE, "node_modules", "playwright")):
        log("setup", "npm install playwright…")
        subprocess.run(["npm", "init", "-y"], cwd=HERE, capture_output=True)
        subprocess.run(["npm", "install", "playwright", "--no-audit", "--no-fund"], cwd=HERE, check=True)
        install = ["npx", "playwright", "install", "chromium-headless-shell"]
        if os.environ.get("CI"):  # runner Linux : dependances systeme incluses
            install.insert(3, "--with-deps")
        subprocess.run(install, cwd=HERE, check=True)

def render_frames(project, timing, work, preview=False):
    ensure_playwright()
    with open(os.path.join(ENGINE, "project.js"), "w") as f:
        f.write("window.PROJECT = " + json.dumps(project) + ";\n")
    with open(os.path.join(ENGINE, "timing.js"), "w") as f:
        f.write("window.TIMING = " + json.dumps(timing) + ";\n")
    with open(os.path.join(work, "timing.json"), "w") as f:
        json.dump(timing, f)
    with open(os.path.join(work, "project.json"), "w") as f:
        json.dump(project, f)
    cmd = ["node", os.path.join(HERE, "render.js"), work] + (["preview"] if preview else [])
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
    for line in proc.stdout:
        line = line.strip()
        if line.startswith("FRAME") or line in ("done", "preview ok"):
            log("frames", line)
        elif line.startswith("PAGEERROR"):
            log("frames", line)
    proc.wait()
    if proc.returncode:
        sys.exit("ERROR: rendu des frames échoué")

# ── 4-6. music, mix, encode ─────────────────────────────────────────
def make_music(work):
    subprocess.run([sys.executable, os.path.join(HERE, "make_music.py"), work], check=True)

def mix(project, timing, work):
    audio = project.get("audio", {})
    vog = float(audio.get("voGain", 7.0))
    mug = float(audio.get("musicLevel", -8.5))
    ins, fl = [], []
    idx = 0
    for s in timing["scenes"]:
        mp3 = os.path.join(work, "vo", f"{s['id']}.mp3")
        if not os.path.exists(mp3):
            continue
        ins += ["-i", mp3]
        d = int(s["voStart"] * 1000)
        fl.append(f"[{idx}]aresample=48000,aformat=channel_layouts=stereo,adelay={d}|{d}[a{idx}]")
        idx += 1
    fl.append("".join(f"[a{i}]" for i in range(idx)) +
              f"amix=inputs={idx}:normalize=0,apad=whole_dur={timing['total']}[vo]")
    subprocess.run([FFMPEG, "-y"] + ins + ["-filter_complex", ";".join(fl),
                    "-map", "[vo]", os.path.join(work, "vo_track.wav")],
                   check=True, capture_output=True)
    subprocess.run([FFMPEG, "-y", "-i", os.path.join(work, "vo_track.wav"),
                    "-i", os.path.join(work, "music.wav"), "-filter_complex",
                    f"[0]volume={vog}dB[vo];[0]volume={vog}dB[vok];"
                    f"[1]aresample=48000,volume={mug}dB[m];"
                    "[m][vok]sidechaincompress=threshold=0.02:ratio=6:attack=120:release=850:makeup=1[md];"
                    "[vo][md]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=disabled[out]",
                    "-map", "[out]", os.path.join(work, "mix.wav")],
                   check=True, capture_output=True)
    log("mix", "vo + musique mixés (sidechain)")

def encode(project, work, outpath):
    subprocess.run([FFMPEG, "-y",
                    "-framerate", "24", "-i", os.path.join(work, "frames", "f%05d.png"),
                    "-i", os.path.join(work, "mix.wav"),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
                    outpath], check=True, capture_output=True)
    log("encode", f"{outpath} ({probe_duration(outpath):.1f}s, {os.path.getsize(outpath)//1048576} Mo)")

# ── orchestrate ──────────────────────────────────────────────────────
def build(project, preview_only=False, progress=None):
    def report(stage, pct):
        if progress: progress(stage, pct)
    slug = slugify(project.get("meta", {}).get("slug") or project.get("meta", {}).get("title"))
    work = os.path.join(OUT, slug + "-work")
    os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)

    target = float(project.get("target", {}).get("duration", 120))
    report("voix off", 5)
    durs = gen_vo(project, work)
    timing = compute_timing(project, durs)
    # auto-fit: if too long, speed the voice up once (max +4%)
    overshoot = timing["total"] - target
    if overshoot > 1.5:
        bump = min(4, int(overshoot / timing["total"] * 100) + 1)
        log("timing", f"{timing['total']:.1f}s > cible {target:.0f}s → débit +{bump}%")
        durs = gen_vo(project, work, rate_bump=bump)
        timing = compute_timing(project, durs)
    log("timing", f"durée finale {timing['total']:.1f}s (cible {target:.0f}s)")

    if preview_only:
        report("aperçu", 50)
        render_frames(project, timing, work, preview=True)
        report("terminé", 100)
        return os.path.join(work, "preview")

    report("frames", 15)
    render_frames(project, timing, work)
    report("musique", 70)
    make_music(work)
    report("mixage", 82)
    mix(project, timing, work)
    report("encodage", 88)
    outpath = os.path.join(OUT, slug + ".mp4")
    encode(project, work, outpath)
    shutil.rmtree(os.path.join(work, "frames"), ignore_errors=True)
    report("terminé", 100)
    return outpath

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--preview-only", action="store_true")
    args = ap.parse_args()
    with open(args.project) as f:
        proj = json.load(f)
    out = build(proj, preview_only=args.preview_only)
    print("OK:", out)
