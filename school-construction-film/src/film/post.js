// Post-processing: multisampled HDR render, ground-truth ambient occlusion,
// optional depth of field, filmic tone mapping (OutputPass) and a HUD layer
// for titles/phase captions.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// GTAO restricted to architecture + ground (foliage flagged userData.noAO is
// skipped - its canopy shading already carries occlusion), computed at a
// reduced resolution and upsampled by the blend pass.
class SiteGTAOPass extends GTAOPass {
  constructor(scene, camera, w, h, scale) { super(scene, camera, w, h); this.resScale = scale; this.setSize(w, h); }
  setSize(w, h) { super.setSize(Math.max(1, Math.round(w * (this.resScale ?? 1))), Math.max(1, Math.round(h * (this.resScale ?? 1)))); }
  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse((o) => { if (o.userData.noAO && o.visible) { o.visible = false; this._visibilityCache.push(o); } });
  }
}

// Depth of field that reuses the AO pass depth buffer instead of rendering
// the whole scene a second time.
class SharedDepthBokehPass extends BokehPass {
  render(renderer, writeBuffer, readBuffer) {
    const depth = this.depthSource && this.depthSource();
    if (!depth) { super.render(renderer, writeBuffer, readBuffer); return; }
    this.uniforms.tDepth.value = depth;
    this.uniforms.tColor.value = readBuffer.texture;
    this.uniforms.nearClip.value = this.camera.near;
    this.uniforms.farClip.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (!this.renderToScreen) renderer.clear();
    this._fsQuad.render(renderer);
  }
}

export function createPost(renderer, scene, camera, { width, height, ao = true, msaa = 4, dof = true, smaa = false, aoScale = 0.5 }) {
  const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (ao) {
    gtao = new SiteGTAOPass(scene, camera, width, height, aoScale);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.9;
    gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.6, thickness: 2.0, scale: 1.0, samples: 10, distanceFallOff: 1.0 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 10 });
    composer.addPass(gtao);
  }
  let bokeh = null;
  if (dof) {
    bokeh = new SharedDepthBokehPass(scene, camera, { focus: 50, aperture: 0.00007, maxblur: 0.0035 });
    if (gtao) bokeh.depthSource = () => gtao.normalRenderTarget.depthTexture;
    bokeh.enabled = false;
    composer.addPass(bokeh);
  }
  composer.addPass(new OutputPass());
  if (smaa) composer.addPass(new SMAAPass());
  return {
    composer, gtao, bokeh,
    setFocus(focus) {
      if (!bokeh) return;
      bokeh.enabled = focus != null;
      if (focus != null) bokeh.uniforms.focus.value = focus;
    },
    render() { composer.render(); },
    setSize(w, h) { composer.setSize(w, h); },
  };
}
