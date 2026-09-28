// Video Debrief production in the browser: voice (local Piper model, or none
// with subtitles), timing, music, mix, 1080p frames from the scene engine,
// WebCodecs encoding and MP4 muxing. Same steps as pipeline/build.py, no server.
(function () {
  'use strict';
  const VDB = (window.VDB = window.VDB || {});
  const SR = 48000;
  const CPS = { fr: 15.0, en: 14.2, es: 14.5, de: 13.5, it: 14.5, pt: 14.5 };

  async function resample(samples, fromRate) {
    if (fromRate === SR) return samples;
    const length = Math.ceil(samples.length * SR / fromRate);
    const ctx = new OfflineAudioContext(1, length, SR);
    const buffer = ctx.createBuffer(1, samples.length, fromRate);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return (await ctx.startRendering()).getChannelData(0);
  }

  function parseRate(value) {
    const n = parseInt(String(value || '+6%').replace(/[^\-\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 6;
  }

  /** Same pacing as pipeline/build.py: lead, scene voice-overs separated by gaps, tail. */
  VDB.computeTiming = function (project, durations) {
    const pacing = project.pacing || {};
    const lead = pacing.lead ?? 0.8, gap = pacing.gap ?? 0.55, tail = pacing.tail ?? 4.8;
    let t = lead;
    const scenes = (project.scenes || []).map(s => {
      const d = Math.max(durations[s.id] || 0, Number(s.minDuration) || 3.0);
      const scene = { id: s.id, voStart: +t.toFixed(3), voEnd: +(t + d).toFixed(3) };
      t += d + gap;
      return scene;
    });
    return { scenes, total: +(t - gap + tail).toFixed(3), fps: pacing.fps || 24 };
  };

  async function recordVoice(project, voiceId, rateBump, report, isCancelled) {
    const rate = parseRate(project.audio && project.audio.rate) + rateBump;
    const scenes = (project.scenes || []).filter(s => String(s.vo || '').trim());
    const takes = {}, durations = {};
    for (let i = 0; i < scenes.length; i++) {
      if (isCancelled()) throw new Error('Production cancelled.');
      const s = scenes[i];
      report(i / scenes.length, `Recording the voice: scene ${i + 1} / ${scenes.length}…`);
      const take = await VDB.speakLocal(voiceId, s.vo, rate);
      takes[s.id] = await resample(take.samples, take.sampleRate);
      durations[s.id] = takes[s.id].length / SR;
    }
    report(1, 'Voice recorded.');
    return { takes, durations, rate };
  }

  function estimateDurations(project) {
    const cps = CPS[(project.meta && project.meta.lang) || 'fr'] || 14.5;
    const durations = {};
    (project.scenes || []).forEach(s => { durations[s.id] = s.vo ? Math.max(3, String(s.vo).length / cps) : 0; });
    return durations;
  }

  /** Voice over the music, the music ducked under the voice (sidechain), peaks limited. */
  VDB.mixSoundtrack = function (project, timing, takes, music) {
    const n = music.channels[0].length;
    const vo = new Float32Array(n);
    timing.scenes.forEach(s => {
      const take = takes[s.id];
      if (!take) return;
      const at = Math.floor(s.voStart * SR);
      for (let i = 0; i < take.length && at + i < n; i++) vo[at + i] += take[i];
    });
    let voPeak = 1e-9;
    for (let i = 0; i < n; i++) voPeak = Math.max(voPeak, Math.abs(vo[i]));
    const voGain = voPeak > 1e-6 ? 0.85 / voPeak : 0;
    const audio = project.audio || {};
    const musicGain = Math.pow(10, Number(audio.musicLevel ?? -8.5) / 20);
    const attack = Math.exp(-1 / (0.12 * SR)), release = Math.exp(-1 / (0.85 * SR));
    const threshold = 0.02, ratio = 6;
    const left = new Float32Array(n), right = new Float32Array(n);
    let env = 0, peak = 1e-9;
    for (let i = 0; i < n; i++) {
      const v = vo[i] * voGain;
      const level = Math.abs(v);
      env = level > env ? attack * env + (1 - attack) * level : release * env + (1 - release) * level;
      const duck = env > threshold ? (threshold + (env - threshold) / ratio) / env : 1;
      const m = musicGain * duck;
      left[i] = v + music.channels[0][i] * m;
      right[i] = v + music.channels[1][i] * m;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    if (peak > 0.89) {
      const k = 0.89 / peak;
      for (let i = 0; i < n; i++) { left[i] *= k; right[i] *= k; }
    }
    return { sampleRate: SR, channels: [left, right] };
  };

  /** A hidden 1920×1080 copy of the scene engine, used to draw the frames. */
  function openRenderer(engineUrl) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1920px;height:1080px;border:0;opacity:0;pointer-events:none;';
      frame.src = engineUrl;
      let settled = false;
      const timer = setTimeout(() => { settled = true; frame.remove(); reject(new Error('The render engine did not start.')); }, 30000);
      frame.onload = () => {
        const check = () => {
          if (settled) return;
          const win = frame.contentWindow;
          if (win && typeof win.captureFrame === 'function' && typeof win.loadForCapture === 'function') { settled = true; clearTimeout(timer); resolve(frame); }
          else setTimeout(check, 50);
        };
        check();
      };
      document.body.appendChild(frame);
    });
  }

  /**
   * opts: { project, voiceId (null: no voice), subtitles, engineUrl,
   *         onProgress(ratio, label), isCancelled() }
   * Returns { blob, extension, duration, videoCodec, audioCodec, voiced }.
   */
  VDB.produceInBrowser = async function (opts) {
    const project = JSON.parse(JSON.stringify(opts.project));
    const isCancelled = opts.isCancelled || (() => false);
    const progress = opts.onProgress || (() => {});
    const support = await VDB.exportSupport(1920, 1080, 24);
    if (!support.ok) throw new Error(support.reason);
    const target = Number(project.target && project.target.duration) || 120;
    // Weights of each stage in the overall progress.
    const W = opts.voiceId ? { voice: 0.3, music: 0.05, frames: 0.6, end: 0.05 } : { voice: 0, music: 0.05, frames: 0.88, end: 0.07 };
    let takes = {}, timing;
    let subtitles = !!opts.subtitles, voiced = !!opts.voiceId, notice = '';
    if (opts.voiceId) {
      try {
        await VDB.loadLocalVoice(opts.voiceId, (stage, r, label) => progress(0, label));
      } catch (error) {
        // Engine unreachable (offline, CDN down): the video is still produced, with subtitles.
        voiced = false; subtitles = true;
        notice = `Local voice unavailable (${error.message || error}): produced with subtitles.`;
        progress(0, notice);
      }
    }
    if (voiced) {
      let voice = await recordVoice(project, opts.voiceId, 0, (r, label) => progress(W.voice * r * 0.85, label), isCancelled);
      timing = VDB.computeTiming(project, voice.durations);
      // Too long: speak slightly faster once (at most +4%), as the Python pipeline does.
      const overshoot = timing.total - target;
      if (overshoot > 1.5) {
        const bump = Math.min(4, Math.floor(overshoot / timing.total * 100) + 1);
        voice = await recordVoice(project, opts.voiceId, bump, (r, label) => progress(W.voice * (0.85 + 0.15 * r), `${label} (+${bump}% to fit ${target} s)`), isCancelled);
        timing = VDB.computeTiming(project, voice.durations);
      }
      takes = voice.takes;
    } else {
      timing = VDB.computeTiming(project, estimateDurations(project));
    }
    if (isCancelled()) throw new Error('Production cancelled.');
    progress(W.voice, 'Composing the music…');
    await new Promise(r => setTimeout(r, 30));
    let music = VDB.makeMusic(project, timing, SR);
    const mix = VDB.mixSoundtrack(project, timing, takes, music);
    // Only the mix is needed from here: let the music and the voice takes be freed.
    music = null; takes = {};
    progress(W.voice + W.music, 'Preparing the images…');
    const frame = await openRenderer(opts.engineUrl || 'engine/scene.html?preview=1&capture=1');
    try {
      const win = frame.contentWindow;
      await win.loadForCapture(project, timing);
      const started = performance.now();
      const result = await VDB.encodeVideo({
        duration: timing.total, fps: 24, width: 1920, height: 1080, mix,
        drawFrame: t => win.captureFrame(t, { subtitles }),
        isCancelled,
        onProgress: (stage, r) => {
          if (stage === 'frames') {
            const elapsed = (performance.now() - started) / 1000;
            const left = r > 0.02 ? Math.round(elapsed / r - elapsed) : null;
            progress(W.voice + W.music + W.frames * r, `Rendering the images: ${Math.round(r * 100)}%${left !== null ? ` (about ${left < 90 ? `${left} s` : `${Math.round(left / 60)} min`} left)` : ''}`);
          } else if (stage === 'audio') progress(W.voice + W.music + W.frames + W.end * 0.6 * r, 'Encoding the sound…');
          else progress(W.voice + W.music + W.frames + W.end * (0.6 + 0.4 * r), 'Assembling the file…');
        },
      });
      progress(1, 'Video ready.');
      return Object.assign(result, { duration: timing.total, voiced, notice, timing });
    } finally {
      frame.remove();
    }
  };

  /** Plays a short sample of the local voice (first voice-over sentence). */
  VDB.previewLocalVoice = async function (voiceId, text, rate) {
    const take = await VDB.speakLocal(voiceId, text, rate);
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, take.samples.length, take.sampleRate);
    buffer.copyToChannel(take.samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return new Promise(resolve => { source.onended = () => { ctx.close(); resolve(); }; });
  };
})();
