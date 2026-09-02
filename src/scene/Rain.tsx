import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// crowfield storm rain — Sky-style: pale slanted streaks that never stop,
// blown the same way the wheat leans. A box of rain follows the camera and
// wraps around it, so the field rains wherever you fly.
const COUNT = 900
const BOX = { x: 70, y: 30, z: 70 }
const SLANT = 0.14 // matches the wheat's constant lean
const FALL = 16 // m/s
const DRIFT = 2.6 // m/s sideways, wind-blown

export function Rain() {
  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.012, 0.55, 0.012)
    const mat = new THREE.MeshBasicMaterial({
      color: '#9fb4d8',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    const m = new THREE.InstancedMesh(geo, mat, COUNT)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * BOX.x,
        Math.random() * BOX.y,
        (Math.random() - 0.5) * BOX.z
      )
      dummy.rotation.z = SLANT
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    return m
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const cam = state.camera.position
    for (let i = 0; i < COUNT; i++) {
      mesh.getMatrixAt(i, dummy.matrix)
      v.setFromMatrixPosition(dummy.matrix)
      v.y -= FALL * delta
      v.x += DRIFT * delta
      if (v.y < 0) v.y += BOX.y
      if (v.x - cam.x > BOX.x / 2) v.x -= BOX.x
      else if (v.x - cam.x < -BOX.x / 2) v.x += BOX.x
      if (v.z - cam.z > BOX.z / 2) v.z -= BOX.z
      else if (v.z - cam.z < -BOX.z / 2) v.z += BOX.z
      dummy.position.copy(v)
      dummy.rotation.z = SLANT
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
