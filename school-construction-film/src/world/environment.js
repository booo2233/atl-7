// Static site context present from frame 1: terrain, tropical forest with
// coconut palms, tea terraces, the neighbouring house, sky, sun and haze.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/math.js';
import { terrainHeight, padDistance, teaMask, fbm2 } from './terrain.js';

export const SUN = { elevation: 38, azimuth: 132 }; // degrees; azimuth from north, clockwise

export function sunDirection() {
  const el = THREE.MathUtils.degToRad(SUN.elevation), az = THREE.MathUtils.degToRad(SUN.azimuth);
  // north = -Z, east = +X
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

function terrainMesh(size, seg, soilTex, sink = 0, holeRadius = 0) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const veg = new Float32Array(pos.count), tea = new Float32Array(pos.count), col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = padDistance(x, z);
    let y = terrainHeight(x, z);
    if (holeRadius > 0 && Math.abs(x) < holeRadius && Math.abs(z) < holeRadius) y -= sink;
    pos.setY(i, y);
    veg[i] = THREE.MathUtils.smoothstep(d, 2, 14);
    tea[i] = teaMask(x, z);
    const n = fbm2(x * 0.02, z * 0.02, 3);
    col[i * 3] = 0.07 + 0.05 * n; col[i * 3 + 1] = 0.12 + 0.07 * n; col[i * 3 + 2] = 0.045 + 0.03 * n;
  }
  g.setAttribute('aVeg', new THREE.BufferAttribute(veg, 1));
  g.setAttribute('aTea', new THREE.BufferAttribute(tea, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tSoil = { value: soilTex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVeg; attribute float aTea; varying float vVeg; varying float vTea; varying vec3 vTP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvVeg = aVeg; vTea = aTea; vTP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tSoil; varying float vVeg; varying float vTea; varying vec3 vTP;
float tH(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float tN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(tH(i),tH(i+vec2(1,0)),f.x), mix(tH(i+vec2(0,1)),tH(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 soilC = texture2D(tSoil, vTP.xz * 0.125).rgb;
float gn = tN(vTP.xz * 0.35) * 0.5 + tN(vTP.xz * 1.7) * 0.5;
vec3 veg = diffuseColor.rgb * (0.75 + 0.5 * gn);
// tea bushes in contour rows
float rows = smoothstep(0.25, 0.55, abs(fract(vTP.y * 0.9 + tN(vTP.xz*0.05)*0.6) - 0.5) * 2.0);
vec3 teaC = mix(vec3(0.19, 0.30, 0.10), vec3(0.34, 0.46, 0.16), rows) * (0.85 + 0.3 * gn);
veg = mix(veg, teaC, vTea);
diffuseColor.rgb = mix(soilC, veg, vVeg);`);
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return mesh;
}

// ---- vegetation geometry ----------------------------------------------------------------
function colorize(g, top, bottom, rnd) {
  const pos = g.attributes.position, c = new Float32Array(pos.count * 3);
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / Math.max(1e-3, max.y - min.y);
    const j = 0.9 + rnd() * 0.2;
    for (let k = 0; k < 3; k++) c[i * 3 + k] = (bottom[k] + (top[k] - bottom[k]) * t) * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function broadleafGeometry(detail, lumps, seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 4.2, 6); trunk.translate(0, 2.1, 0);
  colorize(trunk, [0.32, 0.26, 0.2], [0.22, 0.17, 0.13], rnd);
  parts.push(trunk.toNonIndexed());
  for (let i = 0; i < lumps; i++) {
    const r = 1.9 + rnd() * 1.3;
    let s = new THREE.IcosahedronGeometry(r, detail);
    s.deleteAttribute('normal'); s.deleteAttribute('uv');
    s = mergeVertices(s);
    const a = rnd() * Math.PI * 2, rr = i === 0 ? 0 : 1.2 + rnd() * 1.2;
    const p = s.attributes.position;
    const sq = 0.72 + rnd() * 0.2;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const bump = 0.82 + 0.3 * fbm2(x * 0.9 + seed * 3.1 + i * 7.7, z * 0.9 + y * 0.7, 3);
      p.setXYZ(k, x * bump, y * bump * sq * (y < 0 ? 0.6 : 1), z * bump);
    }
    s.translate(Math.cos(a) * rr, 4.6 + rnd() * 2.2 + (i === 0 ? 1.2 : 0), Math.sin(a) * rr);
    s.computeVertexNormals();
    s = s.toNonIndexed();
    colorize(s, [0.15, 0.27, 0.08], [0.035, 0.075, 0.025], rnd);
    parts.push(s);
  }
  for (const p of parts) { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(k)) p.deleteAttribute(k); }
  return mergeGeometries(parts);
}

function palmGeometry(seed) {
  const rnd = mulberry32(seed);
  const H = 15 + rnd() * 5, lean = 0.06 + rnd() * 0.1;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * lean * H * t, t * H, 0)); }
  const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.2, 5, false);
  colorize(trunk, [0.3, 0.27, 0.22], [0.22, 0.19, 0.15], rnd);
  const top = pts[8];
  const fronds = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3, len = 4.8 + rnd() * 1.4, droop = 0.35 + rnd() * 0.5;
    const segs = 5, pos = [], uv = [];
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const P = (t) => top.clone().addScaledVector(dir, len * t).add(new THREE.Vector3(0, 0.7 * t - droop * len * t * t * 0.55, 0));
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs, w = 1.05 * Math.sin(Math.PI * (0.15 + 0.85 * (t0 + t1) / 2)) + 0.12;
      const a0 = P(t0), a1 = P(t1);
      const q = [a0.clone().addScaledVector(side, -w), a0.clone().addScaledVector(side, w), a1.clone().addScaledVector(side, w), a1.clone().addScaledVector(side, -w)];
      for (const [vi, uu, vv] of [[0, t0, 0], [1, t0, 1], [2, t1, 1], [0, t0, 0], [2, t1, 1], [3, t1, 0]]) { pos.push(q[vi].x, q[vi].y, q[vi].z); uv.push(uu, vv); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    fronds.push(g);
  }
  const t = trunk.toNonIndexed();
  for (const k of Object.keys(t.attributes)) if (!['position', 'normal', 'color'].includes(k)) t.deleteAttribute(k);
  return { trunk: t, fronds: mergeGeometries(fronds) };
}

export function palmGeometries(seed = 5) { return palmGeometry(seed); }

// ---- scatter -------------------------------------------------------------------------------
function scatterForest(scene, materials, rnd) {
  const near = [], far = [], palms = [];
  const tries = 36000;
  for (let i = 0; i < tries; i++) {
    const r = 16 + Math.pow(rnd(), 0.7) * 640, a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r + 0, z = Math.sin(a) * r - 10;
    const d = padDistance(x, z);
    if (d < 4) continue;
    if (teaMask(x, z) > 0.3) continue;
    const dens = fbm2(x * 0.012, z * 0.012);
    const keep = r < 200 ? 0.95 : 0.32;
    if (rnd() > keep * (0.55 + dens)) continue;
    const y = terrainHeight(x, z) - 0.3;
    const isPalm = rnd() < (r < 220 ? 0.24 : 0.1);
    const big = r < 200 ? 1.25 + rnd() * 1.0 : 1.6 + rnd() * 1.1;
    const item = { x, y, z, s: isPalm ? 0.95 + rnd() * 0.45 : big, rot: rnd() * Math.PI * 2, c: rnd() };
    if (isPalm) palms.push(item);
    else if (r < 200) near.push(item); else far.push(item);
  }
  // a few hand-placed palms near the campus edges, as in the video
  for (const [x, z] of [[-60, -40], [-58, -8], [56, -48], [62, -20], [58, 12], [-64, 30]]) {
    palms.push({ x, y: terrainHeight(x, z), z, s: 1.1, rot: rnd() * 6, c: rnd() });
  }
  // Instanced in spatial chunks so the renderer can frustum-cull whole
  // patches of forest (for the camera and for the sun's shadow map).
  const CHUNK = 90;
  const leafMat = materials.get('leaf');
  const chunked = (list) => {
    const m = new Map();
    for (const t of list) {
      const k = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return [...m.values()];
  };
  const place = (im, list, stretch) => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s * (stretch ? 0.9 + t.c * 0.3 : 1), t.s));
      im.setMatrixAt(i, m);
    });
    im.computeBoundingSphere();
    im.frustumCulled = true;
  };
  const mk = (geo, list, cast, colorFn, mat = leafMat, stretch = true) => {
    for (const part of chunked(list)) {
      const im = new THREE.InstancedMesh(geo, mat, part.length);
      place(im, part, stretch);
      if (colorFn) { const col = new THREE.Color(); part.forEach((t, i) => im.setColorAt(i, colorFn(t, col))); }
      im.castShadow = cast; im.receiveShadow = true;
      im.userData.noAO = true;
      scene.add(im);
    }
  };
  const tint = (t, col) => col.setHSL(0.22 + t.c * 0.08, 0.26 + t.c * 0.2, 0.2 + t.c * 0.13);
  mk(broadleafGeometry(1, 4, 7), near.filter((_, i) => i % 2 === 0), true, tint);
  mk(broadleafGeometry(1, 3, 8), near.filter((_, i) => i % 2 === 1), true, tint);
  mk(broadleafGeometry(0, 3, 9), far, false, tint);
  const pg = palmGeometry(3);
  mk(pg.trunk, palms, true, (t, col) => col.setRGB(1, 1, 1), leafMat, false);
  mk(pg.fronds, palms, true, null, materials.get('frond'), false);
  return { near: near.length, far: far.length, palms: palms.length };
}

// Neighbouring two-storey house with a grey hipped roof (top-left of the video)
function neighbourHouse(scene, materials) {
  const g = new THREE.Group();
  const x = -76, z = -30, y = terrainHeight(x, z);
  const wall = materials.get('frame');
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 6.4, 9), new THREE.MeshStandardMaterial({ color: 0xeeeae4, roughness: 0.85 }));
  body.position.set(0, 3.2, 0); g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(9.4, 3.2, 4, 1), new THREE.MeshStandardMaterial({ color: 0x7d8792, roughness: 0.5, metalness: 0.4 }));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1.0, 1, 0.78); roof.position.set(0, 6.4 + 1.6, 0); g.add(roof);
  const win = new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.2, metalness: 0.3 });
  for (const [wx, wy] of [[-3.5, 1.6], [0, 1.6], [3.5, 1.6], [-3.5, 4.6], [3.5, 4.6]]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 0.1), win); w.position.set(wx, wy, 4.52); g.add(w);
  }
  const bal = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0xeeeae4, roughness: 0.85 }));
  bal.position.set(0, 3.6, 5.1); g.add(bal);
  g.position.set(x, y, z); g.rotation.y = 0.35;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  void wall;
  scene.add(g);
}

export function createEnvironment(scene, renderer, materials, textures, { seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  // sky dome
  const sky = new Sky();
  sky.scale.setScalar(9000);
  const su = sky.material.uniforms;
  su.turbidity.value = 7.5; su.rayleigh.value = 1.25; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82;
  const sd = sunDirection();
  su.sunPosition.value.copy(sd);
  scene.add(sky);
  // image based lighting from the same sky
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky(); sky2.scale.setScalar(1000);
  Object.entries(su).forEach(([k, v]) => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = v.value?.clone ? v.value.clone() : v.value; });
  envScene.add(sky2);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4d5a3a, side: THREE.DoubleSide }));
  ground.position.y = -2; envScene.add(ground);
  const envRT = pm.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.7;
  pm.dispose();

  // sun + fill
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.1);
  sun.position.copy(sd).multiplyScalar(160).add(new THREE.Vector3(-4, 0, -10));
  sun.target.position.set(-4, 0, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -86; sc.right = 86; sc.top = 86; sc.bottom = -86; sc.near = 20; sc.far = 360;
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xd3e2f0, 0x6f5a45, 0.35);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xbfcad0, 0.0014);

  // terrain: detailed near patch + coarse far skirt
  const nearT = terrainMesh(420, 210, textures.soil);
  scene.add(nearT);
  const farT = terrainMesh(3600, 180, textures.soil, 1.5, 205);
  scene.add(farT);

  const counts = scatterForest(scene, materials, rnd);
  neighbourHouse(scene, materials);
  return { sun, hemi, sky, counts };
}
