// Material library. Physically based (MeshStandard/Physical) materials with
// procedural textures. Construction materials use a shader extension that:
//  * maps textures tri-planarly in world space (no UV seams between pieces,
//    and a growing column never stretches its texture),
//  * blends from the RAW construction surface (laterite blocks, cast
//    concrete) to the FINISHED surface (plaster + paint) per instance, driven
//    by the per-instance `aFinish` attribute: a noisy wet edge sweeps down
//    each element as the plasterers work top-down.
import * as THREE from 'three';
import * as TX from './textures.js';

const FINISH_VERT_HEAD = /* glsl */`
attribute float aFinish; attribute float aSeed; attribute float hNorm;
varying float vFinish; varying float vSeed; varying float vH; varying vec3 vWP; varying vec3 vWN;`;

const FINISH_VERT_BODY = /* glsl */`
vec4 wp4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp4 = instanceMatrix * wp4;
#endif
wp4 = modelMatrix * wp4;
vWP = wp4.xyz;
vec3 n0 = objectNormal;
#ifdef USE_INSTANCING
  n0 = mat3(instanceMatrix) * n0;
#endif
vWN = normalize(mat3(modelMatrix) * n0);
vFinish = aFinish; vSeed = aSeed; vH = hNorm;`;

const FINISH_FRAG_HEAD = /* glsl */`
uniform sampler2D tRaw; uniform sampler2D tFin;
uniform float uRawScale; uniform float uFinScale; uniform float uRawRough; uniform float uFinRough;
uniform float uKeepTop; uniform vec3 uFinTint; uniform float uVariation;
varying float vFinish; varying float vSeed; varying float vH; varying vec3 vWP; varying vec3 vWN;
float gMask;
float fHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i), fHash(i + vec3(1,0,0)), f.x), mix(fHash(i + vec3(0,1,0)), fHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0,0,1)), fHash(i + vec3(1,0,1)), f.x), mix(fHash(i + vec3(0,1,1)), fHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
// world-space box projection along the dominant normal axis (one texture
// fetch; architecture is axis-aligned so a blended triplanar is unnecessary)
vec3 triSample(sampler2D t, vec3 p, vec3 n, float s){
  vec3 a = abs(n);
  vec2 uv = (a.x > a.y && a.x > a.z) ? p.zy : (a.y > a.z ? p.xz : p.xy);
  return texture2D(t, uv * s).rgb; }`;

const FINISH_FRAG_MAP = /* glsl */`
vec3 rawC = triSample(tRaw, vWP, vWN, uRawScale);
vec3 finC = triSample(tFin, vWP, vWN, uFinScale) * uFinTint;
float nz = fNoise(vWP * 2.3) * 0.6 + fNoise(vWP * 9.0) * 0.4;
float edge = 1.0 - vFinish * 1.25;
float mask = smoothstep(edge - 0.035, edge + 0.035, vH + (nz - 0.5) * 0.24);
mask = vFinish <= 0.001 ? 0.0 : (vFinish >= 0.999 ? 1.0 : mask);
mask *= 1.0 - uKeepTop * smoothstep(0.62, 0.9, vWN.y);
// freshly applied plaster is darker for a short while (wet band above the edge)
float wet = mask * (1.0 - smoothstep(0.0, 0.18, vH + (nz - 0.5) * 0.24 - edge)) * (1.0 - smoothstep(0.85, 1.0, vFinish));
gMask = mask;
vec3 col = mix(rawC, finC * (1.0 - 0.18 * wet), mask);
col *= 1.0 + (vSeed - 0.5) * uVariation * (1.0 - mask);
diffuseColor.rgb *= col;`;

function finishMaterial(name, { raw, fin, rawScale, finScale, rawRough = 0.9, finRough = 0.85, keepTop = 0, tint = [1, 1, 1], variation = 0.12, metalness = 0 }) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness, name });
  const uniforms = {
    tRaw: { value: raw }, tFin: { value: fin }, uRawScale: { value: rawScale }, uFinScale: { value: finScale },
    uRawRough: { value: rawRough }, uFinRough: { value: finRough }, uKeepTop: { value: keepTop },
    uFinTint: { value: new THREE.Vector3(...tint) }, uVariation: { value: variation },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FINISH_VERT_HEAD}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${FINISH_VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FINISH_FRAG_HEAD}`)
      .replace('#include <map_fragment>', FINISH_FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(uRawRough, uFinRough, gMask);');
  };
  m.customProgramCacheKey = () => `finish:${name}`;
  return m;
}

// World-planar/triplanar textured material that never changes state
function worldMaterial(name, map, scale, rough, extra = {}) {
  return finishMaterial(name, { raw: map, fin: map, rawScale: scale, finScale: scale, rawRough: rough, finRough: rough, variation: extra.variation ?? 0.06, ...extra });
}

export function createMaterials() {
  const M = new Map();
  const plaster = TX.plasterTexture(1);
  const laterite = TX.lateriteTexture(2);
  const concrete = TX.concreteTexture(3);
  const concreteDark = TX.concreteTexture(33, [118, 117, 112]);
  const corr = TX.corrugationNormal();

  // --- construction materials (raw -> finished) ---------------------------------
  M.set('frame', finishMaterial('frame', { raw: concrete, fin: plaster, rawScale: 0.5, finScale: 0.25, rawRough: 0.88, finRough: 0.82, keepTop: 1 }));
  M.set('masonry', finishMaterial('masonry', { raw: laterite, fin: plaster, rawScale: 0.5, finScale: 0.25, rawRough: 0.93, finRough: 0.84, keepTop: 0.35 }));

  // --- paints & fixed finishes --------------------------------------------------------
  const std = (name, o) => { const m = new THREE.MeshStandardMaterial({ name, ...o }); M.set(name, m); return m; };
  std('lavender', { color: 0x8479ad, roughness: 0.6 });
  std('jali', { color: 0x3b4352, roughness: 0.65, metalness: 0.15 });
  std('winframe', { color: 0x2c2a29, roughness: 0.45, metalness: 0.4 });
  std('door', { color: 0x6b4630, roughness: 0.6 });
  std('steel', { color: 0x5b6169, roughness: 0.5, metalness: 0.65 });
  std('timber', { color: 0x5a3a24, roughness: 0.8 });
  std('pipe', { color: 0x8e9294, roughness: 0.55 });
  std('grille', { color: 0x4c6a82, roughness: 0.5, metalness: 0.45 });
  std('stageRed', { color: 0x8a1c1f, roughness: 0.38 });
  std('plinthBlue', { color: 0x3d5566, roughness: 0.6 });
  std('woodPeg', { color: 0x9a7348, roughness: 0.9 });
  std('string', { color: 0xf06a28, roughness: 0.7, emissive: 0x2a0800 });
  std('lime', { color: 0xf4f2ec, roughness: 0.95 });
  std('crane', { color: 0xe4a513, roughness: 0.5, metalness: 0.35 });
  std('craneDark', { color: 0x2b2d30, roughness: 0.6, metalness: 0.4 });
  std('ballast', { color: 0x8d8c86, roughness: 0.9 });
  std('cable', { color: 0x1c1c1c, roughness: 0.4, metalness: 0.6 });
  std('busYellow', { color: 0xf0b40c, roughness: 0.35, metalness: 0.1 });
  std('busDark', { color: 0x1d1f22, roughness: 0.5 });
  std('tyre', { color: 0x151515, roughness: 0.85 });
  std('fenceNet', { color: 0x2f7a3a, roughness: 0.9, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  std('lamp', { color: 0xfff6d8, roughness: 0.3, emissive: 0xfff0c0, emissiveIntensity: 0.3 });
  std('courtLine', { color: 0xf1efe8, roughness: 0.8 });
  std('trunk', { color: 0x6c5a48, roughness: 0.95 });
  std('slide', { color: 0xd8611c, roughness: 0.45 });

  M.set('glass', new THREE.MeshPhysicalMaterial({
    name: 'glass', color: 0x1b252d, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03,
    envMapIntensity: 1.5,
  }));
  M.set('busGlass', new THREE.MeshPhysicalMaterial({ name: 'busGlass', color: 0x14191d, roughness: 0.06, metalness: 0.3, clearcoat: 1 }));

  // --- roofing -------------------------------------------------------------------------
  const greyTex = TX.sheetTexture(21, [178, 186, 194], { fade: 0.2 });
  const redTex = TX.sheetTexture(22, [128, 44, 42], { rust: 0.25, fade: 0.35 });
  const sheetMat = (name, map, metal, rough) => {
    const m = new THREE.MeshStandardMaterial({ name, map, normalMap: corr, normalScale: new THREE.Vector2(1.2, 1.2), metalness: metal, roughness: rough, side: THREE.DoubleSide });
    M.set(name, m); return m;
  };
  sheetMat('sheetGrey', greyTex, 0.55, 0.36);
  sheetMat('sheetRed', redTex, 0.3, 0.5);
  std('ridgeGrey', { color: 0xa3abb3, roughness: 0.4, metalness: 0.55 });
  const tiles = TX.tileTexture(5);
  M.set('tile', new THREE.MeshStandardMaterial({ name: 'tile', map: tiles, roughness: 0.62, side: THREE.DoubleSide }));
  std('ridgeTile', { color: 0x4d2229, roughness: 0.6 });

  // --- signage -----------------------------------------------------------------------------
  M.set('signPublic', new THREE.MeshStandardMaterial({ name: 'signPublic', map: TX.signTexture('DE PAUL PUBLIC SCHOOL', 13.2), roughness: 0.45 }));
  M.set('signJunior', new THREE.MeshStandardMaterial({ name: 'signJunior', map: TX.signTexture('DE PAUL JUNIOR COLLEGE', 9.8), roughness: 0.45 }));
  M.set('busPlate', new THREE.MeshStandardMaterial({ name: 'busPlate', map: TX.plateTexture('DE PAUL', '#101010', '#f7f4ea'), roughness: 0.5 }));

  // --- site ----------------------------------------------------------------------------------
  M.set('pavers', worldMaterial('pavers', TX.paverTexture(6), 0.5, 0.8));
  M.set('plaza', worldMaterial('plaza', TX.plazaTexture(7), 1 / 2.4, 0.75));
  M.set('apron', worldMaterial('apron', TX.apronTexture(8), 1 / 3, 0.85));
  M.set('courtSlab', worldMaterial('courtSlab', concreteDark, 0.4, 0.9));
  M.set('roofslab', worldMaterial('roofslab', concreteDark, 0.5, 0.9));
  M.set('grass', worldMaterial('grass', TX.grassTexture(10), 0.25, 0.95, { variation: 0.25 }));
  M.set('drain', new THREE.MeshStandardMaterial({ name: 'drain', color: 0x2a2826, roughness: 0.9 }));

  M.set('frond', new THREE.MeshStandardMaterial({ name: 'frond', map: TX.frondTexture(11), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
  const leaf = new THREE.MeshStandardMaterial({ name: 'leaf', color: 0xffffff, vertexColors: true, roughness: 0.88 });
  // break smooth canopy blobs into leaf clumps with world-space noise
  leaf.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafP;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vec4 lp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
lp = instanceMatrix * lp;
#endif
vLeafP = (modelMatrix * lp).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLeafP;
float lH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float lN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lH(i), lH(i + vec3(1,0,0)), f.x), mix(lH(i + vec3(0,1,0)), lH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lH(i + vec3(0,0,1)), lH(i + vec3(1,0,1)), f.x), mix(lH(i + vec3(0,1,1)), lH(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float cl = lN(vLeafP * 1.1) * 0.55 + lN(vLeafP * 3.7) * 0.3 + lN(vLeafP * 11.0) * 0.15;
diffuseColor.rgb *= 0.45 + 1.05 * smoothstep(0.25, 0.8, cl);`);
  };
  M.set('leaf', leaf);
  const shrub = leaf.clone();
  shrub.vertexColors = false; shrub.color.set(0x44702c); shrub.name = 'shrub';
  shrub.onBeforeCompile = leaf.onBeforeCompile;
  M.set('shrub', shrub);

  const soil = TX.soilTexture(9);
  return { M, textures: { soil, grass: TX.grassTexture(12), plaster, concrete, laterite } };
}
