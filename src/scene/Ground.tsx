import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { MapId } from './maps'

const vertexShader = /* glsl */ `
uniform float uAuvers;
uniform float uCrow;
varying vec2 vXZ;
varying float vH;
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
void main() {
  vec3 pos = position;
  if (uAuvers > 0.5) {
    // rolling Auvers hills — MUST stay in sync with terrain.ts groundHeight()
    float n = noise(pos.xz * 0.028) * 0.72 + noise(pos.xz * 0.085) * 0.28;
    float d = length(pos.xz);
    float t = clamp((d - 6.0) / 26.0, 0.0, 1.0);
    float rise = 0.35 + 0.65 * (t * t * (3.0 - 2.0 * t));
    pos.y += (n - 0.35) * 9.5 * rise;
  } else {
    float n = noise(pos.xz * 0.05) * 0.6 + noise(pos.xz * 0.18) * 0.25;
    // gentle rolling field, flat near the walking area center
    float d = length(pos.xz);
    float rise = smoothstep(30.0, 120.0, d);
    // crowfield's plain is nearly flat — in sync with terrain.ts
    pos.y += n * mix(6.0, 2.2, uCrow) * rise;
  }
  vXZ = pos.xz;
  vH = pos.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uDim;
uniform float uAuvers;
uniform float uCrow;
varying vec2 vXZ;
varying float vH;
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.1 + vec2(9.2, 3.7);
    a *= 0.5;
  }
  return v;
}
void main() {
  float strokes = fbm(vXZ * vec2(0.35, 1.4));
  float strokes2 = fbm(vXZ * vec2(1.2, 0.3) + 17.0);
  vec3 col;

  if (uAuvers > 0.5) {
    // ---- Green Wheat Fields, Auvers: emerald swirls ----
    vec3 deepTeal = vec3(0.09, 0.32, 0.28);
    vec3 emerald = vec3(0.22, 0.52, 0.30);
    vec3 youngGreen = vec3(0.42, 0.66, 0.24);
    vec3 sunlit = vec3(0.66, 0.78, 0.28);
    col = mix(deepTeal, emerald, smoothstep(0.25, 0.6, strokes));
    col = mix(col, youngGreen, smoothstep(0.55, 0.8, strokes2));
    col = mix(col, sunlit, smoothstep(0.62, 0.9, strokes) * 0.5);
    // hill crests catch the light, valleys sink into teal
    col += vec3(0.10, 0.12, 0.02) * smoothstep(0.5, 3.5, vH);
    col = mix(col, deepTeal * 0.9, smoothstep(-0.5, -3.5, vH) * 0.5);

    // the pale dirt road: front-right, curving across the field to the far hedgerow
    float roadX = 4.0 + (vXZ.y + 40.0) * 0.16 + sin(vXZ.y * 0.09) * 1.8;
    float road = smoothstep(3.4, 2.2, abs(vXZ.x - roadX)) * step(-66.0, vXZ.y) * step(vXZ.y, 66.0);
    vec3 roadCol = vec3(0.86, 0.85, 0.72);
    roadCol = mix(roadCol, vec3(0.72, 0.80, 0.80), smoothstep(0.4, 0.8, fbm(vXZ * 0.9)) * 0.5);
    roadCol += vec3(0.08, 0.06, -0.02) * smoothstep(0.5, 0.9, strokes2);
    col = mix(col, roadCol, road * 0.95);

    // distant hills melt into teal haze
    float d = length(vXZ);
    col = mix(col, vec3(0.30, 0.55, 0.50), smoothstep(80.0, 170.0, d) * 0.65);
    col = mix(col, vec3(0.62, 0.78, 0.74), smoothstep(150.0, 230.0, d) * 0.55);
  } else if (uCrow > 0.5) {
    // ---- Wheatfield with Crows: storm-lit lemon gold ----
    // the painting's wheat is a brighter, more acidic yellow than Saint-Rémy's,
    // with rusty orange dashes on the left and a greener cast on the right
    vec3 lemon = vec3(0.78, 0.70, 0.13);
    vec3 lemonLight = vec3(0.91, 0.84, 0.25);
    vec3 olive = vec3(0.45, 0.48, 0.14);
    col = mix(lemon, lemonLight, smoothstep(0.32, 0.72, strokes));
    col = mix(col, olive, smoothstep(0.55, 0.85, strokes2) * 0.45);
    col += vH * 0.03;
    // rusty-orange short dashes, mostly left of the path (as in the painting)
    float rustMask = smoothstep(0.60, 0.86, fbm(vXZ * vec2(1.6, 0.5) + 41.0));
    float leftness = smoothstep(2.0, -14.0, vXZ.x);
    col = mix(col, vec3(0.72, 0.44, 0.15), rustMask * leftness * 0.55);
    // the right side of the field runs slightly greener
    col = mix(col, vec3(0.55, 0.58, 0.16), smoothstep(8.0, 40.0, vXZ.x) * 0.35);

    // the THREE roads: a real Y-fork — ONE shared stem from the viewer's feet
    // to the split at z=0, then two narrow branches leaving at steady angles,
    // grass wedges opening between them — like an actual split country road
    float deadEnd = smoothstep(-25.0, -15.0, vXZ.y); // full strength at the viewer's feet, swallows itself by z=-25
    float spanC = step(vXZ.y, 10.0) * deadEnd;
    float spanL = step(-35.0, vXZ.y) * step(vXZ.y, 0.0);
    float spanR = step(-22.0, vXZ.y) * step(vXZ.y, 0.0);
    float tFork = max(-vXZ.y, 0.0);                     // distance past the split
    float blend = smoothstep(0.0, 4.0, tFork);          // branches ease open over the first 4m
    float dC = abs(vXZ.x);                              // central: x = 0
    float dL = abs(vXZ.x + 1.29 * tFork * blend);       // left branch
    float dR = abs(vXZ.x - 1.14 * tFork * blend);       // right branch, fainter
    float roadC = smoothstep(3.0, 1.8, dC) * spanC;
    float roadL = smoothstep(2.8, 1.6, dL) * spanL;
    float roadR = smoothstep(2.6, 1.4, dR) * spanR;
    // grass grows along every roadside; down the central spine it creeps in
    // ONLY where the road is dying — the junction at your feet stays clean dirt
    float verge = clamp(
      (smoothstep(4.6, 3.4, dC) - smoothstep(3.0, 1.8, dC)) * spanC +
      (smoothstep(4.4, 3.2, dL) - smoothstep(2.8, 1.6, dL)) * spanL +
      (smoothstep(4.2, 3.0, dR) - smoothstep(2.6, 1.4, dR)) * spanR +
      smoothstep(0.9, 0.35, dC) * step(vXZ.y, 10.0) * (1.0 - deadEnd),
      0.0, 1.0);
    vec3 dirt = mix(vec3(0.60, 0.39, 0.25), vec3(0.72, 0.52, 0.35), smoothstep(0.3, 0.75, strokes)); // red ochre earth, like real clay dirt
    col = mix(col, dirt, roadC * 0.95);
    col = mix(col, dirt * 0.96, roadL * 0.9);
    col = mix(col, dirt * 0.90, roadR * 0.6); // the right road is barely there
    col = mix(col, vec3(0.48, 0.27, 0.16), (smoothstep(3.6, 3.0, dC) - smoothstep(3.0, 1.8, dC)) * spanC * 0.7); // darker wheel ruts
    col = mix(col, vec3(0.42, 0.54, 0.23), verge * 0.4);   // faint green tint under the roadside grass

    // the storm presses the distance into blue-violet haze
    float d = length(vXZ);
    col = mix(col, vec3(0.26, 0.36, 0.52), smoothstep(70.0, 150.0, d) * 0.7);
    col = mix(col, vec3(0.30, 0.38, 0.60), smoothstep(130.0, 220.0, d) * 0.6);
  } else {
    // ---- golden wheatfield ----
    vec3 gold = vec3(0.83, 0.62, 0.16);
    vec3 goldLight = vec3(0.97, 0.80, 0.32);
    vec3 greenShadow = vec3(0.42, 0.48, 0.16);
    col = mix(gold, goldLight, smoothstep(0.35, 0.75, strokes));
    col = mix(col, greenShadow, smoothstep(0.55, 0.85, strokes2) * 0.4);
    col += vH * 0.03;

    // dirt path along z (x near 0)
    float path = smoothstep(2.6, 1.4, abs(vXZ.x + sin(vXZ.y * 0.08) * 1.5)) * step(vXZ.y, 6.0) * step(-66.0, vXZ.y);
    vec3 dirt = vec3(0.72, 0.55, 0.33);
    col = mix(col, dirt * (0.9 + 0.2 * strokes), path * 0.9);

    // distant hills tint blue-green
    float d = length(vXZ);
    col = mix(col, vec3(0.24, 0.42, 0.38), smoothstep(80.0, 160.0, d) * 0.7);
    col = mix(col, vec3(0.35, 0.55, 0.72), smoothstep(140.0, 220.0, d) * 0.6);
  }

  gl_FragColor = vec4(col * uDim, 1.0);
}
`

export function Ground({
  dimRef,
  map,
}: {
  dimRef: React.MutableRefObject<[number, number, number]>
  map: MapId
}) {
  const geometry = useMemo(() => {
    // Auvers hills need finer tessellation to stay smooth
    const g = new THREE.PlaneGeometry(460, 460, map === 'auvers' ? 200 : 128, map === 'auvers' ? 200 : 128)
    g.rotateX(-Math.PI / 2)
    return g
  }, [map])

  const uniforms = useMemo(
    () => ({
      uDim: { value: new THREE.Vector3(1, 1, 1) },
      uAuvers: { value: map === 'auvers' ? 1 : 0 },
      uCrow: { value: map === 'crowfield' ? 1 : 0 },
    }),
    [map]
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      }),
    [uniforms]
  )

  useFrame((_, delta) => {
    const u = uniforms.uDim.value
    const k = Math.min(1, delta * 1.5)
    u.x += (dimRef.current[0] - u.x) * k
    u.y += (dimRef.current[1] - u.y) * k
    u.z += (dimRef.current[2] - u.z) * k
  })

  const mesh = useMemo(() => new THREE.Mesh(geometry, material), [geometry, material])
  return <primitive object={mesh} />
}
