import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { groundHeight } from './terrain'
import { MIN_H, MAX_H } from './PlayerControls'
import { perchPoints, type PerchPoint } from './perch'
import type { MapId } from './maps'
import type { PresenceState } from './presence'

// perching: click a fence post or shrub crown and your bird glides down and
// settles on it — wings folded, free to look around, movement keys (or the
// perch button) take off again. While settled, the position reported to other
// players is the perch itself (their bird sits ON the post), not the camera.
//
// picking works like bird picking: a window-level capture click, because the
// wheat stopPropagation()s canvas clicks. A click is a perch attempt when a
// perch point lies close to the click ray; birds within 40px win the click.
const SNAP_DIST = 40
const SETTLE_DIST = 0.4
const MARKER_RANGE = 4.5 // icons appear only at the wall itself — 2.2 left dead gaps between boulders
const MARKER_MARGIN = 40 // px from screen edge before the icon hides
const PICK_RAY_DIST = 4.2 // boulder/hedge crests are wide domes — aiming at the rock face must still find the crest
const PICK_MAX_RANGE = 45 // can't perch on something on the far side of the field
const PICK_PX_FALLBACK = 110 // pointer-locked: nearest perch within this many px of the crosshair

export function PerchController({
  perch,
  map,
  paused,
  presenceRef,
  heightRef,
  perchedRef,
  ledRef,
  joystick,
  birdRefs,
  markersRef,
  onPerch,
  onSettled,
  onTakeoff,
}: {
  perch: PerchPoint | null
  map: MapId
  paused: boolean
  presenceRef: React.MutableRefObject<PresenceState>
  heightRef: React.MutableRefObject<number>
  perchedRef: React.MutableRefObject<boolean> // movement lock while gliding down / settled
  ledRef: React.MutableRefObject<boolean> // no perching while holding hands
  joystick: React.MutableRefObject<{ x: number; y: number }>
  birdRefs: React.MutableRefObject<Map<string, THREE.Group>>
  markersRef: React.MutableRefObject<{ x: number; y: number; key: number }[]> // floating perch icons (screen px)
  onPerch: (p: PerchPoint) => void
  onSettled: (settled: boolean) => void
  onTakeoff: () => void
}) {
  const { camera, size } = useThree()
  const pts = useMemo(() => perchPoints(map), [map])
  const settledRef = useRef(false)
  const tmp = useRef({ v: new THREE.Vector3(), e: new THREE.Euler() })
  const markerClock = useRef(0)

  // click-to-perch picking
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    let downX = 0
    let downY = 0
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('[data-ui]')) return
      if (paused || ledRef.current) return
      const locked = !!document.pointerLockElement
      if (!locked && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return // drag release
      const ndc = locked
        ? new THREE.Vector2(0, 0)
        : new THREE.Vector2((e.clientX / size.width) * 2 - 1, -(e.clientY / size.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)

      // birds win the click — a perched attempt near a friend opens their menu instead
      const v = tmp.current.v
      for (const g of birdRefs.current.values()) {
        g.getWorldPosition(v).project(camera)
        if (v.z > 1) continue
        const px = (v.x * 0.5 + 0.5) * size.width
        const py = (-v.y * 0.5 + 0.5) * size.height
        const cx = locked ? size.width / 2 : e.clientX
        const cy = locked ? size.height / 2 : e.clientY
        if (Math.hypot(px - cx, py - cy) < 40) return
      }

      // nearest perch point to the click ray, in front of us and in range
      let best: PerchPoint | null = null
      let bestD = PICK_RAY_DIST
      for (const p of pts) {
        v.set(p.x, p.y, p.z)
        if (v.clone().sub(camera.position).dot(raycaster.ray.direction) < 0) continue // behind us
        if (camera.position.distanceTo(v) > PICK_MAX_RANGE) continue
        const d = raycaster.ray.distanceToPoint(v)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      // pointer-locked forgiveness (same as bird picking): if no crest lay
      // near the crosshair ray, take the nearest crest within a few pixels —
      // a rounded rock face can eat the ray long before it nears the top
      if (!best && locked) {
        let bestPx = PICK_PX_FALLBACK
        for (const p of pts) {
          v.set(p.x, p.y, p.z)
          if (camera.position.distanceTo(v) > PICK_MAX_RANGE) continue
          v.project(camera)
          if (v.z > 1) continue
          const px = (v.x * 0.5 + 0.5) * size.width
          const py = (-v.y * 0.5 + 0.5) * size.height
          const d = Math.hypot(px - size.width / 2, py - size.height / 2)
          if (d < bestPx) {
            bestPx = d
            best = p
          }
        }
      }
      if (best) {
        onPerch(best)
        e.stopPropagation() // landing is not a wheat gust
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [camera, size, pts, paused, ledRef, birdRefs, onPerch])

  useFrame((state, delta) => {
    // floating perch icons: nearby posts that are actually on screen right now
    markerClock.current += delta
    if (markerClock.current > 0.12) {
      markerClock.current = 0
      const out = markersRef.current
      out.length = 0
      if (!perch && !paused && !ledRef.current) {
        const cam = state.camera
        const { v } = tmp.current
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i]
          const dx = p.x - cam.position.x
          const dz = p.z - cam.position.z
          if (dx * dx + dz * dz > MARKER_RANGE * MARKER_RANGE) continue
          v.set(p.x, p.y + 0.75, p.z).project(cam)
          if (v.z > 1) continue // behind
          const sx = (v.x * 0.5 + 0.5) * size.width
          const sy = (-v.y * 0.5 + 0.5) * size.height
          if (sx < MARKER_MARGIN || sx > size.width - MARKER_MARGIN) continue
          if (sy < MARKER_MARGIN || sy > size.height - MARKER_MARGIN) continue
          out.push({ x: sx, y: sy, key: i })
        }
      }
    }
    if (!perch) {
      perchedRef.current = false
      if (settledRef.current) {
        settledRef.current = false
        onSettled(false)
      }
      return
    }
    perchedRef.current = true
    const cam = state.camera
    const { e: euler } = tmp.current

    // the post itself sits OUTSIDE the movement fence (r 68 vs BOUND 66.5),
    // so the camera anchors just inside the ring — otherwise PlayerControls'
    // boundary clamp and this pull fight forever and the bird never settles.
    // the reported bird still lands exactly ON the post
    const pr = Math.hypot(perch.x, perch.z)
    const eyeScale = (pr - 2.2) / pr
    const eyeX = perch.x * eyeScale
    const eyeZ = perch.z * eyeScale

    // glide down to the perch (same capped-speed pull as the handhold follow)
    const dx = eyeX - cam.position.x
    const dz = eyeZ - cam.position.z
    const dist = Math.hypot(dx, dz)
    if (dist > SNAP_DIST) {
      cam.position.x = eyeX
      cam.position.z = eyeZ
    } else if (dist > 0.02) {
      const speed = Math.min(10, 3 + dist * 2)
      const step = Math.min(dist, speed * delta)
      cam.position.x += (dx / dist) * step
      cam.position.z += (dz / dist) * step
    }

    // eye height: just above the perch top, written through heightRef so
    // PlayerControls' terrain math keeps owning camera.y
    const gh = groundHeight(cam.position.x, cam.position.z, map)
    const targetH = THREE.MathUtils.clamp(perch.y + 0.5 - gh, MIN_H, MAX_H)
    heightRef.current += (targetH - heightRef.current) * Math.min(1, delta * 3)

    const settled = dist < SETTLE_DIST
    if (settled !== settledRef.current) {
      settledRef.current = settled
      onSettled(settled)
    }
    if (settled) {
      // the bird sits ON the post — friends see it there, wings folded
      euler.setFromQuaternion(cam.quaternion, 'YXZ')
      presenceRef.current = { x: perch.x, y: perch.y + 0.08, z: perch.z, yaw: euler.y }
      // pushing the touch joystick hops off again
      if (Math.hypot(joystick.current.x, joystick.current.y) > 0.4) onTakeoff()
    }
  })

  return null
}
