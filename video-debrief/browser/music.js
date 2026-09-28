// Parametric underscore for the Video Debrief, synthesized in the browser.
// Each scene carries a `mood` (or one is
// derived from its type) and the score is assembled from mood recipes in
// D minor. Pure synthesis, no samples, deterministic.
(function () {
  'use strict';
  const VDB = (window.VDB = window.VDB || {});

  const N = {
    D1: 36.71, D2: 73.42, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81, Cs3: 138.59,
    D3: 146.83, E3: 164.81, F3: 174.61, A3: 220.0, Bb3: 233.08, C4: 261.63,
    D4: 293.66, E4: 329.63, F4: 349.23,
  };

  VDB.DEFAULT_MOOD = {
    'cold-open': 'dark', chain: 'tension', 'map-focus': 'impact',
    'map-spread': 'grim', image: 'tension', 'map-trace': 'hope',
    'stat-grid': 'cold', lessons: 'resolve', endcard: 'none',
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /** Seeded standard normal noise (Box-Muller). */
  function gaussian(seed, m) {
    const r = mulberry32(seed);
    const out = new Float32Array(m);
    for (let i = 0; i < m; i += 2) {
      const u = Math.max(r(), 1e-12), v = r();
      const mag = Math.sqrt(-2 * Math.log(u));
      out[i] = mag * Math.cos(2 * Math.PI * v);
      if (i + 1 < m) out[i + 1] = mag * Math.sin(2 * Math.PI * v);
    }
    return out;
  }

  /**
   * project: the video project; timing: { scenes: [{ id, voStart, voEnd }], total }.
   * Returns { sampleRate, channels: [left, right] } as Float32Arrays.
   */
  VDB.makeMusic = function (project, timing, sampleRate = 48000) {
    const SR = sampleRate;
    const total = timing.total;
    const n = Math.max(1, Math.floor(total * SR));
    const dry = new Float32Array(n), wet = new Float32Array(n);

    const envAr = (m, attack, release) => {
      const e = new Float32Array(m).fill(1);
      const na = Math.min(Math.floor(attack * SR), m), nr = Math.min(Math.floor(release * SR), m);
      for (let i = 0; i < na; i++) { const p = na > 1 ? i / (na - 1) : 1; e[i] *= p * p; }
      for (let i = 0; i < nr; i++) { const p = nr > 1 ? 1 - i / (nr - 1) : 0; e[m - nr + i] *= Math.pow(p, 1.5); }
      return e;
    };
    const lowpass = (x, cutoff) => {
      const g = Math.exp(-2 * Math.PI * cutoff / SR);
      const y = new Float32Array(x.length);
      let prev = 0;
      for (let i = 0; i < x.length; i++) { prev = (1 - g) * x[i] + g * prev; y[i] = prev; }
      return y;
    };
    // Band-limited saw by additive synthesis; harmonics by the Chebyshev recurrence.
    const sawInto = (out, freq, m, nh = 14) => {
      let harmonics = 0;
      while (harmonics < nh && freq * (harmonics + 1) < 16000) harmonics++;
      const w = 2 * Math.PI * freq / SR;
      for (let i = 0; i < m; i++) {
        const theta = w * i;
        const s1 = Math.sin(theta), c2 = 2 * Math.cos(theta);
        let prev = 0, cur = s1, sum = 0;
        for (let k = 1; k <= harmonics; k++) {
          sum += cur / k;
          const next = c2 * cur - prev;
          prev = cur; cur = next;
        }
        out[i] += sum * (2 / Math.PI);
      }
    };
    const add = (buf, t0, x, gain = 1) => {
      const a = Math.floor(t0 * SR);
      for (let i = Math.max(0, -a); i < x.length; i++) {
        const j = a + i;
        if (j >= n) break;
        buf[j] += x[i] * gain;
      }
    };
    const pad = (freqs, t0, t1, gain, attack = 2.5, release = 2.5, cutoff = 900, wetg = 0.9) => {
      const m = Math.floor((t1 - t0) * SR);
      if (m <= 0) return;
      const x = new Float32Array(m);
      for (const f of freqs) { sawInto(x, f * 1.0012, m); sawInto(x, f * 0.9988, m); }
      const y = lowpass(x, cutoff), e = envAr(m, attack, release);
      const k = gain / Math.max(freqs.length, 1);
      for (let i = 0; i < m; i++) y[i] *= e[i] * k;
      add(dry, t0, y, 0.55); add(wet, t0, y, wetg);
    };
    const drone = (freqs, t0, t1, gain, attack = 3.0, release = 3.0) => {
      const m = Math.floor((t1 - t0) * SR);
      if (m <= 0) return;
      const x = new Float32Array(m), e = envAr(m, attack, release);
      for (let i = 0; i < m; i++) {
        const tt = i / SR;
        let v = 0;
        for (const f of freqs) v += Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2 * tt + 0.5);
        x[i] = v * e[i] * (1 + 0.12 * Math.sin(2 * Math.PI * 0.07 * tt)) * gain / freqs.length;
      }
      add(dry, t0, x, 0.8); add(wet, t0, x, 0.25);
    };
    const boom = (t0, gain = 1.0, f0 = 95, f1 = 34, dur = 1.6) => {
      const m = Math.floor(dur * SR);
      const x = new Float32Array(m);
      let phase = 0;
      const noise = gaussian(Math.floor(t0 * 100) + 1, m);
      for (let i = 0; i < m; i++) {
        const tt = i / SR;
        phase += 2 * Math.PI * (f1 + (f0 - f1) * Math.exp(-tt * 7)) / SR;
        x[i] = Math.sin(phase) * Math.exp(-tt * 3.2);
        noise[i] *= Math.exp(-tt * 26);
      }
      const thump = lowpass(noise, 300);
      for (let i = 0; i < m; i++) x[i] += thump[i] * 1.6;
      add(dry, t0, x, gain * 0.9); add(wet, t0, x, gain * 0.7);
    };
    const pluck = (t0, freq, gain = 0.5, dur = 2.2, bright = 2200) => {
      const m = Math.floor(dur * SR);
      const x = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        const tt = i / SR;
        x[i] = (Math.sin(2 * Math.PI * freq * tt) + 0.42 * Math.sin(2 * Math.PI * freq * 2 * tt)
          + 0.18 * Math.sin(2 * Math.PI * freq * 3.01 * tt)) * Math.exp(-tt * 2.6);
      }
      const y = lowpass(x, bright);
      for (let i = 0; i < Math.min(80, m); i++) y[i] *= i / 79;
      add(dry, t0, y, gain * 0.7); add(wet, t0, y, gain * 0.9);
    };
    const subPulse = (t0, gain = 0.6, f = 36.7) => {
      const m = Math.floor(0.34 * SR);
      const x = new Float32Array(m);
      for (let i = 0; i < m; i++) { const tt = i / SR; x[i] = Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 11); }
      for (let i = 0; i < 40; i++) x[i] *= i / 39;
      add(dry, t0, x, gain);
    };
    const tick = (t0, gain = 0.12) => {
      const m = Math.floor(0.012 * SR);
      const x = gaussian(Math.floor(t0 * 1000) % 99991 + 1, m);
      for (let i = 0; i < m; i++) x[i] *= 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (m - 1));
      const low = lowpass(x, 2500);
      for (let i = 0; i < m; i++) x[i] -= low[i];
      add(dry, t0, x, gain);
    };
    const riser = (t0, t1, gain = 0.5) => {
      const m = Math.floor((t1 - t0) * SR);
      if (m <= 0) return;
      const x = gaussian(777, m);
      let prev = 0;
      for (let i = 0; i < m; i++) {
        const g = Math.exp(-2 * Math.PI * (150 + (3800 - 150) * i / m) / SR);
        prev = (1 - g) * x[i] + g * prev;
        x[i] = prev * Math.pow(i / m, 2.4) * gain;
      }
      add(dry, t0, x, 0.8); add(wet, t0, x, 0.5);
    };

    // ---- mood recipes per scene ----
    const scenes = {};
    (project.scenes || []).forEach(s => { scenes[s.id] = s; });
    const tw = timing.scenes || [];
    const plucks = [N.D3, N.F3, N.A2, N.G2, N.D4, N.E4, N.F4];
    tw.forEach((s, i) => {
      const spec = scenes[s.id] || {};
      const mood = spec.mood || VDB.DEFAULT_MOOD[spec.type] || 'dark';
      const a = s.voStart, b = s.voEnd;
      const nxt = i + 1 < tw.length ? tw[i + 1].voStart : Math.min(b + 2.0, total);
      const dur = b - a;
      if (mood === 'dark') {
        drone([N.D1, N.D2], Math.max(0, a - 0.8), nxt + 1.5, 0.55, 2.5);
        boom(Math.max(0, a - 0.3), 0.7);
        boom(a + dur * 0.7, 0.85);
        pluck(a + dur * 0.18, N.D3, 0.30, 2.2, 1200);
      } else if (mood === 'tension') {
        drone([N.D2, N.A2], a - 0.3, nxt + 1.5, 0.5);
        pad([N.D3, N.F3, N.A3], a + 0.5, nxt - 0.2, 0.30, 3.5, 2.5, 750);
        for (let k = a + 0.8; k < nxt; k += 0.75) tick(k, 0.10);
      } else if (mood === 'impact') {
        const det = a + dur * 0.10;
        riser(a - 1.8, det, 0.55);
        boom(det, 1.0);
        drone([N.D1, N.D2], det, nxt + 0.5, 0.6);
        let beat = 0;
        for (let k = det + 0.9; k < nxt - 0.3; k += 0.62, beat++) {
          subPulse(k, 0.45 + 0.35 * Math.min(1, (k - det) / 20));
          if (beat % 2) tick(k - 0.3, 0.14);
        }
        pad([N.D2, N.F3, N.A2], det + 0.7, a + dur * 0.66, 0.26, 1.5, 2.5, 700);
        pad([N.Bb2, N.D3, N.F3], a + dur * 0.66, nxt + 0.4, 0.30, 2.0, 2.5, 900);
      } else if (mood === 'grim') {
        drone([N.D1, N.D2], a - 0.3, nxt + 0.5, 0.6);
        boom(a + dur * 0.2, 0.8);
        let beat = 0;
        for (let k = a + 0.4; k < nxt - 0.3; k += 0.62, beat++) {
          subPulse(k, 0.55 + 0.25 * Math.min(1, (k - a) / 15));
          if (beat % 2) tick(k - 0.3, 0.14);
        }
        pad([N.G2, N.Bb2, N.D3], a + 1.0, a + dur * 0.55, 0.32, 2.0, 2.5, 1100);
        pad([N.A2, N.Cs3, N.E3], a + dur * 0.55, nxt + 0.4, 0.36, 2.0, 2.5, 1400);
      } else if (mood === 'hope') {
        pad([N.Bb2, N.F3, N.D4], a + 0.3, nxt - 0.3, 0.34, 3.0, 2.5, 1500, 1.1);
        drone([N.D1], a + 0.3, nxt, 0.3);
        pluck(a + dur * 0.15, N.D4, 0.4);
        pluck(a + dur * 0.35, N.F4, 0.3);
        pluck(a + dur * 0.62, N.Bb3, 0.35);
      } else if (mood === 'cold') {
        drone([N.D1, N.D2], a - 0.3, nxt + 1.0, 0.5);
        for (let j = 0; j < 5; j++) pluck(a + dur * (0.08 + 0.2 * j), plucks[j % plucks.length], 0.38, 2.8, 1500);
        for (let k = a + 0.5; k < nxt; k += 1.5) tick(k, 0.07);
      } else if (mood === 'resolve') {
        pad([N.D3, N.F3, N.A3, N.E4], a + 0.5, a + dur * 0.78, 0.32, 4.0, 2.5, 1300, 1.2);
        [N.D4, N.E4, N.F4].forEach((note, j) => pluck(a + dur * (0.12 + 0.2 * j), note, 0.32));
        const swell = a + dur * 0.74;
        pad([N.D2, N.D3, N.A3, N.D4, N.F4], swell, total - 1.2, 0.42, 2.2, 3.5, 1800, 1.3);
        boom(swell + 0.3, 0.55, 70, 36, 2.5);
        drone([N.D1], swell, total - 0.8, 0.4, 1.5, 3.0);
      }
    });

    // ---- reverb (Schroeder: 4 combs, 2 allpasses), delays scaled from 44.1 kHz ----
    const scale = SR / 44100;
    const comb = (x, delay, fb) => {
      const y = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) y[i] = x[i] + (i >= delay ? fb * y[i - delay] : 0);
      return y;
    };
    const allpass = (x, delay, g = 0.5) => {
      const y = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        const xd = i >= delay ? x[i - delay] : 0, yd = i >= delay ? y[i - delay] : 0;
        y[i] = -g * x[i] + xd + g * yd;
      }
      return y;
    };
    let rev = new Float32Array(n);
    for (const [d, fb] of [[1557, 0.78], [1617, 0.76], [1491, 0.79], [1422, 0.77]]) {
      const c = comb(wet, Math.round(d * scale), fb);
      for (let i = 0; i < n; i++) rev[i] += c[i] / 4;
    }
    rev = lowpass(allpass(allpass(rev, Math.round(225 * scale)), Math.round(556 * scale)), 3200);

    const mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = dry[i] + rev[i] * 0.55;
    const fi = Math.min(n, Math.floor(0.4 * SR));
    for (let i = 0; i < fi; i++) mono[i] *= i / fi;
    const fo = Math.min(n, Math.floor(2.2 * SR));
    for (let i = 0; i < fo; i++) mono[n - fo + i] *= Math.pow(1 - i / (fo - 1 || 1), 1.4);
    let peak = 1e-9;
    for (let i = 0; i < n; i++) { mono[i] = Math.tanh(mono[i] * 1.1); peak = Math.max(peak, Math.abs(mono[i])); }
    const norm = 0.82 / peak;
    const haas = Math.floor(0.011 * SR);
    const left = new Float32Array(n), right = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const m = mono[i] * norm;
      const side = Math.tanh(rev[i] - (i >= haas ? rev[i - haas] : 0)) * 0.18;
      left[i] = Math.max(-1, Math.min(1, m + side));
      right[i] = Math.max(-1, Math.min(1, m - side));
    }
    return { sampleRate: SR, channels: [left, right] };
  };
})();
