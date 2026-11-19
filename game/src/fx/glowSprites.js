// Additive glow sprites at fixed or moving points: street lamps, traffic signals, rooftop
// beacons, head and tail lights and police light bars. Sizes are in metres, scaled per pixel.
import * as THREE from 'three';
import { glowTexture } from '../world/textures.js';

const glowVertex = `attribute vec3 color; attribute float size; uniform float scale; varying vec3 vColor;
void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const glowFragment = `uniform sampler2D map; uniform float intensity; varying vec3 vColor;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor * t.a * intensity, 1.0);
#include <colorspace_fragment>
}`;
export const glowScale = { value: 400 };

/** Additive glow sprites at fixed points (lamps, beacons, signals); intensity is a uniform. */
export function createGlowPoints(points, colors, sizes) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: glowVertex, fragmentShader: glowFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: glowTexture() }, intensity: { value: 1 }, scale: glowScale },
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}
