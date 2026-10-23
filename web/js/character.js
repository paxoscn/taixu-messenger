import * as THREE from 'three';
import { damp, roundedRect } from './noise.js';

export const HAT_EMOJI = {
  hat_postman: '🧢',
  hat_straw: '👒',
  hat_flower: '🌸',
  hat_sailor: '⛵',
  hat_crown: '👑',
  none: '·',
};

export const HAT_LABEL = {
  hat_postman: '邮差帽',
  hat_straw: '麦秆草帽',
  hat_flower: '小花环',
  hat_sailor: '水手帽',
  hat_crown: '星星王冠',
  none: '不戴帽子',
};

const EMOTE_GLYPH = {
  wave: '👋',
  heart: '❤️',
  laugh: '😄',
  note: '🎵',
  mail: '✉️',
  star: '✨',
};

const skinMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4c9a2,
  roughness: 0.82,
  flatShading: true,
});

const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2f3c, roughness: 0.5 });
const cheekMaterial = new THREE.MeshStandardMaterial({ color: 0xef9c8d, roughness: 0.9 });
const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3c32, roughness: 0.9 });
const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.85 });

const shadowTexture = makeShadowTexture();
const shadowGeometry = new THREE.PlaneGeometry(1, 1);
const shadowMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  opacity: 0.36,
  depthWrite: false,
  color: 0x223047,
});

const emoteTextureCache = new Map();

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0,
    flatShading: true,
    ...extra,
  });
}

function makeShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(24,33,50,.85)');
  gradient.addColorStop(0.55, 'rgba(24,33,50,.35)');
  gradient.addColorStop(1, 'rgba(24,33,50,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeNameSprite(name, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 160);

  roundedRect(ctx, 22, 18, 468, 124, 30);
  ctx.fillStyle = 'rgba(251,243,223,.93)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(47,58,75,.82)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#2f3a4b';
  ctx.font = '700 48px "PingFang SC","Hiragino Sans GB",sans-serif';
  ctx.fillText(name, 256, subtitle ? 78 : 94);
  if (subtitle) {
    ctx.fillStyle = '#7a7362';
    ctx.font = '500 27px "PingFang SC","Hiragino Sans GB",sans-serif';
    ctx.fillText(subtitle, 256, 118);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.55, 0.48, 1);
  return sprite;
}

function getEmoteTexture(kind) {
  if (emoteTextureCache.has(kind)) return emoteTextureCache.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.shadowColor = 'rgba(30,40,60,.25)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  roundedRect(ctx, 28, 20, 200, 168, 52);
  ctx.fillStyle = '#fff8e7';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#2f3a4b';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(112, 186);
  ctx.lineTo(142, 186);
  ctx.lineTo(124, 218);
  ctx.closePath();
  ctx.fillStyle = '#fff8e7';
  ctx.fill();
  ctx.stroke();

  ctx.font = '112px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(EMOTE_GLYPH[kind] || '✨', 128, 108);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  emoteTextureCache.set(kind, texture);
  return texture;
}

function buildHat(id) {
  const group = new THREE.Group();
  const navy = standard(0x384a6b);
  const straw = standard(0xd8b977);
  const strawDark = standard(0xb9934f);
  const white = standard(0xf8f1dd);
  const blue = standard(0x5281b3);
  const coral = standard(0xe9775f);
  const gold = standard(0xf0bd4d, { metalness: 0.35, roughness: 0.4, emissive: 0x5a3800 });

  if (id === 'hat_straw') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.57, 0.035, 16), straw);
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.24, 12), straw);
    crown.position.y = 0.13;
    group.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.38, 0.06, 12), coral);
    band.position.y = 0.055;
    group.add(band);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), coral);
    knot.position.set(0.33, 0.06, 0.13);
    group.add(knot);
  } else if (id === 'hat_flower') {
    const colors = [0xf08a7a, 0xf3c75c, 0xf4a9c1, 0xf7f1df, 0x9dcf8a];
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 0.31 + Math.sin(i * 2.3) * 0.02;
      const flower = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.062, 0),
        standard(colors[i % colors.length]),
      );
      flower.position.set(Math.cos(angle) * radius, 0.02 + (i % 3) * 0.018, Math.sin(angle) * radius);
      flower.scale.set(1, 0.75, 1);
      group.add(flower);
    }
    const leaf = standard(0x6fa562);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), leaf);
      blade.position.set(Math.cos(angle) * 0.34, 0.05, Math.sin(angle) * 0.34);
      blade.rotation.z = Math.cos(angle) * 0.6;
      blade.rotation.x = -Math.sin(angle) * 0.6;
      group.add(blade);
    }
  } else if (id === 'hat_sailor') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.41, 0.04, 16), white);
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.17, 12), white);
    crown.position.y = 0.09;
    group.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.36, 0.07, 12), blue);
    band.position.y = 0.04;
    group.add(band);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), white);
    pom.position.y = 0.2;
    group.add(pom);
  } else if (id === 'hat_crown') {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.09, 12), gold);
    group.add(ring);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.19, 4), gold);
      spike.position.set(Math.cos(angle) * 0.225, 0.12, Math.sin(angle) * 0.225);
      group.add(spike);
      const jewel = new THREE.Mesh(
        new THREE.SphereGeometry(0.033, 6, 5),
        standard(i % 2 ? 0x7ad1c0 : 0xf08a90, { emissive: 0x221111, roughness: 0.3 }),
      );
      jewel.position.set(Math.cos(angle) * 0.27, 0.01, Math.sin(angle) * 0.27);
      group.add(jewel);
    }
  } else if (id === 'none') {
    // Bare heads are a fashion statement too.
  } else {
    // postman cap (default)
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.325, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52), navy);
    top.scale.y = 0.72;
    top.position.y = 0.04;
    group.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.32, 0.075, 14), standard(0x2c3a55));
    band.position.y = 0.02;
    group.add(band);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.045, 0.3), standard(0x2c3a55));
    brim.position.set(0, -0.005, 0.23);
    brim.rotation.x = -0.1;
    group.add(brim);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), gold);
    button.position.set(0, 0.1, 0.3);
    group.add(button);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8), gold);
    badge.position.set(0.2, 0.02, 0.22);
    badge.rotation.y = 0.8;
    group.add(badge);
  }

  group.position.y = 0.245;
  return group;
}

function buildProp(kind) {
  const group = new THREE.Group();
  if (!kind) return group;

  if (kind === 'letter') {
    const envelope = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), standard(0xfdf4df));
    group.add(envelope);
    const seal = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), standard(0xe9775f));
    seal.position.z = 0.015;
    group.add(seal);
  } else if (kind === 'lantern') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), standard(0x5b4a3a));
    group.add(frame);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.15, 0.12),
      standard(0xffd88a, { emissive: 0xffa63d, emissiveIntensity: 1.2, roughness: 0.4 }),
    );
    glow.position.y = -0.01;
    group.add(glow);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 4, 8, Math.PI), standard(0x5b4a3a));
    handle.position.y = 0.13;
    group.add(handle);
  } else if (kind === 'bread') {
    const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), standard(0xc68a4b));
    loaf.scale.set(1.5, 0.7, 0.8);
    group.add(loaf);
  } else if (kind === 'shell') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), standard(0xf4b8a8));
    shell.scale.set(1, 0.4, 1.3);
    group.add(shell);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), standard(0xfff4de));
    pearl.position.set(0.02, 0.03, 0);
    group.add(pearl);
  } else if (kind === 'staff') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.05, 5), standard(0x7b5b3d));
    pole.position.y = -0.15;
    group.add(pole);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 10), standard(0xf0bd4d, { metalness: 0.3 }));
    ring.position.y = 0.4;
    group.add(ring);
  } else if (kind === 'flag') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.7, 5), standard(0x6d5138));
    pole.position.y = 0.05;
    group.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.16), standard(0xe9775f, { side: THREE.DoubleSide }));
    cloth.position.set(0.15, 0.3, 0);
    group.add(cloth);
  } else if (kind === 'brush') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.32, 5), standard(0xc19a62));
    stick.rotation.z = 0.5;
    group.add(stick);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 5), standard(0x4f7fb5));
    tip.position.set(0.08, 0.15, 0);
    tip.rotation.z = 0.5;
    group.add(tip);
  }
  return group;
}

/**
 * A chunky little postal person. Origin is at the feet, model faces +Z.
 */
export function createCharacter(options = {}) {
  const {
    bodyColor = '#e9775f',
    accentColor = '#fff3d6',
    hat = 'hat_postman',
    name = '',
    subtitle = '',
    prop = null,
    scale = 1,
    shadow = true,
    showName = true,
    hairColor = '#5a4131',
    seed = 0,
  } = options;

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(scale);
  root.add(bodyGroup);

  const uniform = standard(bodyColor);
  const uniformDark = standard(new THREE.Color(bodyColor).multiplyScalar(0.78), {});
  const accent = standard(accentColor);
  const hair = standard(hairColor);

  if (shadow) {
    const blob = new THREE.Mesh(shadowGeometry, shadowMaterial);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    blob.scale.setScalar(0.95 * scale);
    bodyGroup.add(blob);
  }

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.075, 0.085, 0.4, 6);
  const footGeometry = new THREE.BoxGeometry(0.16, 0.1, 0.24);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.115, 0.47, 0);
  const leftLegMesh = new THREE.Mesh(legGeometry, uniformDark);
  leftLegMesh.position.y = -0.2;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);
  const leftFoot = new THREE.Mesh(footGeometry, bootMaterial);
  leftFoot.position.set(0, -0.4, 0.05);
  leftFoot.castShadow = true;
  leftLeg.add(leftFoot);
  bodyGroup.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.115;
  bodyGroup.add(rightLeg);

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.255, 0.34, 4, 9), uniform);
  torso.position.y = 0.82;
  torso.castShadow = true;
  bodyGroup.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.265, 0.06, 10), darkMaterial);
  belt.position.y = 0.58;
  bodyGroup.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), standard(0xf0bd4d, { metalness: 0.3 }));
  buckle.position.set(0, 0.58, 0.255);
  bodyGroup.add(buckle);

  // Collar / scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 5, 12), accent);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.13;
  bodyGroup.add(scarf);
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.04), accent);
  scarfTail.position.set(0.13, 1.02, 0.19);
  scarfTail.rotation.z = 0.2;
  bodyGroup.add(scarfTail);

  for (let i = 0; i < 3; i += 1) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), standard(0xf0bd4d));
    button.position.set(0, 0.72 + i * 0.12, 0.255);
    bodyGroup.add(button);
  }

  // Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.18), standard(accentColor));
  pack.position.set(0, 0.86, -0.28);
  pack.castShadow = true;
  bodyGroup.add(pack);
  const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.2), standard(new THREE.Color(accentColor).multiplyScalar(0.86)));
  packFlap.position.set(0, 1.04, -0.28);
  packFlap.rotation.x = 0.08;
  bodyGroup.add(packFlap);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.7, 0.02), standard(0x5a4634));
  strap.position.set(0.16, 0.93, 0.22);
  strap.rotation.z = -0.32;
  bodyGroup.add(strap);

  const carriedLetter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.03), standard(0xfdf4df));
  carriedLetter.position.set(0.02, 1.09, -0.39);
  carriedLetter.rotation.z = 0.35;
  carriedLetter.visible = false;
  bodyGroup.add(carriedLetter);

  // Arms
  const armGeometry = new THREE.CapsuleGeometry(0.068, 0.3, 4, 7);
  const handGeometry = new THREE.SphereGeometry(0.076, 6, 5);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.3, 1.06, 0);
  const leftArmMesh = new THREE.Mesh(armGeometry, uniform);
  leftArmMesh.position.y = -0.19;
  leftArmMesh.rotation.z = -0.08;
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
  leftHand.position.y = -0.38;
  leftArm.add(leftHand);
  leftArm.rotation.z = 0.12;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.3, 1.06, 0);
  const rightArmMesh = leftArmMesh.clone();
  rightArmMesh.rotation.z = 0.08;
  rightArm.add(rightArmMesh);
  const rightHand = leftHand.clone();
  rightArm.add(rightHand);
  rightArm.rotation.z = -0.12;
  bodyGroup.add(rightArm);

  if (prop) {
    const propGroup = buildProp(prop);
    propGroup.position.set(0, -0.44, 0.06);
    rightArm.add(propGroup);
  }

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.4;
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 11), skinMaterial);
  head.castShadow = true;
  headGroup.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.305, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
    hair,
  );
  hairCap.position.y = 0.025;
  headGroup.add(hairCap);

  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 5), hair);
  fringe.scale.set(1.2, 0.5, 0.5);
  fringe.position.set(0.02, 0.19, 0.24);
  headGroup.add(fringe);

  const eyeGeometry = new THREE.SphereGeometry(0.034, 6, 5);
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.1, 0.02, 0.282);
  leftEye.scale.set(1, 1.15, 0.6);
  headGroup.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.1;
  headGroup.add(rightEye);

  const cheekGeometry = new THREE.SphereGeometry(0.05, 6, 5);
  const leftCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
  leftCheek.scale.set(1, 0.55, 0.4);
  leftCheek.position.set(-0.17, -0.06, 0.25);
  headGroup.add(leftCheek);
  const rightCheek = leftCheek.clone();
  rightCheek.position.x = 0.17;
  headGroup.add(rightCheek);

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 4, 8, Math.PI), eyeMaterial);
  mouth.position.set(0, -0.085, 0.278);
  mouth.rotation.z = Math.PI;
  headGroup.add(mouth);

  let hatGroup = buildHat(hat);
  headGroup.add(hatGroup);

  let nameSprite = null;
  if (showName && name) {
    nameSprite = makeNameSprite(name, subtitle);
    nameSprite.position.y = 2.08;
    root.add(nameSprite);
  }

  const emoteSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: getEmoteTexture('wave'), transparent: true, depthWrite: false }),
  );
  emoteSprite.scale.set(0.82, 0.82, 1);
  emoteSprite.position.y = 2.5;
  emoteSprite.visible = false;
  root.add(emoteSprite);

  // A tiny bit of per-character variation so a crowd doesn't look cloned.
  const wobble = (seed % 7) / 7;
  headGroup.rotation.y = (wobble - 0.5) * 0.14;
  bodyGroup.rotation.y = 0;

  let phase = wobble * Math.PI * 2;
  let walkAmount = 0;
  let emoteTimer = 0;
  let emoteDuration = 3.4;
  let currentHat = hat;
  let timeAlive = 0;

  const api = {
    group: root,
    bodyGroup,
    head: headGroup,
    castShadow: true,
    get hat() {
      return currentHat;
    },
    setHat(nextHat) {
      if (nextHat === currentHat) return;
      currentHat = nextHat;
      headGroup.remove(hatGroup);
      hatGroup = buildHat(nextHat);
      headGroup.add(hatGroup);
    },
    setHasLetter(value) {
      carriedLetter.visible = Boolean(value);
    },
    setEmote(kind) {
      emoteSprite.material.map = getEmoteTexture(kind);
      emoteSprite.material.needsUpdate = true;
      emoteSprite.visible = true;
      emoteTimer = emoteDuration;
      emoteSprite.material.opacity = 0;
    },
    setNameTagOpacity(value) {
      if (!nameSprite) return;
      const opacity = Math.max(0, Math.min(1, value));
      nameSprite.material.opacity = opacity;
      nameSprite.visible = opacity > 0.02;
    },
    update(dt, time, { moving = false, speed = 0, water = false } = {}) {
      timeAlive += dt;
      const targetWalk = moving ? 1 : 0;
      walkAmount = damp(walkAmount, targetWalk, 9, dt);
      phase += dt * (5.2 + Math.min(speed, 8) * 0.9) * (moving ? 1 : 0.2);

      const swing = Math.sin(phase) * 0.62 * walkAmount;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.72;
      rightArm.rotation.x = swing * 0.72;
      leftArm.rotation.z = 0.12 + Math.sin(time * 1.7) * 0.02;
      rightArm.rotation.z = -0.12 - Math.sin(time * 1.7 + 0.8) * 0.02;

      const bob = Math.abs(Math.sin(phase)) * 0.055 * walkAmount;
      const idle = Math.sin(time * 2.1 + wobble * 4) * 0.012;
      bodyGroup.position.y = bob + idle + (water ? -0.04 : 0);
      headGroup.rotation.z = Math.sin(phase) * 0.035 * walkAmount;
      headGroup.rotation.x = Math.sin(phase * 0.5) * 0.02 * walkAmount;

      if (emoteTimer > 0) {
        emoteTimer = Math.max(0, emoteTimer - dt);
        const progress = 1 - emoteTimer / emoteDuration;
        emoteSprite.position.y = 2.45 + progress * 0.35;
        emoteSprite.material.opacity = Math.min(1, (emoteDuration - emoteTimer) * 6) * Math.min(1, emoteTimer * 2.2);
        if (emoteTimer === 0) emoteSprite.visible = false;
      }
    },
  };

  return api;
}

export function setObjectShadow(object, cast) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = false;
    }
  });
}
