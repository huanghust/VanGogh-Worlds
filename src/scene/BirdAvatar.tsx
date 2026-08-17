import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

// origami paper bird — broad swept delta wings, pointed beak, fan tail.
// built as three folded-paper sheets: body strip + left/right wings (hinged at the spine)
type V = [number, number, number]

const NOSE: V = [0, 0.02, -0.62]
const HEAD_L: V = [-0.08, 0.02, -0.44]
const HEAD_R: V = [0.08, 0.02, -0.44]
const SPINE_A: V = [0, 0.06, -0.22]
const TIP_L: V = [-1.05, 0.12, 0.04]
const TIP_R: V = [1.05, 0.12, 0.04]
const SPINE_B: V = [0, 0.06, 0.1]
const TRAIL_L: V = [-0.2, 0.03, 0.34]
const TRAIL_R: V = [0.2, 0.03, 0.34]
const SPINE_C: V = [0, 0.04, 0.34]
const TAIL_L: V = [-0.24, 0.02, 0.62]
const TAIL_C: V = [0, 0.02, 0.54]
const TAIL_R: V = [0.24, 0.02, 0.62]

function sheet(verts: V[], tris: [number, number, number][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts.flat()), 3))
  g.setIndex(tris.flat())
  g.computeVertexNormals()
  return g
}

function buildBird() {
  const bodyVerts: V[] = [NOSE, HEAD_L, HEAD_R, SPINE_A, SPINE_B, SPINE_C, TRAIL_L, TRAIL_R, TAIL_L, TAIL_C, TAIL_R]
  const body = sheet(bodyVerts, [
    [0, 1, 3], [0, 3, 2], // head
    [1, 3, 4], [2, 4, 3], // back
    [1, 4, 6], [2, 7, 4], // mid body
    [6, 4, 5], [4, 7, 5], // lower body
    [6, 5, 8], [5, 10, 7], // tail fan
    [8, 5, 9], [9, 5, 10],
  ])
  const wingLVerts: V[] = [HEAD_L, SPINE_A, SPINE_B, TRAIL_L, TIP_L]
  const wingL = sheet(wingLVerts, [
    [0, 4, 1], // front facet
    [1, 4, 2], // back facet
    [4, 3, 2], // trailing facet
  ])
  const wingRVerts: V[] = [HEAD_R, SPINE_A, SPINE_B, TRAIL_R, TIP_R]
  const wingR = sheet(wingRVerts, [
    [0, 1, 4],
    [1, 2, 4],
    [4, 2, 3],
  ])
  return { body, wingL, wingR }
}

// shared with RemoteBirds — identical white birds for every online player
export function makeBirdMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 0.3,
    roughness: 0.4,
    flatShading: true,
    side: THREE.DoubleSide,
  })
}
export { buildBird }

// pure white origami bird — you ride it: only its top half shows at the bottom of the screen
export function BirdAvatar({
  bubble,
  presenceRef,
  moveRef,
  perchedAt,
  onTap,
}: {
  bubble: string | null
  presenceRef?: React.MutableRefObject<{ x: number; y: number; z: number; yaw: number }>
  moveRef?: React.MutableRefObject<number> // flight effort 0..1 (hover → full flight), shared with PlayerControls/LeadFollower
  perchedAt?: { x: number; y: number; z: number } | null // settled on a post: your bird sits there in view, wings folded
  onTap?: () => void // touch devices: tapping your own bird opens the chat box
}) {
  const group = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Group>(null)
  const wingR = useRef<THREE.Group>(null)

  const mat = useMemo(makeBirdMaterial, [])

  const parts = useMemo(buildBird, [])

  const prev = useRef({ pos: new THREE.Vector3(), yaw: 0, roll: 0 })
  const tmp = useRef({ fwd: new THREE.Vector3(), target: new THREE.Vector3() })

  useFrame((state, delta) => {
    if (!group.current) return
    const cam = state.camera
    const { fwd, target } = tmp.current
    const t = state.clock.elapsedTime

    // perched: the bird sits ON the post in front of you — visible, wings
    // folded, gently breathing. position reporting stays with PerchController
    if (perchedAt) {
      const sit = 1 - Math.pow(1e-4, delta)
      group.current.position.x += (perchedAt.x - group.current.position.x) * sit
      group.current.position.y += (perchedAt.y + 0.08 - group.current.position.y) * sit
      group.current.position.z += (perchedAt.z - group.current.position.z) * sit
      cam.getWorldDirection(fwd)
      const sitYaw = Math.atan2(-fwd.x, -fwd.z)
      let sdy = sitYaw - group.current.rotation.y
      while (sdy > Math.PI) sdy -= Math.PI * 2
      while (sdy < -Math.PI) sdy += Math.PI * 2
      group.current.rotation.y += sdy * sit
      group.current.rotation.x += (-0.3 - group.current.rotation.x) * sit // chest out, upright — a perched bird, not a bent-over one
      group.current.rotation.z += (0 - group.current.rotation.z) * sit
      const foldT = Math.min(1, delta * 3)
      const sway = Math.sin(t * 1.6) * 0.02
      // wings rest low alongside the body, tips angled gently back — a
      // resting gull silhouette, flat-backed (a hard sweep tents the wings
      // over the spine and reads as a hump)
      if (wingL.current) {
        wingL.current.rotation.z += (0.1 + sway - wingL.current.rotation.z) * foldT
        wingL.current.rotation.y += (0.45 - wingL.current.rotation.y) * foldT
      }
      if (wingR.current) {
        wingR.current.rotation.z += (-0.1 - sway - wingR.current.rotation.z) * foldT
        wingR.current.rotation.y += (-0.45 - wingR.current.rotation.y) * foldT
      }
      return
    }

    cam.getWorldDirection(fwd)

    // riding position: bird ahead, body sunk low so only its top half shows
    // at the bottom edge of the screen — y anchored to the camera, never drifts to center
    target.copy(cam.position).addScaledVector(fwd, 2.6)
    target.y = cam.position.y - 0.95
    // near-rigid follow — the bird IS your avatar, it must never fall behind
    const follow = 1 - Math.pow(1e-6, delta)
    group.current.position.lerp(target, follow)

    const yaw = Math.atan2(-fwd.x, -fwd.z)
    const pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1)) * 0.15

    // banking roll from turn rate
    let yawVel = (yaw - prev.current.yaw) / Math.max(delta, 1e-4)
    if (yawVel > Math.PI / delta) yawVel = 0
    if (yawVel < -Math.PI / delta) yawVel = 0
    let rollTarget = THREE.MathUtils.clamp(yawVel * 0.28, -0.7, 0.7)
    prev.current.roll += (rollTarget - prev.current.roll) * Math.min(1, delta * 6)
    prev.current.yaw = yaw

    group.current.rotation.set(pitch, yaw, prev.current.roll)

    // wing flap: effort comes from the shared moveRef (0 = hover, 1 = full
    // flight) — written by PlayerControls from real input, or by LeadFollower
    // while being led (gentle glide in formation, harder flap only when
    // catching up). Camera displacement was the old signal and it counted
    // altitude easing as "sprinting", hence the mad flapping
    const speed = cam.position.distanceTo(prev.current.pos) / Math.max(delta, 1e-4)
    prev.current.pos.copy(cam.position)
    const moving = moveRef
      ? THREE.MathUtils.clamp(moveRef.current, 0, 1)
      : THREE.MathUtils.clamp(speed / 6, 0, 1)
    const flap = Math.sin(t * (7 + moving * 5)) * (0.1 + moving * 0.45) + Math.sin(t * 1.3) * 0.05
    if (wingL.current) {
      wingL.current.rotation.z = -flap
      wingL.current.rotation.y *= Math.max(0, 1 - delta * 4) // relax any perch sweep
    }
    if (wingR.current) {
      wingR.current.rotation.z = flap
      wingR.current.rotation.y *= Math.max(0, 1 - delta * 4)
    }

    // gentle hover bob
    group.current.position.y += Math.sin(t * 2.1) * 0.03

    // report where our bird is, so other online players can see it
    if (presenceRef) {
      presenceRef.current = {
        x: group.current.position.x,
        y: group.current.position.y,
        z: group.current.position.z,
        yaw: group.current.rotation.y,
      }
    }
  })

  return (
    <group
      ref={group}
      scale={0.9}
      onClick={(e) => {
        if (!onTap) return
        e.stopPropagation() // the bird is in front of the wheat — don't also trigger a gust
        onTap()
      }}
    >
      <mesh geometry={parts.body} material={mat} />
      <group ref={wingL}>
        <mesh geometry={parts.wingL} material={mat} />
      </group>
      <group ref={wingR}>
        <mesh geometry={parts.wingR} material={mat} />
      </group>
      {bubble && (
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
              maxWidth: '33vw', // wrap at one third of the screen width
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 4px 16px rgba(10,15,40,0.35)',
            }}
          >
            {bubble}
          </div>
        </Html>
      )}
    </group>
  )
}