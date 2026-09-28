// The film: builds the scene once, then renders any frame deterministically
// as a pure function of the frame number.
import * as THREE from 'three';
import { FILM } from '../config.js';
import { buildSchool } from '../building/index.js';
import { scheduleElements } from '../construction/schedule.js';
import { validateAndFix } from '../construction/validate.js';
import { ConstructionRuntime } from '../construction/runtime.js';
import { setupCraneRigs } from '../building/crane.js';
import { createMaterials } from '../render/materials.js';
import { createEnvironment } from '../world/environment.js';
import { applyCamera, liveCamera, CAMERAS } from './cameras.js';
import { createPost } from './post.js';
import { Hud } from './hud.js';

export class Film {
  constructor(canvas, { width, height, ao = true, msaa = 4, smaa = false, captions = FILM.captions, pixelRatio = 1 } = {}) {
    this.canvas = canvas;
    this.width = width; this.height = height;
    this.opts = { ao, msaa, smaa, captions, pixelRatio };
    this.cameraMode = 'edit'; // 'edit' | 'CAM_1'..'CAM_4' | 'free'
  }

  get fps() { return FILM.fps; }
  get seconds() { return FILM.seconds; }
  get frameCount() { return Math.round(FILM.fps * FILM.seconds); }

  async init(log = () => {}) {
    const t0 = performance.now();
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(this.opts.pixelRatio);
    r.setSize(this.width, this.height, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, this.width / this.height, 0.5, 12000);

    log('materials');
    const { M, textures } = createMaterials();
    this.materials = M;
    log('environment');
    this.env = createEnvironment(this.scene, r, M, textures, { seed: FILM.seed });

    log('building');
    const { L, ES } = await buildSchool();
    this.layout = L;
    this.elements = ES.list;
    const sched = scheduleElements(this.elements);
    if (sched.missing.length) console.warn('Unscheduled groups:', sched.missing);
    log('validation');
    this.validation = validateAndFix(this.elements, { fps: FILM.fps, seconds: FILM.seconds });

    log('runtime');
    this.runtime = new ConstructionRuntime(this.elements, M);
    this.runtime.build(this.scene);
    this.craneRig = setupCraneRigs(this.runtime, this.elements);
    if (this.onRuntime) this.onRuntime(this);

    this.post = createPost(r, this.scene, this.camera, { width: this.width, height: this.height, ao: this.opts.ao, msaa: this.opts.msaa, smaa: this.opts.smaa });
    this.hud = new Hud(r, this.width, this.height, { enabled: this.opts.captions });
    this.buildMs = performance.now() - t0;
    return this;
  }

  // Render film-normalised time T (0..1)
  renderT(T, { freeCamera = null } = {}) {
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    this.runtime.update(T);
    if (this.onUpdate) this.onUpdate(T);
    let camName = this.cameraMode === 'edit' ? liveCamera(T) : this.cameraMode;
    let focus = null;
    if (this.cameraMode === 'free' && freeCamera) {
      this.camera.position.copy(freeCamera.position);
      this.camera.quaternion.copy(freeCamera.quaternion);
      this.camera.fov = freeCamera.fov; this.camera.updateProjectionMatrix();
      camName = 'free';
    } else {
      focus = applyCamera(this.camera, camName, T).focus;
    }
    this.camera.updateMatrixWorld();
    this.post.setFocus(focus);
    this.post.render();
    this.hud.draw(T, { cameraLabel: CAMERAS[camName]?.label || 'Free camera', showCamera: this.cameraMode !== 'edit' });
    this.hud.render();
    this.lastCamera = camName;
  }

  renderFrame(i) { this.renderT(Math.min(1, i / (this.frameCount - 1))); }

  resize(w, h) {
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
    this.hud.resize(w, h);
  }
}
