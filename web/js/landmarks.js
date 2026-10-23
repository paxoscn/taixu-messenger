import * as THREE from 'three';
import { makeSign, makeClockFace, makeFaceTexture, glowSprite } from './fx.js';

const material = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0,
    flatShading: true,
    ...extra,
  });

const M = {
  wall: material(0xf8ecd4),
  wallWarm: material(0xf3ddba),
  wallDark: material(0xe6cda4),
  trim: material(0xe9775f),
  trimDeep: material(0xc65a44),
  roofCoral: material(0xd66f58),
  roofRust: material(0xb96948),
  roofTeal: material(0x4f8b83),
  roofGreen: material(0x6c9b68),
  wood: material(0x8a6747),
  woodDark: material(0x674b34),
  stone: material(0xd8c9a6),
  stoneDark: material(0xb7a682),
  stoneGrey: material(0x9a9a8c),
  white: material(0xf8f1dd),
  glass: material(0xffdf9a, { emissive: 0xffb347, emissiveIntensity: 0.55, roughness: 0.45 }),
  red: material(0xd35a4c),
  redDeep: material(0xa8473c),
  gold: material(0xf0bd4d, { metalness: 0.4, roughness: 0.35 }),
  green: material(0x6f9e5b),
  leaf: material(0x5b8c51),
  sand: material(0xe7d49d),
  thatch: material(0xc49c5c),
  dark: material(0x3c4658),
  metal: material(0x6a7482, { metalness: 0.35, roughness: 0.55 }),
  blue: material(0x5884b4),
};

const UP = new THREE.Vector3(0, 1, 0);

function addBox(parent, w, h, d, mat, x = 0, y = 0, z = 0, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, top, bottom, height, segments, mat, x = 0, y = 0, z = 0, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat);
  mesh.position.set(x, y, z);
  if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCone(parent, radius, height, segments, mat, x = 0, y = 0, z = 0, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), mat);
  mesh.position.set(x, y, z);
  if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, radius, mat, x = 0, y = 0, z = 0, segments = 8) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(4, segments - 2)), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addWindow(parent, x, y, z, width = 0.55, height = 0.62, mat = M.glass, frame = M.woodDark) {
  addBox(parent, width + 0.12, height + 0.12, 0.06, frame, x, y, z);
  addBox(parent, width, height, 0.07, mat, x, y, z + 0.035);
  addBox(parent, 0.045, height, 0.04, frame, x, y, z + 0.08);
}

function addDoor(parent, x, y, z, width = 0.8, height = 1.35, mat = M.woodDark) {
  const door = addBox(parent, width, height, 0.09, mat, x, y, z);
  addSphere(parent, 0.045, M.gold, x + width * 0.32, y, z + 0.07, 6);
  return door;
}

function addSignPlane(parent, text, options = {}) {
  const {
    x = 0,
    y = 2.1,
    z = 1.6,
    width = 1.9,
    height = 0.46,
    sub = '',
    seed = 0,
    ry = 0,
  } = options;
  const sign = makeSign(text, { width, height, sub, seed });
  sign.position.set(x, y, z);
  sign.rotation.y = ry;
  parent.add(sign);
  return sign;
}

function addLantern(parent, x, y, z, options = {}) {
  const { size = 0.16, color = '#ffd88a', light = false, post = false } = options;
  if (post) {
    addCylinder(parent, 0.035, 0.045, y, 5, M.woodDark, x, y / 2, z);
  }
  const glow = addSphere(parent, size, M.glass, x, y, z, 7);
  const halo = glowSprite(color, size * 7, 0.55);
  halo.position.set(x, y, z);
  parent.add(halo);
  if (light) {
    const point = new THREE.PointLight(0xffca7a, 0.9, 7, 2);
    point.position.set(x, y, z);
    parent.add(point);
  }
  return glow;
}

function addPost(parent, x, z, height = 1.1) {
  addCylinder(parent, 0.045, 0.055, height, 5, M.woodDark, x, height / 2, z);
  return height;
}

function signpost(parent, text, x, z, rotation = 0) {
  addPost(parent, x, z, 1.4);
  const sign = makeSign(text, { width: 1.25, height: 0.32, fontSize: 56, seed: text.length });
  sign.position.set(x, 1.3, z + 0.02);
  sign.rotation.y = rotation;
  parent.add(sign);
}

function addFence(parent, startX, endX, z, gapStart = null, gapEnd = null) {
  const step = 0.55;
  let last = null;
  for (let x = startX; x <= endX + 0.001; x += step) {
    if (gapStart !== null && x > gapStart && x < gapEnd) {
      last = null;
      continue;
    }
    addBox(parent, 0.09, 0.62, 0.09, M.wood, x, 0.31, z);
    addBox(parent, 0.14, 0.08, 0.12, M.woodDark, x, 0.66, z);
    if (last !== null) {
      addBox(parent, x - last, 0.06, 0.06, M.wood, (x + last) / 2, 0.4, z);
      addBox(parent, x - last, 0.05, 0.05, M.wood, (x + last) / 2, 0.18, z);
    }
    last = x;
  }
}

function addPine(parent, x, z, scale = 1) {
  addCylinder(parent, 0.1 * scale, 0.16 * scale, 0.9 * scale, 5, M.wood, x, 0.45 * scale, z);
  addCone(parent, 0.65 * scale, 1.5 * scale, 7, M.leaf, x, 1.4 * scale, z);
  addCone(parent, 0.45 * scale, 1.2 * scale, 7, M.leaf, x, 2.15 * scale, z);
}

function addMushroom(parent, x, z, scale = 1) {
  addCylinder(parent, 0.045 * scale, 0.06 * scale, 0.16 * scale, 5, M.white, x, 0.08 * scale, z);
  const cap = addSphere(parent, 0.1 * scale, M.red, x, 0.2 * scale, z, 7);
  cap.scale.y = 0.65;
  const dot = addSphere(parent, 0.02 * scale, M.white, x + 0.03, 0.24 * scale, z + 0.03, 5);
  dot.scale.set(1, 0.5, 1);
}

function paintingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 180);
  sky.addColorStop(0, '#f7d8b0');
  sky.addColorStop(0.65, '#cfe4e0');
  sky.addColorStop(1, '#8cc66f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 180);
  ctx.fillStyle = '#f7d37c';
  ctx.beginPath();
  ctx.arc(190, 52, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5f9257';
  for (let i = 0; i < 5; i += 1) {
    const x = 30 + i * 46;
    const h = 60 + (i % 3) * 22;
    ctx.beginPath();
    ctx.moveTo(x - 26, 168);
    ctx.lineTo(x, 168 - h);
    ctx.lineTo(x + 26, 168);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(47,58,75,.5)';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 246, 170);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------------------
// Post office
// ---------------------------------------------------------------------------

function buildPostOffice(group, planet) {
  addCylinder(group, 3.25, 3.45, 0.26, 12, M.stoneDark, 0, 0.13, 0).receiveShadow = true;
  addCylinder(group, 2.8, 2.9, 0.12, 12, M.stone, 0, 0.32, 0);

  addBox(group, 4.4, 2.35, 3.0, M.wall, 0, 1.55, 0);
  addBox(group, 4.6, 0.26, 3.2, M.trim, 0, 0.48, 0);
  addBox(group, 4.5, 0.14, 3.1, M.trimDeep, 0, 2.66, 0);
  addCone(group, 3.5, 1.55, 4, M.roofCoral, 0, 3.48, 0, { y: Math.PI / 4 });
  addSphere(group, 0.13, M.gold, 0, 4.32, 0, 7);
  addCylinder(group, 0.05, 0.05, 0.5, 5, M.gold, 0, 4.5, 0);

  // Chimney + smoke
  addBox(group, 0.55, 1.0, 0.55, M.wallWarm, -1.35, 3.3, -0.55);
  addBox(group, 0.68, 0.15, 0.68, M.stoneDark, -1.35, 3.85, -0.55);
  planet.addSmoke(
    group.localToWorld(new THREE.Vector3(-1.35, 4.1, -0.55)),
    { count: 7, size: 0.55, rise: 2.6, speed: 0.075, color: '#e8e2d6', drift: 0.5 },
  );

  // Door, steps, windows
  addBox(group, 1.12, 1.65, 0.08, M.trimDeep, 0, 1.14, 1.51);
  addBox(group, 0.95, 1.5, 0.1, M.woodDark, 0, 1.12, 1.55);
  addWindow(group, 0, 1.86, 1.56, 0.42, 0.25, M.glass, M.woodDark);
  addBox(group, 1.7, 0.14, 0.8, M.roofCoral, 0, 2.28, 1.7, { x: -0.12 });
  addSphere(group, 0.05, M.gold, 0.35, 1.15, 1.62, 6);
  addBox(group, 1.9, 0.16, 0.5, M.stone, 0, 0.37, 1.85);
  addBox(group, 2.2, 0.16, 0.32, M.stoneDark, 0, 0.23, 2.15);

  addWindow(group, -1.5, 1.5, 1.56, 0.56, 0.66);
  addWindow(group, 1.5, 1.5, 1.56, 0.56, 0.66);
  addWindow(group, 1.98, 1.55, -0.2, 0.5, 0.6);

  addSignPlane(group, '微光邮局', {
    y: 2.4,
    z: 1.6,
    width: 2.0,
    height: 0.4,
    sub: 'TINY POST OFFICE',
    seed: 4,
  });
  const clock = makeClockFace({ size: 0.55 });
  clock.position.set(1.28, 2.1, 1.565);
  group.add(clock);

  addLantern(group, -0.78, 2.05, 1.7, { size: 0.09, post: false });
  addLantern(group, 0.78, 2.05, 1.7, { size: 0.09, post: false });

  // Mailbox
  addCylinder(group, 0.055, 0.07, 0.95, 5, M.woodDark, 2.55, 0.48, 1.95);
  addBox(group, 0.62, 0.52, 0.42, M.trimDeep, 2.55, 1.18, 1.95);
  const top = addCylinder(group, 0.31, 0.31, 0.42, 10, M.trimDeep, 2.55, 1.44, 1.95, { x: Math.PI / 2 });
  top.scale.y = 1;
  addBox(group, 0.38, 0.04, 0.02, M.dark, 2.55, 1.24, 2.17);
  addBox(group, 0.04, 0.4, 0.05, M.gold, 2.88, 1.28, 1.8);
  addBox(group, 0.2, 0.16, 0.02, M.trim, 2.97, 1.48, 1.8);
  const mailSign = makeSign('信件', { width: 0.32, height: 0.15, fontSize: 74, seed: 1 });
  mailSign.position.set(2.55, 1.17, 2.17);
  group.add(mailSign);

  // Parcels
  addBox(group, 0.72, 0.56, 0.62, material(0xd9b783), -2.35, 0.6, 1.7, { y: 0.2 });
  addBox(group, 0.74, 0.035, 0.64, M.woodDark, -2.35, 0.89, 1.7, { y: 0.2 });
  addBox(group, 0.52, 0.42, 0.48, material(0xefe0c1), -2.42, 1.15, 1.55, { y: -0.12 });
  addBox(group, 0.54, 0.03, 0.5, M.trim, -2.42, 1.37, 1.55, { y: -0.12 });
  addBox(group, 0.35, 0.28, 0.35, material(0xd9b783), -1.8, 0.44, 2.05, { y: 0.4 });

  // Bicycle
  const bike = new THREE.Group();
  bike.position.set(-2.55, 0, 2.35);
  bike.rotation.z = 0.08;
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.035, 5, 12);
  const wheelA = new THREE.Mesh(wheelGeo, M.dark);
  wheelA.position.set(0.48, 0.36, 0);
  bike.add(wheelA);
  const wheelB = wheelA.clone();
  wheelB.position.x = -0.48;
  bike.add(wheelB);
  addBox(bike, 0.06, 0.06, 0.5, M.trim, 0, 0.45, 0, { z: 0.2 });
  addBox(bike, 0.06, 0.42, 0.06, M.trim, -0.12, 0.6, 0);
  addBox(bike, 0.06, 0.52, 0.06, M.trim, 0.34, 0.55, 0);
  addBox(bike, 0.4, 0.05, 0.05, M.dark, -0.3, 0.85, 0);
  addBox(bike, 0.26, 0.04, 0.12, M.woodDark, -0.16, 0.78, 0);
  addBox(bike, 0.25, 0.18, 0.2, M.wood, 0.46, 0.86, 0);
  const bikeMail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.02), material(0xfdf4df));
  bikeMail.position.set(0.46, 0.9, 0.11);
  bike.add(bikeMail);
  group.add(bike);

  signpost(group, '↞ 环星小径', -3.0, 2.7, -0.12);

  const doorLight = new THREE.PointLight(0xffc879, 0.7, 6, 2);
  doorLight.position.set(0, 2.2, 2.1);
  group.add(doorLight);

  // Porch bunting
  const bunting = [M.trim, M.roofTeal, M.gold, M.trim, M.roofTeal, M.gold];
  for (let i = 0; i < 6; i += 1) {
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 3), bunting[i]);
    flag.position.set(-1.4 + i * 0.56, 2.62 - Math.sin((i / 5) * Math.PI) * 0.13, 1.8);
    flag.rotation.x = Math.PI;
    group.add(flag);
  }
}

// ---------------------------------------------------------------------------
// Windmill
// ---------------------------------------------------------------------------

function buildWindmill(group, planet) {
  addCylinder(group, 2.5, 2.8, 0.26, 10, M.stoneDark, 0, 0.13, 0);
  addCylinder(group, 1.35, 1.95, 4.2, 9, M.wallWarm, 0, 2.35, 0);
  addCylinder(group, 1.98, 2.0, 0.35, 9, M.stone, 0, 0.5, 0);
  addCylinder(group, 1.44, 1.5, 0.12, 9, M.wood, 0, 1.5, 0);
  addCylinder(group, 1.28, 1.34, 0.12, 9, M.wood, 0, 3.2, 0);
  addCone(group, 1.68, 1.25, 9, M.roofRust, 0, 5.05, 0);
  addCylinder(group, 0.035, 0.05, 0.8, 5, M.woodDark, 0, 5.65, 0);

  addDoor(group, 0, 1.05, 1.62, 0.82, 1.35, M.woodDark);
  addBox(group, 1.0, 0.14, 0.35, M.stone, 0, 0.35, 1.8);
  addWindow(group, -0.7, 3.15, 1.35, 0.46, 0.54);
  addWindow(group, 0.82, 2.2, 1.36, 0.42, 0.5);

  // Sacks and wheat
  for (let i = 0; i < 3; i += 1) {
    const sack = addSphere(group, 0.28, material(0xd9b783), 2.05 + i * 0.12, 0.3, 1.15 - i * 0.4, 7);
    sack.scale.set(0.9, 1.1, 0.85);
    addCylinder(group, 0.07, 0.09, 0.16, 5, M.woodDark, 2.05 + i * 0.12, 0.62, 1.15 - i * 0.4);
  }
  for (let i = 0; i < 5; i += 1) {
    addCylinder(group, 0.02, 0.02, 0.9, 4, material(0xe3bd63), -2.15 + i * 0.1, 0.45, 1.2, { z: 0.18 });
  }

  const blades = new THREE.Group();
  blades.position.set(0, 4.0, 1.72);
  const hub = addSphere(blades, 0.18, M.woodDark, 0, 0, 0, 8);
  hub.castShadow = true;
  for (let i = 0; i < 4; i += 1) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    addBox(arm, 0.1, 3.3, 0.1, M.woodDark, 0, 1.6, 0);
    addBox(arm, 0.8, 1.95, 0.045, material(0xf2e4c6), 0.46, 1.75, 0);
    for (let j = 0; j < 3; j += 1) {
      addBox(arm, 0.74, 0.035, 0.02, M.wood, 0.46, 1.3 + j * 0.45, 0.04);
    }
    blades.add(arm);
  }
  group.add(blades);
  planet.addAnimation((dt) => {
    blades.rotation.z += dt * 0.45;
  });

  addSignPlane(group, '风车磨坊', { y: 2.1, z: 1.7, width: 1.9, height: 0.45, sub: 'WINDMILL', seed: 2 });
}

// ---------------------------------------------------------------------------
// Lighthouse
// ---------------------------------------------------------------------------

function buildLighthouse(group, planet) {
  addCylinder(group, 3.0, 3.4, 0.5, 11, M.stoneGrey, 0, 0.25, 0);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const rock = addSphere(group, 0.42 + (i % 3) * 0.15, M.stoneGrey, Math.cos(angle) * 2.9, 0.38, Math.sin(angle) * 2.9, 6);
    rock.scale.set(1.2, 0.65, 1);
  }

  addCylinder(group, 1.55, 2.05, 2.5, 10, M.white, 0, 1.8, 0);
  addCylinder(group, 1.34, 1.58, 1.15, 10, M.red, 0, 3.55, 0);
  addCylinder(group, 1.13, 1.33, 1.35, 10, M.white, 0, 4.8, 0);
  addCylinder(group, 0.95, 1.12, 0.95, 10, M.red, 0, 5.95, 0);
  addCylinder(group, 0.82, 0.95, 0.75, 10, M.white, 0, 6.8, 0);

  addCylinder(group, 1.25, 1.25, 0.18, 10, M.stoneDark, 0, 7.22, 0);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    addCylinder(group, 0.025, 0.03, 0.5, 4, M.metal, Math.cos(angle) * 1.15, 7.55, Math.sin(angle) * 1.15);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.025, 4, 22), M.metal);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 7.8;
  group.add(rail);

  const lanternGlass = addCylinder(group, 0.64, 0.64, 1.0, 10, M.glass, 0, 8.05, 0);
  lanternGlass.material = material(0xffe4a6, {
    emissive: 0xffad3f,
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0.92,
    roughness: 0.3,
  });
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    addBox(group, 0.06, 1.05, 0.06, M.metal, Math.cos(angle) * 0.64, 8.05, Math.sin(angle) * 0.64);
  }
  addCone(group, 1.05, 0.9, 10, M.redDeep, 0, 8.98, 0);
  addSphere(group, 0.11, M.gold, 0, 9.5, 0, 6);
  addCylinder(group, 0.02, 0.03, 0.5, 4, M.metal, 0, 9.75, 0);

  addDoor(group, 0, 1.0, 1.83, 0.72, 1.25, M.woodDark);
  addBox(group, 0.92, 0.14, 0.3, M.stone, 0, 0.32, 2.0);
  addWindow(group, 0, 2.7, 1.55, 0.36, 0.46);
  addWindow(group, 0, 4.55, 1.25, 0.32, 0.4);
  addSignPlane(group, '潮汐灯塔', { y: 2.15, z: 2.02, width: 1.5, height: 0.36, sub: 'TIDELIGHT', seed: 3 });

  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 8.05, 0);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const direction of [1, -1]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.95, 6.2, 10, 1, true), beamMaterial);
    beam.rotation.x = direction * -Math.PI / 2;
    beam.position.z = direction * 3.1;
    beamPivot.add(beam);
  }
  group.add(beamPivot);
  planet.addAnimation((dt) => {
    beamPivot.rotation.y += dt * 0.36;
  });

  const glow = glowSprite('#ffcf86', 3.4, 0.65);
  glow.position.set(0, 8.05, 0);
  group.add(glow);
  const light = new THREE.PointLight(0xffc979, 1.6, 16, 2);
  light.position.set(0, 8.05, 0);
  group.add(light);
}

// ---------------------------------------------------------------------------
// Beach
// ---------------------------------------------------------------------------

function buildBeach(group, planet) {
  addCylinder(group, 4.5, 4.7, 0.09, 16, M.sand, 0, 0.045, 0).receiveShadow = true;

  // Stilt hut
  const hut = new THREE.Group();
  hut.position.set(-0.2, 0, -0.4);
  for (const [x, z] of [[-1.0, -0.9], [1.0, -0.9], [-1.0, 0.9], [1.0, 0.9]]) {
    addCylinder(hut, 0.09, 0.11, 0.55, 5, M.woodDark, x, 0.28, z);
  }
  addBox(hut, 2.5, 0.18, 2.1, M.wood, 0, 0.62, 0);
  addBox(hut, 2.4, 1.5, 0.1, M.wallWarm, 0, 1.45, -0.95);
  addBox(hut, 0.1, 1.5, 1.9, M.wallWarm, -1.15, 1.45, 0);
  addBox(hut, 0.1, 1.5, 1.9, M.wallWarm, 1.15, 1.45, 0);
  addBox(hut, 0.1, 0.55, 1.9, M.wallWarm, -1.15, 1.0, 0);
  addCone(hut, 2.0, 1.15, 4, M.thatch, 0, 2.72, 0, { y: Math.PI / 4 });
  addCone(hut, 1.15, 0.55, 4, M.thatch, 0, 3.25, 0, { y: Math.PI / 4 });
  addBox(hut, 1.0, 0.1, 0.14, M.woodDark, 0, 1.8, 1.16);
  addBox(hut, 0.9, 0.55, 0.08, M.woodDark, -0.55, 1.15, 1.06);
  const hutSign = makeSign('贝壳海滩', { width: 1.2, height: 0.3, seed: 7 });
  hutSign.position.set(0, 2.1, 1.08);
  hut.add(hutSign);
  group.add(hut);

  // String lights on hut
  for (let i = 0; i < 6; i += 1) {
    addSphere(hut, 0.045, M.glass, -1.1 + i * 0.45, 2.15 - Math.sin((i / 5) * Math.PI) * 0.1, 1.12, 5);
  }

  // Surfboard
  const board = addSphere(group, 0.25, M.trim, 1.35, 1.0, 1.2, 9);
  board.scale.set(0.35, 2.1, 0.13);
  board.rotation.z = 0.22;
  addBox(group, 0.08, 1.0, 0.02, M.white, 1.38, 1.0, 1.285, { z: 0.22 });

  // Parasol + towel + ball
  addCylinder(group, 0.035, 0.045, 1.9, 5, M.wood, -2.4, 0.95, 1.3);
  addCone(group, 1.35, 0.5, 12, M.trim, -2.4, 1.92, 1.3, { z: 0.08 });
  const parasolRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.025, 4, 24), M.white);
  parasolRing.rotation.x = Math.PI / 2;
  parasolRing.position.set(-2.4, 1.7, 1.3);
  group.add(parasolRing);
  addBox(group, 1.5, 0.03, 0.9, M.roofTeal, -2.6, 0.1, 0.15, { y: 0.1 });
  addBox(group, 1.5, 0.035, 0.15, M.white, -2.6, 0.115, 0.15, { y: 0.1 });
  const ball = addSphere(group, 0.24, M.white, -1.6, 0.34, 1.0, 8);
  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 4, 12), [M.trim, M.roofTeal, M.gold][i]);
    band.rotation.set(Math.PI / 2, (i / 3) * Math.PI, 0);
    band.position.copy(ball.position);
    group.add(band);
  }

  // Bonfire
  const fire = new THREE.Group();
  fire.position.set(1.9, 0, 1.6);
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const stone = addSphere(fire, 0.16 + (i % 3) * 0.04, M.stoneGrey, Math.cos(angle) * 0.62, 0.13, Math.sin(angle) * 0.62, 5);
    stone.scale.y = 0.7;
  }
  for (let i = 0; i < 3; i += 1) {
    addCylinder(fire, 0.06, 0.08, 0.9, 5, M.woodDark, 0, 0.25, 0, { z: Math.PI / 2, x: i * 0.7 });
  }
  const flame = addCone(fire, 0.34, 0.95, 7, material(0xff8c3c, { emissive: 0xff6b1f, emissiveIntensity: 1.4 }), 0, 0.85, 0);
  const innerFlame = addCone(fire, 0.18, 0.6, 6, material(0xffe07a, { emissive: 0xffb52e, emissiveIntensity: 1.8 }), 0, 0.72, 0.05);
  const fireLight = new THREE.PointLight(0xff9b4d, 2.2, 9, 2);
  fireLight.position.set(0, 1.15, 0);
  fire.add(fireLight);
  group.add(fire);
  planet.flames.push({ mesh: flame, light: fireLight, baseIntensity: 2.2, phase: 0 });
  planet.addAnimation((dt, elapsed) => {
    innerFlame.scale.y = 1 + Math.sin(elapsed * 17) * 0.12;
    innerFlame.rotation.y += dt * 0.3;
  });
  planet.addSmoke(group.localToWorld(new THREE.Vector3(1.9, 1.4, 1.6)), {
    count: 6,
    size: 0.7,
    rise: 3.0,
    speed: 0.08,
    color: '#ded4c4',
    drift: 0.6,
  });

  // Shells, driftwood
  for (let i = 0; i < 8; i += 1) {
    const shell = addSphere(group, 0.08, i % 2 ? M.trim : M.white, -3.2 + i * 0.9, 0.1, 2.4 - (i % 3) * 0.6, 6);
    shell.scale.set(1, 0.35, 1.2);
  }
  addCylinder(group, 0.08, 0.12, 1.3, 5, M.wood, 3.3, 0.16, 0.8, { z: Math.PI / 2, y: 0.3 });

  signpost(group, '☼ 拾贝小径', 3.2, 2.6, 0.2);
}

// ---------------------------------------------------------------------------
// Temple
// ---------------------------------------------------------------------------

function buildTemple(group, planet) {
  addBox(group, 5.8, 0.22, 4.6, M.stoneDark, 0, 0.11, 0);
  addBox(group, 4.9, 0.24, 3.8, M.stone, 0, 0.34, 0);
  addBox(group, 3.9, 0.26, 3.0, M.stoneDark, 0, 0.59, 0);
  addBox(group, 4.4, 0.18, 0.4, M.stone, 0, 0.46, 1.9);
  addBox(group, 5.2, 0.18, 0.4, M.stone, 0, 0.23, 2.25);

  // Zen garden patches
  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.22, 0.012, 3, 24), M.sand);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-1.95 + (i % 2) * 0.06, 0.48, 0.9);
    group.add(ring);
  }
  addSphere(group, 0.28, M.stoneGrey, -1.95, 0.52, 0.9, 5).scale.set(1.2, 0.7, 1);

  // Main hall
  addBox(group, 3.2, 0.25, 2.6, M.woodDark, 0, 0.84, 0);
  for (const [x, z] of [[-1.35, -1.05], [1.35, -1.05], [-1.35, 1.05], [1.35, 1.05]]) {
    addCylinder(group, 0.13, 0.15, 2.1, 8, M.red, x, 1.95, z);
  }
  addBox(group, 3.1, 2.0, 0.14, M.wallWarm, 0, 1.95, -1.15);
  addBox(group, 3.2, 0.18, 2.6, M.red, 0, 2.95, 0);
  addCone(group, 2.6, 0.7, 4, M.roofTeal, 0, 3.35, 0, { y: Math.PI / 4 });
  addCone(group, 1.8, 0.6, 4, M.roofTeal, 0, 3.85, 0, { y: Math.PI / 4 });
  addSphere(group, 0.13, M.gold, 0, 4.2, 0, 6);
  addCylinder(group, 0.025, 0.035, 0.4, 4, M.gold, 0, 4.4, 0);

  // Altar and bell
  addBox(group, 1.2, 0.4, 0.6, M.woodDark, 0, 1.02, -0.7);
  addSphere(group, 0.18, M.gold, 0, 1.35, -0.7, 7);
  addCylinder(group, 0.015, 0.015, 0.5, 3, M.dark, 0, 2.58, 0.1);
  addSphere(group, 0.22, M.gold, 0, 2.28, 0.1, 7);
  addCylinder(group, 0.02, 0.02, 0.35, 3, M.woodDark, 0, 2.47, 0.1);

  // Incense
  addCylinder(group, 0.11, 0.14, 0.22, 8, M.stoneGrey, 0.75, 1.39, -0.7);
  for (let i = 0; i < 3; i += 1) {
    addCylinder(group, 0.008, 0.008, 0.32, 3, M.red, 0.72 + i * 0.03, 1.6, -0.7 + i * 0.02);
  }
  planet.addSmoke(group.localToWorld(new THREE.Vector3(0.75, 1.9, -0.7)), {
    count: 5,
    size: 0.4,
    rise: 2.4,
    speed: 0.07,
    color: '#ddd7cb',
    drift: 0.25,
  });

  // Torii gate
  const gate = new THREE.Group();
  gate.position.set(0, 0, 2.3);
  addCylinder(gate, 0.15, 0.17, 2.5, 7, M.red, -1.15, 1.25, 0);
  addCylinder(gate, 0.15, 0.17, 2.5, 7, M.red, 1.15, 1.25, 0);
  addBox(gate, 3.1, 0.22, 0.28, M.redDeep, 0, 2.55, 0);
  addBox(gate, 3.4, 0.14, 0.34, M.dark, 0, 2.74, 0);
  addBox(gate, 2.5, 0.16, 0.2, M.red, 0, 2.05, 0);
  addBox(gate, 0.18, 0.28, 0.2, M.dark, -1.42, 2.68, 0);
  addBox(gate, 0.18, 0.28, 0.2, M.dark, 1.42, 2.68, 0);
  group.add(gate);

  for (const x of [-1.85, 1.85]) {
    addBox(group, 0.3, 0.25, 0.3, M.stoneGrey, x, 0.78, 2.35);
    addCylinder(group, 0.22, 0.26, 0.16, 6, M.stoneDark, x, 0.98, 2.35);
    addBox(group, 0.26, 0.4, 0.26, M.stoneGrey, x, 1.26, 2.35);
    addBox(group, 0.4, 0.1, 0.4, M.stoneDark, x, 1.51, 2.35);
    addSphere(group, 0.09, M.glass, x, 1.28, 2.5, 5);
    const halo = glowSprite('#ffd48e', 0.7, 0.5);
    halo.position.set(x, 1.28, 2.5);
    group.add(halo);
  }

  addSignPlane(group, '云顶小寺', { y: 2.25, z: 1.33, width: 1.55, height: 0.38, sub: 'CLOUD TEMPLE', seed: 5 });
  signpost(group, '↟ 上山的路', -2.8, 2.9, -0.16);
}

// ---------------------------------------------------------------------------
// Station
// ---------------------------------------------------------------------------

function buildStation(group, planet) {
  addBox(group, 9.4, 0.24, 4.6, M.stone, 0, 0.12, 0);
  addBox(group, 9.4, 0.03, 0.12, M.gold, 0, 0.26, 2.25);
  addBox(group, 9.4, 0.03, 0.12, M.gold, 0, 0.26, -2.25);

  // Rails and sleepers
  for (let i = 0; i < 13; i += 1) {
    addBox(group, 0.42, 0.07, 1.5, M.woodDark, -4.8 + i * 0.8, 0.27, 1.55);
  }
  addBox(group, 9.8, 0.07, 0.09, M.metal, 0, 0.33, 1.12);
  addBox(group, 9.8, 0.07, 0.09, M.metal, 0, 0.33, 1.98);

  // Station house
  addBox(group, 3.5, 0.3, 2.2, M.woodDark, -1.1, 0.42, -1.0);
  addBox(group, 3.3, 2.0, 2.0, M.wallWarm, -1.1, 1.45, -1.0);
  addCone(group, 2.55, 1.15, 4, M.roofTeal, -1.1, 2.95, -1.0, { y: Math.PI / 4 });
  addBox(group, 0.9, 1.4, 0.1, M.woodDark, -1.1, 1.2, 0.02);
  addWindow(group, -2.15, 1.6, 0.03, 0.55, 0.62);
  addWindow(group, 0.2, 1.6, 0.03, 0.55, 0.62);
  const clock = makeClockFace({ size: 0.75 });
  clock.position.set(-1.1, 2.15, 0.04);
  group.add(clock);
  const nameplate = makeSign('环星车站', { width: 1.8, height: 0.42, sub: 'ORBIT STATION', seed: 6 });
  nameplate.position.set(-1.1, 2.62, 0.08);
  group.add(nameplate);

  // Platform canopy
  addCylinder(group, 0.06, 0.075, 2.0, 5, M.woodDark, 1.7, 1.0, -0.6);
  addCylinder(group, 0.06, 0.075, 2.0, 5, M.woodDark, 3.5, 1.0, -0.6);
  addBox(group, 3.4, 0.13, 1.8, M.roofCoral, 2.6, 2.1, -0.35, { x: -0.08 });

  // Bench
  addBox(group, 1.2, 0.12, 0.4, M.wood, 1.7, 0.55, 0.1);
  addBox(group, 1.2, 0.42, 0.08, M.wood, 1.7, 0.82, -0.1);
  addBox(group, 0.08, 0.4, 0.4, M.woodDark, 1.15, 0.35, 0.1);
  addBox(group, 0.08, 0.4, 0.4, M.woodDark, 2.25, 0.35, 0.1);

  // Luggage
  addBox(group, 0.55, 0.4, 0.35, material(0xb9704d), 3.4, 0.5, 0.2, { y: 0.15 });
  addBox(group, 0.45, 0.3, 0.3, material(0x5d8d86), 3.55, 0.85, 0.05, { y: -0.1 });
  addBox(group, 0.58, 0.05, 0.38, M.woodDark, 3.4, 0.71, 0.2, { y: 0.15 });

  // Signal
  addCylinder(group, 0.05, 0.06, 2.2, 5, M.dark, 4.15, 1.1, 1.7);
  addBox(group, 0.22, 0.55, 0.16, M.dark, 4.15, 2.25, 1.7);
  addSphere(group, 0.085, material(0xff6e5e, { emissive: 0xff3b2a, emissiveIntensity: 1.1 }), 4.15, 2.35, 1.78, 6);
  addSphere(group, 0.085, material(0x7fd8a0, { emissive: 0x3fa763, emissiveIntensity: 0.4 }), 4.15, 2.12, 1.78, 6);

  // Handcar
  const cart = new THREE.Group();
  cart.position.set(2.4, 0, 1.55);
  addBox(cart, 1.0, 0.1, 0.7, M.roofTeal, 0, 0.6, 0);
  addBox(cart, 0.9, 0.08, 0.6, M.woodDark, 0, 0.46, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 8);
  for (const [x, z] of [[-0.35, -0.28], [0.35, -0.28], [-0.35, 0.28], [0.35, 0.28]]) {
    const wheel = new THREE.Mesh(wheelGeo, M.dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    cart.add(wheel);
  }
  addCylinder(cart, 0.03, 0.03, 0.9, 4, M.metal, 0, 0.95, 0, { z: Math.PI / 2 });
  addBox(cart, 0.2, 0.2, 0.3, material(0xe8c9a0), -0.15, 0.72, 0.05);
  group.add(cart);

  // Poster board
  addBox(group, 0.08, 1.1, 0.08, M.woodDark, -3.5, 0.55, 0.85);
  const posterFace = makeFaceTexture('🌍', '#fbf3df');
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.55),
    new THREE.MeshBasicMaterial({ map: posterFace, transparent: true }),
  );
  poster.position.set(-3.5, 1.25, 0.87);
  group.add(poster);

  const platformLight = new THREE.PointLight(0xffd08a, 1.1, 10, 2);
  platformLight.position.set(0.5, 2.7, 0.5);
  group.add(platformLight);
  addLantern(group, 0.4, 2.2, 0.2, { size: 0.1, post: false });
}

// ---------------------------------------------------------------------------
// Forest cottage
// ---------------------------------------------------------------------------

function buildForest(group, planet) {
  addBox(group, 3.8, 0.18, 3.2, M.woodDark, 0, 0.09, 0);
  addBox(group, 3.0, 1.85, 2.4, M.wallWarm, 0, 1.15, 0);
  addBox(group, 3.05, 0.18, 2.45, M.wood, 0, 0.32, 0);
  addCone(group, 2.7, 1.35, 4, M.roofGreen, 0, 2.65, 0, { y: Math.PI / 4 });
  addCone(group, 1.4, 0.7, 4, M.roofGreen, 0, 3.25, 0, { y: Math.PI / 4 });
  addCylinder(group, 0.04, 0.05, 0.7, 4, M.red, 0, 3.55, 0);
  addBox(group, 0.5, 0.85, 0.5, M.stoneGrey, 1.1, 2.7, -0.6);
  addBox(group, 0.62, 0.12, 0.62, M.stoneDark, 1.1, 3.14, -0.6);
  planet.addSmoke(group.localToWorld(new THREE.Vector3(1.1, 3.35, -0.6)), {
    count: 6,
    size: 0.48,
    rise: 2.4,
    speed: 0.08,
    color: '#e7e0d1',
    drift: 0.4,
  });

  addDoor(group, 0, 1.08, 1.22, 0.82, 1.35, M.woodDark);
  addBox(group, 1.15, 0.14, 0.4, M.stone, 0, 0.32, 1.4);
  addWindow(group, -0.95, 1.35, 1.21, 0.5, 0.58);
  addWindow(group, 0.95, 1.35, 1.21, 0.5, 0.58);
  addSignPlane(group, '低语森林', { y: 2.05, z: 1.27, width: 1.55, height: 0.38, sub: 'WHISPER WOODS', seed: 8 });

  // Fence
  addFence(group, -2.9, 2.9, 1.9, -0.55, 0.55);
  addFence(group, -2.9, -2.9, 1.9, null, null);

  // Stone path
  for (let i = 0; i < 4; i += 1) {
    const stone = addCylinder(group, 0.26, 0.3, 0.08, 6, M.stone, 0, 0.06, 1.6 + i * 0.55);
    stone.scale.x = 0.9 + (i % 2) * 0.2;
  }

  // Easel and painting
  const easel = new THREE.Group();
  easel.position.set(2.35, 0, 1.15);
  easel.rotation.y = 0.4;
  addCylinder(easel, 0.025, 0.03, 1.2, 4, M.wood, -0.3, 0.6, 0, { z: 0.16 });
  addCylinder(easel, 0.025, 0.03, 1.2, 4, M.wood, 0.3, 0.6, 0, { z: -0.16 });
  addCylinder(easel, 0.025, 0.03, 1.2, 4, M.wood, 0, 0.6, -0.25, { x: 0.2 });
  addBox(easel, 0.9, 0.65, 0.04, M.woodDark, 0, 1.0, 0.02);
  const painting = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.57),
    new THREE.MeshBasicMaterial({ map: paintingTexture() }),
  );
  painting.position.set(0, 1.0, 0.045);
  easel.add(painting);
  group.add(easel);

  // Paint pots
  for (let i = 0; i < 3; i += 1) {
    addCylinder(group, 0.07, 0.08, 0.16, 7, M.metal, 1.85 + i * 0.25, 0.1, 1.75);
    addSphere(group, 0.06, [M.trim, M.roofTeal, M.gold][i], 1.85 + i * 0.25, 0.19, 1.75, 5);
  }

  // Mushrooms
  for (let i = 0; i < 6; i += 1) {
    addMushroom(group, -1.9 + (i % 3) * 0.35, 1.9 + Math.floor(i / 3) * 0.35, 0.8 + (i % 2) * 0.5);
  }

  // Extra pines
  addPine(group, -2.6, -0.6, 1.15);
  addPine(group, 2.5, -1.1, 0.9);
  addPine(group, -3.0, 0.7, 0.75);
  addPine(group, 3.1, 0.1, 1.0);

  signpost(group, '↟ 松针小径', -3.0, 2.7, -0.12);
}

// ---------------------------------------------------------------------------

const BUILDERS = {
  post: buildPostOffice,
  windmill: buildWindmill,
  lighthouse: buildLighthouse,
  beach: buildBeach,
  temple: buildTemple,
  station: buildStation,
  forest: buildForest,
};

export function buildLandmarks(planet) {
  for (const place of planet.places) {
    const toward = place.id === 'post' ? planet.startDir : planet.postDir;
    const frame = planet.frameAt(place.dirVec, toward);
    const group = new THREE.Group();
    group.position.copy(planet.surfacePoint(place.dirVec));
    group.position.addScaledVector(frame.forward, place.id === 'post' ? -1.7 : -1.15);
    group.quaternion.copy(frame.quaternion);
    group.name = `landmark-${place.id}`;
    planet.landmarkGroups.push(group);
    planet.scene.add(group);
    group.updateMatrixWorld(true);
    const builder = BUILDERS[place.kind] || buildPostOffice;
    builder(group, planet, place);
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (object.isMesh) planet.landmarkColliders.push(object);
    });
    planet[`place_${place.id}`] = group;
  }
}
