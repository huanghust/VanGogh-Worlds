// Auvers hedgerow — deterministic specs shared by the Hedges renderer and
// perch.ts, so a perched bird lands exactly ON a shrub's crest on every
// client (never inside it). Hashed from the shrub index, no Math.random().
import { groundHeight } from './terrain'

export const HEDGE_ROW0 = 90 // front row — the perchable crests
export const HEDGE_ROW1 = 60 // taller back row, pure scenery

const fract = (v: number) => v - Math.floor(v)
const hash = (n: number) => fract(Math.sin(n * 269.5 + 183.3) * 43758.5453)

export type HedgeSpec = {
  x: number
  z: number
  y: number // ground height at the shrub
  top: number // absolute y of the shrub's crest — the perch point
  h: number // vertical scale
  sx: number // horizontal scale
  rotY: number
  palette: number
}

export function hedgeAt(i: number): HedgeSpec {
  const a = (i / HEDGE_ROW0) * Math.PI * 2 + (hash(i) - 0.5) * 0.04
  const r = 68 + (hash(i + 11) - 0.5) * 1.4
  const x = Math.cos(a) * r
  const z = Math.sin(a) * r
  const y = groundHeight(x, z, 'auvers')
  const h = 1.4 + hash(i + 23) * 1.0
  // renderer sits the shrub at y + h*0.35 with vertical scale h,
  // so the crest lands at y + 1.35*h — that is the perch top
  return {
    x,
    z,
    y,
    top: y + h * 1.35,
    h,
    sx: 1.2 + hash(i + 41) * 1.1,
    rotY: hash(i + 67) * Math.PI,
    palette: Math.floor(hash(i + 89) * 5),
  }
}

export function hedgeBackAt(k: number): HedgeSpec {
  const i = k + 1000 // separate hash stream from the front row
  const a = (k / HEDGE_ROW1) * Math.PI * 2 + 0.05 + (hash(i) - 0.5) * 0.04
  const r = 70.6 + (hash(i + 11) - 0.5) * 1.4
  const x = Math.cos(a) * r
  const z = Math.sin(a) * r
  const y = groundHeight(x, z, 'auvers')
  const h = 1.9 + hash(i + 23) * 1.2
  return {
    x,
    z,
    y,
    top: y + h * 1.35,
    h,
    sx: 1.4 + hash(i + 41) * 1.2,
    rotY: hash(i + 67) * Math.PI,
    palette: Math.floor(hash(i + 89) * 5),
  }
}
