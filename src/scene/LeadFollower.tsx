import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { groundHeight } from './terrain'
import { MIN_H, MAX_H } from './PlayerControls'
import type { MapId } from './maps'

// handholding: while I'm being led, my bird tags along right behind the
// guide's bird. Their reported position is their *bird* (which rides ~2.6
// ahead of their camera, ~0.95 below eye level), so we trail the bird by a
// few units and mirror their altitude. View stays free — you can look around
// while being led; only position is slaved. Runs after PlayerControls' frame
// (mounted later), so its position writes win; PlayerControls zeroes movement
// input via ledRef so the two never fight.
//
// if the guide vanishes (closed the tab without letting go), we unlock local
// controls after a grace period instead of freezing the follower in place;
// the server also auto-releases stale links, so the tree unchecks shortly after.
// "vanished" is judged by heartbeat freshness, not just visibility — a frozen
// ghost bird would otherwise keep pulling for the whole 12s stale window
const TRAIL_DIST = 5.0 // how far behind the guide's bird we hover
const SNAP_DIST = 40 // farther than this (map switch / teleport) = snap, don't fly across the world
const GUIDE_GONE_MS = 5000 // no fresh heartbeat from the guide for this long = hand slips free

export function LeadFollower({
  ledBy,
  map,
  birdRefs,
  freshnessRef,
  heightRef,
  ledRef,
  leadYawRef,
  moveRef,
  onGuideGone,
}: {
  ledBy: string | null
  map: MapId
  birdRefs: React.MutableRefObject<Map<string, THREE.Group>>
  freshnessRef: React.MutableRefObject<Map<string, [number, number]>> // id -> [server updatedAt, client ms it last advanced]
  heightRef: React.MutableRefObject<number>
  ledRef: React.MutableRefObject<boolean>
  leadYawRef: React.MutableRefObject<number> // the guide's heading — PlayerControls turns toward it while led
  moveRef: React.MutableRefObject<number> // flight effort for the wing flap — glide in formation, flap when catching up
  onGuideGone?: () => void // fired once when the guide stays missing past the grace period
}) {
  const tmp = useRef({ target: new THREE.Vector3() })
  const goneMs = useRef(0)
  const unlocked = useRef(false) // guide absent — controls handed back locally
  const lastLedBy = useRef<string | null>(null)

  useFrame((state, delta) => {
    // a fresh link (or a release) resets the absence bookkeeping
    if (ledBy !== lastLedBy.current) {
      lastLedBy.current = ledBy
      goneMs.current = 0
      unlocked.current = false
    }
    if (!ledBy) {
      ledRef.current = false
      ;(window as unknown as { __led?: boolean }).__led = false
      return
    }
    // ghost detection: no bird OR heartbeat stopped advancing → the guide
    // is gone (clock-skew-proof: we watch the server timestamp *move*,
    // never compare it against our own clock)
    const guide = birdRefs.current.get(ledBy)
    const fresh = freshnessRef.current.get(ledBy)
    const heartbeatFresh = fresh && Date.now() - fresh[1] < GUIDE_GONE_MS
    if (!guide || !heartbeatFresh) {
      goneMs.current += delta * 1000
      // fresh heartbeat but no bird = map-switch remount → patient grace;
      // stale heartbeat = ghost → the freshness window already waited 5s,
      // so only a short confirmation beat before the hand slips free
      const limit = heartbeatFresh ? GUIDE_GONE_MS : 2000
      if (goneMs.current > limit) {
        if (!unlocked.current) {
          unlocked.current = true
          onGuideGone?.()
        }
        ledRef.current = false
        ;(window as unknown as { __led?: boolean }).__led = false
      }
      return
    }
    if (goneMs.current > 0) goneMs.current = 0 // guide (re)appeared
    if (unlocked.current) unlocked.current = false
    ledRef.current = true
    ;(window as unknown as { __led?: boolean }).__led = true

    const cam = state.camera
    const { target } = tmp.current

    // trail point: a few units behind the guide bird's facing direction.
    // share the heading too — PlayerControls eases our yaw toward it, so the
    // follower turns *with* the guide instead of sliding backward/sideways
    const gyaw = guide.rotation.y
    leadYawRef.current = gyaw
    target.set(
      guide.position.x + Math.sin(gyaw) * TRAIL_DIST,
      guide.position.y,
      guide.position.z + Math.cos(gyaw) * TRAIL_DIST
    )

    const dx = target.x - cam.position.x
    const dz = target.z - cam.position.z
    const dist = Math.hypot(dx, dz)
    if (dist > SNAP_DIST) {
      cam.position.x = target.x
      cam.position.z = target.z
    } else if (dist > 0.01) {
      // speed grows with distance: snappy when close, fast when left behind
      const speed = Math.min(16, 4 + dist * 2.5)
      const step = Math.min(dist, speed * delta)
      cam.position.x += (dx / dist) * step
      cam.position.z += (dz / dist) * step
    }

    // wing effort: cruising in formation (dist ≈ 0) is a gentle glide, only
    // falling behind works the wings hard. Never reads altitude easing as
    // effort — that was the mad-flapping bug
    moveRef.current = THREE.MathUtils.clamp(dist / 10, 0.1, 0.6)

    // mirror the guide's altitude: their bird floats 0.95 below their eyes.
    // low-pass filtered — hard-tracking the guide's hover bob made the bird
    // flap like mad; a slow ease reads as a natural rise and fall.
    // written through heightRef so PlayerControls keeps applying terrain
    // clamping and the camera never sinks into a hill
    const gh = groundHeight(cam.position.x, cam.position.z, map)
    const targetH = THREE.MathUtils.clamp(guide.position.y + 0.95 - gh, MIN_H, MAX_H)
    heightRef.current += (targetH - heightRef.current) * Math.min(1, delta * 2.5)
  })

  return null
}
