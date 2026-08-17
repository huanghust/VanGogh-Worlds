import { useMemo } from 'react'

type HouseDef = { pos: [number, number, number]; w: number; h: number; c: string }

const PALETTE = ['#e8dcc0', '#d9c9a8', '#efe2c4', '#cbb894', '#e0d0ac']

function cluster(cx: number, cz: number, n: number, spread: number): HouseDef[] {
  const arr: HouseDef[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random()
    const r = Math.random() * spread
    arr.push({
      pos: [cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r],
      w: 4.5 + Math.random() * 3,
      h: 3 + Math.random() * 2,
      c: PALETTE[i % PALETTE.length],
    })
  }
  return arr
}

// distant blue hills ring + villages scattered AROUND the wheat fields
export function HillsAndVillage() {
  const hills = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2
      const r = 165 + Math.random() * 35
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      arr.push({
        pos: [x, 0, z],
        scale: [55 + Math.random() * 30, 16 + Math.random() * 14, 40 + Math.random() * 20],
        color: i % 2 === 0 ? '#3d6a8a' : '#315a7d',
      })
    }
    return arr
  }, [])

  // hamlets scattered on all sides, beyond the fence, before the hills
  const hamlets = useMemo(
    () => [
      ...cluster(0, -112, 4, 14), // north (with the church)
      ...cluster(98, -52, 3, 12), // north-east
      ...cluster(112, 30, 4, 14), // east
      ...cluster(35, 108, 3, 12), // south-east
      ...cluster(-58, 105, 4, 13), // south-west
      ...cluster(-115, -18, 3, 11), // west
      ...cluster(-85, -78, 3, 12), // north-west
    ],
    []
  )

  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.pos[0], -2, h.pos[2]]} scale={h.scale}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={h.color} roughness={1} flatShading />
        </mesh>
      ))}

      {/* scattered village houses */}
      {hamlets.map((h, i) => (
        <group key={i} position={h.pos}>
          <mesh position={[0, h.h / 2, 0]}>
            <boxGeometry args={[h.w, h.h, h.w]} />
            <meshStandardMaterial color={h.c} roughness={1} />
          </mesh>
          <mesh position={[0, h.h + h.w * 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[h.w * 0.72, h.w * 0.6, 4]} />
            <meshStandardMaterial color="#8a5a3a" roughness={1} />
          </mesh>
          {/* glowing window */}
          <mesh position={[0, h.h * 0.45, h.w / 2 + 0.05]}>
            <planeGeometry args={[0.9, 1.2]} />
            <meshBasicMaterial color="#ffd964" />
          </mesh>
        </group>
      ))}

      {/* church with spire (north hamlet) */}
      <group position={[0, 0, -122]}>
        <mesh position={[0, 3.5, 0]}>
          <boxGeometry args={[8, 7, 10]} />
          <meshStandardMaterial color="#e6d8b8" roughness={1} />
        </mesh>
        <mesh position={[0, 10.5, 0]}>
          <coneGeometry args={[3.4, 8, 4]} />
          <meshStandardMaterial color="#37506e" roughness={1} />
        </mesh>
        <mesh position={[0, 15.5, 0]}>
          <coneGeometry args={[0.5, 3.5, 4]} />
          <meshStandardMaterial color="#2c405a" roughness={1} />
        </mesh>
      </group>
    </group>
  )
}
