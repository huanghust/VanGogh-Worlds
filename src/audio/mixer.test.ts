import { expect, it, vi } from 'vitest'
import { AudioMixer, audioChannels } from './mixer'

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
function graph() {
  const ctx = { currentTime: 10, createGain: () => ({ gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() }) }
  return { ctx: ctx as unknown as AudioContext, destination: {} as AudioNode }
}

it('applies saved levels before audio starts and routes each category through overall volume', () => {
  const prefs = storage()
  const before = new AudioMixer(prefs)
  before.setVolume('master', 60)
  before.setVolume('music', 35)
  before.toggleMute('nature')
  const mixer = new AudioMixer(prefs)
  const { ctx, destination } = graph()
  mixer.attach(ctx, destination)
  expect(mixer.input('master').gain.value).toBe(0.6)
  expect(mixer.input('music').gain.value).toBe(0.35)
  expect(mixer.input('nature').gain.value).toBe(0)
  expect(mixer.input('effects').gain.value).toBe(1)
  expect(mixer.input('master').connect).toHaveBeenCalledWith(destination)
  for (const channel of ['music', 'nature', 'effects'] as const) expect(mixer.input(channel).connect).toHaveBeenCalledWith(mixer.input('master'))
})

it('mutes one channel independently, preserves its level, and restores it smoothly', () => {
  const mixer = new AudioMixer(storage())
  const { ctx, destination } = graph()
  mixer.attach(ctx, destination)
  mixer.setVolume('music', 42)
  mixer.toggleMute('music')
  expect(mixer.input('music').gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 10, 0.05)
  mixer.toggleMute('master')
  expect(mixer.snapshot().music).toEqual({ volume: 42, muted: true })
  mixer.toggleMute('master')
  expect(mixer.snapshot().music.muted).toBe(true)
  mixer.toggleMute('music')
  expect(mixer.input('music').gain.setTargetAtTime).toHaveBeenLastCalledWith(0.42, 10, 0.05)
  expect(mixer.input('nature').gain.setTargetAtTime).not.toHaveBeenCalled()
  expect(mixer.input('effects').gain.setTargetAtTime).not.toHaveBeenCalled()
})

it('retains old global mute and tolerates blocked or malformed browser storage', () => {
  expect(new AudioMixer(storage({ 'wheatfield-muted': '1', 'wheatfield-audio-mix': '{broken' })).snapshot().master.muted).toBe(true)
  const blocked = new AudioMixer({ getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
  expect(() => blocked.setVolume('music', 20)).not.toThrow()
  expect(blocked.snapshot().music.volume).toBe(20)
})

it('bounds persisted and live volume values, accepts silence, and ignores invalid numbers', () => {
  const mixer = new AudioMixer(storage({ 'wheatfield-audio-mix': JSON.stringify({ music: { volume: 200 }, nature: { volume: -50 }, master: { muted: 'false' } }) }))
  expect(mixer.snapshot().music.volume).toBe(100)
  expect(mixer.snapshot().nature.volume).toBe(0)
  expect(mixer.snapshot().master.muted).toBe(false)
  mixer.toggleMute('music')
  mixer.setVolume('music', 0)
  mixer.setVolume('music', NaN)
  expect(mixer.snapshot().music).toEqual({ volume: 0, muted: false })
  for (const channel of audioChannels) expect(mixer.snapshot()[channel].volume).toBeLessThanOrEqual(100)
  const snapshot = mixer.snapshot()
  snapshot.master.volume = 5
  expect(mixer.snapshot().master.volume).toBe(100)
})
