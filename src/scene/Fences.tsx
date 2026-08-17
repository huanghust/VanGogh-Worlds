import { useMemo } from 'react'
import * as THREE from 'three'
import { groundHeight, pathCenter } from './terrain'
import type { MapId } from './maps'

const FENCE_R = 68
const POST_H = 1.3
const RAIL_HEIGHTS = [0.92, 0.5]

// wooden fence ring around the walkable field + a barrier across the path end
export function Fences({ map }: { map: MapId }) {
  const { posts, rails } = useMemo(() => {
    const SEG = 64
    const posts: { pos: [number, number, number]; quat: THREE.Quaternion }[] = []
    const rails: {
      pos: [number, number, number]
      quat: THREE.Quaternion
      len: number
    }[] = []

    // precompute post ground positions
    const ring: { x: number; y: number; z: number }[] = []
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2
      const x = Math.cos(a) * FENCE_R
      const z = Math.sin(a) * FENCE_R
      ring.push({ x, y: groundHeight(x, z, map), z })
    }

    const zAxis = new THREE.Vector3(0, 0, 1)

    for (let i = 0; i < SEG; i++) {
      const p = ring[i]
      // posts stand vertically
      posts.push({ pos: [p.x, p.y + POST_H / 2, p.z], quat: new THREE.Quaternion() })

      const n = ring[(i + 1) % SEG]
      // rails run in true 3D between the two post tops (terrain-aware),
      // so each rail end actually touches its post
      for (const h of RAIL_HEIGHTS) {
        const from = new THREE.Vector3(p.x, p.y + h, p.z)
        const to = new THREE.Vector3(n.x, n.y + h, n.z)
        const dir = to.clone().sub(from)
        const len = dir.length()
        dir.normalize()
        const quat = new THREE.Quaternion().setFromUnitVectors(zAxis, dir)
        const mid = from.clone().add(to).multiplyScalar(0.5)
        rails.push({ pos: [mid.x, mid.y, mid.z], quat, len })
      }
    }
    return { posts, rails }
  }, [map])

  const gateZ = -67.9
  const gateX = pathCenter(gateZ, map)
  const gateY = groundHeight(gateX, gateZ, map)

  return (
    <group>
      {/* fence ring */}
      {posts.map((p, i) => (
        <mesh key={`p${i}`} position={p.pos}>
          <cylinderGeometry args={[0.07, 0.09, POST_H, 6]} />
          <meshStandardMaterial color="#6b4a2a" roughness={1} />
        </mesh>
      ))}
      {rails.map((r, i) => (
        <mesh key={`r${i}`} position={r.pos} quaternion={r.quat}>
          <boxGeometry args={[0.08, 0.12, r.len]} />
          <meshStandardMaterial color="#7d5833" roughness={1} />
        </mesh>
      ))}

      {/* barrier across the end of the dirt path */}
      <group position={[gateX, gateY, gateZ]}>
        <mesh position={[-2.6, 0.7, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 1.4, 6]} />
          <meshStandardMaterial color="#5d3f22" roughness={1} />
        </mesh>
        <mesh position={[2.6, 0.7, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 1.4, 6]} />
          <meshStandardMaterial color="#5d3f22" roughness={1} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[5.4, 0.16, 0.1]} />
          <meshStandardMaterial color="#8a6136" roughness={1} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[5.4, 0.16, 0.1]} />
          <meshStandardMaterial color="#8a6136" roughness={1} />
        </mesh>
      </group>
    </group>
  )
}
