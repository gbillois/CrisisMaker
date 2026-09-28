// Local neural voice for the Video Debrief: Piper (VITS) running in the
// browser with ONNX Runtime Web. Nothing is loaded until the user asks for it;
// the voice model and the phonemizer data are then kept in the browser cache
// (Cache Storage) so later sessions work offline. No key, no server.
(function () {
  'use strict';
  const VDB = (window.VDB = window.VDB || {});

  const ORT_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
  const PHONEMIZE_BASE = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
  const VOICES_BASE = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';
  const CACHE = 'crisismaker-piper-v1';

  /** Voices per video language: [id, label, approximate download in MB]. */
  VDB.LOCAL_VOICES = {
    fr: [['fr_FR-siwis-medium', 'Siwis (f)', 63], ['fr_FR-tom-medium', 'Tom (h)', 63], ['fr_FR-siwis-low', 'Siwis légère (f)', 28]],
    en: [['en_US-ryan-medium', 'Ryan (US · m)', 63], ['en_US-hfc_female-medium', 'HFC (US · f)', 63], ['en_GB-alan-medium', 'Alan (GB · m)', 63]],
    es: [['es_ES-davefx-medium', 'Davefx (h)', 63]],
    de: [['de_DE-thorsten-medium', 'Thorsten (m)', 63], ['de_DE-kerstin-low', 'Kerstin (w)', 28]],
    it: [['it_IT-riccardo-x_low', 'Riccardo (u)', 21]],
    pt: [['pt_BR-faber-medium', 'Faber (BR · h)', 63]],
  };
  VDB.defaultLocalVoice = lang => ((VDB.LOCAL_VOICES[lang] || VDB.LOCAL_VOICES.en)[0][0]);
  VDB.localVoiceInfo = id => {
    for (const list of Object.values(VDB.LOCAL_VOICES)) for (const v of list) if (v[0] === id) return { id: v[0], label: v[1], mb: v[2] };
    return null;
  };

  function voicePath(id) {
    // fr_FR-siwis-medium -> fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx
    const m = /^(([a-z]{2})_[A-Z]{2})-(.+)-(x_low|low|medium|high)$/.exec(id);
    if (!m) throw new Error('Unknown voice ' + id);
    return `${VOICES_BASE}/${m[2]}/${m[1]}/${m[3]}/${m[4]}/${id}.onnx`;
  }

  // ─── Cache Storage (falls back to plain fetch where it is unavailable) ───
  async function openCache() {
    try { return typeof caches !== 'undefined' ? await caches.open(CACHE) : null; } catch { return null; }
  }
  async function cached(url) {
    const cache = await openCache();
    if (!cache) return null;
    try { return (await cache.match(url)) || null; } catch { return null; }
  }
  /** Downloads url (progress: loaded, total), stores it, returns an ArrayBuffer. */
  async function fetchStored(url, onBytes) {
    const hit = await cached(url);
    if (hit) { const buf = await hit.arrayBuffer(); onBytes && onBytes(buf.byteLength, buf.byteLength); return buf; }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url.split('/').pop()}`);
    const total = +(response.headers.get('Content-Length') || 0);
    const reader = response.body && response.body.getReader();
    const parts = [];
    let loaded = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); loaded += value.length;
        onBytes && onBytes(loaded, total);
      }
    } else {
      parts.push(new Uint8Array(await response.arrayBuffer()));
    }
    const blob = new Blob(parts);
    const cache = await openCache();
    if (cache) {
      try { await cache.put(url, new Response(blob, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' } })); } catch { /* quota: keep in memory only */ }
    }
    return await blob.arrayBuffer();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-vdb-src="${src}"]`);
      if (existing) { existing._loaded ? resolve() : existing.addEventListener('load', () => resolve()); return; }
      const script = document.createElement('script');
      script.src = src; script.async = true; script.crossOrigin = 'anonymous';
      script.dataset.vdbSrc = src;
      script.onload = () => { script._loaded = true; resolve(); };
      script.onerror = () => { script.remove(); reject(new Error('Could not load ' + src.split('/').pop() + ' (check the network).')); };
      document.head.appendChild(script);
    });
  }

  const state = { engine: null, enginePromise: null, voices: new Map(), loadingVoices: new Map() };

  /** Is the voice already downloaded in this browser (no network)? */
  VDB.isLocalVoiceStored = async function (id) {
    try { return !!(await cached(voicePath(id))) && !!(await cached(`${PHONEMIZE_BASE}.data`)); } catch { return false; }
  };
  VDB.isLocalVoiceReady = id => state.voices.has(id);

  function loadEngine(progress) {
    if (state.engine) return Promise.resolve(state.engine);
    if (!state.enginePromise) state.enginePromise = startEngine(progress).catch((error) => { state.enginePromise = null; throw error; });
    return state.enginePromise;
  }
  async function startEngine(progress) {
    progress('engine', 0, 'Loading the speech engine…');
    await loadScript(`${ORT_BASE}ort.min.js`);
    await loadScript(`${PHONEMIZE_BASE}.js`);
    const ort = window.ort;
    if (!ort || typeof window.createPiperPhonemize !== 'function') throw new Error('The speech engine did not load.');
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    // Inference in a worker keeps the page responsive while the voice speaks.
    ort.env.wasm.proxy = true;
    const [wasmBinary, data] = await Promise.all([
      fetchStored(`${PHONEMIZE_BASE}.wasm`),
      fetchStored(`${PHONEMIZE_BASE}.data`, (l, t) => progress('engine', t ? l / t : 0, 'Downloading the phonemizer…')),
    ]);
    state.engine = { ort, wasmBinary, data };
    return state.engine;
  }

  /**
   * Loads the engine and one voice (downloads on first use), reporting
   * progress(stage, ratio, label). Returns { id, sampleRate }.
   */
  VDB.loadLocalVoice = function (id, progress = () => {}) {
    if (state.voices.has(id)) return Promise.resolve(state.voices.get(id));
    // Two clicks (Activate, then Produce) share one download instead of starting a second one.
    state.loadingVoices = state.loadingVoices || new Map();
    if (!state.loadingVoices.has(id)) {
      state.loadingVoices.set(id, loadVoice(id, progress).finally(() => state.loadingVoices.delete(id)));
    }
    return state.loadingVoices.get(id);
  };
  async function loadVoice(id, progress) {
    const engine = await loadEngine(progress);
    const path = voicePath(id);
    const [model, config] = await Promise.all([
      fetchStored(path, (l, t) => progress('voice', t ? l / t : 0, `Downloading the voice (${Math.round(l / 1048576)} / ${Math.round((t || l) / 1048576)} MB)…`)),
      fetchStored(`${path}.json`),
    ]);
    progress('voice', 1, 'Preparing the voice…');
    let session;
    try {
      session = await engine.ort.InferenceSession.create(model);
    } catch (error) {
      // Some browsers refuse the proxy worker: run in the page instead.
      engine.ort.env.wasm.proxy = false;
      session = await engine.ort.InferenceSession.create(model);
    }
    const cfg = JSON.parse(new TextDecoder().decode(config));
    const voice = { id, session, config: cfg, sampleRate: cfg.audio.sample_rate };
    state.voices.set(id, voice);
    return voice;
  }

  function phonemize(engine, text, espeakVoice) {
    return new Promise((resolve, reject) => {
      let settled = false;
      window.createPiperPhonemize({
        print: line => {
          if (settled) return;
          try { settled = true; resolve(JSON.parse(line).phonemes || []); } catch (error) { reject(error); }
        },
        printErr: message => { if (!settled && /error/i.test(message)) { settled = true; reject(new Error(message)); } },
        wasmBinary: engine.wasmBinary,
        getPreloadedPackage: () => engine.data,
        locateFile: file => (file.endsWith('.wasm') ? `${PHONEMIZE_BASE}.wasm` : file.endsWith('.data') ? `${PHONEMIZE_BASE}.data` : file),
      }).then(module => {
        module.callMain(['-l', espeakVoice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
        setTimeout(() => { if (!settled) { settled = true; resolve([]); } }, 50);
      }, reject);
    });
  }

  /** Piper's own mapping: BOS, then each phoneme followed by the pad, then EOS; the voice's table decides. */
  function phonemeIds(config, phonemes) {
    const map = config.phoneme_id_map || {};
    const substitute = config.phoneme_map || {};
    const pad = (map._ || [0])[0];
    const ids = [...(map['^'] || [1]), pad];
    for (const raw of phonemes) {
      for (const p of (substitute[raw] || [raw])) {
        if (!map[p]) continue; // symbols this voice does not know are skipped, as Piper does
        ids.push(...map[p], pad);
      }
    }
    ids.push(...(map.$ || [2]));
    return ids;
  }

  /* Every sentence in one run of the phonemizer (one output line per input); falls back to
     one run per sentence if the output does not line up. */
  function phonemizeAll(engine, list, espeakVoice) {
    if (!list.length) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const lines = [];
      window.createPiperPhonemize({
        print: line => { try { lines.push(JSON.parse(line).phonemes || []); } catch (_) { /* not a result line */ } },
        printErr: () => {},
        wasmBinary: engine.wasmBinary,
        getPreloadedPackage: () => engine.data,
        locateFile: file => (file.endsWith('.wasm') ? `${PHONEMIZE_BASE}.wasm` : file.endsWith('.data') ? `${PHONEMIZE_BASE}.data` : file),
      }).then(module => {
        module.callMain(['-l', espeakVoice, '--input', JSON.stringify(list.map(text => ({ text }))), '--espeak_data', '/espeak-ng-data']);
        if (lines.length === list.length) { resolve(lines); return; }
        Promise.all(list.map(sentence => phonemize(engine, sentence, espeakVoice))).then(resolve, reject);
      }, reject);
    });
  }

  /** Sentences of at most ~220 characters, so each inference stays short. */
  function sentences(text) {
    const parts = String(text || '').replace(/\s+/g, ' ').trim().match(/[^.!?…;:]+[.!?…;:]*["»”)]*\s*/g) || [];
    const out = [];
    for (const part of parts) {
      let rest = part.trim();
      while (rest.length > 220) {
        const cut = rest.lastIndexOf(',', 220) > 60 ? rest.lastIndexOf(',', 220) + 1 : rest.lastIndexOf(' ', 220);
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) out.push(rest);
    }
    return out;
  }
  VDB.splitSentences = sentences;

  /**
   * Speaks text with a loaded voice. rate: speed change in percent (+6 = 6% faster).
   * Returns { samples: Float32Array, sampleRate }.
   */
  VDB.speakLocal = async function (id, text, rate = 0) {
    const voice = state.voices.get(id);
    if (!voice) throw new Error('The local voice is not loaded.');
    const engine = state.engine;
    const ort = engine.ort;
    const inf = voice.config.inference || {};
    const lengthScale = (inf.length_scale || 1) / (1 + rate / 100);
    const pause = new Float32Array(Math.round(voice.sampleRate * 0.28));
    const chunks = [];
    const list = sentences(text);
    // One phonemizer instance for the whole voice-over (it loads 18 MB of language data).
    const phonemesList = await phonemizeAll(engine, list, voice.config.espeak.voice);
    for (let index = 0; index < list.length; index++) {
      const ids = phonemeIds(voice.config, phonemesList[index] || []);
      if (ids.length <= 3) continue;
      const feeds = {
        input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
        input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, lengthScale, inf.noise_w ?? 0.8]), [3]),
      };
      if (voice.config.num_speakers > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
      const result = await voice.session.run(feeds);
      chunks.push(Float32Array.from(result.output.data));
      chunks.push(pause);
    }
    if (chunks.length) chunks.pop();
    const length = chunks.reduce((sum, c) => sum + c.length, 0);
    const samples = new Float32Array(length);
    let offset = 0;
    for (const c of chunks) { samples.set(c, offset); offset += c.length; }
    return { samples, sampleRate: voice.sampleRate };
  };
})();
