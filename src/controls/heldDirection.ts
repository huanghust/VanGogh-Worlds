// Movement and height have separate owners so two thumbs can work together.
export class HeldDirection {
  private owner: string | null = null
  value = 0

  start(owner: string, direction: number) {
    if (this.owner !== null) return false
    this.owner = owner
    this.value = direction
    return true
  }

  end(owner: string) {
    if (owner === this.owner) this.reset()
  }

  reset() {
    this.owner = null
    this.value = 0
  }
}
