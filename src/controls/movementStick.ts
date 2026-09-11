type Point = { x: number; y: number }

// One finger owns movement until it releases. Camera touches cannot steal or
// reset that finger, and both the visible pad and left-screen swipes share it.
export class MovementStick {
  private owner: string | null = null
  private origin: Point = { x: 0, y: 0 }
  private radius = 1
  value: Point = { x: 0, y: 0 }

  get active() { return this.owner !== null }

  start(id: string, origin: Point, radius: number) {
    if (this.active) return false
    this.owner = id
    this.origin = origin
    this.radius = radius
    return true
  }

  move(id: string, point: Point) {
    if (this.owner !== id) return false
    const dx = point.x - this.origin.x
    const dy = point.y - this.origin.y
    const distance = Math.hypot(dx, dy)
    // A small dead zone lets the thumb rest without making the bird drift.
    const strength = Math.min(1, Math.max(0, (distance - 4) / (this.radius - 4)))
    this.value = distance > 0
      ? { x: dx / distance * strength, y: dy / distance * strength }
      : { x: 0, y: 0 }
    return true
  }

  end(id: string) {
    if (this.owner !== id) return false
    this.reset()
    return true
  }

  reset() {
    this.owner = null
    this.value = { x: 0, y: 0 }
  }
}
