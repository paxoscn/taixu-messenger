// Small deterministic noise helpers shared by terrain, props and animation.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

function hash3i(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function lerp3(a, b, c, d, tx, ty, tz) {
  const x00 = lerp(a, b, tx);
  const x10 = lerp(c, d, tx);
  const x01 = x00;
  const x11 = x10;
  const y0 = lerp(x00, x10, ty);
  const y1 = lerp(x01, x11, ty);
  return lerp(y0, y1, tz);
}

export function noise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);

  const n000 = hash3i(ix, iy, iz);
  const n100 = hash3i(ix + 1, iy, iz);
  const n010 = hash3i(ix, iy + 1, iz);
  const n110 = hash3i(ix + 1, iy + 1, iz);
  const n001 = hash3i(ix, iy, iz + 1);
  const n101 = hash3i(ix + 1, iy, iz + 1);
  const n011 = hash3i(ix, iy + 1, iz + 1);
  const n111 = hash3i(ix + 1, iy + 1, iz + 1);

  const x00 = lerp(n000, n100, fx);
  const x10 = lerp(n010, n110, fx);
  const x01 = lerp(n001, n101, fx);
  const x11 = lerp(n011, n111, fx);
  const y0 = lerp(x00, x10, fy);
  const y1 = lerp(x01, x11, fy);
  return lerp(y0, y1, fz) * 2 - 1;
}

export function fbm3(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise3(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

// Great-circle interpolation between two unit vectors (arrays or Vector3s).
export function slerpDir(a, b, t) {
  const ax = a.x ?? a[0];
  const ay = a.y ?? a[1];
  const az = a.z ?? a[2];
  const bx = b.x ?? b[0];
  const by = b.y ?? b[1];
  const bz = b.z ?? b[2];
  let dot = clamp(ax * bx + ay * by + az * bz, -1, 1);
  const theta = Math.acos(dot);
  if (theta < 1e-5) return [ax, ay, az];
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb];
}

export function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
