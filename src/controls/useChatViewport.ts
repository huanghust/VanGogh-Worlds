import { useLayoutEffect, useRef } from 'react'
import { ChatViewport } from './chatViewport'

export function useChatViewport(open: boolean) {
  const scene = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const viewport = useRef<ChatViewport | null>(null)

  useLayoutEffect(() => {
    if (!scene.current) return
    const controller = new ChatViewport(scene.current, () => composer.current, window)
    viewport.current = controller
    return () => { controller.dispose(); viewport.current = null }
  }, [])

  useLayoutEffect(() => {
    if (open) {
      viewport.current?.open()
      input.current?.focus({ preventScroll: true })
    } else {
      viewport.current?.close()
    }
  }, [open])

  return { scene, composer, input }
}
