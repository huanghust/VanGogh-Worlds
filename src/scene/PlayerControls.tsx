import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { groundHeight } from './terrain'
import type { MapId } from './maps'

const BOUND = 66.5 // stay inside the fence ring
export const MIN_H = 1.4
export const MAX_H = 9
export const DEFAULT_H = 2.8

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export function PlayerControls({
  joystick,
  lookDelta,
  started,
  paused = false,
  heightRef,
  fovRef,
  map,
  pointerLock = true,
  continuousFly = false,
  flyLatch,
  ledRef,
  perchedRef,
  leadYawRef,
  moveRef,
  spawnTick,
  faceRef,
  warpRef,
  onLockFallback,
}: {
  joystick: React.MutableRefObject<{ x: number; y: number }>
  lookDelta: React.MutableRefObject<{ dx: number; dy: number }>
  started: boolean
  paused?: boolean // menu frame open — no auto-lock while it is
  heightRef: React.MutableRefObject<number>
  fovRef: React.MutableRefObject<number>
  map: MapId
  pointerLock?: boolean // on = lock mouse to look · off = drag to look
  continuousFly?: boolean // on = tap a direction key once and the bird keeps going
  flyLatch?: React.MutableRefObject<{ fwd: number; strafe: number }> // latched CF direction
  ledRef?: React.MutableRefObject<boolean> // handholding: being led — position is slaved to the guide
  perchedRef?: React.MutableRefObject<boolean> // perched on a fence/shrub — sitting still (look stays free)
  leadYawRef?: React.MutableRefObject<number> // handholding: the guide's heading — while led we turn with them
  moveRef?: React.MutableRefObject<number> // flight effort 0..1 shared with BirdAvatar's wing flap
  spawnTick?: number // bump to teleport back to the painting's spawn point (joining a friend)
  faceRef?: React.MutableRefObject<{ x: number; z: number } | null> // locate: ease the view toward this point
  warpRef?: React.MutableRefObject<{ x: number; z: number } | null> // warp: snap the camera here
  onLockFallback?: () => void // called (throttled) while pointer lock keeps being refused
}) {
  const { camera, gl } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const pitch = useRef(0)
  const bob = useRef(0)
  // drag-mode look state + fling inertia
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const angVel = useRef({ x: 0, y: 0 })
  // pointer-lock resilience: transient failures (page reload races, ESC cooldown,
  // sandboxed previews) must never permanently kill the feature. lockBroken only
  // ADDS drag-look as a fallback — every new click still tries to lock again.
  const [lockBroken, setLockBroken] = useState(false)
  const lockBrokenRef = useRef(false) // mirror for the lock effect (kept out of its deps)
  const lockPending = useRef(false)
  const sawPromise = useRef(false)
  const failStreak = useRef(0)
  const prevActive = useRef(false)
  const prevPointerLock = useRef(pointerLock)
  const dragLook = !pointerLock || lockBroken

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    camera.position.set(0, DEFAULT_H, 10)
    heightRef.current = DEFAULT_H
    yaw.current = 0
    pitch.current = 0
    // debug: ?cam=x,y,z,yaw teleports the start position (used by screenshot tests)
    const camParam = new URLSearchParams(window.location.search).get('cam')
    if (camParam) {
      const [x, y, z, yw] = camParam.split(',').map(Number)
      if (!Number.isNaN(x + y + z)) camera.position.set(x, y, z)
      if (!Number.isNaN(yw)) yaw.current = yw
    }
  }, [camera, heightRef])

  // "join a friend" teleport: back to the spawn point, facing the field
  useEffect(() => {
    if (!spawnTick) return
    camera.position.set(0, DEFAULT_H, 10)
    heightRef.current = DEFAULT_H
    yaw.current = 0
    pitch.current = 0
  }, [spawnTick, camera, heightRef])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return // typing in chat
      if (e.repeat) return
      keys.current[e.code] = true

      // continuous flying: direction keys are latches — tap to start, tap again to stop
      if (continuousFly && flyLatch) {
        const l = flyLatch.current
        if (e.code === 'KeyW' || e.code === 'KeyZ') l.fwd = l.fwd === 1 ? 0 : 1
        else if (e.code === 'KeyS') l.fwd = l.fwd === -1 ? 0 : -1
        else if (e.code === 'KeyA' || e.code === 'KeyQ') l.strafe = l.strafe === -1 ? 0 : -1
        else if (e.code === 'KeyD') l.strafe = l.strafe === 1 ? 0 : 1
      }
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [continuousFly, flyLatch])

  // pointer-lock mouse look (desktop) — only when the pointer lock setting is on
  useEffect(() => {
    if (!pointerLock) return
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      if (!ledRef?.current) yaw.current -= e.movementX * 0.0022 // led: the guide steers
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.0022, -1.2, 1.3)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [gl, pointerLock])

  // drag-to-look (pointer lock off OR temporarily unavailable): hold left button
  // and drag, fling = inertia. Ignored entirely while the pointer is locked.
  useEffect(() => {
    if (!dragLook || isTouchDevice()) return
    const dom = gl.domElement
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement === dom) return
      dragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      angVel.current = { x: 0, y: 0 }
    }
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || document.pointerLockElement === dom) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
      const dyaw = ledRef?.current ? 0 : -dx * 0.003 // led: the guide steers
      const dpitch = -dy * 0.003
      yaw.current += dyaw
      pitch.current = THREE.MathUtils.clamp(pitch.current + dpitch, -1.3, 1.4)
      angVel.current = { x: dpitch, y: dyaw }
    }
    const onUp = () => {
      dragging.current = false
    }
    dom.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      dom.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [gl, dragLook])

  // pointer lock engage + re-engage — skipped only when the setting is off.
  // Failures are often transient (Chrome's ~1.25s cooldown after an ESC exit,
  // a request landing while a dev-server reload replaces the document), so:
  //   · each attempt gets short-backoff retries
  //   · a request already in flight is never duplicated (avoids acquire→exit races)
  //   · repeated failure only ADDS drag-look as a fallback (lockBroken) — the next
  //     genuine click always tries to lock again, and a success clears everything
  useEffect(() => {
    if (!pointerLock) return
    const dom = gl.domElement
    const timers: number[] = []

    const fail = (attempt: number) => {
      lockPending.current = false
      failStreak.current += 1
      if (failStreak.current >= 3 && !lockBrokenRef.current) {
        lockBrokenRef.current = true
        setLockBroken(true) // drag-look kicks in, preference stays on
        onLockFallback?.() // tell the user ONCE per fallback — never nag
      }
      // retries only while we still believe the environment can lock; once broken,
      // one silent attempt per click is enough (a success flips everything back)
      if (!lockBrokenRef.current && attempt < 2) {
        timers.push(window.setTimeout(() => tryLock(attempt + 1), attempt === 0 ? 900 : 1700))
      }
    }

    const tryLock = (attempt = 0) => {
      if (!started || isTouchDevice()) return
      if (document.pointerLockElement === dom || lockPending.current) return
      lockPending.current = true
      sawPromise.current = false
      try {
        const r = dom.requestPointerLock?.() as Promise<void> | undefined
        if (r && typeof r.then === 'function') {
          sawPromise.current = true
          r.then(
            () => { lockPending.current = false },
            () => fail(attempt)
          )
        } else {
          // legacy sync API — outcome arrives via pointerlockchange/error events;
          // don't stay "pending" forever if neither fires
          timers.push(window.setTimeout(() => { lockPending.current = false }, 600))
        }
      } catch {
        fail(attempt)
      }
    }

    const onGesture = () => tryLock()
    const onFocus = () => tryLock() // an unfocused window rejects with WrongDocumentError — retry once focus arrives
    const onError = () => {
      // Chrome fires both the event and a promise rejection — count only once
      if (sawPromise.current) lockPending.current = false
      else fail(2) // legacy browsers report failure only here; no further retry
    }
    const onChange = () => {
      lockPending.current = false
      if (document.pointerLockElement === dom) {
        failStreak.current = 0
        if (lockBrokenRef.current) {
          lockBrokenRef.current = false
          setLockBroken(false)
        }
      }
    }

    dom.addEventListener('click', onGesture)
    dom.addEventListener('mousedown', onGesture) // some browsers prefer the earlier gesture
    window.addEventListener('focus', onFocus)
    document.addEventListener('pointerlockerror', onError)
    document.addEventListener('pointerlockchange', onChange)
    // auto-lock only when the scene becomes active (entering the painting or
    // closing the menu) or the setting is re-enabled — NOT on every effect
    // re-run (a re-render storm would fire gesture-less requests that fail
    // and burn the fail streak)
    const active = started && !paused
    const justActivated = active && !prevActive.current
    const justEnabled = pointerLock && !prevPointerLock.current
    prevActive.current = active
    prevPointerLock.current = pointerLock
    if (justActivated || justEnabled) tryLock()
    return () => {
      dom.removeEventListener('click', onGesture)
      dom.removeEventListener('mousedown', onGesture)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('pointerlockerror', onError)
      document.removeEventListener('pointerlockchange', onChange)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [started, paused, gl, pointerLock, onLockFallback])

  useFrame((_, delta) => {
    // touch look input (yaw is the guide's job while being led)
    if (!ledRef?.current) yaw.current -= lookDelta.current.dx * 0.004
    pitch.current = THREE.MathUtils.clamp(pitch.current - lookDelta.current.dy * 0.004, -1.2, 1.3)
    lookDelta.current.dx = 0
    lookDelta.current.dy = 0

    // drag-mode fling inertia: view keeps gliding after release, eases to a stop
    if (dragLook && !dragging.current) {
      const decay = Math.exp(-4.5 * delta)
      angVel.current.x *= decay
      angVel.current.y *= decay
      if (!ledRef?.current && Math.abs(angVel.current.y) > 0.00005) yaw.current += angVel.current.y
      if (Math.abs(angVel.current.x) > 0.00005) {
        pitch.current = THREE.MathUtils.clamp(pitch.current + angVel.current.x, -1.3, 1.4)
      }
    }

    // handholding: turn with the guide — a gentle shortest-arc ease toward
    // their heading, so the follower banks round instead of sliding sideways
    if (ledRef?.current && leadYawRef) {
      let dyaw = leadYawRef.current - yaw.current
      while (dyaw > Math.PI) dyaw -= Math.PI * 2
      while (dyaw < -Math.PI) dyaw += Math.PI * 2
      yaw.current += dyaw * Math.min(1, delta * 2.5)
    }

    camera.rotation.set(pitch.current, yaw.current, 0)

    // locate: ease the view toward the friend (shortest arc, then release)
    if (faceRef?.current) {
      const dx = faceRef.current.x - camera.position.x
      const dz = faceRef.current.z - camera.position.z
      const target = Math.atan2(-dx, -dz)
      let dyaw = target - yaw.current
      while (dyaw > Math.PI) dyaw -= Math.PI * 2
      while (dyaw < -Math.PI) dyaw += Math.PI * 2
      yaw.current += dyaw * Math.min(1, delta * 6)
      if (Math.abs(dyaw) < 0.02) faceRef.current = null
      camera.rotation.set(pitch.current, yaw.current, 0)
    }

    // warp: fold the distance — land at the friend's side
    if (warpRef?.current) {
      const w = warpRef.current
      warpRef.current = null
      camera.position.x = w.x
      camera.position.z = w.z
    }

    const k = keys.current

    // view height: ArrowUp / ArrowDown (slider writes heightRef directly)
    // (suspended while being led or perched — someone else owns the altitude)
    if (!ledRef?.current && !perchedRef?.current) {
      if (k['ArrowUp']) heightRef.current = Math.min(MAX_H, heightRef.current + delta * 5)
      if (k['ArrowDown']) heightRef.current = Math.max(MIN_H, heightRef.current - delta * 5)
    }

    // zoom: + / - (pinch writes fovRef directly on touch)
    if (k['Equal'] || k['NumpadAdd']) fovRef.current = Math.max(35, fovRef.current - delta * 40)
    if (k['Minus'] || k['NumpadSubtract']) fovRef.current = Math.min(95, fovRef.current + delta * 40)
    const pc = camera as THREE.PerspectiveCamera
    if (Math.abs(pc.fov - fovRef.current) > 0.01) {
      pc.fov += (fovRef.current - pc.fov) * Math.min(1, delta * 10)
      pc.updateProjectionMatrix()
    }

    // QWERTY + AZERTY (Z/Q) friendly movement
    let fwd = (k['KeyW'] || k['KeyZ'] ? 1 : 0) - (k['KeyS'] ? 1 : 0)
    let strafe = (k['KeyD'] ? 1 : 0) - (k['KeyA'] || k['KeyQ'] ? 1 : 0)
    fwd += -joystick.current.y
    strafe += joystick.current.x

    // continuous flying: movement comes from the latched direction instead
    // (tap a key once = keep flying that way, tap again = stop, fence = stuck)
    if (continuousFly && flyLatch) {
      fwd = flyLatch.current.fwd
      strafe = flyLatch.current.strafe
    }

    // handholding / perching: being led or sitting — own steering is off
    if (ledRef?.current || perchedRef?.current) {
      fwd = 0
      strafe = 0
    }

    // tell the wings how hard we're actually flying (LeadFollower overwrites
    // this while led — formation glide ≠ sprint)
    if (moveRef) moveRef.current = Math.min(1, Math.hypot(fwd, strafe))

    const len = Math.hypot(fwd, strafe)
    if (len > 1) {
      fwd /= len
      strafe /= len
    }

    const speed = k['ShiftLeft'] || k['ShiftRight'] ? 14 : 7
    const dir = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    const side = new THREE.Vector3(-dir.z, 0, dir.x)

    camera.position.addScaledVector(dir, fwd * speed * delta)
    camera.position.addScaledVector(side, strafe * speed * delta)

    // hard barrier: stay inside the fence ring
    const r = Math.hypot(camera.position.x, camera.position.z)
    if (r > BOUND) {
      camera.position.x *= BOUND / r
      camera.position.z *= BOUND / r
    }

    // head bob while moving
    const moving = Math.min(1, Math.hypot(fwd, strafe))
    bob.current += delta * speed * 1.1 * moving

    // ride the terrain — never sink beneath the ground
    const gh = groundHeight(camera.position.x, camera.position.z, map)
    camera.position.y = gh + heightRef.current + Math.sin(bob.current) * 0.055 * moving
  })

  return null
}
