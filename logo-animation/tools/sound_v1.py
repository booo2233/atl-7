"""Procedural soundtrack for the crest reveal, synthesised with numpy.

Every cue is placed from the animation's own event table (output/events.json,
written by tools/render.mjs from src/logo.js), so picture and sound share one
timeline. Nothing is sampled: whooshes are filtered noise, the booms are
pitch-dropping sines, the tings and chimes are inharmonic partials, and the
room is a synthetic stereo impulse response.

usage: python3 tools/sound.py [output/events.json] [output/soundtrack.wav]
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(20260929)
MIX = np.zeros((2, N))
SEND = np.zeros((2, N))  # reverb send


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def place(sig, t0, pan=0.0, gain=1.0, verb=0.3):
    """Add a mono or (2, n) stereo signal at t0 seconds; pan in [-1, 1]."""
    sig = np.asarray(sig, float)
    if sig.ndim == 1:
        a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig = sig[:, -i0:]
        i0 = 0
    n = min(sig.shape[1], N - i0)
    if n <= 0:
        return
    MIX[:, i0:i0 + n] += sig[:, :n] * gain
    SEND[:, i0:i0 + n] += sig[:, :n] * gain * verb


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t * decay)


def stft_filter(x, gain_fn, n_fft=1024, hop=256):
    """Time-varying filter: gain_fn(freqs, t) -> spectral gain for the frame at t."""
    win = np.hanning(n_fft)
    pad = np.concatenate([np.zeros(n_fft), x, np.zeros(n_fft)])
    out = np.zeros(len(pad))
    norm = np.zeros(len(pad))
    freqs = np.fft.rfftfreq(n_fft, 1 / SR)
    for s in range(0, len(pad) - n_fft, hop):
        X = np.fft.rfft(pad[s:s + n_fft] * win)
        X *= gain_fn(freqs, (s + n_fft / 2 - n_fft) / SR)
        out[s:s + n_fft] += np.fft.irfft(X, n_fft) * win
        norm[s:s + n_fft] += win ** 2
    return (out / np.maximum(norm, 1e-3))[n_fft:n_fft + len(x)]


def band(fc, bw_oct):
    return lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / bw_oct) ** 2)


def whoosh(dur, f0, f1, bw=0.9, attack=0.4, release=0.5, curve=1.0):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    y = stft_filter(x, lambda f, t: band(f0 * (f1 / f0) ** (np.clip(t / dur, 0, 1) ** curve), bw)(f))
    t = np.arange(n) / SR
    e = np.minimum(1, t / (dur * attack)) * np.minimum(1, (dur - t) / (dur * release))
    y = y * np.clip(e, 0, 1) ** 1.5
    return y / (np.abs(y).max() + 1e-9)


def boom(f0=58, f1=31, dur=2.2, decay=2.0, click=0.5):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 7)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * env(len(t), 0.004, decay)
    y += 0.35 * np.sin(2 * ph + 0.5) * env(len(t), 0.004, decay * 2.2)
    c = rng.standard_normal(int(0.03 * SR)) * env(int(0.03 * SR), 0.0005, 120)
    c = stft_filter(c, lambda fr, _t: band(900, 1.4)(fr), 256, 64)
    y[:len(c)] += click * c / (np.abs(c).max() + 1e-9)
    return y / np.abs(y).max()


def ting(f, dur=1.6, bright=1.0, decay=3.0):
    t = tt(dur)
    y = np.zeros(len(t))
    for ratio, amp, d in [(1, 1, 1), (2.76, 0.5 * bright, 1.7), (5.40, 0.28 * bright, 2.6), (8.93, 0.14 * bright, 4.0), (2.0, 0.2, 1.2)]:
        y += amp * np.sin(2 * np.pi * f * ratio * t + rng.random() * 6) * np.exp(-t * decay * d)
    y *= np.minimum(1, t / 0.0015)
    return y / np.abs(y).max()


def pop(f, dur=0.12):
    t = tt(dur)
    fr = f * (1 + 0.7 * np.exp(-t * 90))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.001, 38)
    return y


def grains(dur, fc, bw, density, glen=(0.01, 0.05)):
    """Granular rustle: short band-limited noise grains at random times."""
    n = int(dur * SR)
    x = np.zeros(n)
    for _ in range(int(density * dur)):
        g = int(rng.uniform(*glen) * SR)
        s = int(rng.uniform(0, max(1, n - g)))
        x[s:s + g] += rng.standard_normal(g) * np.hanning(g) * rng.uniform(0.3, 1)
    y = stft_filter(x, lambda f, t: band(fc, bw)(f))
    return y / (np.abs(y).max() + 1e-9)


def crackle(dur, rate):
    n = int(dur * SR)
    x = np.zeros(n)
    idx = rng.integers(0, n, int(rate * dur))
    x[idx] = rng.uniform(-1, 1, len(idx))
    y = stft_filter(x, lambda f, t: band(4200, 1.2)(f))
    return y / (np.abs(y).max() + 1e-9)


def sparkle(dur, n_grains, lo=3500, hi=9000):
    n = int(dur * SR)
    y = np.zeros(n)
    for _ in range(n_grains):
        f = rng.uniform(lo, hi)
        g = int(rng.uniform(0.04, 0.16) * SR)
        s = int(rng.uniform(0, max(1, n - g)))
        tg = np.arange(g) / SR
        y[s:s + g] += np.sin(2 * np.pi * f * tg) * np.exp(-tg * 30) * np.minimum(1, tg / 0.002) * rng.uniform(0.3, 1)
    return y / (np.abs(y).max() + 1e-9)


def pad():
    """Warm D-major (add 9) bed that swells when the crest locks up."""
    t = np.arange(N) / SR
    y = np.zeros((2, N))
    notes = [73.42, 110.0, 146.83, 185.0, 220.0, 329.63, 440.0]
    bright = 0.35 + 0.65 * np.clip((t - 9.1) / 1.6, 0, 1)
    for k, f in enumerate(notes):
        for ch in range(2):
            det = 1 + (ch * 2 - 1) * 0.0022 * (1 + k % 3)
            for h in range(1, 7):
                amp = (1 / h) * np.exp(-(h - 1) * (1.4 - 0.9 * bright))
                y[ch] += amp * np.sin(2 * np.pi * f * det * h * t + k + h)
    lvl = 0.16 + 0.16 * np.clip((t - 2.3) / 6, 0, 1) + 0.55 * np.clip((t - 9.15) / 1.2, 0, 1) ** 1.5
    lvl *= np.clip(t / 1.4, 0, 1) * np.clip((DUR - t) / 1.6, 0, 1) ** 1.3
    lvl *= 1 + 0.08 * np.sin(2 * np.pi * 0.23 * t)
    return y / np.abs(y).max() * lvl


def reverb(x, secs=2.6):
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / secs)
        ir = stft_filter(ir, lambda f, tt_: np.exp(-f / (7000 * np.exp(-tt_ * 0.8))) * (f > 180), 1024, 256)
        ir[: int(0.012 * SR)] = 0  # pre-delay
        ir /= np.sqrt((ir ** 2).sum())
        m = len(x[ch]) + n
        size = 1 << (m - 1).bit_length()
        out[ch] = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: len(x[ch])]
    return out


def main():
    ev_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'output' / 'events.json'
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'output' / 'soundtrack.wav'
    events = json.loads(ev_path.read_text())
    manifest = json.loads((ROOT / 'assets' / 'layers' / 'manifest.json').read_text())
    ring = manifest['ring']

    MIX[:] += pad() * 0.5
    penta = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51]
    star_rank = {}
    for e in events:
        k, t0 = e['kind'], e['t']
        d = e.get('dur', 0.5)
        if k == 'riser':
            place(whoosh(0.62, 500, 7000, 0.7, attack=0.8, release=0.1, curve=1.6), t0 - 0.12 + 0.12, gain=0.28)
        elif k == 'flash':
            place(boom(62, 30, 2.4, 1.6), t0, gain=0.9, verb=0.1)
            place(sparkle(1.4, 40, 5000, 11000), t0, gain=0.14, verb=0.6)
            place(ting(1174.66, 2.5, 0.6, 1.2), t0, gain=0.12, verb=0.8)
        elif k == 'orbit':
            # a swirl that pans round with the orbiting spark
            w = whoosh(d, 900, 2600, 0.6, attack=0.3, release=0.25)
            tl = np.arange(len(w)) / SR
            pan = np.cos(2 * np.pi * (tl / d) - np.pi / 2) * 0.8
            a = (pan + 1) * np.pi / 4
            place(np.stack([w * np.cos(a), w * np.sin(a)]) * np.sqrt(2), t0, gain=0.22)
        elif k == 'comet':
            w = whoosh(d + 0.15, 1400, 3800, 0.55, attack=0.15, release=0.2) * 0.8 + crackle(d + 0.15, 900) * 0.35
            tl = np.arange(len(w)) / SR
            u = np.clip(tl / d, 0, 1)
            pan = np.cos(-np.pi / 2 + 2 * np.pi * (u + 0.16 * u * (1 - u))) * 0.85
            a = (pan + 1) * np.pi / 4
            place(np.stack([w * np.cos(a), w * np.sin(a)]) * np.sqrt(2), t0, gain=0.3, verb=0.35)
        elif k == 'burst':
            place(boom(90, 45, 1.2, 3.5, 0.9), t0, gain=0.55)
            place(sparkle(1.0, 60, 3000, 10000), t0, gain=0.2, verb=0.6)
            place(whoosh(0.5, 3000, 700, 0.9, attack=0.05, release=0.7), t0, gain=0.25)
        elif k == 'star':
            i = e['i']
            L = manifest['layers'][f'star{i}']
            r = star_rank.setdefault(round(t0, 2), len(star_rank))
            f = penta[min(r, len(penta) - 1)]
            place(ting(f, 1.4, 0.9, 3.2), t0, pan=(L['cx'] - ring['cx']) / 260, gain=0.2, verb=0.55)
            place(whoosh(0.35, 2500, 600, 0.8, attack=0.6, release=0.3), t0 - 0.3, pan=(L['cx'] - ring['cx']) / 260, gain=0.1)
        elif k == 'rustle':
            for side in (-0.6, 0.6):
                place(grains(d, 4200, 0.8, 260), t0, pan=side, gain=0.1, verb=0.35)
        elif k == 'flutter':
            x = grains(d, 1800, 1.0, 160, (0.008, 0.02))
            x *= 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 21 * np.arange(len(x)) / SR))
            place(x, t0, gain=0.14, verb=0.3)
            place(ting(440, 2.0, 0.4, 1.6), t0 + 0.15, gain=0.08, verb=0.8)
        elif k == 'swell':
            w = whoosh(d, 400, 5000, 1.0, attack=0.95, release=0.02, curve=2.0)
            place(w, t0, gain=0.3, verb=0.4)
        elif k == 'boom':
            place(boom(55, 28, 3.0, 1.4, 0.7), t0, gain=1.0, verb=0.2)
            place(ting(293.66, 2.6, 0.5, 1.1), t0, gain=0.14, verb=0.7)
        elif k == 'ignite':
            n = int(0.9 * SR)
            x = rng.standard_normal(n)
            y = stft_filter(x, lambda f, t: 1 / (1 + (f / (300 + 3500 * min(1, t / 0.25))) ** 4))
            y *= env(n, 0.03, 4.0)
            y = y / np.abs(y).max() + 0.3 * crackle(0.9, 300) * env(n, 0.05, 3)
            place(y, t0, gain=0.22, verb=0.3)
            place(boom(90, 60, 0.6, 7, 0), t0, gain=0.25)
        elif k == 'unfurl':
            w = whoosh(d, 700, 2000, 1.1, attack=0.2, release=0.6)
            w2 = whoosh(d, 800, 2300, 1.1, attack=0.2, release=0.6)
            place(np.stack([w, w2]) * 0.8, t0, gain=0.3, verb=0.3)
        elif k == 'tick':
            i = e['i']
            if i < 20:
                pan, f = (i / 17 - 0.5) * 1.4, 1500 + 40 * i
            elif i < 40:
                pan, f = ((i - 20) / 13 - 0.5) * 1.2, 1900 + 30 * (i - 20)
            else:
                pan, f = ((i - 40) / 7 - 0.5) * 0.7, 1200
            place(pop(f), t0, pan=pan, gain=0.1, verb=0.25)
        elif k == 'ping':
            place(ting([1318.51, 1567.98, 1760.0, 1975.53, 2349.32][e['i']], 0.9, 0.6, 5), t0, pan=0.55, gain=0.07, verb=0.5)
        elif k == 'drop':
            place(whoosh(d, 2600, 500, 0.8, attack=0.6, release=0.15), t0, gain=0.3)
        elif k == 'thud':
            place(boom(75, 38, 1.6, 3.0, 1.0), t0, gain=0.8, verb=0.15)
        elif k == 'pop':
            place(pop(700, 0.2), t0, gain=0.2)
        elif k == 'chime':
            for j, f in enumerate([587.33, 739.99, 880.0, 1174.66, 1479.98]):
                place(ting(f, 4.5, 0.5, 0.8), t0 + j * 0.012, pan=(j - 2) * 0.25, gain=0.1, verb=0.9)
            place(boom(73.42, 36.7, 3.0, 1.0, 0.2), t0, gain=0.55, verb=0.3)
        elif k == 'shine':
            s = sparkle(d, 90)
            tl = np.arange(len(s)) / SR
            a = (np.clip(tl / d, 0, 1) * 1.6 - 0.8 + 1) * np.pi / 4
            place(np.stack([s * np.cos(a), s * np.sin(a)]) * np.sqrt(2), t0, gain=0.12, verb=0.8)
            place(whoosh(d, 3000, 9000, 0.5, attack=0.4, release=0.5), t0, gain=0.07, verb=0.7)
        elif k == 'shimmer':
            s = sparkle(d, 50)
            place(s, t0, gain=0.06, verb=0.9)
        elif k == 'twinkle':
            place(ting(2349.32 * (1 + 0.06 * e['i']), 0.8, 0.3, 6), t0, pan=(e['i'] - 3) * 0.2, gain=0.035, verb=0.8)

    wet = reverb(SEND)
    mix = MIX + wet * 0.55
    # gentle master: soft clip, then normalise to -1 dBFS
    mix = np.tanh(mix * 1.4) / 1.4
    fade = np.clip((DUR - np.arange(N) / SR) / 0.35, 0, 1)
    mix *= fade
    mix *= 0.89 / np.abs(mix).max()
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out_path, f'{DUR:.1f} s', 'peak %.2f' % np.abs(mix).max())


if __name__ == '__main__':
    main()
