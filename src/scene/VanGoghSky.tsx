import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { MapId } from './maps'
import { paintSky } from './skyPainter'

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

// the sky is a single oil painting (see skyPainter.ts): EVERY pixel of the
// base is a brush dash — no gradients, no fbm clouds. The shader only adds
// time-of-day pigment grading, the living sun, dusk stars, and a slow
// breathing wobble so the painting never sits dead still.
const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uDusk;
uniform float uNight;
uniform float uAuvers;
uniform float uCrow;
uniform sampler2D uSky;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec3 d = normalize(vDir);
  float u = atan(d.z, d.x) / 6.2831853 + 0.5;
  float vv = 1.0 - clamp(d.y, 0.0, 1.0);
  // living paint — the whole canvas breathes, slowly
  u += 0.0035 * sin(uTime * 0.06 + vv * 8.0);
  vv += 0.002 * sin(uTime * 0.045 + u * 20.0);
  vec3 col = texture2D(uSky, vec2(u, 1.0 - vv * 0.62)).rgb; // flipY: v=1 is the canvas TOP (zenith)

  float h = clamp(d.y, -0.08, 1.0);

  // below the horizon the painting melts into haze
  vec3 haze = mix(mix(vec3(0.45, 0.72, 0.88), vec3(0.62, 0.78, 0.74), uAuvers), vec3(0.30, 0.38, 0.60), uCrow);
  col = mix(col, haze, smoothstep(0.04, -0.06, d.y));

  // dusk / night pigment grading — multiplied paint, not a new picture
  vec3 duskGrade = mix(mix(vec3(1.10, 0.72, 0.50), vec3(1.05, 0.78, 0.58), uAuvers), vec3(0.95, 0.62, 0.48), uCrow);
  col = mix(col, col * duskGrade + vec3(0.10, 0.03, 0.0) * (1.0 - h), uDusk);
  col = mix(col, col * vec3(0.30, 0.40, 0.80), uNight);

  // the sun stays alive: breathing glow + slow radiating shimmer
  vec3 sunDir = normalize(vec3(0.55, 0.42, -0.72));
  float sd = distance(d, sunDir);
  float sunGlow = exp(-sd * 5.5);
  vec3 sp = d - sunDir;
  float ang = atan(sp.y, length(sp.xz));
  float rays = 0.5 + 0.5 * sin(ang * 26.0 - uTime * 0.15);
  float rayMask = rays * exp(-sd * 3.2);
  vec3 sunCol = mix(vec3(1.0, 0.92, 0.55), vec3(1.0, 0.62, 0.25), uDusk);
  float sunAmt = mix(mix(1.0, 0.35, uAuvers), 0.18, uCrow) * (1.0 - uNight * 0.85);
  col += sunCol * sunGlow * 1.1 * sunAmt;
  col += sunCol * rayMask * 0.35 * sunAmt;

  // a few drifting stars when dusk / night
  float star = step(0.9975, hash(floor(d.xz / max(d.y, 0.05) * 60.0)));
  col += vec3(1.0, 0.95, 0.7) * star * max(uDusk, uNight) * smoothstep(0.15, 0.5, h) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(floor(d.xz * 60.0)) * 20.0));

  gl_FragColor = vec4(col, 1.0);
}
`

export function VanGoghSky({
  modeRef,
  onSunClick,
  map,
}: {
  modeRef: React.MutableRefObject<{ dusk: number; night: number }>
  onSunClick: () => void
  map: MapId
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  // the painted sky itself — repainted whenever the painting changes
  const skyTex = useMemo(() => paintSky(map), [map])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDusk: { value: 0 },
      uNight: { value: 0 },
      uAuvers: { value: map === 'auvers' ? 1 : 0 },
      uCrow: { value: map === 'crowfield' ? 1 : 0 },
      uSky: { value: skyTex },
    }),
    [map, skyTex]
  )

  useFrame((state, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    const k = Math.min(1, delta * 1.5)
    matRef.current.uniforms.uDusk.value = THREE.MathUtils.lerp(matRef.current.uniforms.uDusk.value, modeRef.current.dusk, k)
    matRef.current.uniforms.uNight.value = THREE.MathUtils.lerp(matRef.current.uniforms.uNight.value, modeRef.current.night, k)
  })

  return (
    <mesh
      onClick={(e) => {
        if (e.delta > 8) return // drag-to-look release, not a deliberate tap
        // clicking the upper sky toggles dusk
        if (e.point.y > 40) onSunClick()
      }}
    >
      <sphereGeometry args={[400, 48, 32]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={frag}
        uniforms={uniforms}
      />
    </mesh>
  )
}
