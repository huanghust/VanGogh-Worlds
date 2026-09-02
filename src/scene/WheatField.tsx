import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { groundHeight, pathCenter, pathRange, crowSideRoadX, crowSideRoadSpan } from './terrain'
import type { MapId } from './maps'

// --- paint a wheat stalk texture on canvas: thick brush strokes ---
function makeWheatTexture(map: MapId): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 128, 256)

  const stroke = (x: number, y: number, len: number, ang: number, w: number, col: string) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.strokeStyle = col
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -len)
    ctx.stroke()
    ctx.restore()
  }

  if (map === 'auvers') {
    // young green wheat: teal-green stems, yellow-green heads
    let x = 64
    for (let y = 250; y > 90; y -= 14) {
      x += (Math.random() - 0.5) * 4
      stroke(x, y, 16, (Math.random() - 0.5) * 0.15, 5, Math.random() > 0.5 ? '#2a7a52' : '#3f9a66')
    }
    for (let i = 0; i < 26; i++) {
      const gy = 30 + Math.random() * 70
      const side = i % 2 === 0 ? 1 : -1
      const col = ['#6ab873', '#8fc862', '#b5d66a', '#55aa72'][i % 4]
      stroke(x + (Math.random() - 0.5) * 6, gy + 20, 20 + Math.random() * 12, side * (0.5 + Math.random() * 0.4), 5, col)
    }
    for (let i = 0; i < 10; i++) {
      stroke(x, 40 + Math.random() * 30, 26, (Math.random() - 0.5) * 1.2, 2, '#d4e38a')
    }
  } else if (map === 'crowfield') {
    // storm wheat: sharp lemon yellow with rusty-orange and olive dashes —
    // the acidic, wind-beaten palette of the crow painting
    let x = 64
    for (let y = 250; y > 90; y -= 14) {
      x += (Math.random() - 0.5) * 4
      stroke(x, y, 16, (Math.random() - 0.5) * 0.15, 5, Math.random() > 0.5 ? '#c9a91e' : '#dcc23a')
    }
    for (let i = 0; i < 26; i++) {
      const gy = 30 + Math.random() * 70
      const side = i % 2 === 0 ? 1 : -1
      const col = ['#e3d33f', '#d9c832', '#c0762a', '#efe05a', '#a8a12c'][i % 5]
      stroke(x + (Math.random() - 0.5) * 6, gy + 20, 20 + Math.random() * 12, side * (0.5 + Math.random() * 0.4), 5, col)
    }
    for (let i = 0; i < 10; i++) {
      stroke(x, 40 + Math.random() * 30, 26, (Math.random() - 0.5) * 1.2, 2, '#f2e878')
    }
  } else {
    // golden ripe wheat
    let x = 64
    for (let y = 250; y > 90; y -= 14) {
      x += (Math.random() - 0.5) * 4
      stroke(x, y, 16, (Math.random() - 0.5) * 0.15, 5, Math.random() > 0.5 ? '#c98f1e' : '#e0aa2b')
    }
    for (let i = 0; i < 26; i++) {
      const gy = 30 + Math.random() * 70
      const side = i % 2 === 0 ? 1 : -1
      const col = ['#f5c63a', '#eaa825', '#d8951c', '#f7d456'][i % 4]
      stroke(x + (Math.random() - 0.5) * 6, gy + 20, 20 + Math.random() * 12, side * (0.5 + Math.random() * 0.4), 5, col)
    }
    for (let i = 0; i < 10; i++) {
      stroke(x, 40 + Math.random() * 30, 26, (Math.random() - 0.5) * 1.2, 2, '#f8dd7a')
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// --- short roadside grass tuft for the crowfield paths ---
function makeGrassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 96
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 64, 96)
  // a ragged fan of short blades, springing from one root point
  const blades = ['#4e6a2c', '#5d7a34', '#6d8b3c', '#7fa04a', '#9aa84a', '#557231']
  for (let i = 0; i < 9; i++) {
    const ang = -0.6 + (i / 8) * 1.2 + (Math.random() - 0.5) * 0.2
    const len = 30 + Math.random() * 45
    ctx.strokeStyle = blades[i % blades.length]
    ctx.lineWidth = 4 + Math.random() * 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(32, 94)
    ctx.quadraticCurveTo(32 + Math.sin(ang) * len * 0.4, 94 - len * 0.6, 32 + Math.sin(ang) * len, 94 - len)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}


function makeFlowerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 96
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 64, 96)
  // thin stem
  ctx.strokeStyle = '#2f7a4e'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(32, 92)
  ctx.quadraticCurveTo(30, 60, 33, 34)
  ctx.stroke()
  // petals: a loose cup of yellow strokes
  const petals = ['#f2c21f', '#ffd93a', '#eaa812', '#ffe066', '#f5c63a']
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    ctx.fillStyle = petals[i % petals.length]
    ctx.beginPath()
    ctx.ellipse(32 + Math.cos(a) * 7, 26 + Math.sin(a) * 6, 6.5, 5, a, 0, Math.PI * 2)
    ctx.fill()
  }
  // orange heart
  ctx.fillStyle = '#e07b12'
  ctx.beginPath()
  ctx.arc(32, 26, 4.5, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uGustTime;
uniform vec2 uGustOrigin;
uniform vec3 uPlayer;     // bird position
uniform float uPlayerStr; // 0 at rest, ramps with flight speed
uniform float uWind;      // crowfield: constant one-directional hard wind
varying vec2 vUv;
varying float vShade;

void main() {
  vUv = uv;
  vec3 pos = position;
  vec4 world = instanceMatrix * vec4(pos, 1.0);

  float phase = world.x * 0.35 + world.z * 0.45;
  float h = uv.y;                       // 0 at root, 1 at tip
  float sway = sin(uTime * 1.6 + phase) * 0.16
             + sin(uTime * 2.7 + phase * 1.7) * 0.06;

  // the storm wind: one hard direction (east), but CHAOTIC — layered gusts
  // surge and collapse across the field, sometimes even kicking back against
  // themselves, so whole patches thrash instead of breathing politely
  float gustWave = 0.55
                 + 0.35 * sin(uTime * 0.5 + world.x * 0.045 + world.z * 0.07)
                 + 0.28 * sin(uTime * 1.6 + world.z * 0.13 - world.x * 0.03)
                 + 0.18 * sin(uTime * 3.1 + world.x * 0.21);
  // the storm wind: one hard direction (east), a CONSTANT 8° lean that never
  // lets go, plus CHAOTIC layered gusts surging on top — whole patches thrash
  float lean = uWind * (0.14 + gustWave * 1.2);
  float crosswind = uWind * sin(uTime * 2.3 + world.z * 0.11 + world.x * 0.05) * 0.3;

  // gust ripple travelling from click origin
  float gt = uTime - uGustTime;
  float d = distance(world.xz, uGustOrigin);
  float wave = exp(-abs(d - gt * 14.0) * 0.25) * exp(-gt * 0.9) * step(0.0, gt);
  sway += wave * 1.4 * sin(d * 0.6 - gt * 8.0);

  // bird as a moving wind source — the SAME mechanism as the click gust:
  // broad concentric ripples radiating from the bird, fed into the same
  // sway channel, so whole patches lean together like wind (no per-stalk
  // poking). Speed-driven: hover still and the field ignores you entirely.
  float bd = distance(world.xz, uPlayer.xz);
  float bdy = abs(uPlayer.y - world.y);
  float bmask = (1.0 - smoothstep(0.5, 1.9, bdy)) * uPlayerStr;
  sway += exp(-bd * 0.8) * bmask * 0.85 * sin(bd * 1.2 - uTime * 4.5);

  world.x += (sway + lean) * h * h;
  world.z += (sway * 0.6 + lean * 0.3 + crosswind) * h * h;
  vShade = 0.85 + 0.3 * h + wave * 0.5 + bmask * exp(-bd * 0.8) * 0.25 + lean * 0.12;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * world;
}
`

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uDim;
varying vec2 vUv;
varying float vShade;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.4) discard;
  gl_FragColor = vec4(tex.rgb * vShade * uDim, 1.0);
}
`

function makeFieldMaterial(texture: THREE.CanvasTexture, wind = 0) {
  const uniforms = {
    uTime: { value: 0 },
    uGustTime: { value: -100 },
    uGustOrigin: { value: new THREE.Vector2(0, 0) },
    uPlayer: { value: new THREE.Vector3(0, -100, 0) },
    uPlayerStr: { value: 0 },
    uWind: { value: wind },
    uMap: { value: texture },
    uDim: { value: new THREE.Vector3(1, 1, 1) },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
    transparent: false,
  })
  return { uniforms, material }
}

export function WheatField({
  gust,
  dimRef,
  onClickWheat,
  map,
}: {
  gust: { origin: [number, number]; time: number }
  dimRef: React.MutableRefObject<[number, number, number]>
  onClickWheat: (x: number, z: number) => void
  map: MapId
}) {
  // ?lite test param renders fewer stalks (for software-GL test browsers)
  const lite = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lite')
  // Auvers wheat is young and short — it needs many more stalks to read as a field
  const COUNT = lite ? 6000 : map === 'auvers' ? 52000 : 32000
  const FLOWERS = lite ? 120 : 900
  const lastGust = useRef(0)
  const lastCam = useRef<{ x: number; y: number; z: number } | null>(null)

  const { geometry, texture } = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.62, 1.6, 1, 4)
    g.translate(0, 0.8, 0)
    return { geometry: g, texture: makeWheatTexture(map) }
  }, [map])

  const { uniforms, material } = useMemo(
    () => makeFieldMaterial(texture, map === 'crowfield' ? 1 : 0),
    [texture, map]
  )

  // buttercups (Auvers only)
  const flowerData = useMemo(() => {
    if (map !== 'auvers') return null
    const g = new THREE.PlaneGeometry(0.34, 0.5, 1, 2)
    g.translate(0, 0.25, 0)
    return { geometry: g, ...makeFieldMaterial(makeFlowerTexture()) }
  }, [map])

  // roadside grass tufts (crowfield only) — real 3D blades edging the red
  // dirt roads, thrashing in the same storm wind as the wheat
  const grassData = useMemo(() => {
    if (map !== 'crowfield') return null
    const g = new THREE.PlaneGeometry(0.55, 0.85, 1, 2)
    g.translate(0, 0.425, 0)
    return { geometry: g, ...makeFieldMaterial(makeGrassTexture(), 0.45) } // short tufts catch less storm than the wheat — bent, not flattened across the dirt
  }, [map])

  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, COUNT)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const range = pathRange(map)
    let i = 0
    while (i < COUNT) {
      const r = 2.2 + Math.sqrt(Math.random()) * 63.5 // stay inside the boundary ring
      const a = Math.random() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      // keep the winding path 100% wheat-free — same curve as the ground shader
      if (z < range.zMax && z > range.zMin && Math.abs(x - pathCenter(z, map)) < range.halfWidth) continue
      if (map === 'crowfield') {
        // the two side roads stay wheat-free too (their spans are shorter)
        const spanL = crowSideRoadSpan('left')
        const spanR = crowSideRoadSpan('right')
        if (z > spanL.zMin && z < spanL.zMax && Math.abs(x - crowSideRoadX('left', z)) < 3.0) continue
        if (z > spanR.zMin && z < spanR.zMax && Math.abs(x - crowSideRoadX('right', z)) < 2.8) continue
      }
      dummy.position.set(x, groundHeight(x, z, map), z)
      dummy.rotation.y = Math.random() * Math.PI
      const s = 0.9 + Math.random() * 0.8
      if (map === 'auvers') {
        // young wheat: shorter than ripe wheat, but full and bushy
        dummy.scale.set(s * 1.15, s * (0.75 + Math.random() * 0.4), s * 1.15)
      } else {
        dummy.scale.set(s, s * (0.9 + Math.random() * 0.5), s)
      }
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      i++
    }
    m.instanceMatrix.needsUpdate = true
    return m
  }, [geometry, material, map])

  const flowerMesh = useMemo(() => {
    if (!flowerData) return null
    const m = new THREE.InstancedMesh(flowerData.geometry, flowerData.material, FLOWERS)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    const range = pathRange(map)
    let i = 0
    let guard = 0
    while (i < FLOWERS && guard++ < FLOWERS * 20) {
      // buttercups cluster in the nearer field, like the painting's foreground
      const r = 3 + Math.sqrt(Math.random()) * 40
      const a = Math.random() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (z < range.zMax && z > range.zMin && Math.abs(x - pathCenter(z, map)) < range.halfWidth + 0.6) continue
      dummy.position.set(x, groundHeight(x, z, map), z)
      dummy.rotation.y = Math.random() * Math.PI
      const s = 0.7 + Math.random() * 0.9
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      i++
    }
    m.count = i
    m.instanceMatrix.needsUpdate = true
    return m
  }, [flowerData, map])

  const grassMesh = useMemo(() => {
    if (!grassData) return null
    const MAX = lite ? 1500 : 9000
    const m = new THREE.InstancedMesh(grassData.geometry, grassData.material, MAX)
    m.frustumCulled = false
    const dummy = new THREE.Object3D()
    let i = 0
    // central road (grass thins where the road dies) + the two side roads
    const roads: { xAt: (z: number) => number; zMin: number; zMax: number; wide: number; fork?: boolean }[] = [
      { xAt: () => 0, zMin: -15, zMax: 12, wide: 2.2 },
      { xAt: (z) => crowSideRoadX('left', z), ...crowSideRoadSpan('left'), wide: 2.1, fork: true },
      { xAt: (z) => crowSideRoadX('right', z), ...crowSideRoadSpan('right'), wide: 1.9, fork: true },
    ]
    for (const road of roads) {
      for (let z = road.zMax; z > road.zMin && i < MAX; z -= 0.42) {
        const cx = road.xAt(z)
        // branches plant grass only where the fork has visibly opened —
        // the shared stem's edges belong to the central road alone
        if (road.fork && Math.abs(cx) < 6.5) continue
        for (const side of [-1, 1]) {
          if (Math.random() < 0.42) continue // ragged gaps — clumps, not hedges
          const n = 1 + Math.floor(Math.random() * 3)
          for (let k = 0; k < n && i < MAX; k++) {
            // scattered clumps BESIDE the painted dirt, never on it
            const x = cx + side * (road.wide + 1.6 + Math.random() * 2.0) + (Math.random() - 0.5) * 0.6
            const zz = z + (Math.random() - 0.5) * 0.3
            dummy.position.set(x, groundHeight(x, zz, map), zz)
            dummy.rotation.y = Math.random() * Math.PI
            const s = 0.7 + Math.random() * 0.7
            dummy.scale.set(s, s * (0.8 + Math.random() * 0.5), s)
            dummy.updateMatrix()
            m.setMatrixAt(i, dummy.matrix)
            i++
          }
        }
      }
    }
    m.count = i
    m.instanceMatrix.needsUpdate = true
    return m
  }, [grassData, map, lite])

  useFrame((state, delta) => {
    uniforms.uTime.value = state.clock.elapsedTime
    if (flowerData) flowerData.uniforms.uTime.value = state.clock.elapsedTime
    if (grassData) grassData.uniforms.uTime.value = state.clock.elapsedTime
    // bird as wind source: strength comes ONLY from flight speed — zero when
    // hovering, so a still bird never makes the field shiver
    const cam = state.camera.position
    const prev = lastCam.current
    const speed = prev ? Math.hypot(cam.x - prev.x, cam.y - prev.y, cam.z - prev.z) / Math.max(delta, 1e-4) : 0
    lastCam.current = { x: cam.x, y: cam.y, z: cam.z }
    const strTarget = Math.min(1, Math.max(0, (speed - 1.0) * 0.14)) // wakes up past ~1 m/s
    const str = uniforms.uPlayerStr.value + (strTarget - uniforms.uPlayerStr.value) * Math.min(1, delta * 5)
    uniforms.uPlayer.value.set(cam.x, cam.y, cam.z)
    uniforms.uPlayerStr.value = str
    if (flowerData) {
      flowerData.uniforms.uPlayer.value.set(cam.x, cam.y, cam.z)
      flowerData.uniforms.uPlayerStr.value = str
    }
    const u = uniforms.uDim.value
    const k = Math.min(1, delta * 1.5)
    u.x += (dimRef.current[0] - u.x) * k
    u.y += (dimRef.current[1] - u.y) * k
    u.z += (dimRef.current[2] - u.z) * k
    if (flowerData) flowerData.uniforms.uDim.value.copy(u)
    if (gust.time > lastGust.current) {
      lastGust.current = gust.time
      uniforms.uGustTime.value = state.clock.elapsedTime
      uniforms.uGustOrigin.value.set(gust.origin[0], gust.origin[1])
    }
  })

  return (
    <group>
      <primitive
        object={mesh}
        onClick={(e: { stopPropagation: () => void; point: THREE.Vector3; delta: number }) => {
          if (e.delta > 8) return // a drag-to-look release, not a deliberate tap
          e.stopPropagation()
          onClickWheat(e.point.x, e.point.z)
        }}
      />
      {flowerMesh && <primitive object={flowerMesh} />}
      {grassMesh && <primitive object={grassMesh} />}
    </group>
  )
}
