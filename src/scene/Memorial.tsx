import { useMemo } from 'react'
import { groundHeight } from './terrain'

// the painter's memorial — where the crowfield's central road dies, a
// full-size straw hat rests on the dirt beside scattered brushes, tin paint
// tubes and a wooden palette, as if the painter himself dissolved into the
// storm air mid-stroke. Human scale, 1890s materials, weathered and dusty.
const SPOT = { x: 0, z: -21 } // just past the road's visible end

// period brushes: worn wood shaft, dull nickel ferrule, hog-bristle tuft
// stained only at the very tip — the rest stays natural bristle brown
const BRUSHES: { x: number; z: number; rot: number; stain: string; len: number }[] = [
  { x: -1.6, z: 0.9, rot: 0.5, stain: '#a5712f', len: 1.5 }, // ochre
  { x: 1.3, z: 1.6, rot: -0.9, stain: '#31456e', len: 1.35 }, // ultramarine
  { x: 1.9, z: -0.7, rot: 2.2, stain: '#b09a35', len: 1.6 }, // chrome yellow
  { x: -0.9, z: -1.8, rot: 1.4, stain: '#93392b', len: 1.3 }, // vermilion
]

// period tin tubes: pewter body, pasted paper label, hand-crimped tail —
// one burst at the shoulder, its paint oozed out and dried on the dirt
const TUBES: { x: number; z: number; rot: number; squeeze: number; ooze?: string }[] = [
  { x: 1.6, z: 0.2, rot: 1.1, squeeze: 0.7, ooze: '#b09a35' },
  { x: -2.1, z: -0.5, rot: -0.4, squeeze: 1.0 },
  { x: 0.4, z: 2.3, rot: 2.8, squeeze: 0.55 },
]

// dabs on the palette: the crow painting's own colors, mid-mix, irregular
const DABS: { x: number; z: number; c: string; s: number }[] = [
  { x: 0.28, z: 0.1, c: '#b09a35', s: 0.09 },
  { x: 0.05, z: 0.32, c: '#a5712f', s: 0.11 },
  { x: -0.22, z: 0.15, c: '#31456e', s: 0.08 },
  { x: 0.15, z: -0.25, c: '#93392b', s: 0.1 },
]

export function Memorial() {
  const gy = useMemo(() => groundHeight(SPOT.x, SPOT.z, 'crowfield'), [])
  return (
    <group position={[SPOT.x, gy, SPOT.z]}>
      {/* the straw hat — human-sized (brim ≈ a bird's wingspan), crown-down,
          tipped toward the sky. Flat-crowned like his actual boater: dusty
          weathered straw, faded ribbon, sweat-stained. No handle. */}
      <group position={[0, 0.3, 0]} rotation={[0.14, 0.4, 0.09]}>
        {/* brim — single dusty straw disc, slightly uneven */}
        <mesh scale={[1, 1, 0.96]}>
          <cylinderGeometry args={[0.95, 1.0, 0.05, 28]} />
          <meshStandardMaterial color="#b09a62" roughness={1} />
        </mesh>
        {/* woven inner ring, a shade darker */}
        <mesh position={[0, 0.032, 0]}>
          <cylinderGeometry args={[0.62, 0.66, 0.03, 24]} />
          <meshStandardMaterial color="#9c8552" roughness={1} />
        </mesh>
        {/* flat crown with a barely-domed top */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.48, 0.54, 0.3, 24]} />
          <meshStandardMaterial color="#a8905a" roughness={1} />
        </mesh>
        <mesh position={[0, 0.35, 0]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.48, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#a8905a" roughness={1} />
        </mesh>
        {/* faded ribbon band, dusty black-brown */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.545, 0.565, 0.14, 24]} />
          <meshStandardMaterial color="#43331f" roughness={1} />
        </mesh>
        {/* sweat stains darkening the brim near the band */}
        <mesh position={[0.35, 0.045, 0.3]} scale={[1.4, 0.15, 1]}>
          <sphereGeometry args={[0.14, 10, 8]} />
          <meshStandardMaterial color="#6e5c38" roughness={1} />
        </mesh>
        <mesh position={[-0.3, 0.045, -0.42]} scale={[1.1, 0.15, 0.9]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#75643e" roughness={1} />
        </mesh>
      </group>

      {/* brushes: shaft, grip, ferrule, two-tone bristle tuft */}
      {BRUSHES.map((b, i) => (
        <group key={`b${i}`} position={[b.x, 0.08, b.z]} rotation={[0, b.rot, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.1, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.05, b.len * 0.62, 8]} />
            <meshStandardMaterial color="#8b6b42" roughness={0.95} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-b.len * 0.42, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.062, b.len * 0.22, 8]} />
            <meshStandardMaterial color="#7a5c36" roughness={0.95} />
          </mesh>
          {/* dull nickel ferrule, paint-caked */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[b.len * 0.26, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, b.len * 0.12, 8]} />
            <meshStandardMaterial color="#8a8a82" roughness={0.7} metalness={0.15} />
          </mesh>
          {/* hog bristles: natural brown, stained only at the working tip */}
          <mesh rotation={[0, 0, -Math.PI / 2]} position={[b.len * 0.35, 0, 0]}>
            <coneGeometry args={[0.052, b.len * 0.11, 8]} />
            <meshStandardMaterial color="#5a4a30" roughness={1} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 2]} position={[b.len * 0.41, 0, 0]}>
            <coneGeometry args={[0.03, b.len * 0.06, 8]} />
            <meshStandardMaterial color={b.stain} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* paint tubes: pewter body, paper label, crimped tail, one burst */}
      {TUBES.map((tb, i) => (
        <group key={`t${i}`} position={[tb.x, 0.09, tb.z]} rotation={[0, tb.rot, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} scale={[1, 1, tb.squeeze]}>
            <cylinderGeometry args={[0.09, 0.11, 0.5, 9]} />
            <meshStandardMaterial color="#a3a199" roughness={0.75} metalness={0.2} />
          </mesh>
          {/* pasted paper label, aged ivory */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.02, 0, 0]} scale={[1, 1, tb.squeeze]}>
            <cylinderGeometry args={[0.104, 0.104, 0.2, 9]} />
            <meshStandardMaterial color="#cfc7b2" roughness={0.95} />
          </mesh>
          {/* hand-crimped tail */}
          <mesh position={[-0.3 * tb.squeeze - 0.06, 0, 0]}>
            <boxGeometry args={[0.12, 0.16 * tb.squeeze + 0.04, 0.025]} />
            <meshStandardMaterial color="#948f85" roughness={0.85} metalness={0.15} />
          </mesh>
          {/* plain dark cap */}
          <mesh position={[0.29, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.068, 0.068, 0.1, 10]} />
            <meshStandardMaterial color="#6e6a60" roughness={0.8} />
          </mesh>
          {/* burst shoulder: dried paint crusted on the dirt */}
          {tb.ooze && (
            <>
              <mesh position={[0.1, -0.02, 0.08]} scale={[1.6, 0.35, 1.1]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color={tb.ooze} roughness={0.65} />
              </mesh>
              <mesh position={[0.24, -0.055, 0.15]} scale={[2.8, 0.1, 1.7]}>
                <sphereGeometry args={[0.06, 10, 8]} />
                <meshStandardMaterial color={tb.ooze} roughness={0.75} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* the palette: worn oval of dark varnished wood, thumb hole, dabs */}
      <group position={[-0.4, 0.05, 1.1]} rotation={[0, -0.5, 0]}>
        <mesh scale={[1, 1, 0.78]}>
          <cylinderGeometry args={[0.62, 0.62, 0.05, 24]} />
          <meshStandardMaterial color="#4f3a20" roughness={0.9} />
        </mesh>
        <mesh position={[-0.38, 0.01, -0.28]}>
          <cylinderGeometry args={[0.09, 0.09, 0.07, 12]} />
          <meshStandardMaterial color="#2e2110" roughness={1} />
        </mesh>
        {DABS.map((d, i) => (
          <mesh key={`d${i}`} position={[d.x, 0.045, d.z]} scale={[1, 0.32, 1]}>
            <sphereGeometry args={[d.s, 10, 8]} />
            <meshStandardMaterial color={d.c} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
