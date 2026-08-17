import { useMemo } from 'react'
import * as THREE from 'three'
import { neutralStroke } from './paint'

// crowfield distance: the painting's storm plain ends in rough country.
// Three overlapping ranges of craggy, wind-torn rock — NOT neat pyramids —
// each range hazier than the last (atmospheric perspective), plus scattered
// outcrops and wind-bent thornbushes in the near band so the ground between
// the boulder wall and the ranges never reads as bare floor.
type Crag = {
  pos: [number, number, number]
  scale: [number, number, number]
  rotY: number
  lean: number
  color: string
}

// near slate → mid violet → far haze-blue
const RANGES = [
  { rMin: 95, rMax: 120, hMin: 10, hMax: 20, colors: ['#232c42', '#2a3048', '#1f2839'] },
  { rMin: 135, rMax: 175, hMin: 24, hMax: 42, colors: ['#2e3653', '#343a58', '#3b3a5c'] },
  { rMin: 185, rMax: 235, hMin: 42, hMax: 72, colors: ['#45416a', '#4f4a76', '#565178'] },
]

function ridgeCrags(): Crag[] {
  const out: Crag[] = []
  RANGES.forEach((range, ri) => {
    const n = 14 + ri * 2 // wider rings need more crags to stay continuous
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ri * 0.23 + (Math.random() - 0.5) * 0.14
      const r = range.rMin + Math.random() * (range.rMax - range.rMin)
      const h = range.hMin + Math.random() * (range.hMax - range.hMin)
      const w = h * (1.1 + Math.random() * 0.9) // wide enough to overlap neighbours
      out.push({
        pos: [Math.cos(a) * r, -3 - ri, Math.sin(a) * r],
        scale: [w, h, w * (0.7 + Math.random() * 0.5)],
        rotY: Math.random() * Math.PI,
        lean: (Math.random() - 0.5) * 0.28, // storm-tilted, jagged silhouettes
        color: range.colors[(i + ri) % range.colors.length],
      })
    }
  })
  return out
}

export function Mountains() {
  const crags = useMemo(() => ridgeCrags(), [])
  const stroke = useMemo(() => neutralStroke(33), [])

  // near-band outcrops: lone rocks and shattered slabs between the boulder
  // wall and the first range — the field's rough apron
  const outcrops = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1)
    const stroke = neutralStroke(34)
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, map: stroke.map, bumpMap: stroke.bump, bumpScale: 0.1 })
    const m = new THREE.InstancedMesh(geo, mat, 26)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const palette = ['#3a3550', '#453f5c', '#322e48', '#4c475e']
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2
      const r = 76 + Math.random() * 16
      const s = 1.2 + Math.random() * 2.6
      dummy.position.set(Math.cos(a) * r, 0.2 + Math.random() * 0.8, Math.sin(a) * r)
      dummy.scale.set(s * 1.4, s, s * 1.1)
      dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(palette[i % palette.length]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [])

  // wind-bent thornbushes: dark knots hunched low between the outcrops
  const thorns = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 0)
    const stroke = neutralStroke(35)
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, map: stroke.map, bumpMap: stroke.bump, bumpScale: 0.05 })
    const m = new THREE.InstancedMesh(geo, mat, 34)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const palette = ['#2c2a20', '#3a3626', '#242e22']
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + 0.09 + Math.random() * 0.15
      const r = 74 + Math.random() * 20
      const s = 0.5 + Math.random() * 0.9
      dummy.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r)
      // squashed and stretched eastward — bent by the same storm as the wheat
      dummy.scale.set(s * 1.9, s * 0.7, s)
      dummy.rotation.y = Math.random() * Math.PI
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(palette[i % palette.length]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [])

  return (
    <group>
      {crags.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale} rotation={[0, c.rotY, c.lean]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={c.color}
            roughness={1}
            flatShading
            map={stroke.map}
            bumpMap={stroke.bump}
            bumpScale={0.5}
          />
        </mesh>
      ))}
      <primitive object={outcrops} />
      <primitive object={thorns} />
    </group>
  )
}
