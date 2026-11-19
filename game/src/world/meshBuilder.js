// Batches many boxes and quads into one BufferGeometry (positions, normals, world-scaled UVs and
// vertex colours), so the whole city draws in a handful of calls. Also merges small three.js
// geometries (palms, cars) into one.
import * as THREE from 'three';

export class GeometryBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }

  /** One quad from four corners given counter-clockwise as seen from its front. */
  quad(a, b, c, d, uvs, color) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = [a, b, c, d][k];
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(uvs[k * 2], uvs[k * 2 + 1]);
      this.col.push(color.r, color.g, color.b);
    }
  }

  /**
   * An axis-aligned box. UVs are in metres divided by (su, sv) with an offset, so a facade texture
   * keeps a fixed window size on every building. faces: which faces to emit.
   */
  box(x0, y0, z0, x1, y1, z1, color, { su = 1, sv = 1, uo = 0, vo = 0, top = true, bottom = false, sides = true, topColor } = {}) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const u = (m) => m / su + uo, v = (m) => m / sv + vo;
    if (sides) {
      const w = x1 - x0, d = z1 - z0, hy0 = v(y0), hy1 = v(y1);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [u(0), hy0, u(w), hy0, u(w), hy1, u(0), hy1], c);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [u(w), hy0, u(2 * w), hy0, u(2 * w), hy1, u(w), hy1], c);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [u(0.5), hy0, u(0.5 + d), hy0, u(0.5 + d), hy1, u(0.5), hy1], c);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [u(d), hy0, u(2 * d), hy0, u(2 * d), hy1, u(d), hy1], c);
    }
    if (top) {
      const tc = topColor ? new THREE.Color(topColor) : c;
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [x0 / su, z1 / su, x1 / su, z1 / su, x1 / su, z0 / su, x0 / su, z0 / su], tc);
    }
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 0, 1, 0, 1, 1, 0, 1], c);
  }

  /** A flat horizontal rectangle at height y, UVs given in metres / scale. */
  flat(x0, z0, x1, z1, y, color, scale = 1) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / scale, z1 / scale, x1 / scale, z1 / scale, x1 / scale, z0 / scale, x0 / scale, z0 / scale], c);
  }

  get empty() { return this.pos.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Merge geometries (each optionally with a colour and a matrix) into one non-indexed geometry with
 * vertex colours: parts = [{ geometry, color, matrix }].
 */
export function mergeParts(parts) {
  const pos = [], nor = [], col = [], uv = [];
  const normalMatrix = new THREE.Matrix3();
  for (const { geometry, color = '#ffffff', matrix } of parts) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) {
      g.applyMatrix4(matrix);
      normalMatrix.getNormalMatrix(matrix);
    }
    const c = new THREE.Color(color);
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
      if (t) uv.push(t.getX(i), t.getY(i)); else uv.push(0, 0);
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const tmpObj = new THREE.Object3D();
/** A matrix from position, Euler rotation and scale, for mergeParts and instancing. */
export function makeMatrix(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  tmpObj.position.set(x, y, z);
  tmpObj.rotation.set(rx, ry, rz);
  tmpObj.scale.set(sx, sy, sz);
  tmpObj.updateMatrix();
  return tmpObj.matrix.clone();
}
