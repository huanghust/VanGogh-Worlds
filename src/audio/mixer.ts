export const audioChannels = ['master', 'music', 'nature', 'effects'] as const
export type AudioChannel = typeof audioChannels[number]
export type AudioMix = Record<AudioChannel, { volume: number; muted: boolean }>
type Preferences = Pick<Storage, 'getItem' | 'setItem'>
const MIX_KEY = 'wheatfield-audio-mix'
const MUTE_KEY = 'wheatfield-muted'

function browserPreferences(): Preferences | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

// User volume sits after the scene's fades and modulation, so changing weather,
// songs, or paintings cannot overwrite a user's volume or mute preference.
export class AudioMixer {
  private mix: AudioMix = {
    master: { volume: 100, muted: false }, music: { volume: 100, muted: false },
    nature: { volume: 100, muted: false }, effects: { volume: 100, muted: false },
  }
  private ctx: AudioContext | null = null
  private buses = new Map<AudioChannel, GainNode>()

  private storage: Preferences | undefined

  constructor(storage = browserPreferences()) {
    this.storage = storage
    try {
      this.mix.master.muted = storage?.getItem(MUTE_KEY) === '1'
      const saved = JSON.parse(storage?.getItem(MIX_KEY) ?? 'null')
      for (const channel of audioChannels) {
        const value = saved?.[channel]
        if (typeof value?.volume === 'number' && Number.isFinite(value.volume)) this.mix[channel].volume = Math.round(Math.max(0, Math.min(100, value.volume)))
        if (typeof value?.muted === 'boolean') this.mix[channel].muted = value.muted
      }
    } catch { /* Unavailable or damaged storage must not prevent playback. */ }
  }

  snapshot(): AudioMix {
    return structuredClone(this.mix)
  }

  attach(ctx: AudioContext, destination: AudioNode) {
    if (this.ctx) return
    this.ctx = ctx
    for (const channel of audioChannels) {
      const bus = ctx.createGain()
      bus.gain.value = this.level(channel)
      this.buses.set(channel, bus)
      bus.connect(channel === 'master' ? destination : this.input('master'))
    }
  }

  input(channel: AudioChannel): GainNode {
    const bus = this.buses.get(channel)
    if (!bus) throw new Error('Audio mixer has not been attached')
    return bus
  }

  setVolume(channel: AudioChannel, volume: number): AudioMix {
    if (!Number.isFinite(volume)) return this.snapshot()
    this.mix[channel].volume = Math.round(Math.max(0, Math.min(100, volume)))
    // Adjusting a muted channel is an explicit request to hear it again.
    this.mix[channel].muted = false
    return this.apply(channel)
  }

  toggleMute(channel: AudioChannel): AudioMix {
    this.mix[channel].muted = !this.mix[channel].muted
    return this.apply(channel)
  }

  private level(channel: AudioChannel) {
    return this.mix[channel].muted ? 0 : this.mix[channel].volume / 100
  }

  private apply(channel: AudioChannel) {
    if (this.ctx) this.buses.get(channel)?.gain.setTargetAtTime(this.level(channel), this.ctx.currentTime, 0.05)
    try {
      this.storage?.setItem(MIX_KEY, JSON.stringify(this.mix))
      this.storage?.setItem(MUTE_KEY, this.mix.master.muted ? '1' : '0')
    } catch { /* The controls still work when browser storage is disabled. */ }
    return this.snapshot()
  }
}
