#!/usr/bin/env python3
"""moody duet — low flute + violin, for the crowfield. Rendered as a separate
file ONLY (not wired into the game until the owner says combine)."""
import numpy as np
import wave

SR = 44100
DUR = 96.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)

def lowpass(x, fc):
    a = (2 * np.pi * fc / SR) / (1 + 2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y

def flute_note(buf, f0, start, dur, vel=0.4):
    """low flute: sine core + a breath of noise, slow airy attack"""
    i0, i1 = int(start * SR), min(N, int((start + dur) * SR))
    if i0 >= N: return
    n = i1 - i0
    tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 4.6 * tt)
    tone = np.sin(2 * np.pi * f0 * vib * tt) + 0.18 * np.sin(2 * np.pi * f0 * 2 * vib * tt)
    breath = lowpass(rng.standard_normal(n), 3000) * 0.06
    x = tone + breath
    e = np.minimum(1, tt / 0.22) * np.minimum(1, (dur - tt) / 0.35)
    buf[i0:i1] += x * e * vel

def violin_note(buf, f0, start, dur, vel=0.3, slide_from=None):
    """violin: sawtooth + vibrato + warm lowpass, expressive slow bow"""
    i0, i1 = int(start * SR), min(N, int((start + dur) * SR))
    if i0 >= N: return
    n = i1 - i0
    tt = np.arange(n) / SR
    if slide_from:
        # glissando into the note over the first 18%
        gs = int(n * 0.18)
        f = np.full(n, f0)
        f[:gs] = np.linspace(slide_from, f0, gs)
    else:
        f = np.full(n, f0)
    f = f * (1 + 0.008 * np.sin(2 * np.pi * 5.4 * tt))
    ph = np.cumsum(f) / SR
    x = 2 * (ph % 1) - 1
    x = lowpass(x, 1400)
    e = np.minimum(1, tt / 0.18) ** 1.4 * np.minimum(1, (dur - tt) / 0.3)
    buf[i0:i1] += x * e * vel

music = np.zeros(N)

# ---- low flute: a mournful ground line, D natural minor, long breaths ----
# G3 A3 Bb3 C4 D4 — low and heavy
FLUTE = [
    (2.0,  [(196.00, 5.5), (220.00, 4.0), (233.08, 6.5)]),           # G A Bb
    (20.0, [(293.66, 6.0), (261.63, 4.5), (233.08, 5.5)]),           # D4 C4 Bb3
    (38.0, [(196.00, 7.0), (174.61, 5.0)]),                          # G3 F3 — sinking
    (52.0, [(220.00, 5.0), (233.08, 4.0), (293.66, 6.5)]),           # A Bb D4 — ache up
    (70.0, [(261.63, 6.0), (220.00, 5.0), (196.00, 7.0)]),           # C4 A3 G3 home, unresolved
    (88.0, [(196.00, 6.0)]),
]
for start, notes in FLUTE:
    s = start
    for f, d in notes:
        flute_note(music, f, s, d + 0.1, vel=0.36)
        s += d * 0.96

# ---- violin: slow weeping answers, high and thin, enters late ----
VIOLIN = [
    (14.0, [(587.33, 4.5, 523.25), (523.25, 3.5, None)]),            # D5 slid from C5, C5
    (30.0, [(466.16, 5.0, 440.00), (440.00, 4.0, None)]),            # Bb4 from A4
    (47.0, [(523.25, 4.0, None), (587.33, 5.5, 523.25)]),            # C5, D5 slid
    (64.0, [(440.00, 5.5, 392.00), (349.23, 4.5, None)]),            # A4 from G4, F4 — falls
    (80.0, [(392.00, 6.5, 349.23), (293.66, 5.0, None)]),            # G4 from F4, D4 — down to rest
]
for start, notes in VIOLIN:
    s = start
    for f, d, slide in notes:
        violin_note(music, f, s, d + 0.12, vel=0.26, slide_from=slide)
        s += d * 0.94

# ---- faint wind bed so the silence between notes isn't dead ----
white = rng.standard_normal(N)
brown = np.cumsum(white)
brown /= np.max(np.abs(brown))
windbed = brown * (0.02 + 0.012 * np.sin(2 * np.pi * t / 19.0))
mix = music + windbed

def echo(x, delay_s, gain):
    d = int(delay_s * SR)
    y = np.zeros_like(x)
    y[d:] = x[:-d] * gain
    return y

wet = mix + echo(mix, 0.38, 0.24) + echo(mix, 0.79, 0.11)
left = wet * 0.95 + echo(wet, 0.012, 0.05)
right = wet * 0.95 + echo(wet, 0.016, 0.05)

fi, fo = int(2.5 * SR), int(5 * SR)
left[:fi] *= np.linspace(0, 1, fi); right[:fi] *= np.linspace(0, 1, fi)
left[-fo:] *= np.linspace(1, 0, fo); right[-fo:] *= np.linspace(1, 0, fo)

peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
g = 0.8 / peak
L = (left * g).astype(np.float32)
R = (right * g).astype(np.float32)

out = '/Users/joan/Desktop/app-original/crowfield-flute-violin.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = np.empty(N * 2, dtype=np.int16)
    frames[0::2] = (L * 32767).astype(np.int16)
    frames[1::2] = (R * 32767).astype(np.int16)
    w.writeframes(frames.tobytes())
print('wrote', out, N / SR, 's')
