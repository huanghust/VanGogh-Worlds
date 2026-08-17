import * as THREE from 'three'

// brushstroke texture painter — the shared "oil paint" layer. Every surface
// in the paintings gets its texture from here: short, thick, round-capped
// dashes with a slight arc, laid in a coherent direction like Van Gogh's
// hatched strokes. Deterministic via a seeded RNG so every client paints
// the SAME canvas (multiplayer consistency).

export type StrokeOpts = {
  base: string // canvas base color
  colors: string[] // stroke palette, painted in layered passes
  size?: number // canvas px (square)
  strokes?: number // strokes per color pass
  angle?: number // base stroke direction (radians)
  angleJitter?: number
  len?: [number, number] // stroke length range (px)
  wid?: [number, number] // stroke width range (px)
  alpha?: number
  seed?: number
  tile?: boolean // wrap strokes over the edges so the texture tiles seamlessly
}

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

function paintCanvas(o: StrokeOpts, gray: boolean): HTMLCanvasElement {
  const size = o.size ?? 512
  const rng = mulberry32(o.seed ?? 1234)
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = gray ? '#808080' : o.base
  ctx.fillRect(0, 0, size, size)

  const colors = gray ? ['#6a6a6a', '#969696', '#585858', '#ababab', '#767676'] : o.colors
  const count = o.strokes ?? 260
  const angle = o.angle ?? 0
  const jitter = o.angleJitter ?? 0.3
  const [lMin, lMax] = o.len ?? [14, 34]
  const [wMin, wMax] = o.wid ?? [3.5, 7]
  const alpha = o.alpha ?? 0.55

  const dash = (x: number, y: number, len: number, ang: number, w: number, col: string) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.strokeStyle = col
    ctx.globalAlpha = alpha
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    // a slight belly — real bristles never draw a laser-straight line
    ctx.quadraticCurveTo(0, (rng() - 0.5) * len * 0.22, len / 2, 0)
    ctx.stroke()
    ctx.restore()
  }

  for (const col of colors) {
    for (let i = 0; i < count; i++) {
      const x = rng() * size
      const y = rng() * size
      const len = lMin + rng() * (lMax - lMin)
      const ang = angle + (rng() - 0.5) * 2 * jitter
      const w = wMin + rng() * (wMax - wMin)
      if (o.tile) {
        // draw wrapped copies so edges tile cleanly
        for (const ox of [-size, 0, size]) {
          for (const oy of [-size, 0, size]) {
            dash(x + ox, y + oy, len, ang, w, col)
          }
        }
      } else {
        dash(x, y, len, ang, w, col)
      }
    }
  }
  ctx.globalAlpha = 1
  return c
}

/** colored stroke texture */
export function strokeTexture(o: StrokeOpts): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(paintCanvas(o, false))
  tex.colorSpace = THREE.SRGBColorSpace
  if (o.tile) {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
  }
  return tex
}

/** grayscale stroke relief — use as bumpMap for the raised-paint glint */
export function strokeBump(o: StrokeOpts): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(paintCanvas(o, true))
  if (o.tile) {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
  }
  return tex
}

/** neutral (white-based) stroke texture: keeps a mesh's own/instance colors,
 *  only adds painted shading. Pair with strokeBump for impasto. */
export function neutralStroke(seed = 77): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const opts: StrokeOpts = {
    base: '#ffffff',
    colors: ['#e2e2e2', '#c9c9c9', '#f2f2f2', '#b4b4b4'],
    size: 256,
    strokes: 170,
    angleJitter: 0.5,
    len: [10, 26],
    wid: [3, 6],
    alpha: 0.5,
    seed,
    tile: true,
  }
  return { map: strokeTexture(opts), bump: strokeBump(opts) }
}
