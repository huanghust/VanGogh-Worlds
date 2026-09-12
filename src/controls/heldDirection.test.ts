import { describe, expect, it } from 'vitest'
import { HeldDirection } from './heldDirection'
import { MovementStick } from './movementStick'

describe('two-thumb flight', () => {
  it('moves and changes height independently; releasing either finger preserves the other', () => {
    const flight = new HeldDirection()
    const movement = new MovementStick()
    movement.start('left', { x: 0, y: 0 }, 40)
    movement.move('left', { x: 0, y: -40 })
    flight.start('right', 1)
    expect(movement.value.y).toBe(-1)
    expect(flight.value).toBe(1)
    flight.end('left')
    expect(flight.value).toBe(1)
    flight.end('right')
    expect(flight.value).toBe(0)
    expect(movement.value.y).toBe(-1)
  })

  it('ignores a competing finger and stops on cancellation or a menu interruption', () => {
    const flight = new HeldDirection()
    flight.start('up', 1)
    expect(flight.start('down', -1)).toBe(false)
    flight.reset()
    expect(flight.value).toBe(0)
    flight.start('new', -1)
    flight.end('up')
    expect(flight.value).toBe(-1)
    flight.end('new')
    expect(flight.value).toBe(0)
  })
})
