"""Render Map 3's original cello/piano arrangement using acoustic recordings only.

Requires Python + numpy and macOS afconvert. Run from the project root:
  python3 scripts/render-crowfield-music.py /path/to/Cello.arco.pp.sulD.D3B3.aiff

Download source and usage terms are documented in public/sounds/crowfield/README.md.
No oscillators, synthesized instrument sounds, or looped bow fragments are used.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
BEAT = 60 / 56
# Note boundaries in Iowa's pianissimo bowed D-string chromatic scale.
CELLO_REGIONS = {
    50: (1.86, 4.65), 52: (18.24, 20.74), 53: (25.45, 27.78),
    55: (39.82, 42.36), 57: (52.65, 54.91), 58: (58.72, 61.16),
}
PIANO_FREQ = {
    50: 147.0, 52: 165.2, 54: 185.4, 56: 208.3, 58: 233.5,
    60: 262.1, 62: 294.1, 64: 330.7, 66: 370.8, 68: 416.5,
    70: 467.3, 72: 525.5, 74: 588.8, 76: 661.5, 78: 741.5, 80: 835.8,
}
# D minor: spacious piano voicings, a bowed melody, and room between phrases.
# Each entry is (piano voicing, cello notes on beats 1 and 3); None is a rest.
SCORE = [
    ([50, 57, 65, 69], [57, 53]), ([58, 65, 69, 72], [53, 52]),
    ([55, 62, 65, 69], [55, 53]), ([57, 64, 67, 71], [52, None]),
    ([50, 57, 65, 69], [50, 53]), ([58, 65, 69, 72], [57, 58]),
    ([55, 62, 65, 69], [55, 53]), ([57, 64, 67, 71], [52, None]),
    ([50, 57, 65, 69], [57, 55]), ([58, 65, 69, 72], [53, None]),
    ([55, 62, 65, 69], [55, 57]), ([57, 64, 67, 71], [52, 50]),
    ([58, 65, 69, 72], [53, 52]), ([55, 62, 65, 69], [55, 53]),
    ([57, 64, 67, 71], [52, None]), ([50, 57, 65, 69], [50, None]),
]


def read_wav(path):
    with wave.open(str(path)) as f:
        assert f.getframerate() == RATE and f.getsampwidth() == 2
        signal = np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').astype(np.float64) / 32768
        return signal.reshape(-1, f.getnchannels()).mean(axis=1)


def convert_to_wav(source, target):
    subprocess.run(['afconvert', str(source), str(target), '-f', 'WAVE', '-d', 'LEI16@44100'], check=True)
    return read_wav(target)


def measured_pitch(signal, midi):
    expected = 440 * 2 ** ((midi - 69) / 12)
    pitches = []
    size = 8192
    for start in range(int(.4 * RATE), len(signal) - size - int(.3 * RATE), size // 2):
        frame = signal[start:start + size] * np.hanning(size)
        spectrum = np.fft.rfft(frame, size * 2)
        correlation = np.fft.irfft(spectrum * spectrum.conjugate())[:size]
        lo, hi = int(RATE / (expected * 1.1)), int(RATE / (expected * .9))
        lag = lo + np.argmax(correlation[lo:hi])
        a, b, c = correlation[lag - 1:lag + 2]
        lag += .5 * (a - c) / (a - 2 * b + c)
        pitches.append(RATE / lag)
    return float(np.median(pitches))


def tune(signal, source_freq, midi):
    # Small tuning correction only. Every cello pitch has its own recorded note;
    # the piano is sampled every whole tone, so its gaps are at most a semitone.
    ratio = (440 * 2 ** ((midi - 69) / 12)) / source_freq
    assert .9 < ratio < 1.1, (midi, ratio)
    return np.interp(np.arange(0, len(signal) - 1, ratio), np.arange(len(signal)), signal)


def main():
    source = Path(sys.argv[1])
    output = ROOT / 'public/sounds/crowfield'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='crowfield-music-') as work:
        work = Path(work)
        raw = convert_to_wav(source, work / 'cello.wav')
        raw -= np.median(raw)  # remove the recording's small DC offset
        cellos = {}
        for midi, (begin, end) in CELLO_REGIONS.items():
            sample = raw[int(begin * RATE):int(end * RATE)].copy()
            freq = measured_pitch(sample, midi)
            sample = tune(sample, freq, midi)
            sample *= .105 / np.sqrt(np.mean(sample ** 2))
            cellos[midi] = sample
            print(f'Cello {midi}: recorded {freq:.2f} Hz, {len(sample) / RATE:.2f}s')
        pianos = {
            midi: convert_to_wav(ROOT / f'public/sounds/piano/{midi}.m4a', work / f'piano-{midi}.wav')
            for midi in PIANO_FREQ
        }
        duration = 1.2 + len(SCORE) * 4 * BEAT + 7
        mix = np.zeros((int(duration * RATE), 2))

        def add(sample, start, gain, pan, max_duration):
            signal = sample[:int(max_duration * RATE)].copy()
            attack = min(int(.015 * RATE), len(signal))
            release = min(int(.38 * RATE), len(signal) // 3)
            signal[:attack] *= np.linspace(0, 1, attack)
            signal[-release:] *= np.linspace(1, 0, release)
            offset = int(start * RATE)
            signal = signal[:len(mix) - offset]
            stereo = np.array([np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)])
            mix[offset:offset + len(signal)] += signal[:, None] * stereo * gain

        for bar, (chord, melody) in enumerate(SCORE):
            start = 1.2 + bar * 4 * BEAT
            for index, (beat, midi) in enumerate(zip([0, .045, 1.5, 2.5], chord)):
                snap = midi if midi % 2 == 0 else midi + 1
                sample = tune(pianos[snap], PIANO_FREQ[snap], midi)
                add(sample, start + beat * BEAT, [.27, .19, .16, .13][index], .18, 4.7)
            for index, midi in enumerate(melody):
                if midi is not None:
                    add(cellos[midi], start + index * 2 * BEAT + .045, .82 if index == 0 else .68, -.12, 2 * BEAT)
        # Leave a natural breath at the loop boundary; both ends are silent.
        peak = float(abs(mix).max())
        if peak > .72:
            mix *= .72 / peak
        wav = work / 'rainward.wav'
        with wave.open(str(wav), 'wb') as f:
            f.setnchannels(2)
            f.setsampwidth(2)
            f.setframerate(RATE)
            f.writeframes((mix * 32767).astype('<i2').tobytes())
        subprocess.run(['afconvert', str(wav), str(output / 'rainward.m4a'), '-f', 'm4af', '-d', 'aac', '-b', '160000'], check=True)
        print(f'Rendered {duration:.2f}s, peak {abs(mix).max():.3f}, RMS {np.sqrt(np.mean(mix ** 2)):.4f}')


if __name__ == '__main__':
    main()
