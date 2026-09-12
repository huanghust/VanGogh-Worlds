import { expect, it, vi } from 'vitest'
import { watchPointerUnlock } from './pointerUnlock'

it('opens the menu on a browser unlock even when no Escape key event arrives', () => {
  const doc = Object.assign(new EventTarget(), { pointerLockElement: null as Element | null })
  const menu = vi.fn()
  const stop = watchPointerUnlock(doc, menu)
  doc.dispatchEvent(new Event('pointerlockchange'))
  expect(menu).not.toHaveBeenCalled()
  doc.pointerLockElement = {} as Element
  doc.dispatchEvent(new Event('pointerlockchange'))
  expect(menu).not.toHaveBeenCalled()
  doc.pointerLockElement = null
  doc.dispatchEvent(new Event('pointerlockchange'))
  doc.dispatchEvent(new Event('pointerlockchange'))
  expect(menu).toHaveBeenCalledTimes(1)
  stop()
  doc.pointerLockElement = {} as Element
  doc.dispatchEvent(new Event('pointerlockchange'))
  doc.pointerLockElement = null
  doc.dispatchEvent(new Event('pointerlockchange'))
  expect(menu).toHaveBeenCalledTimes(1)
})
