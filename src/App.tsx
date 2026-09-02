import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Volume2, VolumeX, Settings, Bird } from 'lucide-react'
import { audio } from './audio/engine'
import { VanGoghSky } from './scene/VanGoghSky'
import { Ground } from './scene/Ground'
import { WheatField } from './scene/WheatField'
import { CypressTrees } from './scene/Cypress'
import { HillsAndVillage } from './scene/Hills'
import { Sparrows } from './scene/Sparrows'
import { BirdAvatar } from './scene/BirdAvatar'
import { Fences } from './scene/Fences'
import { Hedges } from './scene/Hedges'
import { Boulders } from './scene/Boulders'
import { Memorial } from './scene/Memorial'
import { Mountains } from './scene/Mountains'
import { Meadows } from './scene/Meadows'
import { Rain } from './scene/Rain'
import { PlayerControls, MIN_H, MAX_H, DEFAULT_H } from './scene/PlayerControls'
import { RemoteBirds } from './scene/RemoteBirds'
import { LeadFollower } from './scene/LeadFollower'
import { PerchController } from './scene/PerchController'
import type { PerchPoint } from './scene/perch'
import { FriendsPage, PerchBirdIcon } from './FriendsPage'
import {
  getPlayerId,
  apiHeartbeat,
  apiSay,
  apiFriendReq,
  apiFriendAnswer,
  apiFriendPoll,
  apiFriendName,
  apiLeadReq,
  apiLeadAnswer,
  apiLeadRelease,
  apiWarpLead,
  type PresenceState,
  type RemotePlayer,
  type FriendEntry,
} from './scene/presence'
import { FriendMenu, FriendConfirm, FriendNaming } from './FriendMenu'
import { MAPS, detectMap, saveMap, type MapId } from './scene/maps'
import { DICT, LANGS, detectLang, isCjk, type Lang, type LangKey } from './i18n'

// feeds flight speed into the audio engine every frame (wind whoosh)
function AudioMotion() {
  const prev = useRef(new THREE.Vector3())
  const smooth = useRef(0)
  useFrame((state, delta) => {
    const speed = state.camera.position.distanceTo(prev.current) / Math.max(delta, 1e-4)
    prev.current.copy(state.camera.position)
    const target = THREE.MathUtils.clamp(speed / 14, 0, 1)
    smooth.current += (target - smooth.current) * Math.min(1, delta * 4)
    audio.tick(smooth.current, delta)
  })
  return null
}

// reports our bird's position to the server ~3x per 2s so others can see us
// (server allows 5 heartbeats per 2s — keep a margin for jitter)
function PresenceHeartbeat({
  started,
  presenceRef,
  map,
  sitting,
}: {
  started: boolean
  presenceRef: React.MutableRefObject<PresenceState>
  map: MapId
  sitting: boolean // perched — friends see folded wings
}) {
  const lastErrLog = useRef(0)

  useEffect(() => {
    if (!started) return
    const id = getPlayerId()
    const tick = async () => {
      try {
        await apiHeartbeat(id, presenceRef.current, map, sitting)
      } catch (e) {
        // throttle: log at most once per 30s so the console isn't flooded
        if (Date.now() - lastErrLog.current > 30000) {
          lastErrLog.current = Date.now()
          console.error('[wheatfield] heartbeat failed (backend down?):', e)
        }
      }
    }
    tick()
    const t = window.setInterval(tick, 750)
    return () => window.clearInterval(t)
  }, [started, presenceRef, map, sitting])
  return null
}

// floating perch icons above nearby posts — they appear only when a perchable
// spot is close AND in view; re-reads the shared ref at ~8Hz
function PerchMarkers({ markersRef }: { markersRef: React.MutableRefObject<{ x: number; y: number; key: number }[]> }) {
  const [, force] = useState(0)
  useEffect(() => {
    const i = window.setInterval(() => force((n) => n + 1), 125)
    return () => window.clearInterval(i)
  }, [])
  return (
    <>
      {markersRef.current.map((m) => (
        <div
          key={m.key}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
          style={{ left: m.x, top: m.y - 8, filter: 'drop-shadow(0 1px 4px rgba(10,15,40,0.6))' }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#f5e6bd]/45 bg-[#0d1530]/55 text-[#f5e6bd]">
            <PerchBirdIcon size={18} />
          </div>
        </div>
      ))}
    </>
  )
}

// dedicated language page — search + scrollable list, same visual style as the menu
function LanguagePage({
  t,
  lang,
  onPick,
  onClose,
}: {
  t: (k: LangKey) => string
  lang: Lang
  onPick: (l: Lang) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const query = q.trim().toLowerCase()
  const list = LANGS.filter(
    (l) => !query || l.label.toLowerCase().includes(query) || l.en.toLowerCase().includes(query)
  )

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
        aria-label="back"
      >
        ‹
      </button>
      <div className="mt-20 mb-2 text-3xl">🌐</div>
      <h2 className="mb-6 text-xl tracking-[0.25em] text-[#f5e6bd]">{t('langPageTitle')}</h2>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('langSearchPlaceholder')}
        className="mb-6 w-full max-w-md rounded-full border border-[#f5e6bd]/40 bg-white/5 px-5 py-2.5 text-sm text-[#f5e6bd] placeholder-[#d8c48a]/40 outline-none focus:border-[#f5e6bd]"
      />
      <div className="w-full max-w-md flex-1 overflow-y-auto px-6 pb-20">
        {list.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              onPick(l.id)
              onClose()
            }}
            className={`mb-2 flex w-full items-center justify-between rounded-2xl border px-5 py-3.5 text-left transition-all ${
              lang === l.id
                ? 'border-[#f5e6bd] bg-[#f5e6bd]/15 text-[#f5e6bd]'
                : 'border-[#f5e6bd]/20 text-[#e8d9ae]/80 hover:border-[#f5e6bd]/60 hover:bg-[#f5e6bd]/5'
            }`}
          >
            <span className="text-base">{l.label}</span>
            <span className="flex items-center gap-3 text-xs text-[#d8c48a]/50">
              {l.en !== l.label ? l.en : ''}
              {lang === l.id && <span className="text-[#f5e6bd]">✓</span>}
            </span>
          </button>
        ))}
        {list.length === 0 && <p className="mt-8 text-center text-sm text-[#d8c48a]/50">—</p>}
      </div>
    </div>
  )
}

// dedicated instructions page — same visual style as the language page, scrollable
function InstructionsPage({ t, onClose }: { t: (k: LangKey) => string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lines: LangKey[] = ['instrDesktop', 'instrTouch', 'instrInteract', 'instrChat', 'instrEsc']

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
        aria-label="back"
      >
        ‹
      </button>
      <div className="mb-2 mt-20 text-3xl">🌾</div>
      <h2 className="mb-6 px-4 text-center text-xl tracking-[0.25em] text-[#f5e6bd]">{t('howToTitle')}</h2>
      <div className="w-full max-w-2xl flex-1 overflow-y-auto px-6 pb-20">
        <div className="space-y-3">
          {lines.map((k) => (
            <p
              key={k}
              className="rounded-2xl border border-[#f5e6bd]/20 bg-white/5 px-5 py-3.5 text-center text-sm leading-7 text-[#e8d9ae]/90"
            >
              {t(k)}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// dedicated maps page — the paintings we have walkable maps for, early to late
function MapsPage({
  t,
  map,
  onPick,
  onClose,
}: {
  t: (k: LangKey) => string
  map: MapId
  onPick: (m: MapId) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
        aria-label="back"
      >
        ‹
      </button>
      <div className="mb-2 mt-20 text-3xl">🖼️</div>
      <h2 className="mb-6 px-4 text-center text-xl tracking-[0.25em] text-[#f5e6bd]">{t('mapsPageTitle')}</h2>
      <div className="w-full max-w-md flex-1 overflow-y-auto px-6 pb-20">
        {MAPS.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              onPick(m.id)
              onClose()
            }}
            className={`mb-2 flex w-full items-center justify-between rounded-2xl border px-5 py-3.5 text-left transition-all ${
              map === m.id
                ? 'border-[#f5e6bd] bg-[#f5e6bd]/15 text-[#f5e6bd]'
                : 'border-[#f5e6bd]/20 text-[#e8d9ae]/80 hover:border-[#f5e6bd]/60 hover:bg-[#f5e6bd]/5'
            }`}
          >
            <span className="text-base">{t(m.titleKey)}</span>
            <span className="flex items-center gap-3 text-xs text-[#d8c48a]/50">
              {m.sub}
              {map === m.id && <span className="text-[#f5e6bd]">✓</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// dedicated settings page — same visual style as the language page
function SettingsPage({
  t,
  pointerLock,
  continuousFly,
  onToggleLock,
  onToggleFly,
  onClose,
}: {
  t: (k: LangKey) => string
  pointerLock: boolean
  continuousFly: boolean
  onToggleLock: () => void
  onToggleFly: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const Row = ({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className="mb-2 flex w-full items-center justify-between rounded-2xl border border-[#f5e6bd]/20 px-5 py-3.5 text-left text-[#e8d9ae]/80 transition-all hover:border-[#f5e6bd]/60 hover:bg-[#f5e6bd]/5"
    >
      <span className="text-base">{label}</span>
      <span
        className={`rounded-full border px-4 py-1 text-xs tracking-widest transition-all ${
          on ? 'border-[#f5e6bd] bg-[#f5e6bd]/15 text-[#f5e6bd]' : 'border-[#f5e6bd]/30 text-[#d8c48a]/50'
        }`}
      >
        {on ? t('settingsOn') : t('settingsOff')}
      </span>
    </button>
  )

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
        aria-label="back"
      >
        ‹
      </button>
      <div className="mb-2 mt-20 text-3xl text-[#f5e6bd]">
        <Settings size={30} strokeWidth={1.5} />
      </div>
      <h2 className="mb-6 px-4 text-center text-xl tracking-[0.25em] text-[#f5e6bd]">{t('settingsTitle')}</h2>
      <div className="w-full max-w-md flex-1 overflow-y-auto px-6 pb-20">
        <Row label={t('settingsPointerLock')} on={pointerLock} onToggle={onToggleLock} />
        <Row label={t('settingsContinuousFly')} on={continuousFly} onToggle={onToggleFly} />
      </div>
    </div>
  )
}

// continuous-flying wheel (touch): outer ring = fly fwd/back/left/right, inner circle = stop
function FlyWheel({ flyLatch }: { flyLatch: React.MutableRefObject<{ fwd: number; strafe: number }> }) {
  const [active, setActive] = useState<'up' | 'right' | 'down' | 'left' | null>(null)

  const polar = (r: number, deg: number): [number, number] => [
    80 + r * Math.cos((deg * Math.PI) / 180),
    80 + r * Math.sin((deg * Math.PI) / 180),
  ]
  const sector = (a0: number, a1: number) => {
    const [x0, y0] = polar(72, a0)
    const [x1, y1] = polar(72, a1)
    const [x2, y2] = polar(30, a1)
    const [x3, y3] = polar(30, a0)
    return `M${x0} ${y0} A72 72 0 0 1 ${x1} ${y1} L${x2} ${y2} A30 30 0 0 0 ${x3} ${y3} Z`
  }
  const DIRS = [
    { id: 'up', a: [-135, -45], label: '↑', lx: 80, ly: 55, fwd: 1, strafe: 0 },
    { id: 'right', a: [-45, 45], label: '→', lx: 106, ly: 84, fwd: 0, strafe: 1 },
    { id: 'down', a: [45, 135], label: '↓', lx: 80, ly: 112, fwd: -1, strafe: 0 },
    { id: 'left', a: [135, 225], label: '←', lx: 54, ly: 84, fwd: 0, strafe: -1 },
  ] as const

  const stop = () => {
    flyLatch.current = { fwd: 0, strafe: 0 }
    setActive(null)
  }
  const pick = (d: (typeof DIRS)[number]) => {
    if (active === d.id) return stop() // tapping the active direction stops too
    flyLatch.current = { fwd: d.fwd, strafe: d.strafe }
    setActive(d.id)
  }

  return (
    <div data-ui className="absolute bottom-6 left-6 z-30 opacity-90">
      <svg width={150} height={150} viewBox="0 0 160 160" className="touch-none">
        {DIRS.map((d) => (
          <path
            key={d.id}
            d={sector(d.a[0], d.a[1])}
            fill={active === d.id ? 'rgba(245,230,189,0.40)' : 'rgba(10,16,38,0.45)'}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1.5}
            onPointerDown={(e) => {
              e.preventDefault()
              pick(d)
            }}
          />
        ))}
        <circle
          cx={80}
          cy={80}
          r={26}
          fill={active === null ? 'rgba(245,230,189,0.25)' : 'rgba(10,16,38,0.55)'}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1.5}
          onPointerDown={(e) => {
            e.preventDefault()
            stop()
          }}
        />
        {DIRS.map((d) => (
          <text key={d.id} x={d.lx} y={d.ly} textAnchor="middle" fontSize={20} fill="rgba(255,255,255,0.85)" pointerEvents="none">
            {d.label}
          </text>
        ))}
        <text x={80} y={86} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.75)" pointerEvents="none">
          ■
        </text>
      </svg>
    </div>
  )
}

// phones / iPads must be played sideways — show a rotate prompt in portrait
function RotateOverlay({ t }: { t: (k: LangKey) => string }) {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth
  )
  useEffect(() => {
    const check = () =>
      setPortrait(window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth)
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])
  if (!portrait) return null
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1530] text-center">
      <div className="mb-6 text-6xl" style={{ animation: 'rotHint 1.6s ease-in-out infinite' }}>
        📱
      </div>
      <p className="mb-2 text-xl tracking-[0.3em] text-[#f5e6bd]">{t('rotateTitle')}</p>
      <p className="text-sm text-[#d8c48a]/70">{t('rotateSub')}</p>
      <style>{`@keyframes rotHint { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-90deg) } }`}</style>
    </div>
  )
}

// touch controls, Sky-COTL style:
//   left half  — floating swipe pad: swipe up/down/left/right = move fwd/back/left/right
//   right half — swipe = look around, two-finger pinch = zoom
//   single quick tap = interact · two quick taps = toggle height slider
// everything is handled at window level so the canvas stays fully clickable
function TouchControls({
  joystick,
  lookDelta,
  fovRef,
  onDoubleTap,
}: {
  joystick: React.MutableRefObject<{ x: number; y: number }>
  lookDelta: React.MutableRefObject<{ dx: number; dy: number }>
  fovRef: React.MutableRefObject<number>
  onDoubleTap: () => void
}) {
  useEffect(() => {
    let moveId: number | null = null
    let moveOrigin = { x: 0, y: 0 }
    let lookId: number | null = null
    let lookLast = { x: 0, y: 0 }
    const pinch = new Map<number, { x: number; y: number }>()
    let pinchDist = 0
    let tapStart = { time: 0, x: 0, y: 0 }
    let lastQuickTap = { time: 0, x: 0, y: 0 }

    const fireTapOnCanvas = (x: number, y: number) => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return
      const opts: PointerEventInit = { clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true }
      canvas.dispatchEvent(new PointerEvent('pointerdown', opts))
      canvas.dispatchEvent(new PointerEvent('pointerup', opts))
    }

    const onStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const target = t.target as HTMLElement
        if (target.closest('[data-ui]')) continue
        if (t.clientX < window.innerWidth / 2 && moveId === null) {
          moveId = t.identifier
          moveOrigin = { x: t.clientX, y: t.clientY }
        } else {
          pinch.set(t.identifier, { x: t.clientX, y: t.clientY })
          if (pinch.size === 2) {
            const [a, b] = Array.from(pinch.values())
            pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
            lookId = null // pinch overrides look
          } else if (lookId === null) {
            lookId = t.identifier
            lookLast = { x: t.clientX, y: t.clientY }
          }
        }
        tapStart = { time: performance.now(), x: t.clientX, y: t.clientY }
      }
    }

    const onMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === moveId) {
          let dx = (t.clientX - moveOrigin.x) / 55
          let dy = (t.clientY - moveOrigin.y) / 55
          const l = Math.hypot(dx, dy)
          if (l > 1) {
            dx /= l
            dy /= l
          }
          joystick.current = { x: dx, y: dy }
        } else if (pinch.has(t.identifier)) {
          pinch.set(t.identifier, { x: t.clientX, y: t.clientY })
          if (pinch.size === 2) {
            const [a, b] = Array.from(pinch.values())
            const d = Math.hypot(a.x - b.x, a.y - b.y)
            fovRef.current = Math.min(95, Math.max(35, fovRef.current - (d - pinchDist) * 0.15))
            pinchDist = d
          } else if (t.identifier === lookId) {
            lookDelta.current.dx += t.clientX - lookLast.x
            lookDelta.current.dy += t.clientY - lookLast.y
            lookLast = { x: t.clientX, y: t.clientY }
          }
        }
      }
    }

    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === moveId) {
          moveId = null
          joystick.current = { x: 0, y: 0 }
        }
        pinch.delete(t.identifier)
        if (t.identifier === lookId) lookId = null

        // quick-tap detection (short touch, barely moved, not on UI)
        const target = t.target as HTMLElement
        const dur = performance.now() - tapStart.time
        const moved = Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y)
        if (!target.closest('[data-ui]') && dur < 250 && moved < 12) {
          fireTapOnCanvas(t.clientX, t.clientY) // single tap = interact
          const now = performance.now()
          if (now - lastQuickTap.time < 400 && Math.hypot(t.clientX - lastQuickTap.x, t.clientY - lastQuickTap.y) < 60) {
            onDoubleTap() // two quick taps = toggle slider
            lastQuickTap = { time: 0, x: 0, y: 0 }
          } else {
            lastQuickTap = { time: now, x: t.clientX, y: t.clientY }
          }
        }
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [joystick, lookDelta, fovRef, onDoubleTap])

  return null
}

// vertical height slider (round knob on a vertical track), synced with heightRef
function HeightSlider({ heightRef, visible }: { heightRef: React.MutableRefObject<number>; visible: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)

  // keep knob position in sync (keyboard ↑↓ also changes heightRef)
  useEffect(() => {
    let raf = 0
    const sync = () => {
      if (knob.current) {
        const t = (heightRef.current - MIN_H) / (MAX_H - MIN_H)
        knob.current.style.bottom = `${t * 100}%`
      }
      raf = requestAnimationFrame(sync)
    }
    raf = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(raf)
  }, [heightRef, visible])

  useEffect(() => {
    if (!visible) return
    let dragging = false
    const setFromY = (clientY: number) => {
      if (!track.current) return
      const rect = track.current.getBoundingClientRect()
      const t = 1 - (clientY - rect.top) / rect.height
      heightRef.current = MIN_H + Math.min(1, Math.max(0, t)) * (MAX_H - MIN_H)
    }
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-height-slider]')) return
      dragging = true
      setFromY(e.clientY)
      e.preventDefault()
    }
    const onMove = (e: PointerEvent) => {
      if (dragging) setFromY(e.clientY)
    }
    const onUp = () => {
      dragging = false
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [visible, heightRef])

  if (!visible) return null
  return (
    <div
      data-ui
      data-height-slider
      className="absolute right-8 top-1/2 z-30 flex h-72 w-14 -translate-y-1/2 touch-none items-center justify-center rounded-2xl border-2 border-white/40 bg-black/25 backdrop-blur-sm"
    >
      <div ref={track} className="relative h-56 w-1 rounded-full bg-white/50">
        <div
          ref={knob}
          className="absolute left-1/2 h-9 w-9 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/70 bg-white/25"
        />
      </div>
      <span className="absolute -top-7 text-xs text-white/70">高</span>
      <span className="absolute -bottom-7 text-xs text-white/70">低</span>
    </div>
  )
}

export default function App() {
  const [started, setStarted] = useState(() => new URLSearchParams(window.location.search).has('autostart'))
  const [paused, setPaused] = useState(false)
  const initNight = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('night')
  const [skyMode, setSkyMode] = useState<'day' | 'dusk' | 'night'>(initNight ? 'night' : 'day')
  const [toast, setToast] = useState<string | null>(null)
  const [sliderVisible, setSliderVisible] = useState(false)
  const modeRef = useRef({ dusk: 0, night: initNight ? 1 : 0 })
  const gust = useRef({ origin: [0, 0] as [number, number], time: 0 })
  const burstSignal = useRef({ t: 0, pos: [0, 14, 0] as [number, number, number] })
  const joystick = useRef({ x: 0, y: 0 })
  const lookDelta = useRef({ dx: 0, dy: 0 })
  const flyLatch = useRef({ fwd: 0, strafe: 0 }) // continuous-flying latched direction
  const [chatOpen, setChatOpen] = useState(false)
  const [chatText, setChatText] = useState('')
  const [bubble, setBubble] = useState<string | null>(null)
  const bubbleTimer = useRef<number | undefined>(undefined)
  const heightRef = useRef(DEFAULT_H)
  const fovRef = useRef(70)
  const dimRef = useRef<[number, number, number]>([1, 1, 1])
  const toastTimer = useRef<number | undefined>(undefined)
  const presenceRef = useRef<PresenceState>({ x: 0, y: DEFAULT_H, z: 10, yaw: 0 })
  // handholding: remote-bird groups (lifted from RemoteBirds) + "I'm being led"
  // flag shared with PlayerControls so the guide's pulls never fight input
  const birdRefs = useRef(new Map<string, THREE.Group>())
  const ledRef = useRef(false)
  const leadYawRef = useRef(0) // the guide's heading while handholding
  const moveRef = useRef(0) // flight effort 0..1 — drives the wing flap
  // perching: target post/shrub + settled flag (settled = sitting, folded wings)
  const [perch, setPerch] = useState<PerchPoint | null>(null)
  const [perched, setPerched] = useState(false)
  const perchedRef = useRef(false)
  const [friendsPageOpen, setFriendsPageOpen] = useState(false)
  const [spawnTick, setSpawnTick] = useState(0) // bump = teleport to spawn (joining a friend)
  // locate & warp: face a friend, then a second tap within 10s offers the warp
  const faceRef = useRef<{ x: number; z: number } | null>(null)
  const warpRef = useRef<{ x: number; z: number } | null>(null)
  const locateStamp = useRef<{ id: string; at: number } | null>(null)
  const [warpAsk, setWarpAsk] = useState<RemotePlayer | null>(null)
  // block list — mine alone, kept on this device (the blocker's vision)
  const [blocked, setBlocked] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem('wheatfield-blocked') ?? '[]') as string[])
  )
  const toggleBlock = useCallback((id: string) => {
    setBlocked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('wheatfield-blocked', JSON.stringify([...next]))
      return next
    })
  }, [])
  const perchMarkersRef = useRef<{ x: number; y: number; key: number }[]>([]) // floating perch icons
  // lifted presence bookkeeping: latest poll (bird picking) + per-player
  // heartbeat freshness (LeadFollower's ghost-guide detector)
  const remotePlayersRef = useRef<RemotePlayer[]>([])
  const freshnessRef = useRef(new Map<string, [number, number]>())
  const [lang, setLangState] = useState<Lang>(() => detectLang())
  const [langPageOpen, setLangPageOpen] = useState(() => new URLSearchParams(window.location.search).has('langtest'))
  const [howToOpen, setHowToOpen] = useState(false)
  const [muted, setMuted] = useState(() => audio.isMuted())
  const [settingsOpen, setSettingsOpen] = useState(false)
  // pointer lock: on = mouse captured for looking (default) · off = drag to look
  const [pointerLock, setPointerLockState] = useState(
    () => localStorage.getItem('wheatfield-pointer-lock') !== '0'
  )
  // continuous flying: the bird glides forward on its own, S / pull back to hover
  const [continuousFly, setContinuousFlyState] = useState(
    () => localStorage.getItem('wheatfield-continuous-fly') === '1'
  )
  const setPointerLock = (v: boolean) => {
    setPointerLockState(v)
    localStorage.setItem('wheatfield-pointer-lock', v ? '1' : '0')
  }
  const setContinuousFly = (v: boolean) => {
    setContinuousFlyState(v)
    localStorage.setItem('wheatfield-continuous-fly', v ? '1' : '0')
    if (!v) flyLatch.current = { fwd: 0, strafe: 0 } // kill any latched motion
  }
  const [map, setMapState] = useState<MapId>(() => {
    // debug: ?map=auvers forces a painting (used by screenshot tests)
    const q = new URLSearchParams(window.location.search).get('map')
    if (q === 'auvers' || q === 'wheatfield' || q === 'crowfield') return q
    return detectMap()
  })
  const [mapsPageOpen, setMapsPageOpen] = useState(false)
  const setMap = (m: MapId) => {
    setMapState(m)
    saveMap(m)
  }
  const mapRef = useRef(map) // fresh map id inside the friend-poll closure
  mapRef.current = map
  // ---- friendship system ----
  // debug: ?friendmenu opens the friend menu against a mock player and seeds
  // mock friends so the perched birds show up (screenshot tests)
  const demoFriendMenu = useMemo(() => new URLSearchParams(window.location.search).has('friendmenu'), [])
  const [friendTarget, setFriendTarget] = useState<RemotePlayer | null>(() =>
    demoFriendMenu
      ? { id: 'demo-traveler-000', x: 0, y: 2, z: 0, yaw: 0, bubble: null, bubbleAt: null, updatedAt: Date.now(), sitting: false }
      : null
  )
  const [friends, setFriends] = useState<FriendEntry[]>(() =>
    demoFriendMenu
      ? [
          { id: 'demo-traveler-000', name: '金色云雀' },
          { id: 'demo-friend-001', name: 'Amber Lark' },
          { id: 'demo-friend-002', name: '麦田小麻雀' },
        ]
      : []
  )
  const [pendingOut, setPendingOut] = useState<Record<string, number>>({}) // id -> sent at (ms)
  const [friendConfirm, setFriendConfirm] = useState<null | { kind: 'out' | 'in' | 'leadOut' | 'leadIn'; otherId: string }>(null)
  const [namingQueue, setNamingQueue] = useState<{ friendId: string; current: string }[]>([])
  const [nameInput, setNameInput] = useState('')
  // handholding: who I'm guiding / who's guiding me, plus outgoing lead requests
  const [lead, setLead] = useState<{ leading: string | null; ledBy: string | null } | null>(null)
  const [leadPendingOut, setLeadPendingOut] = useState<Record<string, number>>({})
  const seenIncoming = useRef(new Map<string, number>()) // from -> latest request ts we've noticed
  const answeredReqs = useRef(new Map<string, number>()) // from -> when we answered (for re-requests)
  const seenIncomingLead = useRef(new Map<string, number>())
  const answeredLeads = useRef(new Map<string, number>())
  // the soundtrack follows the painting — gold gets music, green keeps wind
  useEffect(() => {
    audio.setMap(map)
  }, [map])
  // switching paintings lifts you off the old painting's perch — its
  // coordinates mean nothing in the new field
  useEffect(() => {
    setPerch(null)
  }, [map])
  // perched: any steering key hops off the post; a lead offer lifts you off too
  useEffect(() => {
    if (!perch) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        setPerch(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [perch])
  useEffect(() => {
    if (lead?.ledBy && perch) setPerch(null) // holding hands beats sitting still
  }, [lead, perch])
  const isCoarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const t = (k: LangKey) => DICT[lang][k] ?? DICT.en[k]
  const cjk = isCjk(lang)
  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('wheatfield-lang', l)
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  // stable identity — PlayerControls' lock effect depends on it, and a fresh
  // closure per render would re-arm gesture-less lock requests in a loop
  const notifyLockFallback = useCallback(() => {
    showToast(DICT[lang].toastLockFallback ?? DICT.en.toastLockFallback)
  }, [lang, showToast])

  const toggleSlider = () => setSliderVisible((v) => !v)

  // ---- friendship polling + handlers ----
  const friendNames = useMemo(() => Object.fromEntries(friends.map((f) => [f.id, f.name])), [friends])
  const naming = namingQueue[0] ?? null

  // prefill the naming input whenever a new naming dialog reaches the front
  useEffect(() => {
    if (naming) setNameInput(naming.current)
  }, [naming?.friendId]) // eslint-disable-line react-hooks/exhaustive-deps

  // t is rebuilt every render — keep it in a ref so the poll effect below
  // doesn't tear down and re-fire on every state update (that loop once
  // hammered friendPoll until the server's rate limiter kicked in and
  // started returning empty results for EVERYONE on this ip+id)
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (!started) return
    let alive = true
    const id = getPlayerId()
    const tick = async () => {
      try {
        const r = await apiFriendPoll(id)
        if (!alive) return
        // skip the re-render when nothing changed (identity-stable update)
        // (demo mode keeps its seeded mock friends instead)
        if (!demoFriendMenu)
          setFriends((cur) =>
            cur.length === r.friends.length &&
            cur.every((f, i) => f.id === r.friends[i].id && f.name === r.friends[i].name)
              ? cur
              : r.friends
          )
        // drop outgoing requests older than the server-side TTL (60s)
        const now = Date.now()
        setPendingOut((p) => {
          const next = Object.fromEntries(Object.entries(p).filter(([, at]) => now - at < 60000))
          return Object.keys(next).length === Object.keys(p).length ? p : next
        })
        setLeadPendingOut((p) => {
          const next = Object.fromEntries(Object.entries(p).filter(([, at]) => now - at < 60000))
          return Object.keys(next).length === Object.keys(p).length ? p : next
        })
        // a request we sent was accepted — celebrate + offer naming
        if (r.accepted.length > 0) {
          audio.playReceive()
          showToast(tRef.current('friendNowFriends'))
          setNamingQueue((q) => [...q, ...r.accepted.map((a) => ({ friendId: a.with, current: a.name }))])
          setPendingOut((p) => {
            const next = { ...p }
            for (const a of r.accepted) delete next[a.with]
            return next
          })
        }
        // handholding: link established / current link state
        if (r.leadAccepted.length > 0) {
          audio.playReceive()
          showToast(tRef.current('leadNowLeading'))
          setLeadPendingOut((p) => {
            const next = { ...p }
            for (const a of r.leadAccepted) delete next[a.with]
            return next
          })
        }
        setLead((cur) => {
          const same =
            (cur?.leading ?? null) === (r.lead?.leading ?? null) &&
            (cur?.ledBy ?? null) === (r.lead?.ledBy ?? null)
          return same ? cur : r.lead
        })
        // handholding: a led player follows their guide across paintings —
        // the poll carries the partner's current map, so when it changes we
        // switch too (LeadFollower then snaps to the guide's bird)
        if (r.lead?.ledBy && r.leadMap && r.leadMap !== mapRef.current) {
          if (r.leadMap === 'wheatfield' || r.leadMap === 'auvers' || r.leadMap === 'crowfield') {
            mapRef.current = r.leadMap
            setMap(r.leadMap)
            showToast(tRef.current('leadFollowMap'))
          }
        }
        // incoming lead requests — chirp once per fresh request
        for (const inc of r.incomingLead) {
          const last = seenIncomingLead.current.get(inc.from) ?? 0
          if (inc.at > last) {
            seenIncomingLead.current.set(inc.from, inc.at)
            if (inc.at > (answeredLeads.current.get(inc.from) ?? 0)) audio.playReceive()
          }
        }
        setFriendConfirm((cur) => {
          if (cur) return cur
          const fresh = r.incomingLead.find((i) => i.at > (answeredLeads.current.get(i.from) ?? 0))
          return fresh ? { kind: 'leadIn', otherId: fresh.from } : cur
        })
        // incoming requests — chirp once per fresh request, show one at a time
        for (const inc of r.incoming) {
          const last = seenIncoming.current.get(inc.from) ?? 0
          if (inc.at > last) {
            seenIncoming.current.set(inc.from, inc.at)
            if (inc.at > (answeredReqs.current.get(inc.from) ?? 0)) audio.playReceive()
          }
        }
        setFriendConfirm((cur) => {
          if (cur) return cur
          const fresh = r.incoming.find((i) => i.at > (answeredReqs.current.get(i.from) ?? 0))
          return fresh ? { kind: 'in', otherId: fresh.from } : cur
        })
      } catch {
        /* a missed friend poll just means updates arrive a beat later */
      }
    }
    tick()
    const t2 = window.setInterval(tick, 1500)
    return () => {
      alive = false
      window.clearInterval(t2)
    }
  }, [started, showToast, demoFriendMenu])

  const sendFriendReq = useCallback(
    async (to: string) => {
      setFriendConfirm(null)
      try {
        const r = await apiFriendReq(getPlayerId(), to)
        if (r.ok) {
          setPendingOut((p) => ({ ...p, [to]: Date.now() }))
          audio.playSend()
          showToast(t('friendRequestSent'))
        } else if (r.reason === 'friends') {
          showToast(t('friendAlready'))
        } else if (r.reason === 'limited') {
          showToast(t('toastSlowDown'))
        }
      } catch {
        showToast(t('toastNetErr'))
      }
    },
    [showToast, t]
  )

  const answerFriendReq = useCallback(async (accept: boolean) => {
    setFriendConfirm((cur) => {
      if (cur?.kind === 'in') {
        answeredReqs.current.set(cur.otherId, Date.now())
        apiFriendAnswer(getPlayerId(), cur.otherId, accept).catch(() => {})
        if (accept) audio.playSend()
      }
      return null
    })
  }, [])

  const sendLeadReq = useCallback(
    async (to: string) => {
      setFriendConfirm(null)
      try {
        const r = await apiLeadReq(getPlayerId(), to)
        if (r.ok) {
          setLeadPendingOut((p) => ({ ...p, [to]: Date.now() }))
          audio.playSend()
          showToast(t('friendRequestSent'))
        } else if (r.reason === 'notFriends') {
          showToast(t('friendLocked'))
        } else if (r.reason === 'limited') {
          showToast(t('toastSlowDown'))
        }
      } catch {
        showToast(t('toastNetErr'))
      }
    },
    [showToast, t]
  )

  const answerLeadReq = useCallback(async (accept: boolean) => {
    setFriendConfirm((cur) => {
      if (cur?.kind === 'leadIn') {
        answeredLeads.current.set(cur.otherId, Date.now())
        apiLeadAnswer(getPlayerId(), cur.otherId, accept).catch(() => {})
        if (accept) audio.playSend()
      }
      return null
    })
  }, [])

  const releaseLead = useCallback(async () => {
    setLead(null) // optimistic — the poll resyncs if the server disagrees
    try {
      await apiLeadRelease(getPlayerId())
      showToast(t('leadReleased'))
    } catch {
      /* the poll will restore the link if the release never landed */
    }
  }, [showToast, t])

  const closeNaming = useCallback(() => {
    setNamingQueue((q) => q.slice(1))
    setNameInput('')
  }, [])

  const saveFriendName = useCallback(async () => {
    const n = namingQueue[0]
    const name = nameInput.trim()
    closeNaming()
    if (!n || !name || name === n.current) return // empty = keep the random name
    try {
      const r = await apiFriendName(getPlayerId(), n.friendId, name)
      if (r.ok) {
        setFriends((fs) => fs.map((f) => (f.id === n.friendId ? { ...f, name } : f)))
      } else if (r.blocked) {
        showToast(t('toastBlocked'))
      }
    } catch {
      showToast(t('toastNetErr'))
    }
  }, [namingQueue, nameInput, closeNaming, showToast, t])

  // desktop: double-click also toggles the height slider
  useEffect(() => {
    const onDbl = () => toggleSlider()
    window.addEventListener('dblclick', onDbl)
    return () => window.removeEventListener('dblclick', onDbl)
  }, [])

  // ESC opens the menu frame, two complementary paths:
  //   · while locked, the browser consumes ESC to release the lock — the page
  //     never sees the key, so the pointerlockchange below is what opens it
  //   · while NOT locked (drag mode, or lock refused by the environment), the
  //     keydown reaches the page and opens the menu directly
  useEffect(() => {
    const onLockChange = () => {
      if (!document.pointerLockElement && started && !window.matchMedia('(pointer: coarse)').matches) {
        setPaused(true)
      }
    }
    document.addEventListener('pointerlockchange', onLockChange)
    return () => document.removeEventListener('pointerlockchange', onLockChange)
  }, [started])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return // Esc in chat cancels typing
      if (document.pointerLockElement) return // locked: browser handles ESC, see above
      if (e.key !== 'Escape') return
      // friend UI takes priority over the pause menu
      if (naming) {
        closeNaming()
        return
      }
      if (friendConfirm) {
        if (friendConfirm.kind === 'in') answerFriendReq(false) // Esc = silent decline
        else if (friendConfirm.kind === 'leadIn') answerLeadReq(false)
        else setFriendConfirm(null)
        return
      }
      if (friendTarget) {
        setFriendTarget(null)
        return
      }
      if (started && !paused && !window.matchMedia('(pointer: coarse)').matches) {
        setPaused(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, paused, naming, friendConfirm, friendTarget, closeNaming, answerFriendReq, answerLeadReq])

  // turning pointer lock off while locked must actually release the mouse
  useEffect(() => {
    if (!pointerLock && document.pointerLockElement) document.exitPointerLock()
  }, [pointerLock])

  const enterPainting = () => {
    setStarted(true)
    setPaused(false)
    audio.start() // the click is the user gesture that unlocks audio
    audio.setSkyMode(skyMode)
    // pointer lock is requested by PlayerControls as soon as `started` flips —
    // the click's transient activation is still valid, and having a single place
    // that requests the lock avoids double-request races
    if (window.matchMedia('(pointer: coarse)').matches) {
      // mobile/tablet: try to force landscape (needs fullscreen; iOS may refuse — the rotate overlay covers that)
      ;(async () => {
        try {
          await document.documentElement.requestFullscreen?.()
          await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')
        } catch {
          /* not supported — RotateOverlay handles it */
        }
      })()
    }
  }

  const menuOpen = !started || paused

  // Enter opens the chat box; ESC closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || paused) return
      if (e.key === 'Enter' && !chatOpen) {
        e.preventDefault()
        setChatText('')
        setChatOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, paused, chatOpen])

  const sendChat = async () => {
    const text = chatText.trim()
    setChatOpen(false)
    if (!text) return // empty = just cancel
    // server moderates first — blocked words never become a bubble
    try {
      const res = await apiSay(getPlayerId(), text)
      if (res.blocked) {
        showToast(t('toastBlocked'))
        return
      }
      if (res.limited) {
        showToast(t('toastSlowDown'))
        return
      }
    } catch (err) {
      console.error('[wheatfield] say failed:', err)
      // distinguish "backend not up yet" from a specific server error
      let hint = ''
      try {
        const r = await fetch('/api/trpc/ping', { cache: 'no-store' })
        hint = r.ok ? (err instanceof Error ? err.message.slice(0, 60) : 'unknown') : `server ${r.status}`
      } catch {
        hint = 'server unreachable'
      }
      showToast(`${t('toastNetErr')} · ${hint}`)
      return
    }
    setBubble(text)
    audio.playSend()
    window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 20000)
  }

  const cycleSky = () => {
    const next = skyMode === 'day' ? 'dusk' : skyMode === 'dusk' ? 'night' : 'day'
    setSkyMode(next)
    audio.setSkyMode(next)
    modeRef.current = { dusk: next === 'dusk' ? 1 : 0, night: next === 'night' ? 1 : 0 }
    showToast(next === 'dusk' ? t('toastDusk') : next === 'night' ? t('toastNight') : t('toastDay'))
  }

  const MODE_KEY = { day: 'modeDay', dusk: 'modeDusk', night: 'modeNight' } as const
  const NEXT_MODE = { day: 'dusk', dusk: 'night', night: 'day' } as const
  const badgeMode = t('badgeMode')
    .replace('{mode}', t(MODE_KEY[skyMode]))
    .replace('{next}', t(MODE_KEY[NEXT_MODE[skyMode]]))

  // scene lighting per sky mode (dim = multiplier for the custom ground/wheat shaders)
  const LIGHTING = {
    day: { amb: ['#fff4d6', 1.15], d1: ['#ffe9b0', 1.4], d2: ['#7fa8e0', 0.5], fog: '#8fb3d9', dim: [1, 1, 1] },
    dusk: { amb: ['#ffd9b0', 0.8], d1: ['#ffb070', 0.9], d2: ['#7f7fd0', 0.4], fog: '#a087a8', dim: [0.8, 0.72, 0.72] },
    night: { amb: ['#8090c0', 0.45], d1: ['#8fa0d8', 0.35], d2: ['#405080', 0.3], fog: '#1c2848', dim: [0.3, 0.38, 0.6] },
  }[skyMode] as { amb: [string, number]; d1: [string, number]; d2: [string, number]; fog: string; dim: [number, number, number] }
  dimRef.current = LIGHTING.dim

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#101a33] font-serif">
      <Canvas
        camera={{ fov: 70, near: 0.1, far: 900, position: [0, DEFAULT_H, 10] }}
        dpr={[1, 1.75]} // cap retina render scale — full-dpr fills 4x pixels for no visible gain
        onCreated={({ gl }) => {
          gl.setClearColor('#101a33')
        }}
      >
        <fog attach="fog" args={[LIGHTING.fog, 90, 320]} />
        <ambientLight intensity={LIGHTING.amb[1]} color={LIGHTING.amb[0]} />
        <directionalLight position={[40, 60, -50]} intensity={LIGHTING.d1[1]} color={LIGHTING.d1[0]} />
        <directionalLight position={[-30, 40, 60]} intensity={LIGHTING.d2[1]} color={LIGHTING.d2[0]} />

        <VanGoghSky modeRef={modeRef} onSunClick={cycleSky} map={map} />
        <group key={map}>
          <Ground dimRef={dimRef} map={map} />
          <WheatField
            gust={gust.current}
            dimRef={dimRef}
            map={map}
            onClickWheat={(x, z) => {
              gust.current = { origin: [x, z], time: performance.now() }
              audio.gust()
              showToast(t('toastWind'))
            }}
          />
          {map === 'wheatfield' ? (
            <>
              <CypressTrees
                onBurst={(pos) => {
                  burstSignal.current = { t: performance.now(), pos }
                  audio.sparrowBurst()
                  showToast(t('toastSparrows'))
                }}
              />
              <HillsAndVillage />
              <Fences map={map} />
            </>
          ) : map === 'auvers' ? (
            <>
              <Hedges />
              <Meadows />
            </>
          ) : (
            // the crow painting has no village, cypress or hedges — just the
            // field, the three roads and the storm. A ring of boulders marks
            // the field's rim (perch spots), and where the middle road dies:
            // the painter's hat and tools. Rain that never stops.
            <>
              <Boulders />
              <Mountains />
              <Memorial />
              <Rain />
            </>
          )}
        </group>
        <Sparrows burstSignal={burstSignal.current} modeRef={modeRef} crow={map === 'crowfield'} />
        <BirdAvatar
          bubble={bubble}
          presenceRef={presenceRef}
          moveRef={moveRef}
          perchedAt={perched ? perch : null}
          onTap={
            isCoarse
              ? () => {
                  if (chatOpen) return
                  setChatText('')
                  setChatOpen(true)
                }
              : undefined
          }
        />
        <RemoteBirds
          started={started}
          map={map}
          friendNames={friendNames}
          birdRefs={birdRefs}
          playersRef={remotePlayersRef}
          freshnessRef={freshnessRef}
          blocked={blocked}
          onSelect={(p) => {
            if (chatOpen) setChatOpen(false)
            setFriendTarget(p)
          }}
        />
        <PlayerControls
          joystick={joystick}
          lookDelta={lookDelta}
          started={started}
          paused={paused}
          heightRef={heightRef}
          fovRef={fovRef}
          map={map}
          pointerLock={pointerLock}
          continuousFly={continuousFly}
          flyLatch={flyLatch}
          ledRef={ledRef}
          perchedRef={perchedRef}
          leadYawRef={leadYawRef}
          moveRef={moveRef}
          spawnTick={spawnTick}
          faceRef={faceRef}
          warpRef={warpRef}
          onLockFallback={notifyLockFallback}
        />
        <LeadFollower
          ledBy={lead?.ledBy ?? null}
          map={map}
          birdRefs={birdRefs}
          freshnessRef={freshnessRef}
          heightRef={heightRef}
          ledRef={ledRef}
          leadYawRef={leadYawRef}
          moveRef={moveRef}
          onGuideGone={() => showToast(tRef.current('leadPartnerGone'))}
        />
        <PerchController
          perch={perch}
          map={map}
          paused={paused}
          presenceRef={presenceRef}
          heightRef={heightRef}
          perchedRef={perchedRef}
          ledRef={ledRef}
          joystick={joystick}
          birdRefs={birdRefs}
          markersRef={perchMarkersRef}
          onPerch={(p) => {
            setPerch(p)
            showToast(t('toastPerched'))
          }}
          onSettled={setPerched}
          onTakeoff={() => setPerch(null)}
        />
        <AudioMotion />
      </Canvas>

      {/* crosshair */}
      {started && !paused && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border border-white/70 bg-white/20" />
      )}

      {/* floating perch icons above nearby posts */}
      {started && !paused && !perched && <PerchMarkers markersRef={perchMarkersRef} />}

      {/* takeoff button — only while perched (the floating icons handle discovery) */}
      {started && !paused && perched && (
        <button
          data-ui
          onClick={() => setPerch(null)}
          aria-label={t('perchTakeoff')}
          title={t('perchTakeoff')}
          className="absolute bottom-5 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-[#f5e6bd] bg-[#f5e6bd]/25 text-[#f5e6bd] shadow-[0_0_14px_rgba(245,230,189,0.35)] transition-all"
        >
          <PerchBirdIcon size={22} />
        </button>
      )}

      {/* touch controls — canvas stays fully clickable */}
      {started && !paused && (
        <>
          <TouchControls joystick={joystick} lookDelta={lookDelta} fovRef={fovRef} onDoubleTap={toggleSlider} />
          <HeightSlider heightRef={heightRef} visible={sliderVisible} />
          {continuousFly && isCoarse && <FlyWheel flyLatch={flyLatch} />}
        </>
      )}

      {/* mode badge */}
      {started && !paused && (
        <div className="pointer-events-none absolute right-5 top-6 z-30 rounded-full border border-[#f5e6bd]/40 bg-black/30 px-4 py-1.5 text-xs text-[#f5e6bd] backdrop-blur-sm">
          {badgeMode}
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#f5e6bd]/30 bg-black/45 px-6 py-2.5 text-sm text-[#f5e6bd] backdrop-blur-md">
          {toast}
        </div>
      )}

      {/* chat input — pinned to the bottom of the screen until sent or canceled */}
      {chatOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-40 flex justify-center bg-black/40 px-4 py-3 backdrop-blur-md">
          <input
            autoFocus
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') sendChat()
              if (e.key === 'Escape') setChatOpen(false)
            }}
            placeholder={t('chatPlaceholder')}
            className="w-full max-w-xl rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:border-[#f5e6bd]"
          />
        </div>
      )}

      {/* menu frame — shown at start and every time ESC is pressed */}
      {menuOpen && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0d1530]/80 backdrop-blur-sm">
          {/* top-left entries: language page + instructions page */}
          <div className="absolute left-5 top-5 flex items-center gap-2">
            <button
              onClick={() => setLangPageOpen(true)}
              className="flex items-center gap-2 rounded-full border border-[#f5e6bd]/40 bg-black/20 px-4 py-2 text-sm text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
            >
              🌐 {LANGS.find((l) => l.id === lang)?.label}
            </button>
            <button
              onClick={() => setHowToOpen(true)}
              aria-label={t('howToTitle')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 bg-black/20 text-base text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
            >
              ?
            </button>
            <button
              onClick={() => setMuted(audio.toggleMute())}
              aria-label={muted ? t('soundOff') : t('soundOn')}
              title={muted ? t('soundOff') : t('soundOn')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 bg-black/20 text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
            >
              {muted ? <VolumeX size={17} strokeWidth={1.8} /> : <Volume2 size={17} strokeWidth={1.8} />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settingsTitle')}
              title={t('settingsTitle')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f5e6bd]/40 bg-black/20 text-[#f5e6bd] transition-all hover:bg-[#f5e6bd]/10"
            >
              <Settings size={17} strokeWidth={1.8} />
            </button>
          </div>
          <div className="mb-2 text-5xl">🌾</div>
          <h2
            className={`mb-1 px-4 text-center text-[#f5e6bd] ${
              cjk ? 'text-3xl tracking-[0.3em]' : 'text-4xl tracking-[0.04em]'
            }`}
          >
            {t('title')}
          </h2>
          <p className="mb-1 px-4 text-center text-sm tracking-widest text-[#d8c48a]/80">{t('subtitle')}</p>
          <p className="mb-10 text-xs tracking-[0.5em] text-[#d8c48a]/60">WHEATFIELD · IMMERSIVE</p>
          <button
            onClick={enterPainting}
            className={`rounded-full border-2 border-[#f5e6bd] bg-[#f5e6bd]/10 px-10 py-3 text-lg text-[#f5e6bd] transition-all hover:bg-[#f5e6bd] hover:text-[#0d1530] ${
              cjk ? 'tracking-[0.3em]' : 'tracking-[0.12em]'
            }`}
          >
            {t('enterBtn')}
          </button>
          <button
            onClick={() => setMapsPageOpen(true)}
            className={`mt-4 rounded-full border border-[#f5e6bd]/40 bg-black/20 px-6 py-2 text-sm text-[#f5e6bd]/80 transition-all hover:bg-[#f5e6bd]/10 hover:text-[#f5e6bd] ${
              cjk ? 'tracking-[0.2em]' : 'tracking-[0.06em]'
            }`}
          >
            🖼️ {t('changeMapsBtn')}
          </button>
          <button
            onClick={() => setFriendsPageOpen(true)}
            className={`mt-3 flex items-center gap-2 rounded-full border border-[#f5e6bd]/40 bg-black/20 px-6 py-2 text-sm text-[#f5e6bd]/80 transition-all hover:bg-[#f5e6bd]/10 hover:text-[#f5e6bd] ${
              cjk ? 'tracking-[0.2em]' : 'tracking-[0.06em]'
            }`}
          >
            <Bird size={16} strokeWidth={1.8} /> {t('friendsBtn')}
          </button>
        </div>
      )}

      {/* dedicated language page */}
      {langPageOpen && menuOpen && (
        <LanguagePage t={t} lang={lang} onPick={setLang} onClose={() => setLangPageOpen(false)} />
      )}

      {/* dedicated instructions page */}
      {howToOpen && menuOpen && <InstructionsPage t={t} onClose={() => setHowToOpen(false)} />}

      {/* dedicated maps page */}
      {mapsPageOpen && menuOpen && (
        <MapsPage t={t} map={map} onPick={setMap} onClose={() => setMapsPageOpen(false)} />
      )}

      {/* dedicated friends page */}
      {friendsPageOpen && menuOpen && (
        <FriendsPage
          t={t}
          onClose={() => setFriendsPageOpen(false)}
          onJoin={(f) => {
            if (!f.map) return
            if (f.map === 'wheatfield' || f.map === 'auvers' || f.map === 'crowfield') setMap(f.map)
            setPerch(null)
            setSpawnTick((n) => n + 1) // land at the spawn point of their painting
            setFriendsPageOpen(false)
            enterPainting()
            showToast(tRef.current('friendJoined'))
          }}
        />
      )}

      {/* dedicated settings page */}
      {settingsOpen && menuOpen && (
        <SettingsPage
          t={t}
          pointerLock={pointerLock}
          continuousFly={continuousFly}
          onToggleLock={() => setPointerLock(!pointerLock)}
          onToggleFly={() => setContinuousFly(!continuousFly)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* friend menu — slides over the right third when a bird is tapped */}
      {friendTarget && (
        <FriendMenu
          t={t}
          label={friendNames[friendTarget.id] ?? t('friendStranger')}
          isFriend={friendTarget.id in friendNames}
          pendingOut={friendTarget.id in pendingOut}
          friends={friends}
          targetId={friendTarget.id}
          leadLinked={!!lead && (lead.leading === friendTarget.id || lead.ledBy === friendTarget.id)}
          leadPending={friendTarget.id in leadPendingOut}
          onClose={() => setFriendTarget(null)}
          onBefriend={() => setFriendConfirm({ kind: 'out', otherId: friendTarget.id })}
          onLead={() => setFriendConfirm({ kind: 'leadOut', otherId: friendTarget.id })}
          onLeadRelease={releaseLead}
          onLocked={() => showToast(t('friendLocked'))}
          blocked={blocked.has(friendTarget.id)}
          onBlock={() => toggleBlock(friendTarget.id)}
          onRename={() =>
            setNamingQueue((q) => [
              ...q,
              { friendId: friendTarget.id, current: friendNames[friendTarget.id] ?? '' },
            ])
          }
          onLocate={() => {
            // first tap: turn to face them. Second tap within 10s: offer warp.
            const p = remotePlayersRef.current.find((pl) => pl.id === friendTarget.id) ?? friendTarget
            const now = Date.now()
            if (locateStamp.current && locateStamp.current.id === p.id && now - locateStamp.current.at < 10000) {
              locateStamp.current = null
              setWarpAsk(p)
            } else {
              faceRef.current = { x: p.x, z: p.z }
              locateStamp.current = { id: p.id, at: now }
            }
          }}
        />
      )}

      {/* warp confirm — landing at a friend's side means landing in their hand */}
      {warpAsk && (
        <FriendConfirm
          t={t}
          text={t('friendWarpAsk')}
          onYes={() => {
            warpRef.current = { x: warpAsk.x, z: warpAsk.z }
            apiWarpLead(getPlayerId(), warpAsk.id).catch(() => {})
            setWarpAsk(null)
            setFriendTarget(null)
          }}
          onNo={() => setWarpAsk(null)}
        />
      )}

      {/* yes/no confirm — friend ask, lead ask, and their incoming twins */}
      {friendConfirm && (
        <FriendConfirm
          t={t}
          text={
            friendConfirm.kind === 'out'
              ? t('friendAskOut')
              : friendConfirm.kind === 'in'
                ? t('friendAskIn')
                : friendConfirm.kind === 'leadOut'
                  ? t('leadAskOut')
                  : t('leadAskIn')
          }
          onYes={() => {
            if (friendConfirm.kind === 'out') sendFriendReq(friendConfirm.otherId)
            else if (friendConfirm.kind === 'in') answerFriendReq(true)
            else if (friendConfirm.kind === 'leadOut') sendLeadReq(friendConfirm.otherId)
            else answerLeadReq(true)
          }}
          onNo={() => {
            if (friendConfirm.kind === 'in') answerFriendReq(false)
            else if (friendConfirm.kind === 'leadIn') answerLeadReq(false)
            else setFriendConfirm(null)
          }}
        />
      )}

      {/* naming popup once a friendship forms */}
      {naming && (
        <FriendNaming
          t={t}
          current={naming.current}
          value={nameInput}
          onChange={setNameInput}
          onSave={saveFriendName}
          onLater={closeNaming}
        />
      )}

      {/* portrait phones/tablets: rotate-to-landscape prompt */}
      <RotateOverlay t={t} />

      {/* multiplayer presence reporter (renders nothing) */}
      <PresenceHeartbeat started={started} presenceRef={presenceRef} map={map} sitting={perched} />
    </div>
  )
}
