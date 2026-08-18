// Procedural + sampled audio engine for the wheatfield.
// Wind is synthesized live (filtered noise) so it can breathe with the weather,
// your speed, and gust interactions; birds / crickets / crow caws are generated
// sample files in /public/sounds. Everything hangs off one lazily-created
// AudioContext that only starts after the "enter the painting" user gesture.

export type SkyMode = 'day' | 'dusk' | 'night'

const MUTE_KEY = 'wheatfield-muted'

// ---- per-painting songs ---------------------------------------------------
type Song = {
  eighth: number // seconds per eighth note (tempo)
  bars: { pad: number[]; bass: number }[]
  seqs: number[][] // broken-chord patterns, -1 = rest
  pent: number[] // melody pool
  melodyProb: number
  melodyRelease: number
  padVel: number
  arpVel: number
  melVel: number
  bassVel: number
  bassFifth: boolean // add a fifth in the bass on beat 3 (walking floor)
  voice: 'guitar' | 'piano' // the instrument every note is played on
}

const SONGS: Record<string, Song> = {
  // gold — slow autumn nostalgia in C (add9 / maj7 / sus colors), fingerpicked
  // on an acoustic guitar
  wheatfield: {
    eighth: 0.5, // 60 BPM
    bars: [
      { pad: [164.81, 196.0, 261.63, 293.66], bass: 65.41 }, // Cadd9
      { pad: [146.83, 196.0, 246.94], bass: 98.0 }, // G
      { pad: [196.0, 220.0, 261.63, 329.63], bass: 110.0 }, // Am7
      { pad: [174.61, 220.0, 261.63, 329.63], bass: 87.31 }, // Fmaj7
      { pad: [196.0, 261.63, 293.66, 329.63], bass: 65.41 }, // Cadd9, brighter
      { pad: [196.0, 246.94, 293.66], bass: 98.0 }, // G
      { pad: [220.0, 261.63, 329.63, 349.23], bass: 87.31 }, // Fmaj7, top climbs
      { pad: [196.0, 261.63, 293.66], bass: 98.0 }, // Gsus4 → home
    ],
    seqs: [
      [0, 1, 2, 3, 2, 1, 2, 3],
      [0, -1, 2, 1, 3, -1, 1, 2],
    ],
    pent: [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0], // G4 A4 C5 D5 E5 G5 A5
    melodyProb: 0.5,
    melodyRelease: 3.2,
    padVel: 0.45,
    arpVel: 0.4,
    melVel: 0.34,
    bassVel: 0.55,
    bassFifth: false,
    voice: 'guitar',
  },
  // green — lively pastoral in D on a grand piano: brisk flowing arpeggios, a
  // walking bass, brighter pentatonic. Bustling, but every note still harmonizes.
  auvers: {
    eighth: 0.32, // ~94 BPM
    bars: [
      { pad: [185.0, 220.0, 293.66, 329.63], bass: 73.42 }, // Dadd9
      { pad: [220.0, 246.94, 293.66, 369.99], bass: 123.47 }, // Bm7
      { pad: [196.0, 246.94, 293.66, 369.99], bass: 98.0 }, // Gmaj7
      { pad: [220.0, 277.18, 329.63], bass: 110.0 }, // A
      { pad: [220.0, 293.66, 369.99], bass: 92.5 }, // D/F#
      { pad: [246.94, 293.66, 392.0], bass: 98.0 }, // G
      { pad: [246.94, 293.66, 329.63, 392.0], bass: 82.41 }, // Em7
      { pad: [220.0, 293.66, 329.63], bass: 110.0 }, // Asus4 → home
    ],
    seqs: [
      [0, 1, 2, 3, 4, 3, 2, 1],
      [0, 2, 1, 3, 2, 4, 3, 1],
    ],
    pent: [369.99, 440.0, 493.88, 554.37, 587.33, 659.25, 739.99, 880.0], // F#4 A4 B4 C#5 D5 E5 F#5 A5
    melodyProb: 0.6,
    melodyRelease: 2.2,
    padVel: 0.4,
    arpVel: 0.42,
    melVel: 0.36,
    bassVel: 0.5,
    bassFifth: true,
    voice: 'piano',
  },
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private birdsGain: GainNode | null = null
  private sendBuffer: AudioBuffer | null = null
  private receiveBuffer: AudioBuffer | null = null
  private crowBuffer: AudioBuffer | null = null
  private nextCaw = 0 // crowfield: when the next crow calls (ctx time)
  // real guitar samples (University of Iowa MIS, anechoic classical guitar),
  // one per semitone C3..B5, keyed by MIDI number; null until loaded
  private guitarBuffers = new Map<number, AudioBuffer>()
  // measured fundamental of each sample (they were recorded on a guitar tuned
  // a hair flat) so playbackRate can pitch-correct onto the song's grid
  private static readonly GUITAR_SAMPLE_FREQ: Record<number, number> = {
    48: 128.5, 49: 135.9, 50: 144.7, 51: 152.8, 52: 162.8, 53: 172.3,
    54: 181.7, 55: 191.8, 56: 203.2, 57: 215.3, 58: 231.5, 59: 244.9,
    60: 259.1, 61: 275.2, 62: 293.4, 63: 309.5, 64: 327.7, 65: 347.9,
    66: 367.4, 67: 388.9, 68: 410.5, 69: 438.1, 70: 469.0, 71: 494.6,
    72: 518.8, 73: 547.1, 74: 579.4, 75: 615.7, 76: 651.4, 77: 689.1,
    78: 730.8, 79: 775.9, 80: 819.6, 81: 866.7, 82: 919.2, 83: 977.7,
  }
  // real grand-piano samples (University of Iowa MIS — Steinway & Sons model
  // B, every note mezzoforte), one every whole tone D3..Ab5; gaps of one
  // semitone are closed with playbackRate. Keyed by MIDI number.
  private pianoBuffers = new Map<number, AudioBuffer>()
  private static readonly PIANO_SAMPLE_FREQ: Record<number, number> = {
    50: 147.0, 52: 165.2, 54: 185.4, 56: 208.3, 58: 233.5, 60: 262.1,
    62: 294.1, 64: 330.7, 66: 370.8, 68: 416.5, 70: 467.3, 72: 525.5,
    74: 588.8, 76: 661.5, 78: 741.5, 80: 835.8,
  }

  // procedural soundtrack: chord pads, broken chords, a sparse pentatonic
  // melody drifting on top — every note voiced per painting (guitar / piano)
  private musicBus: GainNode | null = null // notes land here (dry + delay send)
  private musicGain: GainNode | null = null // per-map music volume
  private musicWet: GainNode | null = null // hall send level, per-map
  private nextNoteTime = 0
  private step = 0 // eighth-note counter
  private melodyIdx = 3

  private started = false
  private muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
  private mode: SkyMode = 'day'
  private map = 'wheatfield'

  // live targets the per-frame-ish setters ease toward
  private gustBoost = 0 // decays after a gust click
  private motion = 0 // 0..1 from flight speed

  isMuted() {
    return this.muted
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.1)
    }
    return this.muted
  }

  // called from the "enter the painting" click — the one user gesture that
  // unlocks audio in every browser
  start() {
    if (this.started) {
      void this.ctx?.resume()
      return
    }
    this.started = true
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC()
    void this.ctx.resume()

    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    // hard limiter as the last stage: even if ANY synth ever misbehaves, the
    // worst anyone hears is loud — never a speaker-tearing screech
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.25
    this.master.connect(limiter)
    limiter.connect(this.ctx.destination)

    this.buildWind()
    this.buildMusic()
    this.applyMusicMode() // honor the map that was set before the ctx existed
    void this.loadAmbience()
  }

  // ---- procedural soundtrack ---------------------------------------------
  private buildMusic() {
    const ctx = this.ctx!

    this.musicBus = ctx.createGain()
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0 // faded in by applyMusicMode when on the gold map

    // gentle hall: feedback delay, so single notes bloom like in a room.
    // the fast green song gets less of it — too much bloom turns 94 BPM
    // arpeggios into fog
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.34
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.3
    this.musicWet = wet

    this.musicBus.connect(this.musicGain)
    this.musicBus.connect(delay)
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(this.musicGain)
    this.musicGain.connect(this.master!)

    this.nextNoteTime = ctx.currentTime + 0.15
    this.step = 0
    window.setInterval(() => this.scheduleAhead(), 200) // engine lives as long as the page
  }

  private scheduleAhead() {
    const ctx = this.ctx
    if (!ctx || !this.musicBus) return
    const song = SONGS[this.map] ?? SONGS.wheatfield
    while (this.nextNoteTime < ctx.currentTime + 0.6) {
      this.scheduleStep(this.step, this.nextNoteTime, song)
      this.step++
      this.nextNoteTime += song.eighth
    }
  }

  // acoustic guitar — REAL samples now: single notes from the University of
  // Iowa MIS studio (a Raimundo classical guitar recorded in an anechoic
  // chamber — actual wood and nylon, nothing plugged in). Each note snaps to
  // the nearest semitone sample and playbackRate closes the ≤50-cent gap,
  // also correcting the source guitar's slightly flat tuning onto our grid.
  // The old Karplus-Strong synth below survives only as the fallback while
  // the 36 sample files (1.7 MB total) are still loading.
  private playGuitar(freq: number, t: number, release: number, vel: number) {
    const ctx = this.ctx!
    if (this.guitarBuffers.size === 0) {
      this.playGuitarKS(freq, t, release, vel)
      return
    }
    const midi = 69 + 12 * Math.log2(freq / 440)
    const m = Math.max(48, Math.min(83, Math.round(midi)))
    const buf = this.guitarBuffers.get(m)
    const baseFreq = AudioEngine.GUITAR_SAMPLE_FREQ[m]
    if (!buf || !baseFreq) {
      this.playGuitarKS(freq, t, release, vel)
      return
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = freq / baseFreq // pitch-corrected semitone snap
    const g = ctx.createGain()
    g.gain.value = vel * 1.2 // nylon speaks softer than the Steinway — bring it forward
    src.connect(g)
    g.connect(this.musicBus!)
    src.start(t)
    src.onended = () => {
      src.disconnect()
      g.disconnect()
    }
  }

  // Karplus-Strong plucked string, PRECOMPUTED sample by sample into a buffer
  // (a buffer cannot feed back, so it can never howl — the live feedback-loop
  // version did, at ~3 kHz, and we do not speak of it). Kept as the loading
  // fallback for the real guitar samples.
  private playGuitarKS(freq: number, t: number, release: number, vel: number) {
    const ctx = this.ctx!
    const sr = ctx.sampleRate
    const N = Math.max(2, Math.round(sr / freq)) // string length in samples
    const len = Math.floor(sr * (release + 0.3))
    const buf = ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    const ring = new Float32Array(N)
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1
    for (let i = 1; i < N; i++) ring[i] = 0.5 * ring[i] + 0.5 * ring[i - 1] // fingertip, not a pick
    const decay = Math.exp(Math.log(0.01) / (sr * release)) // per-sample gain → 1% after release
    let idx = 0
    for (let n = 0; n < len; n++) {
      const cur = ring[idx]
      ring[idx] = decay * (0.9 * cur + 0.1 * ring[(idx + 1) % N])
      d[n] = cur
      idx = (idx + 1) % N
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const body = ctx.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.value = 130 // the guitar body's main wood resonance
    body.Q.value = 1.1
    body.gain.value = 4
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200 // only shave the digital edge — the sparkle stays
    lp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = vel * 0.6
    src.connect(body)
    body.connect(lp)
    lp.connect(g)
    g.connect(this.musicBus!)
    src.start(t)
    window.setTimeout(
      () => [src, body, lp, g].forEach((n) => n.disconnect()),
      Math.max(0, (t - ctx.currentTime + release + 1) * 1000)
    )

    // pick snap: 12 ms of bright noise at the attack — the fingertip/nail
    // leaving the string, the detail white-noise excitation alone can't make
    if (this.noiseBuf) {
      const snap = ctx.createBufferSource()
      snap.buffer = this.noiseBuf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3200
      bp.Q.value = 0.8
      const sg = ctx.createGain()
      sg.gain.setValueAtTime(vel * 0.22, t)
      sg.gain.setTargetAtTime(0, t, 0.006)
      snap.connect(bp)
      bp.connect(sg)
      sg.connect(this.musicBus!)
      snap.start(t, Math.random())
      snap.stop(t + 0.03)
      window.setTimeout(() => [snap, bp, sg].forEach((n) => n.disconnect()), Math.max(0, (t - ctx.currentTime + 0.5) * 1000))
    }
  }

  // grand piano — REAL samples now: a Steinway model B from the University
  // of Iowa MIS studio, one mf recording per whole tone; each note snaps to
  // the nearest sample (≤1 semitone) and playbackRate closes the gap. The
  // additive synth below survives only as the fallback while the 16 sample
  // files (1.2 MB total) are still loading.
  private playPiano(freq: number, t: number, release: number, vel: number, attack = 0.008) {
    const ctx = this.ctx!
    if (this.pianoBuffers.size === 0) {
      this.playPianoSynth(freq, t, release, vel, attack)
      return
    }
    const midi = 69 + 12 * Math.log2(freq / 440)
    const m = Math.max(50, Math.min(81, Math.round(midi)))
    const snap = m % 2 === 0 ? m : m + (m >= 80 ? -1 : 1) // samples sit on even midis
    const buf = this.pianoBuffers.get(snap)
    const baseFreq = AudioEngine.PIANO_SAMPLE_FREQ[snap]
    if (!buf || !baseFreq) {
      this.playPianoSynth(freq, t, release, vel, attack)
      return
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = freq / baseFreq
    // brightness shelf: mf samples played soft can read "cloudy" — a little
    // air above 2.4 kHz brings the hammer sparkle back
    const shelf = ctx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 2400
    shelf.gain.value = 3
    const g = ctx.createGain()
    g.gain.setValueAtTime(vel * 0.9, t)
    // tail gate: the raw samples ring for 4.5 s, but the song only allots
    // `release` seconds per note — closing the gate on schedule keeps fast
    // arpeggios from piling into mud
    g.gain.setTargetAtTime(0, t + release, 0.35)
    src.connect(shelf)
    shelf.connect(g)
    g.connect(this.musicBus!)
    src.start(t)
    src.onended = () => {
      src.disconnect()
      shelf.disconnect()
      g.disconnect()
    }
  }

  // additive piano synth — fallback only, until the real Steinway samples
  // have finished loading
  private playPianoSynth(freq: number, t: number, release: number, vel: number, attack = 0.008) {
    const ctx = this.ctx!
    // a piano hammer never swells — pads and bass get the same percussive
    // attack as the melody, or the chords read as a synth pad ("electro")
    attack = Math.min(attack, 0.012)
    // hammer noise: a 3 ms pick of bright noise hiding under the note's attack
    if (this.noiseBuf) {
      const ham = ctx.createBufferSource()
      ham.buffer = this.noiseBuf
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1500
      const hg = ctx.createGain()
      hg.gain.setValueAtTime(vel * 0.18, t)
      hg.gain.setTargetAtTime(0, t, 0.002)
      ham.connect(hp)
      hp.connect(hg)
      hg.connect(this.musicBus!)
      ham.start(t, Math.random())
      ham.stop(t + 0.02)
      window.setTimeout(() => [ham, hp, hg].forEach((n) => n.disconnect()), Math.max(0, (t - ctx.currentTime + 0.5) * 1000))
    }
    const amps = [1, 0.5, 0.26, 0.13, 0.07, 0.035]
    const relMul = [1, 0.7, 0.5, 0.35, 0.25, 0.18]
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4200
    lp.connect(this.musicBus!)
    amps.forEach((amp, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq * (i + 1)
      const g = ctx.createGain()
      const peak = Math.max(0.0001, vel * 0.5 * amp)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, t + release * relMul[i])
      o.connect(g)
      g.connect(lp)
      o.start(t)
      o.stop(t + release * relMul[i] + 0.1)
    })
    window.setTimeout(() => lp.disconnect(), Math.max(0, (t - ctx.currentTime + release + 1) * 1000))
  }

  private playNote(
    freq: number,
    time: number,
    release: number,
    vel: number,
    attack = 0.012,
    voice: 'guitar' | 'piano' = 'piano'
  ) {
    // humanize — a machine playing exactly on the grid sounds dead
    const t = time + (Math.random() * 0.012 - 0.006)
    const f = freq * Math.pow(2, (Math.random() * 6 - 3) / 1200)
    if (voice === 'guitar') this.playGuitar(f, t, release, vel)
    else this.playPiano(f, t, release, vel, attack)
  }

  // a hand strumming across the strings: the chord lands as a quick roll
  // (low → high, ~30 ms between strings, first strings a touch stronger),
  // not as a robotic block chord. Occasional up-strums keep it human.
  private strum(notes: number[], t: number, release: number, vel: number) {
    const up = Math.random() < 0.18
    const ordered = up ? [...notes].reverse() : notes
    ordered.forEach((f, i) => {
      const gap = 0.024 + Math.random() * 0.011 // 24–35 ms per string
      const v = vel * (0.85 + Math.random() * 0.25) * (1 - i * 0.045)
      this.playNote(f, t + i * gap, release - i * 0.06, v, 0.012, 'guitar')
    })
  }

  private scheduleStep(step: number, t: number, song: Song) {
    const bar = Math.floor(step / 8) % song.bars.length
    const chord = song.bars[bar]

    if (step % 8 === 0) {
      this.playNote(chord.bass * 2, t, song.eighth * 9, song.bassVel, 0.03, song.voice)
      // guitar: the downbeat chord is strummed; piano keeps its block chord
      if (song.voice === 'guitar') this.strum(chord.pad, t, song.eighth * 8.5, song.padVel)
      else for (const f of chord.pad) this.playNote(f, t, song.eighth * 8.5, song.padVel, 0.05, song.voice)
    }
    // guitar rhythm strumming — a folk hand pattern over the bar:
    // beat 2 gets a light brush, beat 3 a firmer one, the "and" of 3
    // sometimes flicks the top strings. Picks and thumb stay home.
    if (song.voice === 'guitar' && step % 8 === 2 && Math.random() < 0.5) {
      this.strum(chord.pad.slice(-3), t, song.eighth * 2.4, song.padVel * 0.4)
    }
    if (song.voice === 'guitar' && step % 8 === 4) {
      this.strum(chord.pad.slice(-3), t, song.eighth * 3.2, song.padVel * 0.62)
    }
    if (song.voice === 'guitar' && step % 8 === 6 && Math.random() < 0.55) {
      this.strum(chord.pad.slice(-3), t, song.eighth * 2, song.padVel * 0.38)
    }
    // the green song adds a fifth in the bass on beat 3 — a walking, bustling floor
    if (song.bassFifth && step % 8 === 4) {
      this.playNote(chord.bass * 3, t, song.eighth * 4, song.bassVel * 0.75, 0.02, song.voice)
    }

    // broken-chord picking — piano only; the guitar strums its rhythm instead
    const arp = [...chord.pad, ...chord.pad.map((f) => f * 2)]
    const seq = song.seqs[bar % song.seqs.length]
    const pick = seq[step % 8]
    if (pick >= 0 && song.voice === 'piano') this.playNote(arp[pick % arp.length], t, song.eighth * 3.8, song.arpVel, 0.012, song.voice)

    // melody — a random walk through the pentatonic, density set per song
    if (step % 2 === 0 && Math.random() < song.melodyProb) {
      const pent = song.pent
      this.melodyIdx = Math.max(0, Math.min(pent.length - 1, this.melodyIdx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.8 ? 1 : 2)))
      this.playNote(pent[this.melodyIdx], t, song.melodyRelease, song.melVel, 0.012, song.voice)
      // piano sparkle: a faint octave on top of the melody, like the dampers
      // lifting — keeps the line bright without making it louder
      if (song.voice === 'piano' && pent[this.melodyIdx] * 2 <= 880) {
        this.playNote(pent[this.melodyIdx] * 2, t + 0.008, song.melodyRelease * 0.6, song.melVel * 0.28, 0.012, song.voice)
      }
    }
  }

  // ---- synthesized wind -------------------------------------------------
  private buildWind() {
    const ctx = this.ctx!
    // 2s of looping white noise
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuf = buf // reused for one-shot gust whooshes

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true

    // band-pass "whoosh" whose center frequency slowly wanders (gusts of air)
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 400
    this.windFilter.Q.value = 0.6

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.11
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = 220
    lfo.connect(lfoAmt)
    lfoAmt.connect(this.windFilter.frequency)

    // second, slower LFO swells the volume like breathing
    const lfo2 = ctx.createOscillator()
    lfo2.frequency.value = 0.043
    const lfo2Amt = ctx.createGain()
    lfo2Amt.gain.value = 0.03

    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    lfo2.connect(lfo2Amt)
    lfo2Amt.connect(this.windGain.gain)

    src.connect(this.windFilter)
    this.windFilter.connect(this.windGain)
    this.windGain.connect(this.master!)
    src.start()
    lfo.start()
    lfo2.start()
  }

  // ---- sampled ambience ---------------------------------------------------
  private async load(url: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      return await this.ctx!.decodeAudioData(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  private async loadAmbience() {
    const ctx = this.ctx!
    const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
    const guitarNotes: number[] = []
    for (let m = 48; m <= 83; m++) guitarNotes.push(m) // C3..B5
    const pianoNotes: number[] = []
    for (let m = 50; m <= 80; m += 2) pianoNotes.push(m) // D3..Ab5, whole tones
    const [birds, send, receive, crow] = await Promise.all([
      this.load('/sounds/day-birds.mp3'),
      this.load('/sounds/send-chirp.mp3'),
      this.load('/sounds/receive-chirp.mp3'),
      this.load('/sounds/crow-caw.mp3'),
      // real guitar samples load in parallel with the rest; the KS synth
      // covers any note played before its sample arrives
      ...guitarNotes.map(async (m) => {
        const name = `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`
        const buf = await this.load(`/sounds/guitar/${name}.m4a`)
        if (buf) this.guitarBuffers.set(m, buf)
      }),
      // real Steinway samples; the additive synth covers the loading window
      ...pianoNotes.map(async (m) => {
        const buf = await this.load(`/sounds/piano/${m}.m4a`)
        if (buf) this.pianoBuffers.set(m, buf)
      }),
    ])
    this.sendBuffer = send
    this.receiveBuffer = receive
    this.crowBuffer = crow

    const loop = (buf: AudioBuffer | null) => {
      if (!buf) return null
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(g)
      g.connect(this.master!)
      src.start()
      return g
    }
    this.birdsGain = loop(birds)
    this.applyMode()
  }

  // ---- public API ---------------------------------------------------------

  setSkyMode(mode: SkyMode) {
    this.mode = mode
    this.applyMode()
  }

  // which painting the player is inside — picks the song and its instrument
  setMap(map: string) {
    this.map = map
    this.applyMusicMode()
    this.applyMode() // crowfield: sparrow ambience off, crow caws take over
  }

  private applyMusicMode() {
    if (!this.ctx || !this.musicGain) return
    const target = this.map === 'wheatfield' ? 0.5 : this.map === 'auvers' ? 0.34 : 0
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 1.5)
    // hall send per song: the slow gold song can swim a little; the lively
    // green one stays dry enough to hear every note
    const wet = this.map === 'wheatfield' ? 0.3 : this.map === 'auvers' ? 0.16 : 0.2
    this.musicWet?.gain.setTargetAtTime(wet, this.ctx.currentTime, 1.5)
  }

  private applyMode() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // day: birds sing · dusk: a few linger · night: piano + whisper of wind
    // crowfield: no sparrows here — the crows call instead (see tick())
    const birds = this.map === 'crowfield' ? 0 : { day: 0.35, dusk: 0.16, night: 0 }[this.mode]
    this.birdsGain?.gain.setTargetAtTime(birds, t, 1.2)
  }

  // wheat clicked — the wind swells for a moment, then settles
  gust() {
    this.gustBoost = Math.min(1, this.gustBoost + 0.9)
    this.playWhoosh()
  }

  // one-shot shaped "rrr-whoosh": band-passed noise sweeping upward as the
  // gust front arrives, then settling — distinct from the ambient wind bed
  private playWhoosh() {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noiseBuf) return
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.9 + Math.random() * 0.25

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.9
    bp.frequency.setValueAtTime(240, t)
    bp.frequency.exponentialRampToValueAtTime(980, t + 0.55)
    bp.frequency.exponentialRampToValueAtTime(300, t + 1.7)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9)

    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start(t, Math.random() * 1.2) // random offset into the 2s noise loop
    src.stop(t + 2)
  }

  // cypress clicked — sparrows burst out chirping, staggered like their
  // takeoff. Synthesized: each bird fires 2-3 quick swept chirps
  // (chi-chi-chi), no sample needed
  sparrowBurst(count = 5) {
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime
    for (let i = 0; i < count; i++) {
      const start = t0 + i * (0.08 + Math.random() * 0.2)
      const chirps = 2 + Math.floor(Math.random() * 2)
      const f0 = 3600 + Math.random() * 900
      for (let c = 0; c < chirps; c++) {
        const t = start + c * (0.1 + Math.random() * 0.03)
        const osc = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f0, t)
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + 0.03)
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.09)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.09 + Math.random() * 0.05, t + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
        osc.connect(g)
        g.connect(this.master)
        osc.start(t)
        osc.stop(t + 0.12)
      }
    }
  }

  // chat sounds — soft pops, kept well under the ambience
  private playBuf(buf: AudioBuffer | null, volume: number, rate = 1, delay = 0) {
    if (!this.ctx || !buf || !this.master) return
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    const g = this.ctx.createGain()
    g.gain.value = volume
    src.connect(g)
    g.connect(this.master)
    src.start(this.ctx.currentTime + delay)
  }

  // your own message went through — a soft blip, tucked under the music
  playSend() {
    this.playBuf(this.sendBuffer, 0.23)
  }

  // someone nearby said something — quieter, slightly pitched per call
  playReceive() {
    this.playBuf(this.receiveBuffer, 0.22, 0.95 + Math.random() * 0.15)
  }

  // called every frame from the scene — flight speed 0..1 and delta time
  tick(motion: number, delta: number) {
    this.motion = motion
    if (!this.ctx || !this.windGain) return

    // crowfield ambience: lone crows caw across the storm field — sparse,
    // uneven, sometimes answering themselves. Day + dusk; silent at night.
    if (this.map === 'crowfield' && this.crowBuffer && this.mode !== 'night') {
      const now = this.ctx.currentTime
      if (now >= this.nextCaw) {
        const vol = (this.mode === 'dusk' ? 0.16 : 0.24) * (0.8 + Math.random() * 0.4)
        this.playBuf(this.crowBuffer, vol, 0.92 + Math.random() * 0.2)
        if (Math.random() < 0.35) {
          // a second crow answers from across the field
          this.playBuf(this.crowBuffer, vol * 0.7, 0.85 + Math.random() * 0.15, 0.55 + Math.random() * 0.4)
        }
        this.nextCaw = now + 3.5 + Math.random() * 6
      }
    }

    this.gustBoost = Math.max(0, this.gustBoost - delta * 0.45)

    // wind base: calmer at night, louder in the day; flying fast adds whoosh.
    // on the music maps only a whisper of the old rustle stays (halved —
    // it was reading as static under the soundtrack)
    const mapFactor = this.map === 'wheatfield' ? 0.075 : this.map === 'auvers' ? 0.5 : 1
    const base = { day: 0.1, dusk: 0.085, night: 0.06 }[this.mode] * mapFactor
    const target = base + this.motion * 0.03 + this.gustBoost * 0.14
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35)
  }
}

export const audio = new AudioEngine()

// debug handle so automated tests can probe the live graph (ctx state, levels)
;(window as unknown as { __audio: AudioEngine }).__audio = audio
