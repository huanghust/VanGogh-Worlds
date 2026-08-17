// crowfield boulders — deterministic specs shared by the Boulders renderer
// and perch.ts, so every client sees the same rocks and birds land on the
// exact same spot on every screen. No Math.random() here: everything is a
// hash of the boulder index.
//
// The ring is a WALL, not a dotted line: two ragged, overlapping rows of
// wide rocks, like the hedgerow around the Auvers field but stone.
import { groundHeight } from './terrain'

export const BOULDER_ROW0 = 110 // front row — the perchable crest
export const BOULDER_ROW1 = 85 // taller back row peeking over
export const BOULDER_COUNT = BOULDER_ROW0 + BOULDER_ROW1

const fract = (v: number) => v - Math.floor(v)
const hash = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453)

export type BoulderSpec = {
  x: number
  z: number
  y: number // ground height under the boulder
  top: number // absolute y of the perchable top
  h: number // vertical scale
  r: number // horizontal radius (wide → neighbours overlap into a wall)
  rotY: number
  lean: number
  tint: number // 0..1 into the palette
}

export function boulderAt(i: number): BoulderSpec {
  const row = i < BOULDER_ROW0 ? 0 : 1
  const k = row === 0 ? i : i - BOULDER_ROW0
  const n = row === 0 ? BOULDER_ROW0 : BOULDER_ROW1
  const baseR = row === 0 ? 67.5 : 70.5
  const a = (k / n) * Math.PI * 2 + row * 0.037 + (hash(i) - 0.5) * 0.03
  const rr = baseR + (hash(i + 13) - 0.5) * 1.4
  const x = Math.cos(a) * rr
  const z = Math.sin(a) * rr
  const y = groundHeight(x, z, 'crowfield')
  // front row 1.6–2.7 (perchable), back row taller so the wall reads solid
  const h = (1.6 + hash(i + 31) * 1.1) * (row === 0 ? 1 : 1.35)
  const r = 2.1 + hash(i + 57) * 1.1 // diameter 4.2–6.4 vs ~3.8 spacing: overlap
  return {
    x,
    z,
    y,
    top: y + h,
    h,
    r,
    rotY: hash(i + 137) * Math.PI,
    lean: (hash(i + 173) - 0.5) * 0.22,
    tint: hash(i + 211),
  }
}
