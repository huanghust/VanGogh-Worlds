import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// swept triangular wing, pivot at the shoulder so flapping rotates at the
// joint instead of around the wing's center (that was the cardboard look)
const makeWingGeo = (side: 1 | -1) => {
  const g = new THREE.BufferGeometry()
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0.18, side * 1.15, 0, -0.05, side * 0.3, 0, -0.38], 3)
  )
  return g
}
const WING_GEO_L = makeWingGeo(-1)
const WING_GEO_R = makeWingGeo(1)

// a small paper-craft sparrow: round body, short conical beak, fanned tail,
// swept-back wings — in warm browns instead of crow black. Faces +Z (its
// flight direction). The crow variant is the same bird larger and pure black:
// the "m"-shaped flock of the storm painting.
function SparrowBird({ b, crow }: { b: SparrowState; crow: boolean }) {
  const leftWing = useRef<THREE.Group>(null)
  const rightWing = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime * b.flapRate + b.phase
    const flap = Math.sin(t) * 0.7 * b.flapAmp + b.dihedral
    if (leftWing.current) leftWing.current.rotation.z = flap
    if (rightWing.current) rightWing.current.rotation.z = -flap
  })
  const bodyCol = crow ? '#14161c' : '#6d5136'
  const headCol = crow ? '#101218' : '#5b4229'
  const beakCol = crow ? '#3a3f4a' : '#c9a35f'
  const tailCol = crow ? '#0d0f14' : '#54401f'
  const wingCol = crow ? '#171a21' : '#63482e'
  return (
    <group scale={crow ? 0.85 : 0.55}>
      {/* body — apex points back toward the tail */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0.02]}>
        <coneGeometry args={[0.18, 0.8, 5]} />
        <meshBasicMaterial color={bodyCol} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.05, 0.42]}>
        <sphereGeometry args={[0.14, 6, 5]} />
        <meshBasicMaterial color={headCol} />
      </mesh>
      {/* beak — small, pale, conical */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0.04, 0.56]}>
        <coneGeometry args={[0.04, 0.16, 4]} />
        <meshBasicMaterial color={beakCol} />
      </mesh>
      {/* tail fan — a flat triangle, tip pointing backward, slightly raised */}
      <mesh rotation-x={-Math.PI / 2 + 0.18} position={[0, 0.04, -0.42]}>
        <circleGeometry args={[0.2, 3]} />
        <meshBasicMaterial color={tailCol} side={THREE.DoubleSide} />
      </mesh>
      {/* wings on shoulder pivots */}
      <group ref={leftWing} position={[-0.1, 0.05, 0.12]}>
        <mesh geometry={WING_GEO_L}>
          <meshBasicMaterial color={wingCol} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={rightWing} position={[0.1, 0.05, 0.12]}>
        <mesh geometry={WING_GEO_R}>
          <meshBasicMaterial color={wingCol} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// sparrows roam a wide annulus over the field, roughly centered on the cypresses.
// crows fly LOW over the wheat, ahead of the spawn and toward the right —
// where the painting's flock streams out of the storm.
const pickTarget = (crow: boolean) => {
  const a = Math.random() * Math.PI * 2
  if (crow) {
    // crows skim the wheat — the camera rides at y≈2-3, so anything above
    // ~9 leaves the frame; the painting's flock flies low and menacing
    const r = 10 + Math.random() * 32
    return { x: Math.cos(a) * r + 12, z: Math.sin(a) * r - 30, h: 3.5 + Math.random() * 4.5 }
  }
  const r = 18 + Math.random() * 38
  return { x: Math.cos(a) * r, z: Math.sin(a) * r - 10, h: 9 + Math.random() * 13 }
}

type SparrowState = {
  pos: THREE.Vector3
  heading: number // yaw; forward = (sin h, 0, cos h)
  speed: number
  targetSpeed: number
  target: { x: number; z: number; h: number }
  delay: number // staggered takeoff on burst
  wobble: number
  phase: number // wing flap phase offset
  flapRate: number
  flapAmp: number // 1 = full flapping, ~0.1 = bounding with wings tucked
  dihedral: number // wing tuck angle while bounding
  glideEnv: number // 0 = flapping … 1 = bounding (eased)
  mode: 'flap' | 'glide'
  modeT: number // seconds left in current mode
  roll: number // bank angle
  awayEnv: number // 0 = flying with the flock … 1 = gone to roost (dusk/night)
}

export function Sparrows({
  burstSignal,
  modeRef,
  crow = false,
}: {
  burstSignal: { t: number; pos: [number, number, number] }
  modeRef: React.MutableRefObject<{ dusk: number; night: number }>
  crow?: boolean // crowfield: a bigger, blacker, lower-flying flock
}) {
  const group = useRef<THREE.Group>(null)
  const N = crow ? 14 : 9

  // per-bird flight state, integrated per-frame so nothing ever jumps
  const birds = useMemo<SparrowState[]>(
    () =>
      Array.from({ length: N }, (_, i) => {
        const start = pickTarget(crow)
        return {
          pos: new THREE.Vector3(start.x, start.h, start.z),
          heading: Math.random() * Math.PI * 2,
          speed: 6 + Math.random() * 4.5,
          targetSpeed: 6 + Math.random() * 4.5,
          target: pickTarget(crow),
          delay: i * 0.12,
          wobble: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          flapRate: crow ? 6 + Math.random() * 3 : 11 + Math.random() * 4, // crows beat slow
          flapAmp: 1,
          dihedral: 0,
          glideEnv: 0,
          mode: 'flap' as const,
          modeT: 1 + Math.random() * 2,
          roll: 0,
          awayEnv: 0,
        }
      }),
    [N, crow]
  )

  const burst = useRef<{ start: number; pos: THREE.Vector3 } | null>(null)
  const lastBurst = useRef(0)
  const tmpLaunch = useRef(new THREE.Vector3())

  // debug: ?crowpos exposes live bird positions on window.__crowPos
  const debugPos = useMemo(() => new URLSearchParams(window.location.search).has('crowpos'), [])

  useFrame((state, delta) => {
    if (!group.current) return
    const clock = state.clock.elapsedTime

    if (burstSignal.t > lastBurst.current) {
      lastBurst.current = burstSignal.t
      burst.current = { start: clock, pos: new THREE.Vector3(...burstSignal.pos) }
    }

    group.current.children.forEach((child, i) => {
      const b = birds[i]

      // --- waypoint wandering: steer toward the target with a limited turn
      // rate, pick a new one on arrival; speed and altitude drift with it
      const dx = b.target.x - b.pos.x
      const dz = b.target.z - b.pos.z
      if (dx * dx + dz * dz < 25) {
        b.target = pickTarget(crow)
        b.targetSpeed = crow ? 7 + Math.random() * 5 : 6 + Math.random() * 4.5
      }
      const desired = Math.atan2(dx, dz)
      const turnMax = crow ? 2.6 : 1.8 // crows jink hard in the storm
      const turn = THREE.MathUtils.clamp(wrapAngle(desired - b.heading), -turnMax * delta, turnMax * delta)
      b.heading += turn
      // bank into the turn — this alone sells "bird" more than any path shape
      const turnRate = delta > 0 ? turn / delta : 0
      const targetRoll = THREE.MathUtils.clamp(-turnRate * 0.45, -0.55, 0.55)
      b.roll += (targetRoll - b.roll) * Math.min(1, delta * 5)

      b.speed += (b.targetSpeed - b.speed) * Math.min(1, delta * 0.8)
      b.pos.x += Math.sin(b.heading) * b.speed * delta
      b.pos.z += Math.cos(b.heading) * b.speed * delta

      // --- flap / bound cycle: sparrows don't soar — they flap in quick
      // bursts and tuck their wings for a split-second dip between them
      b.modeT -= delta
      if (b.modeT <= 0) {
        if (b.mode === 'flap') {
          b.mode = 'glide'
          b.modeT = 0.35 + Math.random() * 0.8
        } else {
          b.mode = 'flap'
          b.modeT = 1 + Math.random() * 2.2
        }
      }
      const glideGoal = b.mode === 'glide' ? 1 : 0
      b.glideEnv += (glideGoal - b.glideEnv) * Math.min(1, delta * 6)

      // height: drift toward the waypoint's, dip a little mid-bound, lively bob
      const effH = b.target.h - b.glideEnv * 1.1 + Math.sin(clock * 1.1 + b.wobble) * 1.0
      b.pos.y += (effH - b.pos.y) * Math.min(1, delta * 0.9)

      // --- roosting: as the sky dims, most of the flock leaves for the night.
      // day = all 9 · dusk ≈ 5 · night ≈ 1 — matches the birdsong fading out.
      // Away birds spiral up and out, then vanish; they flap back at sunrise.
      const { dusk, night } = modeRef.current
      const activeCount = Math.round(N * (1 - dusk * 0.45 - night * 0.9))
      const awayGoal = i < activeCount ? 0 : 1
      b.awayEnv += (awayGoal - b.awayEnv) * Math.min(1, delta * 0.35)
      const e = b.awayEnv * b.awayEnv * (3 - 2 * b.awayEnv) // smoothstep
      child.visible = e < 0.985

      // away anchor: high and far outward, stable per bird
      const awayX = Math.sin(b.wobble * 3.7) * 78
      const awayZ = Math.cos(b.wobble * 3.7) * 78 - 10
      const awayY = 52 + (i % 3) * 4
      const drawX = b.pos.x + (awayX - b.pos.x) * e
      const drawY = b.pos.y + (awayY - b.pos.y) * e
      const drawZ = b.pos.z + (awayZ - b.pos.z) * e

      // --- burst: startle off the treetop, spiral out, blend into the wander
      let launching = false
      if (burst.current && e < 0.3) {
        const local = clock - burst.current.start - b.delay
        const FLIGHT = 2.8
        if (local > 0 && local < FLIGHT) {
          launching = true
          const launched = easeOutCubic(local / FLIGHT)
          const launch = tmpLaunch.current
          const spiralA = b.wobble + launched * 5.0
          launch.set(
            burst.current.pos.x + Math.cos(spiralA) * launched * 6,
            burst.current.pos.y + 1.5 + launched * 6 + Math.sin(launched * Math.PI) * 3,
            burst.current.pos.z + Math.sin(spiralA) * launched * 6
          )
          child.position.lerpVectors(launch, b.pos, launched)
        } else {
          child.position.set(drawX, drawY, drawZ)
        }
      } else {
        child.position.set(drawX, drawY, drawZ)
      }

      // startled or departing sparrows flap hard, never bound
      if (launching || (awayGoal === 1 && b.awayEnv < 0.9)) {
        b.glideEnv = 0
        b.mode = 'flap'
        b.modeT = Math.max(b.modeT, 1.5)
      }
      b.flapAmp = 1 - b.glideEnv * 0.9
      b.dihedral = b.glideEnv * -0.55 // wings tuck in during the bound

      child.rotation.order = 'YXZ'
      child.rotation.y = b.heading
      child.rotation.z = b.roll
    })

    if (debugPos) {
      ;(window as unknown as { __cam: unknown }).__cam = {
        pos: state.camera.position.toArray().map((v) => Math.round(v * 10) / 10),
        fov: (state.camera as THREE.PerspectiveCamera).fov,
        rotX: Math.round(state.camera.rotation.x * 100) / 100,
        rotY: Math.round(state.camera.rotation.y * 100) / 100,
      }
      const g = group.current
      const chain: string[] = []
      let p = g ? g.parent : null
      while (p) {
        chain.push(`${p.type}#${p.name || '-'}vis:${p.visible ? 1 : 0}`)
        p = p.parent
      }
      ;(window as unknown as { __crowPos: unknown }).__crowPos = birds.map((b, i) => ({
        i,
        x: Math.round(b.pos.x * 10) / 10,
        y: Math.round(b.pos.y * 10) / 10,
        z: Math.round(b.pos.z * 10) / 10,
        vis: group.current?.children[i]?.visible ?? null,
        away: Math.round(b.awayEnv * 100) / 100,
      }))
      ;(window as unknown as { __crowDebug: unknown }).__crowDebug = {
        group: g ? g.type : 'null',
        groupVisible: g?.visible,
        world: g ? [...g.matrixWorld.elements.slice(12, 15)].map((v) => Math.round(v * 10) / 10) : null,
        childCount: g?.children.length,
        sceneParent: chain.slice(0, 6),
      }
    }
  })

  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <SparrowBird key={i} b={b} crow={crow} />
      ))}
    </group>
  )
}
