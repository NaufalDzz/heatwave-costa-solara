// The day-night cycle: a gradient sky dome with sun disc, glow, drifting clouds and stars, the
// sun (shadow-casting, follows the player) and moon, hemisphere fill, fog and exposure, all
// blended between hand-tuned keyframes so golden hour and sunset over the ocean look their best.
import * as THREE from 'three';
import { clamp } from '../core/mathUtils.js';

// hour, sky top, horizon, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity, fog, exposure
const KEYS = [
  [0, '#060a1c', '#1a2346', '#8fa8ff', 0.35, '#3a4a80', '#151020', 0.55, '#1b2140', 0.95],
  [5, '#0b1230', '#3b2f5c', '#9fb0ff', 0.3, '#46508a', '#1a1424', 0.6, '#2c2a4c', 0.95],
  [6.4, '#3e5d9a', '#ffb08a', '#ffb27a', 1.6, '#9db4e0', '#6a5040', 0.8, '#e8a688', 1.0],
  [9, '#3d86d8', '#bfe3f7', '#fff1d8', 3.0, '#bcd8ff', '#8a7a5a', 1.0, '#c7def0', 1.0],
  [16, '#3a80d4', '#c6e4f5', '#fff0d0', 3.0, '#bcd8ff', '#8a7a5a', 1.0, '#cde3f0', 1.0],
  [18, '#4a6fb8', '#ffc98a', '#ffc070', 2.9, '#b5c4e8', '#9a6a48', 0.95, '#f2c79a', 1.05],
  [19.2, '#3b4f9a', '#ff8a5c', '#ff8a4a', 2.6, '#b3a6e0', '#9a5a46', 1.25, '#f09a78', 1.18],
  [20.2, '#1d2560', '#d4567a', '#ff6a50', 1.0, '#8a7cc0', '#50304a', 1.05, '#9a5a7a', 1.12],
  [21.3, '#0a1030', '#2a2a5a', '#8fa8ff', 0.35, '#3a4a80', '#151020', 0.55, '#202548', 0.95],
  [24, '#060a1c', '#1a2346', '#8fa8ff', 0.35, '#3a4a80', '#151020', 0.55, '#1b2140', 0.95],
];

const skyVertex = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const skyFragment = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; uniform float night; uniform float time;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float s = max(dot(d, normalize(sunDir)), 0.0);
  vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.45));
  col = mix(col, horizon * 0.85, smoothstep(0.0, -0.25, h));
  col += sunColor * (pow(s, 6.0) * 0.45 + pow(s, 64.0) * 0.6) * (1.0 - night * 0.7);
  float disc = smoothstep(0.9993, 0.9997, s);
  col = mix(col, vec3(1.0, 0.96, 0.85) * 1.6, disc * (1.0 - night));
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(time * 0.004, time * 0.002);
    float c = smoothstep(0.52, 0.78, fbm(uv));
    vec3 cloudLit = mix(vec3(1.0), sunColor * 1.2 + horizon * 0.3, 0.6);
    vec3 cloudCol = mix(cloudLit, top * 0.6 + vec3(0.25, 0.2, 0.3), 0.35 + night * 0.5);
    col = mix(col, cloudCol, c * smoothstep(0.0, 0.18, h) * 0.75);
    vec2 g = floor(d.xz / (h + 0.3) * 260.0);
    float star = step(0.9965, hash(g)) * night * smoothstep(0.05, 0.3, h) * (1.0 - c);
    col += vec3(star);
  }
  gl_FragColor = vec4(col, 1.0);
#include <colorspace_fragment>
}`;

export function createSkyAndLighting(renderer, scene) {
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, night: { value: 0 }, time: { value: 0 } },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#bcd8ff', '#8a7a5a', 1);
  scene.add(hemi);
  scene.fog = new THREE.Fog('#c7def0', 220, 1400);

  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, skyMat);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = null, envHour = -99;

  const tmp = { a: new THREE.Color(), b: new THREE.Color() };
  const out = {
    hour: 17.5, timeScale: 1 / 60, nightFactor: 0, sunDir: new THREE.Vector3(), fogColor: scene.fog.color, frozen: false,
    sun, hemi, sky,
    setHour(h) { out.hour = ((h % 24) + 24) % 24; apply(); },
    update(dt, focus, cameraPos) {
      if (!out.frozen) out.hour = (out.hour + dt * out.timeScale) % 24;
      skyMat.uniforms.time.value += dt;
      apply();
      sky.position.copy(cameraPos);
      sun.target.position.set(focus.x, 0, focus.z);
      const lightDir = out.nightFactor > 0.5 ? moonDir : out.sunDir;
      sun.position.set(focus.x + lightDir.x * 400, lightDir.y * 400, focus.z + lightDir.z * 400);
      // Snap the shadow camera to texels so shadows do not shimmer as the player moves.
      const snap = 240 / 2048;
      sun.target.position.x = Math.round(sun.target.position.x / snap) * snap;
      sun.target.position.z = Math.round(sun.target.position.z / snap) * snap;
    },
  };
  const moonDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();

  function blend(index, field) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= out.hour) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((out.hour - a[0]) / (b[0] - a[0]), 0, 1);
    if (field === 'color') return tmp.a.set(a[index]).lerp(tmp.b.set(b[index]), t);
    return a[index] + (b[index] - a[index]) * t;
  }

  function apply() {
    const h = out.hour;
    const theta = (Math.PI * (h - 6)) / 14;
    const elev = Math.sin(theta);
    out.sunDir.set(Math.cos(theta), Math.max(elev, -0.2) * 0.85, 0.35 + 0.55 * clamp(theta / Math.PI, 0, 1)).normalize();
    out.nightFactor = clamp(1 - (elev + 0.05) / 0.25, 0, 1);
    skyMat.uniforms.top.value.copy(blend(1, 'color'));
    skyMat.uniforms.horizon.value.copy(blend(2, 'color'));
    skyMat.uniforms.sunColor.value.copy(blend(3, 'color'));
    skyMat.uniforms.sunDir.value.copy(out.sunDir);
    skyMat.uniforms.night.value = out.nightFactor;
    sun.color.copy(blend(3, 'color'));
    sun.intensity = blend(4);
    hemi.color.copy(blend(5, 'color'));
    hemi.groundColor.copy(blend(6, 'color'));
    hemi.intensity = blend(7);
    scene.fog.color.copy(blend(8, 'color'));
    renderer.toneMappingExposure = blend(9);
    if (Math.abs(h - envHour) > 0.75 && Math.abs(h - envHour) < 23.25) refreshEnvironment();
  }

  function refreshEnvironment() {
    envHour = out.hour;
    if (envTarget) envTarget.dispose();
    envTarget = pmrem.fromScene(envScene, 0, 1, 2000);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.9;
  }

  apply();
  return out;
}
