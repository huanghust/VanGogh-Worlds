import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { HeldDirection } from './heldDirection'

export function FlightButtons({ input, upLabel, downLabel, onLift }: {
  input: React.MutableRefObject<HeldDirection>
  upLabel: string
  downLabel: string
  onLift: () => void
}) {
  const [active, setActive] = useState(0)
  const lift = useRef(onLift)
  useEffect(() => { lift.current = onLift }, [onLift])
  useEffect(() => {
    const held = input.current
    const reset = () => { held.reset(); setActive(0) }
    const visibility = () => { if (document.hidden) reset() }
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      held.reset()
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [input])

  const start = (owner: string, direction: number) => {
    if (!input.current.start(owner, direction)) return false
    lift.current()
    setActive(direction)
    return true
  }
  const end = (owner: string) => {
    input.current.end(owner)
    setActive(input.current.value)
  }

  return (
    <div data-ui className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-30 flex flex-col items-center gap-3">
      {[1, -1].map((direction) => (
        <button
          key={direction}
          data-ui
          type="button"
          aria-label={direction === 1 ? upLabel : downLabel}
          title={direction === 1 ? upLabel : downLabel}
          data-active={active === direction}
          className="flex h-16 w-16 shrink-0 touch-none items-center justify-center rounded-full border border-[#f5e6bd]/60 bg-[#0d1530]/45 text-[#f5e6bd] transition-colors data-[active=true]:bg-[#f5e6bd]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e6bd]"
          onPointerDown={(e) => {
            if (e.button !== 0 || !start(`pointer:${e.pointerId}`, direction)) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerUp={(e) => end(`pointer:${e.pointerId}`)}
          onPointerCancel={(e) => end(`pointer:${e.pointerId}`)}
          onLostPointerCapture={(e) => end(`pointer:${e.pointerId}`)}
          onKeyDown={(e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return
            e.preventDefault()
            e.stopPropagation()
            if (!e.repeat) start(`key:${e.key}`, direction)
          }}
          onKeyUp={(e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return
            e.preventDefault()
            e.stopPropagation()
            end(`key:${e.key}`)
          }}
          onBlur={() => { input.current.reset(); setActive(0) }}
        >
          {direction === 1
            ? <ChevronUp size={28} className="pointer-events-none" aria-hidden="true" />
            : <ChevronDown size={28} className="pointer-events-none" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}
