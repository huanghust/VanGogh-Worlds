// A complete arrangement made from recorded instruments, on its own gain bus.
// Loading or a failed request never falls back to synthesized instrument tones.
export class RecordedMusic {
  private gain: GainNode
  private source: AudioBufferSourceNode | null = null
  private loading: Promise<void> | null = null
  private active = false
  private ctx: AudioContext
  private url: string

  constructor(ctx: AudioContext, destination: AudioNode, url: string) {
    this.ctx = ctx
    this.url = url
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(destination)
  }

  setActive(active: boolean) {
    this.active = active
    this.gain.gain.setTargetAtTime(active ? 0.65 : 0, this.ctx.currentTime, 0.8)
    if (active && !this.source && !this.loading) {
      this.loading = this.load().finally(() => { this.loading = null })
    }
  }

  private async load() {
    try {
      const response = await fetch(this.url)
      if (!response.ok) return
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer())
      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(this.gain)
      // A map switch during the download must not make this track audible.
      this.gain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.gain.gain.setValueAtTime(0, this.ctx.currentTime)
      this.gain.gain.setTargetAtTime(this.active ? 0.65 : 0, this.ctx.currentTime, 0.8)
      source.start()
      this.source = source
    } catch {
      // Keep the rain audible; allow another try when Map 3 is entered again.
    }
  }
}
