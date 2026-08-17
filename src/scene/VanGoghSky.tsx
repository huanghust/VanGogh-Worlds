import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { MapId } from './maps'
import { strokeTexture } from './paint'

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uDusk;
uniform float uNight;
uniform float uAuvers;
uniform float uCrow;
uniform sampler2D uStrokes;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(11.3, 7.7);
    a *= 0.5;
  }
  return v;
}

// swirl distortion around a vortex center
vec2 swirl(vec2 uv, vec2 c, float strength, float radius) {
  vec2 d = uv - c;
  float r = length(d);
  float angle = strength * exp(-r * radius);
  float s = sin(angle);
  float co = cos(angle);
  return vec2(co * d.x - s * d.y, s * d.x + co * d.y) + c;
}

void main() {
  vec3 d = normalize(vDir);
  // project onto a sky plane; keep horizon stable
  float h = clamp(d.y, -0.08, 1.0);
  vec2 uv = vec2(atan(d.z, d.x) * 2.2, h * 3.2);

  // ---- Van Gogh swirls ----
  uv = swirl(uv, vec2(-1.4, 2.35), 2.4 + 0.35 * sin(uTime * 0.11), 2.0);
  uv = swirl(uv, vec2( 1.9, 2.55), -2.0, 2.4);
  uv = swirl(uv, vec2( 0.3, 1.85), 1.5 + 0.3 * sin(uTime * 0.07 + 2.0), 3.0);

  float t = uTime * 0.035;
  // flowing streaky bands
  float bands = fbm(vec2(uv.x * 1.4 + uv.y * 0.6 + t, uv.y * 3.0 - t * 0.7));
  float streak = fbm(uv * vec2(2.2, 5.5) + vec2(t * 1.5, 0.0));
  float strokes = smoothstep(0.35, 0.75, fbm(uv * vec2(5.0, 11.0) + bands * 1.8 + t));

  // ---- palette (wheatfield cobalt | Auvers cream & teal | crowfield storm) ----
  vec3 dayTop     = mix(mix(vec3(0.10, 0.22, 0.55), vec3(0.93, 0.94, 0.87), uAuvers), vec3(0.08, 0.15, 0.40), uCrow);
  vec3 dayHorizon = mix(mix(vec3(0.45, 0.72, 0.88), vec3(0.35, 0.65, 0.61), uAuvers), vec3(0.34, 0.46, 0.64), uCrow);
  vec3 duskTop    = mix(mix(vec3(0.16, 0.10, 0.38), vec3(0.52, 0.44, 0.48), uAuvers), vec3(0.10, 0.08, 0.30), uCrow);
  vec3 duskHorizon= mix(mix(vec3(0.98, 0.55, 0.22), vec3(0.95, 0.66, 0.42), uAuvers), vec3(0.72, 0.44, 0.28), uCrow);
  vec3 nightTop   = mix(mix(vec3(0.02, 0.05, 0.20), vec3(0.03, 0.09, 0.13), uAuvers), vec3(0.02, 0.04, 0.14), uCrow);
  vec3 nightHorizon=mix(mix(vec3(0.08, 0.14, 0.36), vec3(0.09, 0.22, 0.26), uAuvers), vec3(0.06, 0.10, 0.26), uCrow);

  vec3 top = mix(mix(dayTop, duskTop, uDusk), nightTop, uNight);
  vec3 hor = mix(mix(dayHorizon, duskHorizon, uDusk), nightHorizon, uNight);
  vec3 col = mix(hor, top, smoothstep(0.02, 0.55, h));

  // thick-paint strokes — bright on the cobalt sky, dark teal swirls on the Auvers cream
  vec3 strokeDay = mix(mix(vec3(0.75, 0.88, 0.98), vec3(0.22, 0.54, 0.54), uAuvers), vec3(0.78, 0.84, 0.92), uCrow);
  vec3 strokeCol = mix(mix(strokeDay, vec3(1.0, 0.80, 0.45), uDusk), vec3(0.80, 0.86, 1.0), uNight);
  col = mix(col, strokeCol, strokes * (0.35 + 0.30 * uNight + 0.20 * uAuvers + 0.25 * uCrow) * smoothstep(0.0, 0.35, h));
  // crowfield: heavy storm-cloud masses — dark blue-violet bellies hanging
  // LOW over the field, a suffocating lid of cloud with pale grey-white
  // puffs torn between them
  float cloud = smoothstep(0.40, 0.72, fbm(uv * vec2(0.9, 1.7) + vec2(t * 0.6, 3.0)));
  col = mix(col, mix(vec3(0.09, 0.15, 0.34), vec3(0.05, 0.09, 0.24), uNight + uDusk), cloud * 0.85 * uCrow * smoothstep(0.0, 0.45, h));
  // a second, lower deck — the oppressive weight pressing on the horizon
  float lowDeck = smoothstep(0.45, 0.8, fbm(uv * vec2(1.3, 2.2) + vec2(-t * 0.5, 17.0)));
  col = mix(col, mix(vec3(0.12, 0.19, 0.38), vec3(0.07, 0.11, 0.26), uNight + uDusk), lowDeck * 0.6 * uCrow * (1.0 - smoothstep(0.05, 0.35, h)));
  float puff = smoothstep(0.62, 0.85, fbm(uv * vec2(1.6, 2.6) + vec2(-t * 0.4, 9.0)));
  col = mix(col, vec3(0.72, 0.77, 0.79) * (1.0 - 0.6 * uDusk - 0.8 * uNight), puff * 0.45 * uCrow * smoothstep(0.02, 0.3, h));
  // Auvers: lavender-blue swirl accents drifting through the cream
  float lav = smoothstep(0.5, 0.82, streak);
  col = mix(col, vec3(0.52, 0.60, 0.80), lav * 0.30 * uAuvers * (1.0 - uDusk) * (1.0 - uNight));
  col += (bands - 0.5) * 0.10;

  // ---- sun with radiating strokes ----
  vec3 sunDir = normalize(vec3(0.55, 0.42, -0.72));
  float sd = distance(d, sunDir);
  float sunGlow = exp(-sd * 5.5);
  // radiating brush strokes around sun
  vec3 sp = d - sunDir;
  float ang = atan(sp.y, length(sp.xz));
  float rays = 0.5 + 0.5 * sin(ang * 26.0 + fbm(vec2(ang * 4.0, sd * 18.0)) * 6.0 - uTime * 0.15);
  float rayMask = rays * exp(-sd * 3.2);
  vec3 sunCol = mix(vec3(1.0, 0.92, 0.55), vec3(1.0, 0.62, 0.25), uDusk);
  // the storm swallows the sun on the crowfield — only a smothered glow remains
  float sunAmt = mix(mix(1.0, 0.35, uAuvers), 0.18, uCrow);
  col += sunCol * sunGlow * 1.4 * sunAmt;
  col += sunCol * rayMask * 0.55 * sunAmt;
  col += vec3(1.0, 0.98, 0.9) * smoothstep(0.055, 0.0, sd) * 1.6 * mix(1.0, 0.4, uAuvers) * (1.0 - 0.8 * uCrow);

  // a few drifting stars when dusk
  float star = step(0.9975, hash(floor(d.xz / max(d.y, 0.05) * 60.0)));
  col += vec3(1.0, 0.95, 0.7) * star * uDusk * smoothstep(0.15, 0.5, h) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(floor(d.xz * 60.0)) * 20.0));

  // the oil-paint layer: hatched brush dashes sampled THROUGH the swirled
  // uv, so the strokes themselves bend with the vortices — the same impasto
  // dash texture the mountains wear, two scales, crisper at the zenith
  float sk1 = texture2D(uStrokes, uv * vec2(0.32, 0.45)).r;
  float sk2 = texture2D(uStrokes, uv * vec2(0.11, 0.16) + 0.53).r;
  float skyPaint = 0.84 + sk1 * 0.26 + sk2 * 0.12;
  col *= mix(1.0, skyPaint, smoothstep(0.0, 0.18, h)); // keep the horizon haze soft

  // subtle canvas grain
  col += (hash(d.xy * 480.0 + uTime) - 0.5) * 0.03;

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

  const strokeTex = useMemo(
    () =>
      strokeTexture({
        base: '#7d7d7d',
        colors: ['#6b6b6b', '#949494', '#565656', '#ababab'],
        size: 512,
        strokes: 300,
        angle: 0.15,
        angleJitter: 0.35, // freer than the ground — sky strokes dance
        len: [22, 50],
        wid: [5, 9],
        alpha: 0.55,
        seed: 4242,
        tile: true,
      }),
    []
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDusk: { value: 0 },
      uNight: { value: 0 },
      uAuvers: { value: map === 'auvers' ? 1 : 0 },
      uCrow: { value: map === 'crowfield' ? 1 : 0 },
      uStrokes: { value: strokeTex },
    }),
    [map, strokeTex]
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
