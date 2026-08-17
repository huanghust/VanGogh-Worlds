// JS port of the ground shader's height function — MUST stay in sync with Ground.tsx
import type { MapId } from './maps'

const fract = (v: number) => v - Math.floor(v)

function hash2(x: number, y: number): number {
  let px = fract(x * 234.34)
  let py = fract(y * 435.345)
  const d = px * (px + 34.23) + py * (py + 34.23)
  px += d
  py += d
  return fract(px * py)
}

function noise2(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

export function groundHeight(x: number, z: number, map: MapId = 'wheatfield'): number {
  if (map === 'auvers') {
    // Green Wheat Fields, Auvers: real rolling hills across the whole field,
    // only slightly softened near the spawn point
    const n = noise2(x * 0.028, z * 0.028) * 0.72 + noise2(x * 0.085, z * 0.085) * 0.28
    const d = Math.hypot(x, z)
    const t = Math.min(1, Math.max(0, (d - 6) / 26))
    const rise = 0.35 + 0.65 * (t * t * (3 - 2 * t))
    return (n - 0.35) * 9.5 * rise
  }
  if (map === 'crowfield') {
    // Wheatfield with Crows: the painting's plain is nearly flat — just a low
    // breathing undulation so the wheat horizon doesn't read as a knife edge
    const n = noise2(x * 0.05, z * 0.05) * 0.6 + noise2(x * 0.18, z * 0.18) * 0.25
    const dist = Math.hypot(x, z)
    const t = Math.min(1, Math.max(0, (dist - 30) / 90))
    const rise = t * t * (3 - 2 * t)
    return n * 2.2 * rise
  }
  const n = noise2(x * 0.05, z * 0.05) * 0.6 + noise2(x * 0.18, z * 0.18) * 0.25
  const dist = Math.hypot(x, z)
  const t = Math.min(1, Math.max(0, (dist - 30) / 90))
  const rise = t * t * (3 - 2 * t)
  return n * 6 * rise
}

// winding path center — shared with ground shader and wheat clearing
export function pathCenter(z: number, map: MapId = 'wheatfield'): number {
  if (map === 'auvers') {
    // the pale road of Auvers: enters at the front-right, curves toward the middle distance
    return 4 + (z + 40) * 0.16 + Math.sin(z * 0.09) * 1.8
  }
  if (map === 'crowfield') {
    // the "road to nowhere": dead straight down the middle of the field
    return 0
  }
  return -Math.sin(z * 0.08) * 1.5
}

// crowfield's two side roads (kept in sync with the Ground shader):
// a real Y-fork — from the spawn (z=10) to the split point (z=0) there is
// only ONE road; past it each branch leaves at a steady angle (a short
// smoothstep ease at the split so the fork opens cleanly, no giant dirt apron)
function forkBlend(t: number): number {
  const s = Math.min(1, Math.max(0, t / 4))
  return s * s * (3 - 2 * s) // GLSL smoothstep(0, 4, t)
}

export function crowSideRoadX(side: 'left' | 'right', z: number): number {
  const t = Math.max(0, -z) // distance past the split point
  return (side === 'left' ? -1.29 : 1.14) * t * forkBlend(t)
}

export function crowSideRoadSpan(side: 'left' | 'right'): { zMin: number; zMax: number } {
  // branches exist only past the split — the shared stem is the central road's
  return side === 'left' ? { zMin: -35, zMax: 0 } : { zMin: -22, zMax: 0 }
}

// where the path exists at all (z range) per map
export function pathRange(map: MapId = 'wheatfield'): { zMin: number; zMax: number; halfWidth: number } {
  if (map === 'auvers') return { zMin: -66, zMax: 66, halfWidth: 3.4 } // runs hedge to hedge
  // crowfield: the central road starts at the spawn's feet and dies in the
  // middle of the field — beyond z = -25 there is only wheat. The corridor
  // runs a touch past the junction (z=10) so the spawn stands on dirt
  if (map === 'crowfield') return { zMin: -25, zMax: 12, halfWidth: 3.0 }
  return { zMin: -66, zMax: 6, halfWidth: 2.9 }
}
