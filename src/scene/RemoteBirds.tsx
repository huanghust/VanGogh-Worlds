import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { buildBird, makeBirdMaterial } from './BirdAvatar'
import { getPlayerId, apiList, type RemotePlayer } from './presence'
import { audio } from '../audio/engine'

const BUBBLE_MS = 20000

// remote motion uses a snapshot buffer + interpolation: birds are rendered
// ~350ms in the past, gliding between the two server snapshots that bracket
// that instant. Never extrapolates — extrapolation overshoots on network
// jitter and yanks the bird back (the "rubber-band glitch")
const RENDER_DELAY_MS = 350
const BUF_KEEP_MS = 4000

export type Snap = { x: number; y: number; z: number; yaw: number; t: number }

// one remote player: an identical white origami bird. Friends get a small
// golden name tag overhead; tapping the bird opens the friend menu (handled
// at window level in RemoteBirds — the wheat's stopPropagation would swallow
// any click that passes through a stalk first, so R3F onClick can't be trusted)
function RemoteBird({
  p,
  buf,
  name,
  birdRefs,
  blocked = false,
}: {
  p: RemotePlayer
  buf: Snap[] // persistent per-player snapshot buffer (owned by RemoteBirds)
  name?: string
  birdRefs: React.MutableRefObject<Map<string, THREE.Group>>
  blocked?: boolean // in MY block list: grey husk, their words become "......"
  onSelect: (p: RemotePlayer) => void
}) {
  const group = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Group>(null)
  const wingR = useRef<THREE.Group>(null)
  const parts = useMemo(buildBird, [])
  const mat = useMemo(makeBirdMaterial, [])
  const blockedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7d838e',
        emissive: '#3a3d44',
        emissiveIntensity: 0.25,
        roughness: 0.9,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    []
  )
  const birdMat = blocked ? blockedMat : mat
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const initialized = useRef(false)

  useEffect(() => {
    if (group.current) birdRefs.current.set(p.id, group.current)
    return () => {
      birdRefs.current.delete(p.id)
    }
  }, [p.id, birdRefs])

  useFrame((state, delta) => {
    if (!group.current || buf.length === 0) return
    const t = state.clock.elapsedTime
    // interpolation target: the buffered position RENDER_DELAY_MS in the past
    const renderT = Date.now() - RENDER_DELAY_MS
    let tx: number, ty: number, tz: number, tyaw: number
    const newest = buf[buf.length - 1]
    if (renderT >= newest.t) {
      // starved (a poll was dropped) — hold at the newest snapshot instead
      // of guessing ahead; a hold reads as a hover, a wrong guess reads as a glitch
      ;({ x: tx, y: ty, z: tz, yaw: tyaw } = newest)
    } else if (renderT <= buf[0].t) {
      ;({ x: tx, y: ty, z: tz, yaw: tyaw } = buf[0])
    } else {
      let i = buf.length - 2
      while (i > 0 && buf[i].t > renderT) i--
      const a = buf[i]
      const b = buf[i + 1]
      const f = (renderT - a.t) / Math.max(1, b.t - a.t)
      tx = a.x + (b.x - a.x) * f
      ty = a.y + (b.y - a.y) * f
      tz = a.z + (b.z - a.z) * f
      tyaw = a.yaw + (b.yaw - a.yaw) * f // yaw is pre-unwrapped in the buffer
    }
    if (!initialized.current) {
      group.current.position.set(tx, ty, tz)
      group.current.rotation.y = tyaw
      initialized.current = true
    }
    const dist = Math.hypot(tx - group.current.position.x, ty - group.current.position.y, tz - group.current.position.z)
    if (dist > 25) {
      // hopelessly far (teleport / map switch) — snap, don't glide across the world
      group.current.position.set(tx, ty, tz)
      group.current.rotation.y = tyaw
    } else {
      // light smoothing on top of the interpolation to hide snapshot
      // timestamp quantization (τ ≈ 60ms — invisible, not laggy)
      const follow = 1 - Math.pow(1e-7, delta)
      group.current.position.x += (tx - group.current.position.x) * follow
      group.current.position.y += (ty - group.current.position.y) * follow
      group.current.position.z += (tz - group.current.position.z) * follow
      let dyaw = tyaw - group.current.rotation.y
      while (dyaw > Math.PI) dyaw -= Math.PI * 2
      while (dyaw < -Math.PI) dyaw += Math.PI * 2
      group.current.rotation.y += dyaw * follow
    }

    const flapT = Math.min(1, delta * 4)
    if (p.sitting) {
      // perched: upright chest (matches BirdAvatar), wings rest low alongside
      // the body, tips angled gently back — a resting gull silhouette
      group.current.rotation.x += (-0.3 - group.current.rotation.x) * flapT
      const sway = Math.sin(t * 1.6 + phase) * 0.02
      if (wingL.current) {
        wingL.current.rotation.z += (0.1 + sway - wingL.current.rotation.z) * flapT
        wingL.current.rotation.y += (0.45 - wingL.current.rotation.y) * flapT
      }
      if (wingR.current) {
        wingR.current.rotation.z += (-0.1 - sway - wingR.current.rotation.z) * flapT
        wingR.current.rotation.y += (-0.45 - wingR.current.rotation.y) * flapT
      }
    } else {
      group.current.rotation.x += (0 - group.current.rotation.x) * flapT
      const flap = Math.sin(t * 7 + phase) * 0.3 + Math.sin(t * 1.3 + phase) * 0.05
      if (wingL.current) {
        wingL.current.rotation.z += (-flap - wingL.current.rotation.z) * flapT
        wingL.current.rotation.y *= Math.max(0, 1 - delta * 4) // relax any perch sweep
      }
      if (wingR.current) {
        wingR.current.rotation.z += (flap - wingR.current.rotation.z) * flapT
        wingR.current.rotation.y *= Math.max(0, 1 - delta * 4)
      }
    }
  })

  const showBubble = p.bubble && p.bubbleAt && Date.now() - p.bubbleAt < BUBBLE_MS

  return (
    <group ref={group} scale={0.9}>
      <mesh geometry={parts.body} material={birdMat} />
      <group ref={wingL}>
        <mesh geometry={parts.wingL} material={birdMat} />
      </group>
      <group ref={wingR}>
        <mesh geometry={parts.wingR} material={birdMat} />
      </group>
      {name && (
        <Html position={[0, 0.85, 0]} center zIndexRange={[25, 0]}>
          <div
            style={{
              pointerEvents: 'none',
              background: 'rgba(10,16,38,0.45)',
              color: '#f5e6bd',
              border: '1px solid rgba(245,230,189,0.35)',
              borderRadius: '999px',
              padding: '2px 10px',
              fontSize: '12px',
              fontFamily: 'serif',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
        </Html>
      )}
      {showBubble && (
        <Html position={[0, 0.5, -0.3]} center zIndexRange={[30, 0]}>
          <div
            style={{
              pointerEvents: 'none',
              background: 'rgba(255,255,255,0.95)',
              color: '#1a2340',
              borderRadius: '14px',
              padding: '8px 14px',
              fontSize: '14px',
              fontFamily: 'serif',
              width: 'max-content',
              maxWidth: '33vw',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 4px 16px rgba(10,15,40,0.35)',
            }}
          >
            {blocked ? '......' : p.bubble}
          </div>
        </Html>
      )}
    </group>
  )
}

// polls the server for other online players and renders them as white birds
export function RemoteBirds({
  started,
  map,
  friendNames,
  birdRefs,
  playersRef,
  freshnessRef,
  blocked,
  onSelect,
}: {
  started: boolean
  map: string
  friendNames: Record<string, string>
  birdRefs: React.MutableRefObject<Map<string, THREE.Group>> // lifted to App so the handhold follower can find the guide's bird
  playersRef: React.MutableRefObject<RemotePlayer[]> // latest poll (bird picking)
  freshnessRef: React.MutableRefObject<Map<string, [number, number]>> // id -> [server updatedAt, client ms it last advanced] — LeadFollower's ghost detector
  blocked?: Set<string> // MY block list — those birds fly grey and wordless
  onSelect: (p: RemotePlayer) => void
}) {
  const id = useMemo(getPlayerId, [])
  const [players, setPlayers] = useState<RemotePlayer[]>([])
  // newest bubble timestamp we've already chirped for, per player
  const chirpedAt = useRef(new Map<string, number>())
  // per-player snapshot buffers — the interpolation source for smooth motion
  const snapBufs = useRef(new Map<string, Snap[]>())
  playersRef.current = players
  const { camera, size } = useThree()

  // debug: ?birdpos exposes projected screen positions on window.__birdPos
  // (screenshot tests use it to aim synthetic clicks at a real bird)
  const debugPos = useMemo(() => new URLSearchParams(window.location.search).has('birdpos'), [])
  useFrame(() => {
    if (!debugPos) return
    const v = new THREE.Vector3()
    const out: { id: string; x: number; y: number; behind: boolean }[] = []
    for (const [pid, g] of birdRefs.current) {
      g.getWorldPosition(v).project(camera)
      out.push({
        id: pid,
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
        behind: v.z > 1,
      })
    }
    ;(window as unknown as { __birdPos: unknown }).__birdPos = out
  })

  // Bird picking happens at window level, before the event reaches the canvas:
  // the wheat field stopPropagation()s any click that passes through a stalk
  // first, so a bird behind wheat would never see an R3F onClick. Picking here
  // also lets us swallow the DOM event so a bird tap doesn't ALSO fire a gust.
  //   · unlocked — raycast through the tap point (drag releases are ignored)
  //   · pointer-locked — tap coords are frozen, so raycast from the crosshair
  //     and fall back to "nearest bird within 110px of it" for forgiveness
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    let downX = 0
    let downY = 0
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }
    const findOwner = (obj: THREE.Object3D | null): string | null => {
      while (obj) {
        for (const [pid, g] of birdRefs.current) if (g === obj) return pid
        obj = obj.parent
      }
      return null
    }
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('[data-ui]')) return
      const locked = !!document.pointerLockElement
      if (!locked && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return // drag release
      const ndc = locked
        ? new THREE.Vector2(0, 0)
        : new THREE.Vector2((e.clientX / size.width) * 2 - 1, -(e.clientY / size.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects([...birdRefs.current.values()], true)
      let pid = hits.length > 0 && hits[0].distance < 90 ? findOwner(hits[0].object) : null
      if (!pid && locked) {
        // generous crosshair fallback: nearest projected bird within 110px
        const v = new THREE.Vector3()
        let bestD = 110
        for (const [id2, g] of birdRefs.current) {
          g.getWorldPosition(v).project(camera)
          if (v.z > 1) continue
          const px = (v.x * 0.5 + 0.5) * size.width
          const py = (-v.y * 0.5 + 0.5) * size.height
          const d = Math.hypot(px - size.width / 2, py - size.height / 2)
          if (d < bestD) {
            bestD = d
            pid = id2
          }
        }
      }
      const p = pid ? playersRef.current.find((x) => x.id === pid) : null
      if (p) {
        onSelect(p)
        e.stopPropagation() // a bird tap is not a wheat gust
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [camera, size, onSelect])

  useEffect(() => {
    if (!started) return
    setPlayers([]) // switching paintings clears the old painting's birds at once
    chirpedAt.current.clear()
    snapBufs.current.clear()
    freshnessRef.current.clear()
    let alive = true
    const tick = async () => {
      try {
        const list = await apiList(id, map)
        if (!alive) return
        // a fresh bubble from someone else = a soft incoming chirp
        for (const p of list) {
          if (p.bubble && p.bubbleAt && Date.now() - p.bubbleAt < BUBBLE_MS) {
            if ((chirpedAt.current.get(p.id) ?? 0) < p.bubbleAt) {
              chirpedAt.current.set(p.id, p.bubbleAt)
              audio.playReceive()
            }
          }
        }
        // feed each bird's snapshot buffer; yaw is unwrapped against the
        // previous snapshot so interpolation never spins the long way round
        const now = Date.now()
        const seen = new Set<string>()
        for (const p of list) {
          seen.add(p.id)
          let buf = snapBufs.current.get(p.id)
          if (!buf) {
            buf = []
            snapBufs.current.set(p.id, buf)
          }
          let yaw = p.yaw
          if (buf.length > 0) {
            const last = buf[buf.length - 1].yaw
            while (yaw - last > Math.PI) yaw -= Math.PI * 2
            while (yaw - last < -Math.PI) yaw += Math.PI * 2
          }
          buf.push({ x: p.x, y: p.y, z: p.z, yaw, t: now })
          while (buf.length > 2 && buf[0].t < now - BUF_KEEP_MS) buf.shift()
          // heartbeat freshness: note when the server's updatedAt last moved
          // (skew-proof — never compare the server clock against ours)
          const f = freshnessRef.current.get(p.id)
          if (!f || f[0] !== p.updatedAt) freshnessRef.current.set(p.id, [p.updatedAt, now])
        }
        for (const pid of snapBufs.current.keys()) if (!seen.has(pid)) snapBufs.current.delete(pid)
        setPlayers(list)
      } catch {
        /* silent — a missed poll just means birds update a beat later */
      }
    }
    tick()
    const t = window.setInterval(tick, 400)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [started, id, map])

  return (
    <>
      {players.map((p) => (
        <RemoteBird
          key={p.id}
          p={p}
          buf={snapBufs.current.get(p.id) ?? []}
          name={friendNames[p.id]}
          birdRefs={birdRefs}
          blocked={blocked?.has(p.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}
