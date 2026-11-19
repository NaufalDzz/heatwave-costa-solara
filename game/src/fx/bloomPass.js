// HDR bloom and colour grade: the scene renders into a multisampled half-float target, bright
// parts are extracted and blurred down a chain of smaller targets, then everything is combined
// with ACES tone mapping, a warm grade and a soft vignette on the way to the screen.
import * as THREE from 'three';

const quadVertex = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const brightFragment = `uniform sampler2D src; uniform float threshold; varying vec2 vUv;
void main(){ vec3 c = texture2D(src, vUv).rgb; float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(threshold, threshold * 1.8, l), 1.0); }`;
const blurFragment = `uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 c = texture2D(src, vUv).rgb * 0.227;
  c += (texture2D(src, vUv + dir * 1.385).rgb + texture2D(src, vUv - dir * 1.385).rgb) * 0.316;
  c += (texture2D(src, vUv + dir * 3.231).rgb + texture2D(src, vUv - dir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0); }`;
const compositeFragment = `uniform sampler2D scene; uniform sampler2D b0; uniform sampler2D b1; uniform sampler2D b2; uniform sampler2D b3;
uniform float strength; uniform vec3 grade; varying vec2 vUv;
void main(){
  vec3 c = texture2D(scene, vUv).rgb;
  vec3 bloom = texture2D(b0, vUv).rgb * 0.5 + texture2D(b1, vUv).rgb * 0.7 + texture2D(b2, vUv).rgb * 0.9 + texture2D(b3, vUv).rgb * 1.1;
  c += bloom * strength;
  c *= grade;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.55;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createBloomPass(renderer) {
  const opts = { type: THREE.HalfFloatType, depthBuffer: false };
  const sceneTarget = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const levels = [0, 1, 2, 3].map(() => [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)]);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const mat = (fragmentShader, uniforms, toneMapped = false) => new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped });
  const bright = mat(brightFragment, { src: { value: null }, threshold: { value: 1.1 } });
  const blur = mat(blurFragment, { src: { value: null }, dir: { value: new THREE.Vector2() } });
  const composite = mat(compositeFragment, { scene: { value: sceneTarget.texture }, b0: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, strength: { value: 0.42 }, grade: { value: new THREE.Vector3(1.04, 1.0, 0.96) } }, true);
  levels.forEach((l, i) => { composite.uniforms['b' + i].value = l[0].texture; });

  function pass(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, camera);
  }

  const bloom = {
    enabled: true, strength: composite.uniforms.strength, threshold: bright.uniforms.threshold,
    setSize(w, h) {
      sceneTarget.setSize(w, h);
      levels.forEach((l, i) => { const s = 2 ** (i + 1); l[0].setSize(Math.max(1, w / s), Math.max(1, h / s)); l[1].setSize(Math.max(1, w / s), Math.max(1, h / s)); });
    },
    render(scene, cam) {
      if (!bloom.enabled) { renderer.setRenderTarget(null); renderer.render(scene, cam); return; }
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, cam);
      bright.uniforms.src.value = sceneTarget.texture;
      pass(bright, levels[0][0]);
      for (let i = 0; i < levels.length; i++) {
        const [a, b] = levels[i];
        if (i > 0) { blur.uniforms.src.value = levels[i - 1][0].texture; blur.uniforms.dir.value.set(0, 0); pass(blur, a); }
        blur.uniforms.src.value = a.texture; blur.uniforms.dir.value.set(1 / a.width, 0); pass(blur, b);
        blur.uniforms.src.value = b.texture; blur.uniforms.dir.value.set(0, 1 / a.height); pass(blur, a);
      }
      pass(composite, null);
    },
  };
  return bloom;
}
