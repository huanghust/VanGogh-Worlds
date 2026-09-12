import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatViewport } from './chatViewport'

function setup() {
  vi.useFakeTimers()
  const viewport = Object.assign(new EventTarget(), { width: 1024, height: 768, offsetLeft: 0, offsetTop: 0 })
  const win = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    innerWidth: 1024, innerHeight: 768,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  })
  const scene = { clientWidth: 1024, clientHeight: 768, style: { width: '', height: '', transform: '' } }
  const bar = { style: { left: '', top: '', bottom: '', width: '', transform: '' } }
  const controller = new ChatViewport(scene as HTMLElement, () => bar as HTMLElement, win as unknown as Window)
  return { viewport, win, scene, bar, controller }
}

afterEach(() => vi.useRealTimers())

describe('chat keyboard viewport', () => {
  it('keeps the scene size and visible origin stable as the keyboard pans the viewport', () => {
    const { viewport, scene, bar, controller } = setup()
    controller.open()
    viewport.height = 420
    viewport.offsetTop = 180
    viewport.dispatchEvent(new Event('resize'))
    expect(scene.style.height).toBe('768px')
    expect(scene.style.width).toBe('1024px')
    // 180px compensation - 180px browser pan = unchanged visible scene origin.
    expect(scene.style.transform).toBe('translate(0px, 180px)')
    expect(bar.style.top).toBe('600px')
    expect(bar.style.transform).toBe('translateY(-100%)')
    controller.dispose()
  })

  it('waits through keyboard dismissal and then restores normal responsive sizing', () => {
    const { viewport, scene, controller } = setup()
    controller.open()
    viewport.height = 420
    viewport.offsetTop = 180
    viewport.dispatchEvent(new Event('resize'))
    controller.close()
    expect(scene.style.height).toBe('768px')
    viewport.height = 768
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
    expect(scene.style.height).toBe('')
    expect(scene.style.transform).toBe('')
    controller.dispose()
  })

  it('handles real layout resizing, missing viewport events, and cleanup', () => {
    const { viewport, win, scene, controller } = setup()
    controller.open()
    win.innerWidth = 1180
    win.innerHeight = 820
    viewport.width = 1180
    viewport.height = 460
    win.dispatchEvent(new Event('resize'))
    expect(scene.style.width).toBe('1180px')
    expect(scene.style.height).toBe('820px')
    controller.close()
    vi.advanceTimersByTime(1000)
    expect(scene.style.height).toBe('')
    controller.dispose()
    viewport.dispatchEvent(new Event('resize'))
    expect(scene.style.transform).toBe('')
  })
})
