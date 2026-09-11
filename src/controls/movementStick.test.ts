import { describe, expect, it } from 'vitest'
import { MovementStick } from './movementStick'

describe('two-handed movement', () => {
  it('keeps moving when the camera finger moves or releases', () => {
    const stick = new MovementStick()
    stick.start('left-thumb', { x: 100, y: 100 }, 40)
    stick.move('left-thumb', { x: 100, y: 60 })
    expect(stick.start('right-thumb', { x: 600, y: 100 }, 40)).toBe(false)
    expect(stick.move('right-thumb', { x: 650, y: 120 })).toBe(false)
    expect(stick.end('right-thumb')).toBe(false)
    expect(stick.value).toEqual({ x: 0, y: -1 })
    stick.end('left-thumb')
    expect(stick.value).toEqual({ x: 0, y: 0 })
  })

  it('stops on interruption and ignores the old finger after resuming', () => {
    const stick = new MovementStick()
    stick.start('old', { x: 0, y: 0 }, 40)
    stick.move('old', { x: 40, y: 0 })
    stick.reset() // menu, lost focus, or canceled touch
    expect(stick.active).toBe(false)
    expect(stick.value).toEqual({ x: 0, y: 0 })
    stick.start('new', { x: 100, y: 100 }, 40)
    stick.move('new', { x: 60, y: 100 })
    stick.end('old')
    expect(stick.value).toEqual({ x: -1, y: 0 })
  })

  it('allows gentle movement without drift or faster diagonal travel', () => {
    const stick = new MovementStick()
    stick.start('thumb', { x: 0, y: 0 }, 40)
    stick.move('thumb', { x: 2, y: 2 })
    expect(stick.value).toEqual({ x: 0, y: 0 })
    stick.move('thumb', { x: 20, y: 0 })
    expect(stick.value.x).toBeGreaterThan(0)
    expect(stick.value.x).toBeLessThan(1)
    stick.move('thumb', { x: 200, y: 200 })
    expect(Math.hypot(stick.value.x, stick.value.y)).toBeCloseTo(1)
  })
})
