#!/usr/bin/env python3
"""crowfield mood v2 — 'floaty, heavy but loved'. Low airy flute over warm
detuned-triangle string pads (no sawtooth buzz — bees died in v1).
B♭maj7 / F/A / Gm7 / E♭maj7 — weight with warmth. Separate file only;
not wired into the game until the owner says combine."""
import numpy as np
import wave

SR = 44100
DUR = 96.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(23)

def lowpass(x, fc):
    a = (2 * np.pi * fc / SR) / (1 + 2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y

def tri(f_arr):
    """triangle wave via harmonic series (odd harmonics, 1/n², alternating)"""
    ph = np.cumsum(f_arr) / SR
    x = np.zeros_like(ph)
    for k in range(6):
        n = 2 * k + 1
        x += ((-1) ** k / (n * n)) * np.sin(2 * np.pi * n * ph)
    return x * (np.pi * np.pi / 8)

def flute_note(buf, f0, start, dur, vel=0.34):
    """low flute: sine heart, a breath of air, and — per synthesis gospel —
    NO pitch vibrato; the player modulates BRIGHTNESS, ~5.3Hz, ±10%"""
    i0, i1 = int(start * SR), min(N, int((start + dur) * SR))
    if i0 >= N: return
    n = i1 - i0
    tt = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f0 * tt) + 0.07 * np.sin(2 * np.pi * f0 * 2 * tt)
    breath = lowpass(rng.standard_normal(n), 2600) * 0.028
    bright = 1 + 0.10 * np.sin(2 * np.pi * 5.3 * tt) * np.minimum(1, tt / 0.4)  # breath swells in
    x = (tone + breath) * bright
    e = np.minimum(1, tt / 0.3) ** 1.3 * np.minimum(1, (dur - tt) / 0.45)
    buf[i0:i1] += x * e * vel

def pad_note(buf, f0, start, dur, vel=0.16):
    """string pad: three detuned triangles, slow swell — floaty, not buzzy"""
    i0 = max(0, int(start * SR))
    i1 = min(N, int((start + dur) * SR))
    if i0 >= i1: return
    n = i1 - i0
    tt = np.arange(n) / SR + max(0.0, -start)  # keep envelope phase when clamped
    x = (tri(np.full(n, f0 * 0.9994)) + tri(np.full(n, f0)) + tri(np.full(n, f0 * 1.0007))) / 3
    x = lowpass(x, 1100)
    e = np.minimum(1, tt / max(1.2, dur * 0.4)) * np.minimum(1, (dur - tt) / max(1.0, dur * 0.35))
    buf[i0:i1] += x * e * vel

music = np.zeros(N)

# ---- warm heavy chord pads: Bbmaj7 → F/A → Gm7 → Ebmaj7, long crossfades ----
CH = 12.0  # seconds per chord
CHORDS = [
    [116.54, 146.83, 174.61, 220.00],   # Bb2 D3 F3 A3
    [87.31, 110.00, 146.83, 220.00],    # F2 A2 D3 A3  (F/A-ish)
    [98.00, 146.83, 174.61, 233.08],    # G2 D3 F3 Bb3 (Gm7)
    [77.78, 116.54, 155.56, 196.00],    # Eb2 Bb2 D3 G3 (Ebmaj7)
]
nch = int(DUR / CH) + 2
for c in range(nch):
    chord = CHORDS[c % len(CHORDS)]
    for f in chord:
        pad_note(music, f, c * CH - 1.5, CH + 3.5, vel=0.15)

# ---- low flute: long floated phrases over the pads (D minor over Bb = loved ache) ----
FLUTE = [
    (4.0,  [(349.23, 5.5), (440.00, 4.0), (523.25, 6.0)]),   # F4 A4 C5 — opening warmth
    (22.0, [(466.16, 5.0), (440.00, 4.0), (349.23, 5.5)]),   # Bb A F — settles
    (38.0, [(293.66, 6.5), (349.23, 5.0)]),                  # D4 F4 — low rest
    (52.0, [(440.00, 5.0), (523.25, 4.5), (587.33, 6.0)]),   # A C5 D5 — the loved lift
    (70.0, [(523.25, 5.5), (466.16, 4.5), (440.00, 6.0)]),   # back down, gently
    (86.0, [(349.23, 7.0)]),                                  # rests on F
]
for start, notes in FLUTE:
    s = start
    for f, d in notes:
        flute_note(music, f, s, d + 0.15, vel=0.33)
        s += d * 0.95

# ---- high pad glimmers: rare, soft, like light through rain ----
GLIM = [(18.0, 698.46), (45.0, 880.00), (63.0, 783.99), (84.0, 698.46)]  # F5 A5 G5 F5
for s, f in GLIM:
    pad_note(music, f, s, 9.0, vel=0.05)

# ---- faint air bed ----
white = rng.standard_normal(N)
brown = np.cumsum(white)
brown /= np.max(np.abs(brown))
mix = music + brown * (0.014 + 0.008 * np.sin(2 * np.pi * t / 23.0))

def echo(x, d, g):
    n = int(d * SR)
    y = np.zeros_like(x)
    y[n:] = x[:-n] * g
    return y

# long, soft reverb — the floatiness lives here
wet = mix + echo(mix, 0.46, 0.30) + echo(mix, 0.95, 0.18) + echo(mix, 1.55, 0.09)
left = wet * 0.95 + echo(wet, 0.014, 0.05)
right = wet * 0.95 + echo(wet, 0.019, 0.05)

fi, fo = int(3 * SR), int(6 * SR)
left[:fi] *= np.linspace(0, 1, fi); right[:fi] *= np.linspace(0, 1, fi)
left[-fo:] *= np.linspace(1, 0, fo); right[-fo:] *= np.linspace(1, 0, fo)

peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
g = 0.8 / peak
L = (left * g).astype(np.float32)
R = (right * g).astype(np.float32)

out = '/Users/joan/Desktop/app-original/crowfield-flute-strings-v2.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = np.empty(N * 2, dtype=np.int16)
    frames[0::2] = (L * 32767).astype(np.int16)
    frames[1::2] = (R * 32767).astype(np.int16)
    w.writeframes(frames.tobytes())
print('wrote', out, N / SR, 's')
