import * as THREE from 'three'
import type { MapId } from './maps'

// paints the ENTIRE sky as oil strokes — no smooth gradients anywhere.
// The canvas is an equirect strip: u wraps around the horizon, v runs from
// zenith (0) to just below the horizon (1). Everything is built from
// individual dashes advected along a vortex flow field, like the swirling
// skies of The Starry Night / Wheatfield with Crows — Dear Van Gogh style.
//
// Deterministic per map (seeded), so every client paints the same sky.

const W = 2048
const H = 1024
const SKY_FRAC = 0.62 // fraction of the canvas above the horizon

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Vortex = { u: number; v: number; s: number }

// sun position matching the shader's sunDir (0.55, 0.42, -0.72).
// canvas fraction from the TOP: (1 - d.y) * SKY_FRAC (flipY — canvas row 0
// is the zenith). The main vortex sits exactly here, so the sky spirals
// AROUND the sun like a Starry Night moon, not beside it.
const SUN = { u: 0.354, v: (1 - 0.421) * SKY_FRAC }

const VORTICES: Record<MapId, Vortex[]> = {
  wheatfield: [
    { u: SUN.u, v: SUN.v, s: 3.6 }, // the sun IS the whirlpool
    { u: 0.75, v: 0.16, s: -1.7 },
    { u: 0.12, v: 0.28, s: 1.5 },
  ],
  auvers: [
    { u: SUN.u, v: SUN.v, s: 2.4 },
    { u: 0.72, v: 0.2, s: -1.2 },
  ],
  crowfield: [
    { u: SUN.u, v: SUN.v, s: 3.4 },
    { u: 0.7, v: 0.13, s: -2.6 },
    { u: 0.14, v: 0.34, s: 1.8 },
  ],
}

// vertical color ramps (zenith → horizon), day palette per painting
const RAMPS: Record<MapId, [number, string][]> = {
  wheatfield: [
    [0.0, '#12306f'],
    [0.35, '#2b5aa8'],
    [0.7, '#5e93c8'],
    [1.0, '#8fc3dd'],
  ],
  auvers: [
    [0.0, '#dfe8d8'],
    [0.4, '#f2ead2'],
    [0.75, '#d8e4cc'],
    [1.0, '#a8ccc0'],
  ],
  crowfield: [
    [0.0, '#101d45'],
    [0.4, '#24365e'],
    [0.75, '#3d5478'],
    [1.0, '#6b7f9e'],
  ],
}

const ACCENTS: Record<MapId, string[]> = {
  wheatfield: ['#eef4f8', '#7fb2e0', '#c8e0f0', '#4a7cc0'],
  auvers: ['#8a9cc8', '#7ab0a0', '#f8f2e0', '#b8c8e0'],
  crowfield: ['#0d1733', '#56688e', '#b8c0c8', '#1a2a52'],
}

function rampAt(ramp: [number, string][], t: number, out: [number, number, number]) {
  let i = 0
  while (i < ramp.length - 2 && t > ramp[i + 1][0]) i++
  const [t0, c0] = ramp[i]
  const [t1, c1] = ramp[i + 1]
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  const a = parseInt(c0.slice(1), 16)
  const b = parseInt(c1.slice(1), 16)
  out[0] = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k
  out[1] = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k
  out[2] = (a & 255) + ((b & 255) - (a & 255)) * k
}

// flow field: gentle rightward drift + vortex tangents (wrapping in u).
// Wide falloff — the whirlpools must be visible from across the sky,
// not just beside their cores.
function flowDir(vort: Vortex[], u: number, v: number): [number, number] {
  let dx = 0.7
  let dv = 0.12
  for (const c of vort) {
    let du = u - c.u
    if (du > 0.5) du -= 1
    if (du < -0.5) du += 1
    const dvv = (v - c.v) * 1.6 // v compresses — stretch for isotropy
    const r2 = du * du + dvv * dvv
    const fall = Math.exp(-r2 * 9)
    dx += -dvv * c.s * fall
    dv += du * c.s * fall * 0.6
  }
  const m = Math.hypot(dx, dv) || 1
  return [dx / m, dv / m]
}

export function paintSky(map: MapId): THREE.CanvasTexture {
  const rng = mulberry32(map === 'wheatfield' ? 101 : map === 'auvers' ? 202 : 303)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const vort = VORTICES[map]
  const ramp = RAMPS[map]
  const accents = ACCENTS[map]
  const rgb: [number, number, number] = [0, 0, 0]

  const stroke = (x: number, y: number, ang: number, len: number, w: number, col: string, alpha: number, curve = 0.25) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.strokeStyle = col
    ctx.globalAlpha = alpha
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    ctx.quadraticCurveTo(0, (rng() - 0.5) * len * curve, len / 2, 0)
    ctx.stroke()
    ctx.restore()
  }

  // a dash that follows the flow field — Starry Night swirl-riding strokes
  const flowStroke = (u: number, v: number, len: number, w: number, col: string, alpha: number) => {
    ctx.strokeStyle = col
    ctx.globalAlpha = alpha
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    let cu = u
    let cv = v
    ctx.moveTo(cu * W, cv * H)
    const steps = 6 // more segments — smooth arcs, no kinked "careless" joints
    for (let s = 0; s < steps; s++) {
      const [dx, dv] = flowDir(vort, cu, cv)
      cu += dx * (len / steps / W)
      cv += dv * (len / steps / H)
      ctx.lineTo(cu * W, cv * H)
    }
    ctx.stroke()
  }

  const skyH = H * SKY_FRAC

  // ---- 1. base coat: big horizontal strokes, NO flat fill ----
  for (let y = -20; y < H + 20; y += 14) {
    for (let x = -60; x < W + 60; x += 46 + rng() * 30) {
      const v = Math.min(1, Math.max(0, y / skyH))
      rampAt(ramp, v, rgb)
      if (y > skyH) {
        // below the horizon: deep haze band
        rgb[0] *= 0.55
        rgb[1] *= 0.62
        rgb[2] *= 0.7
      }
      const j = () => (rng() - 0.5) * 26
      const col = `rgb(${Math.round(rgb[0] + j()) | 0},${Math.round(rgb[1] + j()) | 0},${Math.round(rgb[2] + j()) | 0})`
      // even the base coat follows the flow — every layer agrees on direction
      const [fdx, fdv] = flowDir(vort, x / W, y / H)
      const ang = Math.atan2(fdv, fdx) + (rng() - 0.5) * 0.1
      stroke(x + (rng() - 0.5) * 20, y + (rng() - 0.5) * 8, ang, 70 + rng() * 70, 13 + rng() * 6, col, 0.95, 0.12)
    }
  }

  // ---- 2. crowfield storm masses: dark stroke clusters hanging low ----
  if (map === 'crowfield') {
    for (let i = 0; i < 900; i++) {
      const u = rng()
      const v = 0.28 * SKY_FRAC + rng() * 0.42 * SKY_FRAC + 0.08
      const [dx, dv] = flowDir(vort, u, v)
      flowStroke(u, v, 60 + rng() * 90, 12 + rng() * 9, ['#0d1733', '#14224a', '#0a1229'][i % 3], 0.5 + rng() * 0.3)
      void dx
      void dv
    }
    // pale torn puffs between the bellies
    for (let i = 0; i < 260; i++) {
      const u = rng()
      const v = 0.3 * SKY_FRAC + rng() * 0.35 * SKY_FRAC + 0.1
      flowStroke(u, v, 40 + rng() * 60, 8 + rng() * 6, '#b8c0c8', 0.35 + rng() * 0.25)
    }
  }

  // ---- 3. the flow layer: thousands of swirl-riding dashes ----
  const FLOW_N = map === 'auvers' ? 2600 : 3400
  for (let i = 0; i < FLOW_N; i++) {
    const u = rng()
    const v = rng() * SKY_FRAC * 0.98
    const t = v / SKY_FRAC
    rampAt(ramp, t, rgb)
    let col: string
    const roll = rng()
    if (roll < 0.22) {
      col = accents[Math.floor(rng() * accents.length)] // bright accent dashes
    } else {
      const lift = roll < 0.6 ? 1.18 : 0.86 // ridge / groove of the base tone
      col = `rgb(${Math.min(255, Math.round(rgb[0] * lift))},${Math.min(255, Math.round(rgb[1] * lift))},${Math.min(255, Math.round(rgb[2] * lift))})`
    }
    flowStroke(u, v, 34 + rng() * 66, 5 + rng() * 6, col, 0.5 + rng() * 0.35)
  }

  // ---- 4. the sun: concentric rings of tangential dashes ----
  if (map !== 'crowfield') {
    const sx = SUN.u * W
    const sy = SUN.v * H
    const ringCols = ['#fff6d8', '#ffe9a0', '#ffd76e', '#f7efC8']
    for (let r = 26; r < 190; r += 15) {
      const n = Math.floor((r * Math.PI * 2) / 34)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.2
        const x = sx + Math.cos(a) * r
        const y = sy + Math.sin(a) * r * 0.75 // slightly squashed halo
        stroke(x, y, a + Math.PI / 2 + (rng() - 0.5) * 0.3, 18 + rng() * 16, 6 + rng() * 4, ringCols[i % ringCols.length], 0.85)
      }
    }
    // hot core
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2
      const r = rng() * 22
      stroke(sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.75, rng() * Math.PI, 14 + rng() * 12, 7, '#fffbe8', 0.95)
    }
  } else {
    // the storm swallows the sun — a smothered pale smudge of flow-following dashes
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2
      const r = rng() * 0.03
      flowStroke(SUN.u + Math.cos(a) * r, SUN.v + Math.sin(a) * r * 0.6, 24 + rng() * 22, 7 + rng() * 4, '#8e99b8', 0.4)
    }
  }

  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}
