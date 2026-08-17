import { useMemo } from 'react'
import * as THREE from 'three'

// Auvers distance: soft meadows rolling away beyond the hedgerow — layered
// green swells, dark tree-line clumps, and one splashed poppy patch catching
// the sun (a nod to the orange flecks Van Gogh dotted through the Auvers
// fields). Kills the "bare green floor" band between hedge and haze.
const SWELL = ['#2a6b47', '#3d8049', '#57924a', '#6fa34f', '#4a8a4a']
const TREES = ['#143d33', '#1c5240', '#235c42']
const POPPY = ['#e0642a', '#d94f2a', '#e87830']

export function Meadows() {
  const hills = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1
      const r = 100 + Math.random() * 85
      arr.push({
        pos: [Math.cos(a) * r, -3, Math.sin(a) * r],
        scale: [42 + Math.random() * 30, 9 + Math.random() * 8, 34 + Math.random() * 22],
        color: SWELL[i % SWELL.length],
      })
    }
    return arr
  }, [])

  // tree-line clumps dotting the meadow crests
  const trees = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1)
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })
    const m = new THREE.InstancedMesh(geo, mat, 46)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.random() * 0.12
      const r = 92 + Math.random() * 80
      const s = 2.2 + Math.random() * 3.2
      dummy.position.set(Math.cos(a) * r, 1.5 + Math.random() * 4, Math.sin(a) * r)
      dummy.scale.set(s * 1.3, s, s * 1.3)
      dummy.rotation.y = Math.random() * Math.PI
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(TREES[i % TREES.length]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [])

  // the poppy splash — a low orange-dotted patch on the south-east meadow
  const poppies = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 0)
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true })
    const m = new THREE.InstancedMesh(geo, mat, 130)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    for (let i = 0; i < 130; i++) {
      const x = 60 + (Math.random() - 0.5) * 30
      const z = -85 + (Math.random() - 0.5) * 22
      const s = 0.25 + Math.random() * 0.3
      dummy.position.set(x, 1.2 + Math.random() * 2.4, z)
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(POPPY[i % POPPY.length]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [])

  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} position={h.pos} scale={h.scale}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color={h.color} roughness={1} flatShading />
        </mesh>
      ))}
      <primitive object={trees} />
      <primitive object={poppies} />
    </group>
  )
}
