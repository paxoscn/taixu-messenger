import * as THREE from 'three';
import { buildLandmarks } from './landmarks.js';
import { makeSoftTexture, glowSprite } from './fx.js';
import {
  mulberry32,
  clamp,
  lerp,
  smoothstep,
  fbm3,
  slerpDir,
} from './noise.js';

const UP = new THREE.Vector3(0, 1, 0);
const SEED = 20251023;

const PALETTE = {
  deep: new THREE.Color(0x3c6f9f),
  shallow: new THREE.Color(0x73c2d4),
  foam: new THREE.Color(0xbfe9e3),
  sand: new THREE.Color(0xe7d49d),
  sandDark: new THREE.Color(0xd7bf85),
  grass: new THREE.Color(0x8cc66f),
  grassDark: new THREE.Color(0x71ab5d),
  highland: new THREE.Color(0xaab780),
  rock: new THREE.Color(0x9ca58e),
};

function randomDir(random) {
  const z = random() * 2 - 1;
  const theta = random() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(r * Math.cos(theta), z, r * Math.sin(theta)).normalize();
}

function hashFloat(n) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function terrainColor(info) {
  const { height, water } = info;
  if (water) {
    const shallow = smoothstep(-0.8, 0.14, height);
    return new THREE.Color().lerpColors(PALETTE.deep, PALETTE.shallow, shallow);
  }
  if (height < 0.32) {
    return new THREE.Color().lerpColors(PALETTE.sandDark, PALETTE.sand, smoothstep(0.14, 0.32, height));
  }
  if (height > 1.65) {
    return new THREE.Color().lerpColors(PALETTE.highland, PALETTE.rock, smoothstep(1.65, 2.1, height));
  }
  return new THREE.Color().lerpColors(PALETTE.grassDark, PALETTE.grass, smoothstep(0.32, 1.1, height));
}

export class Planet {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.radius = world.radius;
    this.random = mulberry32(SEED);
    this.animations = [];
    this.landmarkGroups = [];
    this.landmarkColliders = [];
    this.smokes = [];
    this.butterflies = [];
    this.flames = [];
    this.islets = [];
    this.sparklePoints = null;
    this.starField = null;
    this.moon = null;
    this.moonAngle = 0.7;
    this.sunDirection = new THREE.Vector3(0.55, 0.52, 0.66).normalize();

    this.postDir = new THREE.Vector3(...(world.places.find((p) => p.id === 'post')?.dir || [0, 0, 1])).normalize();
    this.startDir = new THREE.Vector3(...world.start_dir).normalize();

    this.places = world.places.map((place, index) => ({
      ...place,
      dirVec: new THREE.Vector3(...place.dir).normalize(),
      plateau: 0.72 + (index % 3) * 0.07,
    }));

    this.anchors = this.places.map((place) => ({
      dir: place.dirVec,
      cosLimit: Math.cos(0.2),
      inner: Math.cos(0.06),
      target: place.plateau,
    }));

    this.buildTerrain();
    this.buildSky();
    this.buildPaths();
    buildLandmarks(this);
    this.buildNature();
    this.buildClouds();
    this.buildCritters();
  }

  terrainInfo(dir) {
    const x = dir.x;
    const y = dir.y;
    const z = dir.z;
    const continent = fbm3(x * 2.05 + 11.3, y * 2.05 - 4.7, z * 2.05 + 7.9, 4);
    const detail = fbm3(x * 5.4 - 3.1, y * 5.4 + 8.2, z * 5.4 - 1.7, 3);
    let height = 0.52 + continent * 1.42 + detail * 0.2;

    for (const anchor of this.anchors) {
      const dot = x * anchor.dir.x + y * anchor.dir.y + z * anchor.dir.z;
      if (dot < 0.975) continue;
      const angle = Math.acos(clamp(dot, -1, 1));
      const influence = smoothstep(0.2, 0.06, angle);
      if (influence > 0) height = lerp(height, anchor.target, influence);
    }

    height = clamp(height, -0.78, 2.12);
    return { height, water: height < 0.15 };
  }

  heightAt(dir) {
    return this.terrainInfo(dir).height;
  }

  surfacePoint(dir, lift = 0) {
    return dir.clone().normalize().multiplyScalar(this.radius + this.heightAt(dir) + lift);
  }

  frameAt(dir, toward = this.postDir) {
    const up = dir.clone().normalize();
    let forward = toward.clone().sub(up.clone().multiplyScalar(toward.dot(up)));
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, forward),
    );
    return { up, forward, right, quaternion };
  }

  addAnimation(fn) {
    this.animations.push(fn);
  }

  isClearOfPlaces(dir, padding = 0.17) {
    const limit = Math.cos(padding);
    if (dir.dot(this.startDir) > limit) return false;
    return this.places.every((place) => dir.dot(place.dirVec) < limit);
  }

  buildTerrain() {
    const geometry = new THREE.IcosahedronGeometry(this.radius, 5);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    const vertex = new THREE.Vector3();
    const centroid = new THREE.Vector3();
    const faceCount = position.count / 3;

    for (let face = 0; face < faceCount; face += 1) {
      centroid.set(0, 0, 0);
      for (let k = 0; k < 3; k += 1) {
        const index = face * 3 + k;
        vertex.fromBufferAttribute(position, index).normalize();
        centroid.add(vertex);
      }
      centroid.normalize();
      const info = this.terrainInfo(centroid);
      const jitter = hashFloat(face);
      color.copy(terrainColor(info));
      color.offsetHSL(
        (jitter - 0.5) * 0.016,
        (jitter - 0.5) * 0.09,
        (jitter - 0.5) * 0.055,
      );

      for (let k = 0; k < 3; k += 1) {
        const index = face * 3 + k;
        vertex.fromBufferAttribute(position, index).normalize();
        const infoVertex = this.terrainInfo(vertex);
        const radius = this.radius + infoVertex.height;
        position.setXYZ(index, vertex.x * radius, vertex.y * radius, vertex.z * radius);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.94,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrainMesh = mesh;

    // A soft atmospheric halo, camera-independent enough for our purposes.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius + 1.7, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.58 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
            gl_FragColor = vec4(0.62, 0.84, 0.94, 1.0) * intensity * 0.65;
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    atmosphere.renderOrder = -1;
    this.scene.add(atmosphere);

    this.buildWaterSparkles();
  }

  buildWaterSparkles() {
    const positions = [];
    const random = mulberry32(SEED + 9);
    let attempts = 0;
    while (positions.length < 1500 && attempts < 12000) {
      attempts += 1;
      const dir = randomDir(random);
      const info = this.terrainInfo(dir);
      if (!info.water) continue;
      const point = dir.multiplyScalar(this.radius + info.height + 0.07);
      positions.push(point.x, point.y, point.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xe6ffff,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.sparklePoints = points;
  }

  buildSky() {
    const random = mulberry32(SEED + 3);
    const positions = [];
    const colors = [];
    for (let i = 0; i < 1400; i += 1) {
      const dir = randomDir(random).multiplyScalar(320 + random() * 40);
      positions.push(dir.x, dir.y, dir.z);
      const tint = random();
      const color = new THREE.Color().setHSL(
        tint > 0.8 ? 0.09 : tint > 0.55 ? 0.55 : 0.13,
        tint > 0.8 ? 0.55 : 0.12,
        0.75 + random() * 0.2,
      );
      colors.push(color.r, color.g, color.b);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 1.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.renderOrder = -3;
    this.scene.add(stars);
    this.starField = stars;

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(13, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0 }),
    );
    sun.position.copy(this.sunDirection.clone().multiplyScalar(235));
    this.scene.add(sun);
    const sunGlow = glowSprite('#ffd695', 92, 0.55, 0.4);
    sunGlow.position.copy(sun.position);
    this.scene.add(sunGlow);
    this.sun = sun;

    const moon = new THREE.Group();
    const moonBody = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.6, 2),
      new THREE.MeshStandardMaterial({ color: 0xd9d4c7, flatShading: true, roughness: 1 }),
    );
    moon.add(moonBody);
    const craterMaterial = new THREE.MeshStandardMaterial({ color: 0xbab5a7, flatShading: true });
    for (let i = 0; i < 6; i += 1) {
      const crater = new THREE.Mesh(new THREE.CircleGeometry(0.4 + random() * 0.5, 6), craterMaterial);
      const dir = randomDir(random);
      crater.position.copy(dir.multiplyScalar(3.45));
      crater.lookAt(dir.clone().multiplyScalar(8));
      moon.add(crater);
    }
    const moonGlow = glowSprite('#dfe9ff', 18, 0.25, 0.5);
    moon.add(moonGlow);
    this.scene.add(moon);
    this.moon = moon;

    // Two tiny distant paper planets for company.
    const distantMaterial = new THREE.MeshStandardMaterial({ color: 0xd7a68f, flatShading: true, roughness: 1 });
    const distant = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), distantMaterial);
    distant.position.set(-160, 70, -180);
    this.scene.add(distant);
    const distantTwo = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3, 1),
      new THREE.MeshStandardMaterial({ color: 0x9db8c9, flatShading: true, roughness: 1 }),
    );
    distantTwo.position.set(150, -90, -210);
    this.scene.add(distantTwo);
  }

  buildPaths() {
    const random = mulberry32(SEED + 17);
    const stoneGeometry = new THREE.CylinderGeometry(0.34, 0.41, 0.1, 6);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0e4c2,
      roughness: 0.92,
      flatShading: true,
    });

    const stones = [];
    const addPath = (from, to, wiggleSeed) => {
      const angle = from.angleTo(to);
      const steps = Math.max(5, Math.floor((angle * this.radius) / 2.25));
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const base = new THREE.Vector3(...slerpDir(from, to, t)).normalize();
        const frame = this.frameAt(base);
        const wiggle = Math.sin(i * 1.37 + wiggleSeed) * 0.62 + (random() - 0.5) * 0.3;
        const dir = base.clone().addScaledVector(frame.right, wiggle).normalize();
        const position = this.surfacePoint(dir, 0.035);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
        quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(dir, random() * Math.PI * 2),
        );
        const scale = 0.72 + random() * 0.45;
        stones.push({ position, quaternion, scale, dir });
      }
    };

    addPath(this.startDir, this.postDir, 0.3);
    for (const place of this.places) {
      if (place.id === 'post') continue;
      addPath(this.postDir, place.dirVec, place.name.length);
    }

    const mesh = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, stones.length);
    const dummy = new THREE.Object3D();
    stones.forEach((stone, index) => {
      dummy.position.copy(stone.position);
      dummy.quaternion.copy(stone.quaternion);
      dummy.scale.set(stone.scale, 0.8, stone.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      const shade = 0.92 + hashFloat(index) * 0.12;
      mesh.setColorAt(index, new THREE.Color(0xf0e4c2).multiplyScalar(shade));
    });
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.pathMesh = mesh;
  }

  buildNature() {
    const random = mulberry32(SEED + 21);
    const trees = [];
    let attempts = 0;
    while (trees.length < 150 && attempts < 2400) {
      attempts += 1;
      const dir = randomDir(random);
      const info = this.terrainInfo(dir);
      if (info.water || info.height < 0.3) continue;
      if (!this.isClearOfPlaces(dir, 0.225)) continue;
      if (trees.some((tree) => tree.dir.dot(dir) > 0.9994)) continue;
      trees.push({
        dir,
        scale: 0.7 + random() * 0.75,
        yaw: random() * Math.PI * 2,
        pine: random() < 0.58,
        tint: random(),
      });
    }

    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.27, 1.05, 5);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x856043,
      roughness: 0.95,
      flatShading: true,
    });
    const pineGeometry = new THREE.ConeGeometry(0.88, 1.75, 7);
    const roundGeometry = new THREE.IcosahedronGeometry(0.92, 0);
    const foliageMaterial = new THREE.MeshStandardMaterial({
      vertexColors: false,
      roughness: 0.9,
      flatShading: true,
      color: 0xffffff,
    });

    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.length);
    const pineTrees = trees.filter((tree) => tree.pine);
    const roundTrees = trees.filter((tree) => !tree.pine);
    const pineLower = new THREE.InstancedMesh(pineGeometry, foliageMaterial, pineTrees.length);
    const pineUpper = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.62, 1.35, 7),
      foliageMaterial,
      pineTrees.length,
    );
    const roundTops = new THREE.InstancedMesh(roundGeometry, foliageMaterial, roundTrees.length);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    trees.forEach((tree, index) => {
      const position = this.surfacePoint(tree.dir);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, tree.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(tree.dir, tree.yaw));
      dummy.position.copy(position).addScaledVector(tree.dir, 0.55 * tree.scale);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(index, dummy.matrix);
    });

    pineTrees.forEach((tree, index) => {
      const position = this.surfacePoint(tree.dir);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, tree.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(tree.dir, tree.yaw));
      color.setHSL(0.3 + tree.tint * 0.06, 0.34 + tree.tint * 0.14, 0.36 + tree.tint * 0.13);
      dummy.position.copy(position).addScaledVector(tree.dir, 1.35 * tree.scale);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.updateMatrix();
      pineLower.setMatrixAt(index, dummy.matrix);
      pineLower.setColorAt(index, color);

      dummy.position.copy(position).addScaledVector(tree.dir, 2.15 * tree.scale);
      dummy.scale.set(tree.scale * 0.9, tree.scale * 0.9, tree.scale * 0.9);
      dummy.updateMatrix();
      pineUpper.setMatrixAt(index, dummy.matrix);
      pineUpper.setColorAt(index, color.clone().multiplyScalar(1.05));
    });

    roundTrees.forEach((tree, index) => {
      const position = this.surfacePoint(tree.dir);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, tree.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(tree.dir, tree.yaw));
      color.setHSL(0.24 + tree.tint * 0.08, 0.38 + tree.tint * 0.16, 0.42 + tree.tint * 0.14);
      dummy.position.copy(position).addScaledVector(tree.dir, 1.65 * tree.scale);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(tree.scale * 1.1, tree.scale * 0.95, tree.scale * 1.1);
      dummy.updateMatrix();
      roundTops.setMatrixAt(index, dummy.matrix);
      roundTops.setColorAt(index, color);
    });

    for (const mesh of [trunks, pineLower, pineUpper, roundTops]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
    }

    this.buildUnderstory(random);
  }

  buildUnderstory(random) {
    const dummy = new THREE.Object3D();
    const bushSpots = [];
    const rockSpots = [];
    const flowerSpots = [];
    const tuftSpots = [];

    const collect = (count, minHeight, maxPlacePadding, target, extraCheck = null) => {
      let attempts = 0;
      let found = 0;
      while (found < count && attempts < count * 40) {
        attempts += 1;
        const dir = randomDir(random);
        const info = this.terrainInfo(dir);
        if (info.water || info.height < minHeight) continue;
        if (!this.isClearOfPlaces(dir, maxPlacePadding)) continue;
        if (extraCheck && !extraCheck(dir, info)) continue;
        target.push({
          dir,
          scale: 0.7 + random() * 0.7,
          yaw: random() * Math.PI * 2,
          tint: random(),
        });
        found += 1;
      }
    };

    collect(48, 0.3, 0.2, bushSpots);
    collect(56, 0.2, 0.16, rockSpots);
    collect(260, 0.3, 0.12, flowerSpots, (dir, info) => info.height < 1.7);
    collect(300, 0.3, 0.1, tuftSpots);

    const bushes = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.52, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 }),
      bushSpots.length,
    );
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.46, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }),
      rockSpots.length,
    );
    const flowers = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.1, 0.24, 5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 }),
      flowerSpots.length,
    );
    const tufts = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.11, 0.32, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }),
      tuftSpots.length,
    );

    const color = new THREE.Color();

    bushSpots.forEach((spot, index) => {
      const position = this.surfacePoint(spot.dir).addScaledVector(spot.dir, 0.25 * spot.scale);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, spot.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spot.dir, spot.yaw));
      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(spot.scale, spot.scale * 0.7, spot.scale);
      dummy.updateMatrix();
      bushes.setMatrixAt(index, dummy.matrix);
      color.setHSL(0.27 + spot.tint * 0.07, 0.32, 0.33 + spot.tint * 0.1);
      bushes.setColorAt(index, color);
    });

    rockSpots.forEach((spot, index) => {
      const position = this.surfacePoint(spot.dir).addScaledVector(spot.dir, 0.16 * spot.scale);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, spot.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spot.dir, spot.yaw));
      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(spot.scale, spot.scale * 0.65, spot.scale * 0.9);
      dummy.updateMatrix();
      rocks.setMatrixAt(index, dummy.matrix);
      const shade = 0.55 + spot.tint * 0.2;
      color.setRGB(shade, shade * 1.02, shade * 0.95);
      rocks.setColorAt(index, color);
    });

    const flowerColors = [0xf08a7a, 0xf3c75c, 0xf6b6cf, 0xfdf4df, 0xb9a5e0];
    flowerSpots.forEach((spot, index) => {
      const position = this.surfacePoint(spot.dir).addScaledVector(spot.dir, 0.12 * spot.scale);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, spot.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spot.dir, spot.yaw));
      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.setScalar(spot.scale);
      dummy.updateMatrix();
      flowers.setMatrixAt(index, dummy.matrix);
      flowers.setColorAt(index, new THREE.Color(flowerColors[index % flowerColors.length]));
    });

    tuftSpots.forEach((spot, index) => {
      const position = this.surfacePoint(spot.dir).addScaledVector(spot.dir, 0.1 * spot.scale);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, spot.dir);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spot.dir, spot.yaw));
      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.set(spot.scale, spot.scale * (0.8 + spot.tint * 0.5), spot.scale);
      dummy.updateMatrix();
      tufts.setMatrixAt(index, dummy.matrix);
      color.setHSL(0.27, 0.28, 0.36 + spot.tint * 0.1);
      tufts.setColorAt(index, color);
    });

    for (const mesh of [bushes, rocks, flowers, tufts]) {
      mesh.castShadow = mesh === bushes || mesh === rocks;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
    }
  }

  buildClouds() {
    const random = mulberry32(SEED + 31);
    const cloudOrbit = new THREE.Group();
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xfffaf0,
      roughness: 1,
      emissive: 0xfffaf0,
      emissiveIntensity: 0.78,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });

    for (let i = 0; i < 11; i += 1) {
      const cloud = new THREE.Group();
      const blobs = 4 + Math.floor(random() * 3);
      for (let j = 0; j < blobs; j += 1) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), cloudMaterial);
        blob.scale.set(1.1 + random() * 1.4, 0.5 + random() * 0.4, 0.8 + random() * 0.8);
        blob.position.set((j - blobs / 2) * 1.1 + random() * 0.4, random() * 0.3, random() * 0.5 - 0.25);
        cloud.add(blob);
      }
      const dir = randomDir(random);
      const distance = 38 + random() * 8;
      cloud.position.copy(dir.multiplyScalar(distance));
      cloud.lookAt(0, 0, 0);
      cloud.userData.baseDistance = distance;
      cloud.userData.phase = random() * Math.PI * 2;
      cloud.userData.dir = cloud.position.clone().normalize();
      cloud.scale.setScalar(0.55 + random() * 0.5);
      cloudOrbit.add(cloud);
    }
    this.scene.add(cloudOrbit);
    this.cloudOrbit = cloudOrbit;

    // Little floating islands, a bit further out.
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x8cc66f, flatShading: true, roughness: 1 });
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x8b8473, flatShading: true, roughness: 1 });
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x5d9551, flatShading: true, roughness: 1 });
    const isletDirs = [new THREE.Vector3(-0.5, 0.72, 0.5), new THREE.Vector3(0.75, -0.2, -0.6), new THREE.Vector3(0.3, 0.6, -0.74)];
    isletDirs.forEach((dir, index) => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 0), rockMaterial);
      base.scale.set(1, 0.75, 1);
      group.add(base);
      const grass = new THREE.Mesh(new THREE.SphereGeometry(1.55, 8, 6), grassMaterial);
      grass.scale.set(1, 0.25, 1);
      grass.position.y = 0.62;
      group.add(grass);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x856043, flatShading: true }));
      trunk.position.y = 1.02;
      group.add(trunk);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), treeMaterial);
      top.position.y = 1.72;
      group.add(top);
      const direction = dir.clone().normalize();
      group.position.copy(direction.multiplyScalar(48 + index * 4));
      group.rotation.set(random() * 2, random() * 6, random() * 2);
      group.userData.base = group.position.clone();
      group.userData.phase = random() * Math.PI * 2;
      this.scene.add(group);
      this.islets.push(group);
    });
  }

  buildCritters() {
    const random = mulberry32(SEED + 41);

    const birdOrbit = new THREE.Group();
    const wingMaterial = new THREE.MeshBasicMaterial({
      color: 0x35425a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 6; i += 1) {
      const bird = new THREE.Group();
      const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.12), wingMaterial);
      leftWing.position.x = -0.21;
      leftWing.rotation.y = 0.2;
      bird.add(leftWing);
      const rightWing = leftWing.clone();
      rightWing.position.x = 0.21;
      rightWing.rotation.y = -0.2;
      bird.add(rightWing);
      const angle = (i / 6) * Math.PI * 2;
      bird.position.set(Math.cos(angle) * (33 + random() * 3), 3 + random() * 4, Math.sin(angle) * (33 + random() * 3));
      bird.rotation.y = -angle;
      bird.userData.phase = random() * Math.PI * 2;
      bird.userData.left = leftWing;
      bird.userData.right = rightWing;
      birdOrbit.add(bird);
    }
    this.scene.add(birdOrbit);
    this.birdOrbit = birdOrbit;

    const wingColors = [0xf3c75c, 0xf08a7a, 0x9ecfe0, 0xf7f1df];
    for (let i = 0; i < 9; i += 1) {
      let dir = randomDir(random);
      let info = this.terrainInfo(dir);
      let guard = 0;
      while ((info.water || info.height < 0.35 || !this.isClearOfPlaces(dir, 0.1)) && guard < 80) {
        dir = randomDir(random);
        info = this.terrainInfo(dir);
        guard += 1;
      }
      const frame = this.frameAt(dir);
      const base = this.surfacePoint(dir, 0.85);
      const group = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({
        color: wingColors[i % wingColors.length],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const wingGeometry = new THREE.PlaneGeometry(0.23, 0.17);
      const left = new THREE.Mesh(wingGeometry, material);
      left.position.x = -0.1;
      left.rotation.x = -Math.PI / 2;
      group.add(left);
      const right = new THREE.Mesh(wingGeometry, material);
      right.position.x = 0.1;
      right.rotation.x = -Math.PI / 2;
      group.add(right);
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0x4a463f }),
      );
      group.add(body);
      group.position.copy(base);
      this.scene.add(group);
      this.butterflies.push({
        group,
        left,
        right,
        base,
        rightAxis: frame.right,
        forwardAxis: frame.forward,
        radius: 0.9 + random() * 1.2,
        speed: 0.5 + random() * 0.6,
        phase: random() * Math.PI * 2,
        height: 0.6 + random() * 0.6,
      });
    }
  }

  addSmoke(worldPosition, options = {}) {
    const {
      count = 6,
      color = '#e8e3d4',
      size = 0.55,
      rise = 2.2,
      speed = 0.1,
      drift = 0.3,
    } = options;
    const up = worldPosition.clone().normalize();
    const frame = this.frameAt(up, new THREE.Vector3(0, 1, 0));
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: makeSoftTexture(color),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(size);
      this.scene.add(sprite);
      this.smokes.push({
        sprite,
        base: worldPosition.clone(),
        up,
        right: frame.right,
        forward: frame.forward,
        t: (i / count) % 1,
        speed: speed * (0.65 + Math.random() * 0.7),
        rise: rise * (0.7 + Math.random() * 0.6),
        drift: (Math.random() - 0.5) * drift,
        size: size * (0.7 + Math.random() * 0.6),
      });
    }
  }

  update(dt, elapsed) {
    for (const animation of this.animations) animation(dt, elapsed);

    if (this.cloudOrbit) this.cloudOrbit.rotation.y += dt * 0.012;
    if (this.birdOrbit) {
      this.birdOrbit.rotation.y -= dt * 0.045;
      this.birdOrbit.children.forEach((bird) => {
        const flap = Math.sin(elapsed * 7 + bird.userData.phase) * 0.55;
        bird.userData.left.rotation.z = flap;
        bird.userData.right.rotation.z = -flap;
        bird.position.y += Math.sin(elapsed * 1.4 + bird.userData.phase) * dt * 0.25;
      });
    }

    if (this.sparklePoints) {
      this.sparklePoints.material.opacity = 0.36 + Math.sin(elapsed * 1.5) * 0.14;
    }
    if (this.starField) {
      this.starField.material.opacity = 0.78 + Math.sin(elapsed * 0.6) * 0.1;
    }

    if (this.moon) {
      this.moonAngle += dt * 0.018;
      const distance = 88;
      this.moon.position.set(
        Math.cos(this.moonAngle) * distance,
        Math.sin(this.moonAngle * 0.7) * 38 + 20,
        Math.sin(this.moonAngle) * distance,
      );
      this.moon.rotation.y += dt * 0.05;
    }

    for (const islet of this.islets) {
      islet.position.copy(islet.userData.base);
      islet.position.y += Math.sin(elapsed * 0.4 + islet.userData.phase) * 1.2;
      islet.rotation.y += dt * 0.04;
    }

    for (const puff of this.smokes) {
      puff.t += dt * puff.speed;
      if (puff.t > 1) puff.t -= 1;
      const spread = Math.sin(puff.t * Math.PI);
      puff.sprite.position
        .copy(puff.base)
        .addScaledVector(puff.up, puff.t * puff.rise)
        .addScaledVector(puff.right, puff.drift * puff.t + Math.sin(elapsed + puff.t * 5) * 0.1 * spread)
        .addScaledVector(puff.forward, Math.cos(elapsed * 0.7 + puff.t * 4) * 0.08 * spread);
      puff.sprite.material.opacity = Math.sin(puff.t * Math.PI) * 0.24;
      puff.sprite.scale.setScalar(puff.size * (0.55 + puff.t * 1.1));
    }

    for (const butterfly of this.butterflies) {
      const angle = elapsed * butterfly.speed + butterfly.phase;
      const position = butterfly.base
        .clone()
        .addScaledVector(butterfly.rightAxis, Math.cos(angle) * butterfly.radius)
        .addScaledVector(butterfly.forwardAxis, Math.sin(angle) * butterfly.radius);
      position.addScaledVector(position.clone().normalize(), Math.sin(elapsed * 2 + butterfly.phase) * 0.18);
      butterfly.group.position.copy(position);
      const flap = 0.3 + Math.sin(elapsed * 16 + butterfly.phase) * 0.8;
      butterfly.left.rotation.z = flap;
      butterfly.right.rotation.z = -flap;
      butterfly.group.rotation.y = angle + Math.PI / 2;
    }

    for (const flame of this.flames) {
      const flicker = Math.sin(elapsed * 13 + flame.phase) * 0.12 + Math.sin(elapsed * 21 + flame.phase) * 0.06;
      flame.mesh.scale.set(1 + flicker, 1 + flicker * 1.6, 1 + flicker);
      if (flame.light) {
        flame.light.intensity = flame.baseIntensity * (0.82 + flicker * 2.2);
      }
    }
  }
}
