import { useMemo } from 'react'
import * as THREE from 'three'

// flame-shaped cypress, Van Gogh style dark green swirl
function makeCypressGeometry(height: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(height * 0.16, height, 12, 14)
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = (v.y + height / 2) / height // 0 bottom -> 1 top
    // flame silhouette: bulge low, taper to curling tip
    const bulge = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1.0 - t * 0.35)
    const twist = t * 2.6
    const wob = 1 + 0.16 * Math.sin(t * 22.0 + v.x * 4.0)
    const nx = v.x * bulge * wob
    const nz = v.z * bulge * wob
    pos.setXYZ(
      i,
      nx * Math.cos(twist) - nz * Math.sin(twist) + Math.sin(t * 9.0) * 0.25 * t,
      v.y,
      nx * Math.sin(twist) + nz * Math.cos(twist)
    )
  }
  g.computeVertexNormals()
  return g
}

function makeCypressMaterial(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#16351f'
  ctx.fillRect(0, 0, 128, 256)
  // swirling brush strokes
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 128
    const y = Math.random() * 256
    const cols = ['#1d4429', '#0f2a18', '#2a5a33', '#3c6e3a', '#22502e']
    ctx.strokeStyle = cols[i % cols.length]
    ctx.lineWidth = 2 + Math.random() * 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 8, y - 10, x + 14 + Math.random() * 8, y - 18)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
}

export function CypressTrees({ onBurst }: { onBurst: (pos: [number, number, number]) => void }) {
  const trees = useMemo(() => {
    const mat = makeCypressMaterial()
    const defs: { pos: [number, number, number]; h: number }[] = [
      { pos: [-14, 0, -28], h: 16 },
      { pos: [-18.5, 0, -31], h: 12 },
      { pos: [22, 0, -18], h: 18 },
      { pos: [27, 0, -24], h: 13 },
      { pos: [-34, 0, 8], h: 15 },
      { pos: [38, 0, 20], h: 17 },
      { pos: [-8, 0, 42], h: 14 },
      { pos: [12, 0, 55], h: 16 },
      { pos: [-45, 0, -45], h: 19 },
    ]
    return defs.map((d) => ({
      ...d,
      geo: makeCypressGeometry(d.h),
      mat,
    }))
  }, [])

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={t.pos}>
          <mesh
            geometry={t.geo}
            material={t.mat}
            position={[0, t.h / 2, 0]}
            onClick={(e) => {
              if (e.delta > 8) return // drag-to-look release, not a deliberate tap
              e.stopPropagation()
              onBurst([t.pos[0], t.h * 0.85, t.pos[2]])
            }}
          />
          {/* trunk */}
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.18, 0.3, 1.4, 6]} />
            <meshStandardMaterial color="#4a3421" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
