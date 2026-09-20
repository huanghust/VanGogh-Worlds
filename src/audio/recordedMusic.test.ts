import { afterEach, expect, it, vi } from 'vitest'
import { RecordedMusic } from './recordedMusic'

afterEach(() => vi.unstubAllGlobals())
function setup() {
  const gain = { gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() }, connect: vi.fn() }
  const source = { connect: vi.fn(), start: vi.fn(), buffer: null, loop: false }
  const destination = {} as AudioNode
  const ctx = { currentTime: 0, createGain: () => gain, createBufferSource: vi.fn(() => source), decodeAudioData: vi.fn(async () => ({})) }
  const track = new RecordedMusic(ctx as unknown as AudioContext, destination, '/sounds/crowfield/rainward.m4a')
  return { track, ctx, gain, source, destination }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const success = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })

it('loads lazily, creates one loop and routes through the shared mute destination', async () => {
  const fetch = vi.fn(async () => success())
  vi.stubGlobal('fetch', fetch)
  const { track, gain, source, destination } = setup()
  track.setActive(false)
  expect(fetch).not.toHaveBeenCalled()
  track.setActive(true)
  track.setActive(true)
  await settle()
  track.setActive(true)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(source.start).toHaveBeenCalledTimes(1)
  expect(source.loop).toBe(true)
  expect(gain.connect).toHaveBeenCalledWith(destination)
})

it('stays muted if the player leaves Map 3 before the download finishes', async () => {
  let resolve!: (value: ReturnType<typeof success>) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done })))
  const { track, gain } = setup()
  track.setActive(true)
  track.setActive(false)
  resolve(success())
  await settle()
  expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.8)
})

it('allows a failed load to retry without substituting synthetic instruments', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(success())
  vi.stubGlobal('fetch', fetch)
  const { track, ctx } = setup()
  track.setActive(true)
  await settle()
  expect(ctx.createBufferSource).not.toHaveBeenCalled()
  track.setActive(false)
  track.setActive(true)
  await settle()
  expect(ctx.createBufferSource).toHaveBeenCalledTimes(1)
})
