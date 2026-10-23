import * as THREE from 'three';
import { roundedRect } from './noise.js';

const glowCache = new Map();
const softCache = new Map();

function colorString(color) {
  const c = new THREE.Color(color);
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
}

export function makeGlowTexture(color = '#ffe3a1', falloff = 0.55) {
  const key = `${color}-${falloff}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const { r, g, b } = colorString(color);
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
  gradient.addColorStop(0, `rgba(${r},${g},${b},.95)`);
  gradient.addColorStop(falloff, `rgba(${r},${g},${b},.32)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  glowCache.set(key, texture);
  return texture;
}

export function glowSprite(color = '#ffe3a1', size = 6, opacity = 0.7, falloff = 0.55) {
  const material = new THREE.SpriteMaterial({
    map: makeGlowTexture(color, falloff),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function makeSoftTexture(color = '#e8e3d4') {
  if (softCache.has(color)) return softCache.get(color);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const { r, g, b } = colorString(color);
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, `rgba(${r},${g},${b},.7)`);
  gradient.addColorStop(0.6, `rgba(${r},${g},${b},.22)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  softCache.set(color, texture);
  return texture;
}

export function makeSign(text, options = {}) {
  const {
    width = 2.2,
    height = 0.58,
    background = '#fbf3df',
    foreground = '#2f3a4b',
    border = '#2f3a4b',
    fontSize = 62,
    sub = '',
    seed = 0,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(512 * (height / width));
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  roundedRect(ctx, 10, 10, w - 20, h - 20, 18);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fontSize}px "PingFang SC","Hiragino Sans GB",sans-serif`;
  ctx.fillText(text, w / 2, sub ? h * 0.43 : h * 0.52);
  if (sub) {
    ctx.globalAlpha = 0.6;
    ctx.font = `600 ${Math.round(fontSize * 0.38)}px "Avenir Next","PingFang SC",sans-serif`;
    ctx.fillText(sub, w / 2, h * 0.74);
    ctx.globalAlpha = 1;
  }

  // A hand-stamped corner, different for each sign.
  ctx.save();
  ctx.translate(w - 42, 40);
  ctx.rotate(-0.18 + (seed % 5) * 0.04);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.strokeRect(-16, -16, 32, 32);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

export function makeClockFace(options = {}) {
  const { size = 0.8, background = '#fbf3df', foreground = '#2f3a4b' } = options;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 116, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = foreground;
  ctx.stroke();

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.lineWidth = i % 3 === 0 ? 8 : 4;
    ctx.strokeStyle = foreground;
    ctx.moveTo(128 + Math.sin(angle) * 84, 128 - Math.cos(angle) * 84);
    ctx.lineTo(128 + Math.sin(angle) * 100, 128 - Math.cos(angle) * 100);
    ctx.stroke();
  }

  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.sin(1.6) * 44, 128 - Math.cos(1.6) * 44);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.sin(4.4) * 68, 128 - Math.cos(4.4) * 68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 7, 0, Math.PI * 2);
  ctx.fillStyle = foreground;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
}

export function makeFaceTexture(emoji = '✉️', background = '#fbf3df') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2f3a4b';
  ctx.stroke();
  ctx.font = '66px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
