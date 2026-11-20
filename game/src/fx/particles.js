// A pooled GPU particle system: one additive pool (fire, sparks, muzzle flashes, flares) and
// one alpha-blended pool (smoke, dust, blood, water spray), each a single Points draw call.
import * as THREE from 'three';
import { glowTexture } from '../world/textures.js';
import { glowScale } from './glowSprites.js';

const vertex = `attribute vec4 tint; attribute float size; uniform float scale; varying vec4 vTint;
void main(){ vTint = tint; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`;
const fragment = `uniform sampler2D map; varying vec4 vTint;
void main(){ float a = texture2D(map, gl_PointCoord).a * vTint.a; if (a < 0.01) discard; gl_FragColor = vec4(vTint.rgb, a);
#include <colorspace_fragment>
}`;

const PRESETS = {
  fire: { add: true, life: [0.4, 0.9], size: [2.2, 0.6], color: ['#ffc15a', '#ff3a10'], alpha: [0.8, 0], vel: [2, 3.5, 2], gravity: -2, drag: 1.5 },
  flame: { add: true, life: [0.25, 0.55], size: [1.4, 0.4], color: ['#ffe08a', '#ff5a1a'], alpha: [1, 0], vel: [0.6, 2.5, 0.6], gravity: -3, drag: 1 },
  spark: { add: true, life: [0.2, 0.5], size: [0.35, 0.1], color: ['#fff2b0', '#ff9a30'], alpha: [1, 0], vel: [7, 6, 7], gravity: 14, drag: 0.5 },
  streak: { add: true, life: [0.05, 0.09], size: [0.45, 0.2], color: ['#fff6c0', '#ffb040'], alpha: [1, 0], vel: [0, 0, 0], gravity: 0, drag: 0 },
  nitro: { add: true, life: [0.12, 0.22], size: [0.9, 0.3], color: ['#9fe8ff', '#3a3dff'], alpha: [0.6, 0], vel: [0.3, 0.2, 0.3], gravity: 0, drag: 0 },
  flash: { add: true, life: [0.05, 0.08], size: [1.6, 2.2], color: ['#fff6c8', '#ffb040'], alpha: [1, 0], vel: [0, 0, 0], gravity: 0, drag: 0 },
  blast: { add: true, life: [0.5, 0.9], size: [5, 9], color: ['#ffb84d', '#ff2a00'], alpha: [0.55, 0], vel: [9, 7, 9], gravity: -1, drag: 3 },
  smoke: { add: false, life: [1.6, 2.8], size: [1.6, 5.5], color: ['#4a4a4a', '#8a8580'], alpha: [0.55, 0], vel: [1, 2.2, 1], gravity: -1.2, drag: 0.8 },
  blacksmoke: { add: false, life: [2.5, 4], size: [3, 10], color: ['#1d1b1a', '#5a5550'], alpha: [0.75, 0], vel: [2, 3.5, 2], gravity: -1.5, drag: 0.7 },
  dust: { add: false, life: [0.6, 1.2], size: [0.8, 2.6], color: ['#cfc3a8', '#e8dcc0'], alpha: [0.45, 0], vel: [1.5, 1, 1.5], gravity: -0.5, drag: 2 },
  tire: { add: false, life: [0.8, 1.4], size: [1, 3.2], color: ['#d8d8d8', '#f0f0f0'], alpha: [0.4, 0], vel: [0.8, 0.8, 0.8], gravity: -0.6, drag: 1.5 },
  blood: { add: false, life: [0.3, 0.6], size: [0.25, 0.4], color: ['#a01010', '#600808'], alpha: [1, 0], vel: [1.5, 2, 1.5], gravity: 9, drag: 0.5 },
  splash: { add: false, life: [0.6, 1], size: [0.6, 1.6], color: ['#ffffff', '#cdeefa'], alpha: [0.8, 0], vel: [3, 5, 3], gravity: 12, drag: 0.4 },
  impact: { add: false, life: [0.3, 0.6], size: [0.3, 1.0], color: ['#bdb6a6', '#8a8478'], alpha: [0.7, 0], vel: [1.5, 1.5, 1.5], gravity: 2, drag: 2 },
};

function createPool(scene, capacity, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(capacity * 3), tint = new Float32Array(capacity * 4), size = new Float32Array(capacity);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { map: { value: glowTexture() }, scale: glowScale },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = additive ? 3 : 2;
  scene.add(points);
  return { geo, pos, tint, size, list: [], capacity };
}

export function createParticles(scene, rng) {
  const pools = { add: createPool(scene, 2500, true), alpha: createPool(scene, 2500, false) };
  const c0 = new THREE.Color(), c1 = new THREE.Color();
  return {
    /** Emit count particles of a preset at (x, y, z), with optional base velocity and spread. */
    emit(type, x, y, z, count = 1, opts = {}) {
      const p = PRESETS[type];
      const pool = p.add ? pools.add : pools.alpha;
      for (let i = 0; i < count; i++) {
        if (pool.list.length >= pool.capacity) pool.list.shift();
        const sp = opts.spread ?? 1;
        pool.list.push({
          x: x + (rng.next() - 0.5) * (opts.jitter ?? 0.3), y, z: z + (rng.next() - 0.5) * (opts.jitter ?? 0.3),
          vx: (opts.vx ?? 0) + (rng.next() - 0.5) * 2 * p.vel[0] * sp,
          vy: (opts.vy ?? 0) + (p.add || type === 'splash' || type === 'blood' || type === 'spark' ? rng.next() : rng.next() * 0.6 + 0.4) * p.vel[1] * sp,
          vz: (opts.vz ?? 0) + (rng.next() - 0.5) * 2 * p.vel[2] * sp,
          age: 0, life: p.life[0] + rng.next() * (p.life[1] - p.life[0]), p, scale: opts.scale ?? 1,
        });
      }
    },
    update(dt) {
      for (const pool of Object.values(pools)) {
        let n = 0;
        const keep = [];
        for (const q of pool.list) {
          q.age += dt;
          if (q.age >= q.life) continue;
          keep.push(q);
          const p = q.p, t = q.age / q.life;
          q.vy -= p.gravity * dt;
          const d = Math.exp(-p.drag * dt);
          q.vx *= d; q.vy *= d; q.vz *= d;
          q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          if (q.y < 0.05 && p.gravity > 0) { q.y = 0.05; q.vy *= -0.3; }
          pool.pos[n * 3] = q.x; pool.pos[n * 3 + 1] = q.y; pool.pos[n * 3 + 2] = q.z;
          c0.set(p.color[0]).lerp(c1.set(p.color[1]), t);
          pool.tint[n * 4] = c0.r; pool.tint[n * 4 + 1] = c0.g; pool.tint[n * 4 + 2] = c0.b;
          pool.tint[n * 4 + 3] = p.alpha[0] + (p.alpha[1] - p.alpha[0]) * t;
          pool.size[n] = (p.size[0] + (p.size[1] - p.size[0]) * t) * q.scale;
          n++;
        }
        pool.list = keep;
        pool.geo.setDrawRange(0, n);
        for (const a of ['position', 'tint', 'size']) pool.geo.attributes[a].needsUpdate = true;
      }
    },
    count() { return pools.add.list.length + pools.alpha.list.length; },
  };
}
