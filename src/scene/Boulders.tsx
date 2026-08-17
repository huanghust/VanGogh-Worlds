import { useMemo } from 'react'
import * as THREE from 'three'
import { BOULDER_COUNT, boulderAt } from './boulderSpec'
import { neutralStroke } from './paint'

// crowfield boundary: a continuous WALL of storm-grey boulders around the
// field — two ragged overlapping rows, like the Auvers hedgerow but stone.
// The front row's crests are the perch spots (same math as perch.ts).
const PALETTE = ['#5d586e', '#6b6579', '#4c475e', '#7a7387', '#655f72', '#575268']

export function Boulders() {
  const mesh = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1)
    const stroke = neutralStroke(31)
    const mat = new THREE.MeshStandardMaterial({
      roughness: 1,
      flatShading: true,
      map: stroke.map,
      bumpMap: stroke.bump,
      bumpScale: 0.08,
    })
    const m = new THREE.InstancedMesh(geo, mat, BOULDER_COUNT)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    for (let i = 0; i < BOULDER_COUNT; i++) {
      const b = boulderAt(i)
      // icosahedron extends ±scale around its origin — origin AT ground level
      // puts the visible top exactly on the perch height (b.top)
      dummy.position.set(b.x, b.y, b.z)
      dummy.scale.set(b.r, b.h, b.r * (0.8 + b.tint * 0.4))
      dummy.rotation.set(0, b.rotY, b.lean)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(PALETTE[i % PALETTE.length]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [])

  return <primitive object={mesh} />
}
