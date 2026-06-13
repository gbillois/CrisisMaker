#!/usr/bin/env python3
"""Generic parametric underscore for Video Debriefer.

Reads timing.json + project.json from a work dir; each scene carries a
`mood` (or one is derived from its type) and the score is assembled from
mood recipes in D minor. Fully synthesized (numpy/scipy), no samples.
"""
import json, os, sys, wave
import numpy as np
from scipy.signal import lfilter

SR = 44100

# note frequencies
N_ = dict(D1=36.71, D2=73.42, G2=98.0, A2=110.0, Bb2=116.54, C3=130.81, Cs3=138.59,
          D3=146.83, E3=164.81, F3=174.61, A3=220.0, Bb3=233.08, C4=261.63,
          D4=293.66, E4=329.63, F4=349.23)

DEFAULT_MOOD = {
    'cold-open': 'dark', 'chain': 'tension', 'map-focus': 'impact',
    'map-spread': 'grim', 'image': 'tension', 'map-trace': 'hope',
    'stat-grid': 'cold', 'lessons': 'resolve', 'endcard': 'none',
}

def main(workdir):
    T = json.load(open(os.path.join(workdir, "timing.json")))
    P = json.load(open(os.path.join(workdir, "project.json")))
    total = T["total"]
    n = int(total * SR)
    dry = np.zeros(n); wet = np.zeros(n)

    def env_ar(m, attack, release):
        e = np.ones(m)
        na, nr = min(int(attack*SR), m), min(int(release*SR), m)
        if na > 0: e[:na] *= np.linspace(0,1,na)**2
        if nr > 0: e[-nr:] *= np.linspace(1,0,nr)**1.5
        return e
    def lowpass(x, cutoff):
        g = np.exp(-2*np.pi*cutoff/SR); return lfilter([1-g],[1,-g],x)
    def saw_bl(freq, m, nh=14):
        tt = np.arange(m)/SR; out = np.zeros(m); k = 1
        while k <= nh and freq*k < 16000:
            out += np.sin(2*np.pi*freq*k*tt)/k; k += 1
        return out*(2/np.pi)
    def add(buf, t0, x, gain=1.0):
        a = int(t0*SR); b = min(n, a+len(x))
        if a < n: buf[a:b] += x[:b-a]*gain
    def pad(freqs, t0, t1, gain, attack=2.5, release=2.5, cutoff=900, wetg=0.9):
        m = int((t1-t0)*SR)
        if m <= 0: return
        x = np.zeros(m)
        for f in freqs:
            x += saw_bl(f*1.0012, m) + saw_bl(f*0.9988, m)
        x = lowpass(x, cutoff) * env_ar(m, attack, release) * gain / max(len(freqs),1)
        add(dry, t0, x, 0.55); add(wet, t0, x, wetg)
    def drone(freqs, t0, t1, gain, attack=3.0, release=3.0):
        m = int((t1-t0)*SR)
        if m <= 0: return
        tt = np.arange(m)/SR; x = np.zeros(m)
        for f in freqs:
            x += np.sin(2*np.pi*f*tt) + 0.35*np.sin(2*np.pi*f*2*tt+0.5)
        x *= env_ar(m, attack, release) * (1+0.12*np.sin(2*np.pi*0.07*tt)) * gain/len(freqs)
        add(dry, t0, x, 0.8); add(wet, t0, x, 0.25)
    def boom(t0, gain=1.0, f0=95, f1=34, dur=1.6):
        m = int(dur*SR); tt = np.arange(m)/SR
        f = f1 + (f0-f1)*np.exp(-tt*7)
        x = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-tt*3.2)
        th = np.random.default_rng(int(t0*100)).standard_normal(m)*np.exp(-tt*26)
        x += lowpass(th, 300)*1.6
        add(dry, t0, x, gain*0.9); add(wet, t0, x, gain*0.7)
    def pluck(t0, freq, gain=0.5, dur=2.2, bright=2200):
        m = int(dur*SR); tt = np.arange(m)/SR
        x = (np.sin(2*np.pi*freq*tt) + 0.42*np.sin(2*np.pi*freq*2*tt)
             + 0.18*np.sin(2*np.pi*freq*3.01*tt)) * np.exp(-tt*2.6)
        x = lowpass(x, bright); x[:80] *= np.linspace(0,1,80)
        add(dry, t0, x, gain*0.7); add(wet, t0, x, gain*0.9)
    def sub_pulse(t0, gain=0.6, f=36.7):
        m = int(0.34*SR); tt = np.arange(m)/SR
        x = np.sin(2*np.pi*f*tt)*np.exp(-tt*11); x[:40] *= np.linspace(0,1,40)
        add(dry, t0, x, gain)
    def tick(t0, gain=0.12):
        m = int(0.012*SR)
        rng = np.random.default_rng(int(t0*1000) % 99991)
        x = rng.standard_normal(m)*np.hanning(m)
        x -= lowpass(x, 2500)
        add(dry, t0, x, gain)
    def riser(t0, t1, gain=0.5):
        m = int((t1-t0)*SR)
        if m <= 0: return
        x = np.random.default_rng(777).standard_normal(m)
        # chunked sweep lowpass
        out = np.empty_like(x); chunk = 2048
        cuts = np.linspace(150, 3800, m)
        for a in range(0, m, chunk):
            b = min(a+chunk, m)
            g = np.exp(-2*np.pi*float(cuts[a:b].mean())/SR)
            zi = [out[a-1]*g] if a else [0.0]
            out[a:b], _ = lfilter([1-g],[1,-g], x[a:b], zi=zi)
        out *= (np.linspace(0,1,m)**2.4)*gain
        add(dry, t0, out, 0.8); add(wet, t0, out, 0.5)

    # ---- mood recipes per scene ----
    scenes = {s['id']: s for s in P.get('scenes', [])}
    tw = T['scenes']
    last_end = tw[-1]['voEnd'] if tw else total
    n_plk = [N_['D3'], N_['F3'], N_['A2'], N_['G2'], N_['D4'], N_['E4'], N_['F4']]

    for i, s in enumerate(tw):
        spec = scenes.get(s['id'], {})
        mood = spec.get('mood') or DEFAULT_MOOD.get(spec.get('type'), 'dark')
        a, b = s['voStart'], s['voEnd']
        nxt = tw[i+1]['voStart'] if i+1 < len(tw) else min(b + 2.0, total)
        dur = b - a
        if mood == 'dark':
            drone([N_['D1'], N_['D2']], max(0, a-0.8), nxt+1.5, 0.55, attack=2.5)
            boom(max(0, a-0.3), 0.7)
            boom(a + dur*0.7, 0.85)
            pluck(a + dur*0.18, N_['D3'], 0.30, bright=1200)
        elif mood == 'tension':
            drone([N_['D2'], N_['A2']], a-0.3, nxt+1.5, 0.5)
            pad([N_['D3'], N_['F3'], N_['A3']], a+0.5, nxt-0.2, 0.30, attack=3.5, cutoff=750)
            k = a + 0.8
            while k < nxt: tick(k, 0.10); k += 0.75
        elif mood == 'impact':
            det = a + dur*0.10
            riser(a-1.8, det, 0.55)
            boom(det, 1.0)
            drone([N_['D1'], N_['D2']], det, nxt+0.5, 0.6)
            k = det + 0.9; beat = 0
            while k < nxt - 0.3:
                sub_pulse(k, 0.45 + 0.35*min(1, (k-det)/20))
                if beat % 2: tick(k-0.3, 0.14)
                k += 0.62; beat += 1
            pad([N_['D2'], N_['F3'], N_['A2']], det+0.7, a+dur*0.66, 0.26, attack=1.5, cutoff=700)
            pad([N_['Bb2'], N_['D3'], N_['F3']], a+dur*0.66, nxt+0.4, 0.30, attack=2.0, cutoff=900)
        elif mood == 'grim':
            drone([N_['D1'], N_['D2']], a-0.3, nxt+0.5, 0.6)
            boom(a + dur*0.2, 0.8)
            k = a + 0.4; beat = 0
            while k < nxt - 0.3:
                sub_pulse(k, 0.55 + 0.25*min(1, (k-a)/15))
                if beat % 2: tick(k-0.3, 0.14)
                k += 0.62; beat += 1
            pad([N_['G2'], N_['Bb2'], N_['D3']], a+1.0, a+dur*0.55, 0.32, attack=2.0, cutoff=1100)
            pad([N_['A2'], N_['Cs3'], N_['E3']], a+dur*0.55, nxt+0.4, 0.36, attack=2.0, cutoff=1400)
        elif mood == 'hope':
            pad([N_['Bb2'], N_['F3'], N_['D4']], a+0.3, nxt-0.3, 0.34, attack=3.0, cutoff=1500, wetg=1.1)
            drone([N_['D1']], a+0.3, nxt, 0.3)
            pluck(a + dur*0.15, N_['D4'], 0.4)
            pluck(a + dur*0.35, N_['F4'], 0.3)
            pluck(a + dur*0.62, N_['Bb3'] if 'Bb3' in N_ else N_['A3'], 0.35)
        elif mood == 'cold':
            drone([N_['D1'], N_['D2']], a-0.3, nxt+1.0, 0.5)
            for j in range(5):
                pluck(a + dur*(0.08 + 0.2*j), n_plk[j % len(n_plk)], 0.38, dur=2.8, bright=1500)
            k = a + 0.5
            while k < nxt: tick(k, 0.07); k += 1.5
        elif mood == 'resolve':
            pad([N_['D3'], N_['F3'], N_['A3'], N_['E4']], a+0.5, a+dur*0.78, 0.32, attack=4.0, cutoff=1300, wetg=1.2)
            for j, note in enumerate([N_['D4'], N_['E4'], N_['F4']]):
                pluck(a + dur*(0.12 + 0.2*j), note, 0.32)
            swell = a + dur*0.74
            pad([N_['D2'], N_['D3'], N_['A3'], N_['D4'], N_['F4']], swell, total-1.2, 0.42,
                attack=2.2, release=3.5, cutoff=1800, wetg=1.3)
            boom(swell+0.3, 0.55, f0=70, f1=36, dur=2.5)
            drone([N_['D1']], swell, total-0.8, 0.4, attack=1.5, release=3.0)

    # ---- reverb ----
    def comb(x, delay, fb):
        aa = np.zeros(delay+1); aa[0] = 1; aa[delay] = -fb
        return lfilter([1], aa, x)
    def allpass(x, delay, g=0.5):
        bb = np.zeros(delay+1); bb[0] = -g; bb[delay] = 1
        aa = np.zeros(delay+1); aa[0] = 1; aa[delay] = -g
        return lfilter(bb, aa, x)
    rev = np.zeros(n)
    for d, fb in [(1557,0.78),(1617,0.76),(1491,0.79),(1422,0.77)]:
        rev += comb(wet, d, fb)
    rev = lowpass(allpass(allpass(rev/4, 225), 556), 3200)

    mono = dry + rev*0.55
    fi = int(0.4*SR); mono[:fi] *= np.linspace(0,1,fi)
    fo = int(2.2*SR); mono[-fo:] *= np.linspace(1,0,fo)**1.4
    mono = np.tanh(mono*1.1)
    mono *= 0.82/max(np.max(np.abs(mono)), 1e-9)
    haas = int(0.011*SR)
    side = np.tanh(rev - np.concatenate([np.zeros(haas), rev[:-haas]]))*0.18
    L = np.clip(mono+side, -1, 1); R = np.clip(mono-side, -1, 1)
    st = np.empty(n*2, dtype=np.int16)
    st[0::2] = (L*32767).astype(np.int16); st[1::2] = (R*32767).astype(np.int16)
    with wave.open(os.path.join(workdir, "music.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(st.tobytes())
    print("music.wav:", round(total, 2), "s")

if __name__ == "__main__":
    main(sys.argv[1])
