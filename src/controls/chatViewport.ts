export type Viewport = { width: number; height: number; offsetLeft: number; offsetTop: number }
type SceneSize = { width: number; height: number }

// Keep the camera's aspect ratio and on-screen origin unchanged while only the
// composer follows the keyboard. No scrollTo/scrollIntoView calls are needed.
export function chatLayout(scene: SceneSize, viewport: Viewport) {
  return {
    sceneWidth: scene.width,
    sceneHeight: scene.height,
    sceneX: viewport.offsetLeft,
    sceneY: viewport.offsetTop,
    chatX: viewport.offsetLeft,
    chatBottom: viewport.offsetTop + viewport.height,
    chatWidth: viewport.width,
  }
}

export class ChatViewport {
  private sceneSize: SceneSize | null = null
  private baseline: Viewport | null = null
  private closing = false
  private closeTimer: number | undefined

  private readonly scene: HTMLElement
  private readonly composer: () => HTMLElement | null
  private readonly win: Window

  constructor(scene: HTMLElement, composer: () => HTMLElement | null, win: Window) {
    this.scene = scene
    this.composer = composer
    this.win = win
    win.visualViewport?.addEventListener('resize', this.sync)
    win.visualViewport?.addEventListener('scroll', this.sync)
    win.addEventListener('resize', this.sync)
  }

  private read(): Viewport {
    const v = this.win.visualViewport
    return {
      width: v?.width ?? this.win.innerWidth,
      height: v?.height ?? this.win.innerHeight,
      offsetLeft: v?.offsetLeft ?? 0,
      offsetTop: v?.offsetTop ?? 0,
    }
  }

  open() {
    this.win.clearTimeout(this.closeTimer)
    this.closing = false
    if (!this.sceneSize) {
      this.sceneSize = { width: this.scene.clientWidth, height: this.scene.clientHeight }
      this.baseline = this.read()
    }
    this.sync()
  }

  close() {
    if (!this.sceneSize) return
    this.closing = true
    this.sync()
    // Keep compensation through the keyboard's closing animation. Some Safari
    // versions omit its final viewport event, so always release the saved size.
    if (this.sceneSize) this.closeTimer = this.win.setTimeout(() => this.restore(), 1000)
  }

  private sync = () => {
    if (!this.sceneSize || !this.baseline) return
    const v = this.read()
    if (this.closing && v.height >= this.baseline.height - 2 && Math.abs(v.offsetTop - this.baseline.offsetTop) < 2) {
      this.restore()
      return
    }
    // A real window resize/rotation may change width; a keyboard normally only
    // changes the visual height. Respect that real layout change.
    if (Math.abs(this.win.innerWidth - this.sceneSize.width) > 2) {
      this.sceneSize = { width: this.win.innerWidth, height: this.win.innerHeight }
    }
    const layout = chatLayout(this.sceneSize, v)
    this.scene.style.width = `${layout.sceneWidth}px`
    this.scene.style.height = `${layout.sceneHeight}px`
    this.scene.style.transform = `translate(${layout.sceneX}px, ${layout.sceneY}px)`
    const bar = this.composer()
    if (bar) {
      bar.style.left = `${layout.chatX}px`
      bar.style.top = `${layout.chatBottom}px`
      bar.style.bottom = 'auto'
      bar.style.width = `${layout.chatWidth}px`
      bar.style.transform = 'translateY(-100%)'
    }
  }

  private restore() {
    this.win.clearTimeout(this.closeTimer)
    this.sceneSize = null
    this.baseline = null
    this.closing = false
    this.scene.style.width = ''
    this.scene.style.height = ''
    this.scene.style.transform = ''
  }

  dispose() {
    this.restore()
    this.win.visualViewport?.removeEventListener('resize', this.sync)
    this.win.visualViewport?.removeEventListener('scroll', this.sync)
    this.win.removeEventListener('resize', this.sync)
  }
}
