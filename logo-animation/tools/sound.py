"""Punchy, minimal sound design for the kinetic reveal, synthesised with numpy.

Dry and tight: kick-style slams for the type, crisp swishes for the wipes,
short pitched ticks for the stars and leaves, a sub drop when the emblem
becomes the crest, and one clean low hit on the lockup. No bells, chimes or
pads. Cues come from the animation's own event table (output/events.json),
so picture and sound share one timeline.

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
rng = np.random.default_rng(1207)
MIX = np.zeros((2, N))
ROOM = np.zeros((2, N))


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def place(sig, t0, pan=0.0, gain=1.0, room=0.12):
    sig = np.asarray(sig, float)
    if sig.ndim == 1:
        a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    fade = min(sig.shape[1], int(0.03 * SR))
    sig = sig.copy()
    sig[:, sig.shape[1] - fade:] *= np.linspace(1, 0, fade)  # no clicks where a sound is cut
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig, i0 = sig[:, -i0:], 0
    n = min(sig.shape[1], N - i0)
    if n > 0:
        MIX[:, i0:i0 + n] += sig[:, :n] * gain
        ROOM[:, i0:i0 + n] += sig[:, :n] * gain * room


def spectral(x, gain_fn, n_fft=1024, hop=256):
    """Time-varying filter: gain_fn(freqs, t) -> gain for the frame at t."""
    win = np.hanning(n_fft)
    pad = np.concatenate([np.zeros(n_fft), x, np.zeros(n_fft)])
    out = np.zeros(len(pad))
    norm = np.zeros(len(pad))
    f = np.fft.rfftfreq(n_fft, 1 / SR)
    for s in range(0, len(pad) - n_fft, hop):
        X = np.fft.rfft(pad[s:s + n_fft] * win) * gain_fn(f, (s + n_fft / 2 - n_fft) / SR)
        out[s:s + n_fft] += np.fft.irfft(X, n_fft) * win
        norm[s:s + n_fft] += win ** 2
    return (out / np.maximum(norm, 1e-3))[n_fft:n_fft + len(x)]


def band(f, fc, oct_):
    return np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / oct_) ** 2)


def norm(x):
    return x / (np.abs(x).max() + 1e-9)


def kick(f0=160, f1=46, dur=0.45, decay=7.0, drive=1.8):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay) * np.minimum(1, t / 0.002)
    return np.tanh(body * drive) / np.tanh(drive)


def click(dur=0.006, fc=5000):
    n = int(dur * SR)
    x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 900)
    return norm(spectral(np.concatenate([x, np.zeros(512)]), lambda f, _t: band(f, fc, 1.5), 256, 64))


def snap(dur=0.09, fc=3200):
    t = tt(dur)
    x = rng.standard_normal(len(t)) * np.exp(-t * 55)
    return norm(spectral(x, lambda f, _t: band(f, fc, 1.1), 512, 128))


def swish(dur, f0, f1, width=0.8, shape=0.35):
    """Band-passed noise sweep that swells and cuts off at the end."""
    t = tt(dur)
    x = rng.standard_normal(len(t))
    y = spectral(x, lambda f, tt_: band(f, f0 * (f1 / f0) ** np.clip(tt_ / dur, 0, 1), width))
    u = t / dur
    env = (u / shape) ** 2 * (u < shape) + (u >= shape) * np.clip((1 - u) / (1 - shape), 0, 1) ** 0.6
    return norm(y * env)


def swell(dur, f0=300, f1=6000):
    """Reverse-style swell: rises and stops dead."""
    t = tt(dur)
    x = rng.standard_normal(len(t))
    y = spectral(x, lambda f, tt_: 1 / (1 + (f / (f0 * (f1 / f0) ** np.clip(tt_ / dur, 0, 1))) ** 3))
    return norm(y * (t / dur) ** 3)


def tick(f, dur=0.07, decay=60):
    t = tt(dur)
    tone = np.sin(2 * np.pi * f * t) * np.exp(-t * decay)
    tone[: len(click())] += 0.35 * click()[: len(tone)]
    return norm(tone)


def pluck(f, dur=0.22):
    """Dry pitched mallet: fundamental plus a short octave overtone."""
    t = tt(dur)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 22) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 45)
    y *= np.minimum(1, t / 0.0015)
    c = click(0.004, 6000)
    y[: len(c)] += 0.3 * c
    return norm(y)


def sub_drop(f0=90, f1=36, dur=1.6, decay=2.4):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.12)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay) * np.minimum(1, t / 0.004)
    return np.tanh(y * 1.4) / np.tanh(1.4)


def thump(f0=110, f1=52, dur=0.3):
    return kick(f0, f1, dur, 11, 1.2)


def room(x, secs=0.9):
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / secs)
        ir = spectral(ir, lambda f, _t: np.exp(-f / 6000) * (f > 250), 512, 128)
        ir[: int(0.008 * SR)] = 0
        ir /= np.sqrt((ir ** 2).sum())
        size = 1 << (len(x[ch]) + n - 1).bit_length()
        out[ch] = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: len(x[ch])]
    return out


def main():
    ev_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'output' / 'events.json'
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'output' / 'soundtrack.wav'
    events = json.loads(ev_path.read_text())
    manifest = json.loads((ROOT / 'assets' / 'layers' / 'manifest.json').read_text())
    star_of_letter = [5, 6, 0, 1, 2, 3, 4]
    scale = [659.25, 739.99, 830.61, 880.0, 987.77, 1108.73, 1318.51]  # E major, rising

    for e in events:
        k, t0 = e['kind'], e['t']
        d = e.get('dur', 0.3)
        if k == 'slice':
            s = swish(d, 2500, 9000, 0.7, 0.8)
            u = np.arange(len(s)) / len(s)
            a = (u * 1.8 - 0.9 + 1) * np.pi / 4
            place(np.stack([s * np.cos(a), s * np.sin(a)]) * np.sqrt(2), t0, gain=0.28)
        elif k == 'open':
            place(thump(95, 45, 0.5), t0, gain=0.55)
            place(swish(0.25, 600, 1800, 0.9, 0.2), t0, gain=0.18)
        elif k == 'slam':
            z = e.get('size', 1)
            place(kick(170, 44 + 6 * (1 - z), 0.5, 6.5, 2.0), t0, gain=0.85 * z)
            place(snap(0.1, 2800), t0, gain=0.32 * z)
            place(click(), t0, gain=0.25)
        elif k == 'amp':
            place(pluck(523.25, 0.2), t0, gain=0.3)
            place(swish(0.16, 1500, 5000, 0.8, 0.7), t0 - 0.08, gain=0.15)
        elif k == 'wipe':
            place(swish(d + 0.04, 900, 4200, 0.7, 0.8), t0 - 0.02, pan=e.get('pan', 0) * -0.5, gain=0.36)
        elif k == 'star':
            i = e['i']
            L = manifest['layers'][f'star{star_of_letter[i]}']
            pan = (L['cx'] - manifest['ring']['cx']) / 230
            place(pluck(scale[i]), t0, pan=pan, gain=0.34, room=0.2)
            place(swish(0.3, 1200, 5000, 0.8, 0.9), t0 - 0.3, pan=pan * 0.6, gain=0.07)
        elif k == 'zip':
            s = swish(d, 800, 5000, 0.35, 0.85)
            place(s, t0, gain=0.12)
        elif k == 'pop':
            f = e.get('f', 400)
            t = tt(0.16)
            y = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.8 * np.exp(-t / 0.012))) / SR) * np.exp(-t * 28)
            place(norm(y), t0, gain=0.3)
        elif k == 'hit':
            place(kick(140, 50, 0.35, 9, 1.6), t0, gain=0.6)
            place(click(), t0, gain=0.2)
        elif k == 'leaf':
            place(tick(3200 + 180 * (e['i'] % 3), 0.05, 90), t0, pan=0.5 if e['i'] % 2 else -0.5, gain=0.1, room=0.2)
        elif k == 'suck':
            place(swell(d, 300, 7000), t0, gain=0.34)
        elif k == 'boom':
            place(sub_drop(95, 36, 1.6, 2.6), t0, gain=0.95, room=0.05)
            place(snap(0.12, 1800), t0, gain=0.25)
            place(click(), t0, gain=0.2)
        elif k == 'thump':
            place(thump(), t0, gain=0.45)
        elif k == 'tick':
            place(tick(e.get('f', 2000)), t0, pan=e.get('pan', 0), gain=0.1, room=0.15)
        elif k == 'swish':
            s1, s2 = swish(d, 1200, 3500, 0.8, 0.5), swish(d, 1300, 3800, 0.8, 0.5)
            place(np.stack([s1, s2]) * 0.8, t0, gain=0.2)
        elif k == 'whoosh':
            s = swish(d, 350, 1400, 0.9, 0.6)
            u = np.arange(len(s)) / len(s)
            a = (-0.55 * u + 1) * np.pi / 4
            place(np.stack([s * np.cos(a), s * np.sin(a)]) * np.sqrt(2), t0, gain=0.34)
            place(swell(0.5, 400, 5000), 9.5 - 0.5, gain=0.2)
        elif k == 'type':
            place(thump(130, 70, 0.18), t0, gain=0.22)
        elif k == 'final':
            place(sub_drop(75, 33, 4.6, 1.25), t0, gain=1.0, room=0.08)
            place(kick(180, 48, 0.5, 6, 2.2), t0, gain=0.6)
            place(snap(0.14, 2400), t0, gain=0.3)
            place(click(0.006, 7000), t0, gain=0.25)

    mix = MIX + room(ROOM) * 0.5
    mix = np.tanh(mix * 1.25) / 1.25
    t = np.arange(N) / SR
    mix *= np.clip((DUR - t) / 0.3, 0, 1)
    mix *= 0.89 / np.abs(mix).max()
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out_path, f'{DUR:.1f} s')


if __name__ == '__main__':
    main()
