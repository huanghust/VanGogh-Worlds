import { groundHeight } from './terrain'
import { BOULDER_ROW0, boulderAt } from './boulderSpec'
import { HEDGE_ROW0, hedgeAt } from './hedgeSpec'
import type { MapId } from './maps'

// perchable spots around the field's edge: fence post tops in the wheatfield,
// shrub crests in Auvers, boulder crests in the crowfield. All deterministic
// (the same math the Fences/Hedges/Boulders renderers use), so every client
// agrees on exactly where a perched bird sits — ON the crest, never inside it.
const FENCE_R = 68
const POST_H = 1.3

export type PerchPoint = { x: number; y: number; z: number }

export function perchPoints(map: MapId): PerchPoint[] {
  if (map === 'crowfield') {
    const pts: PerchPoint[] = []
    for (let i = 0; i < BOULDER_ROW0; i++) {
      const b = boulderAt(i)
      pts.push({ x: b.x, y: b.top, z: b.z })
    }
    return pts
  }
  if (map === 'auvers') {
    const pts: PerchPoint[] = []
    for (let i = 0; i < HEDGE_ROW0; i++) {
      const s = hedgeAt(i)
      pts.push({ x: s.x, y: s.top, z: s.z })
    }
    return pts
  }
  const pts: PerchPoint[] = []
  const SEG = 64
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2
    const x = Math.cos(a) * FENCE_R
    const z = Math.sin(a) * FENCE_R
    pts.push({ x, y: groundHeight(x, z, map) + POST_H, z })
  }
  return pts
}
