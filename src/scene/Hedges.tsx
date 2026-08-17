import { useMemo } from 'react'
import * as THREE from 'three'
import { HEDGE_ROW0, HEDGE_ROW1, hedgeAt, hedgeBackAt } from './hedgeSpec'
import { neutralStroke } from './paint'

// Auvers has no fences — the field ends in a wild hedgerow, like the
// dark green borders Van Gogh painted around the Auvers fields.
// Positions come from hedgeSpec.ts, shared with perch.ts, so a perched
// bird always lands on an actual shrub crest.
export function Hedges() {
  const mesh = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1)
    const stroke = neutralStroke(32)
    const mat = new THREE.MeshStandardMaterial({
      roughness: 1,
      flatShading: true,
      map: stroke.map,
      bumpMap: stroke.bump,
      bumpScale: 0.06,
    })
    const m = new THREE.InstancedMesh(geo, mat, HEDGE_ROW0 + HEDGE_ROW1)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    // hedge palette: deep teal-green to yellow-green, like the painting's borders
    const palette = ['#143d33', '#1c5240', '#2a6b47', '#3d8049', '#57924a']
    let i = 0
    for (let k = 0; k < HEDGE_ROW0; k++) {
      const s = hedgeAt(k)
      dummy.position.set(s.x, s.y + s.h * 0.35, s.z)
      dummy.scale.set(s.sx, s.h, s.sx)
      dummy.rotation.y = s.rotY
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(palette[s.palette]))
      i++
    }
    for (let k = 0; k < HEDGE_ROW1; k++) {
      const s = hedgeBackAt(k)
      dummy.position.set(s.x, s.y + s.h * 0.35, s.z)
      dummy.scale.set(s.sx, s.h, s.sx)
      dummy.rotation.y = s.rotY
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(palette[s.palette]))
      i++
    }
    m.count = i
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [])

  return <primitive object={mesh} />
}
