import * as THREE from 'three';
import { createCharacter } from './character.js';
import { clamp, damp } from './noise.js';

const UP = new THREE.Vector3(0, 1, 0);
const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

export class Player {
  constructor({ scene, camera, planet, world, domElement, onFootstep }) {
    this.scene = scene;
    this.camera = camera;
    this.planet = planet;
    this.world = world;
    this.domElement = domElement;
    this.onFootstep = onFootstep;

    this.character = createCharacter({
      name: '旅人',
      showName: false,
      bodyColor: '#4f7fa6',
      accentColor: '#f5dfa9',
      hat: 'hat_postman',
      scale: 0.98,
    });
    this.root = this.character.group;
    scene.add(this.root);

    this.dir = planet.startDir.clone();
    this.facing = new THREE.Vector3(0, 0, 1);
    this.yaw = 0;
    const compactViewport = window.innerWidth < 700;
    this.pitch = compactViewport ? 0.43 : 0.38;
    this.distance = compactViewport ? 10.6 : 8.4;
    this.jump = 0;
    this.jumpVelocity = 0;
    this.airborne = false;
    this.enabled = false;
    this.locked = false;
    this.joystick = { x: 0, y: 0 };
    this.keys = new Set();
    this.dragging = false;
    this.dragPointer = null;
    this.dragX = 0;
    this.dragY = 0;
    this.water = false;
    this.stepAccumulator = 0;
    this.currentSpeed = 0;
    this.moving = false;
    this.cameraInitialized = false;
    this.velocityDir = new THREE.Vector3(0, 0, 1);
    this.raycaster = new THREE.Raycaster();
    this.cameraRayDirection = new THREE.Vector3();

    this.tmp = {
      up: new THREE.Vector3(),
      north: new THREE.Vector3(),
      east: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      move: new THREE.Vector3(),
      targetFacing: new THREE.Vector3(),
      pivot: new THREE.Vector3(),
      cameraPos: new THREE.Vector3(),
      lookAt: new THREE.Vector3(),
      basis: new THREE.Matrix4(),
    };

    this.placeAtStart();
    this.bindEvents();
  }

  placeAtStart() {
    this.dir.copy(this.planet.startDir);
    const desired = this.tangentTo(this.dir, this.planet.postDir);
    this.facing.copy(desired);
    if (this.facing.lengthSq() < 0.001) this.facing.set(0, 0, 1);
    this.facing.normalize();
    this.tangentBasis();
    this.yaw = Math.atan2(
      this.facing.dot(this.tmp.east),
      this.facing.dot(this.tmp.north),
    );
    this.root.position.copy(this.planet.surfacePoint(this.dir, 0.02));
    this.applyOrientation();
  }

  tangentTo(fromDir, toward) {
    const up = fromDir;
    const tangent = toward.clone().sub(up.clone().multiplyScalar(toward.dot(up)));
    if (tangent.lengthSq() < 1e-8) tangent.copy(new THREE.Vector3(1, 0, 0).sub(up.clone().multiplyScalar(up.x)));
    return tangent.normalize();
  }

  spawn(state) {
    this.enabled = true;
    this.placeAtStart();
    if (state?.player?.hat) this.character.setHat(state.player.hat);
    if (state) this.character.setHasLetter(Boolean(state.letter));
    this.cameraInitialized = false;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  setLocked(value) {
    this.locked = Boolean(value);
    if (value) {
      this.keys.clear();
      this.joystick.x = 0;
      this.joystick.y = 0;
    }
  }

  setJoystick(x, y) {
    this.joystick.x = clamp(x, -1, 1);
    this.joystick.y = clamp(y, -1, 1);
  }

  setHat(hat) {
    this.character.setHat(hat);
  }

  setHasLetter(value) {
    this.character.setHasLetter(Boolean(value));
  }

  jump() {
    if (!this.enabled || this.locked || this.airborne) return;
    this.airborne = true;
    this.jumpVelocity = 4.6;
  }

  bindEvents() {
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (MOVE_KEYS.has(event.code)) {
        this.keys.add(event.code);
        if (event.code.startsWith('Arrow')) event.preventDefault();
      }
      if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && this.enabled) {
        this.keys.add('Shift');
      }
      if (event.code === 'Space' && this.enabled) {
        event.preventDefault();
        this.jump();
      }
    });

    window.addEventListener('keyup', (event) => {
      if (MOVE_KEYS.has(event.code)) this.keys.delete(event.code);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.keys.delete('Shift');
    });

    window.addEventListener('blur', () => this.keys.clear());

    const canvas = this.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.enabled || event.button !== 0) return;
      this.dragging = true;
      this.dragPointer = event.pointerId;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      canvas.classList.add('dragging');
      canvas.setPointerCapture?.(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging || event.pointerId !== this.dragPointer) return;
      const dx = event.clientX - this.dragX;
      const dy = event.clientY - this.dragY;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      this.yaw -= dx * 0.0052;
      this.pitch = clamp(this.pitch + dy * 0.0042, 0.08, 1.12);
    });

    const endDrag = (event) => {
      if (event.pointerId !== undefined && event.pointerId !== this.dragPointer) return;
      this.dragging = false;
      this.dragPointer = null;
      canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    window.addEventListener('pointerup', endDrag);

    canvas.addEventListener('wheel', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.distance = clamp(this.distance + Math.sign(event.deltaY) * 0.7, 4.6, 13);
    }, { passive: false });
  }

  tangentBasis() {
    const { up, north, east } = this.tmp;
    up.copy(this.dir).normalize();
    let reference = Math.abs(up.y) > 0.985 ? new THREE.Vector3(0, 0, 1) : UP;
    north.copy(reference).addScaledVector(up, -reference.dot(up));
    if (north.lengthSq() < 1e-6) {
      reference = new THREE.Vector3(1, 0, 0);
      north.copy(reference).addScaledVector(up, -reference.dot(up));
    }
    north.normalize();
    east.crossVectors(up, north).normalize();
    return { up, north, east };
  }

  cameraForward() {
    const { north, east, forward } = this.tmp;
    forward.copy(north).multiplyScalar(Math.cos(this.yaw)).addScaledVector(east, Math.sin(this.yaw)).normalize();
    return forward;
  }

  applyOrientation() {
    const { up, right, basis } = this.tmp;
    up.copy(this.dir).normalize();
    if (this.facing.lengthSq() < 1e-6) this.facing.set(0, 0, 1);
    this.facing.addScaledVector(up, -this.facing.dot(up));
    if (this.facing.lengthSq() < 1e-6) this.facing.copy(this.tangentTo(this.dir, this.planet.postDir));
    this.facing.normalize();
    right.crossVectors(up, this.facing).normalize();
    basis.makeBasis(right, up, this.facing);
    this.root.quaternion.setFromRotationMatrix(basis);
  }

  update(dt, elapsed) {
    if (!this.enabled) return;

    const { up, north, east, forward, right, move, targetFacing, pivot, cameraPos, lookAt } = this.tmp;
    this.tangentBasis();

    let axisForward = 0;
    let axisRight = 0;
    if (!this.locked) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) axisForward += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) axisForward -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) axisRight += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) axisRight -= 1;
      axisForward += -this.joystick.y;
      axisRight += this.joystick.x;
    }

    const inputLength = Math.hypot(axisForward, axisRight);
    if (inputLength > 1) {
      axisForward /= inputLength;
      axisRight /= inputLength;
    }
    const moving = inputLength > 0.08;

    this.cameraForward();
    right.crossVectors(up, forward).normalize();

    const terrain = this.planet.terrainInfo(this.dir);
    this.water = terrain.water;

    const sprint = this.keys.has('Shift');
    let speed = sprint ? 7.6 : 4.9;
    if (this.water) speed *= 0.68;

    let actualSpeed = 0;
    if (moving) {
      move.copy(forward).multiplyScalar(axisForward).addScaledVector(right, axisRight);
      move.addScaledVector(up, -move.dot(up));
      if (move.lengthSq() > 1e-6) {
        move.normalize();
        const angular = (speed * dt) / this.planet.radius;
        this.dir.addScaledVector(move, angular).normalize();
        actualSpeed = speed;
        targetFacing.copy(move);
        this.facing.lerp(targetFacing, 1 - Math.exp(-12 * dt));
      }
    }
    this.moving = moving && actualSpeed > 0;
    this.currentSpeed = damp(this.currentSpeed, actualSpeed, 8, dt);

    // Grounding / jumping.
    if (this.airborne) {
      this.jumpVelocity -= 14.5 * dt;
      this.jump += this.jumpVelocity * dt;
      if (this.jump <= 0) {
        this.jump = 0;
        this.jumpVelocity = 0;
        this.airborne = false;
      }
    }

    const position = this.planet.surfacePoint(this.dir, 0.02);
    this.root.position.copy(position);
    this.applyOrientation();
    this.character.update(dt, elapsed, {
      moving: this.moving,
      speed: this.currentSpeed,
      water: this.water,
    });
    this.character.bodyGroup.position.y += this.jump;

    // Footsteps.
    if (this.moving && !this.airborne) {
      this.stepAccumulator += this.currentSpeed * dt;
      const threshold = this.water ? 0.95 : 1.85;
      if (this.stepAccumulator >= threshold) {
        this.stepAccumulator = 0;
        this.onFootstep?.(this.water);
      }
    } else {
      this.stepAccumulator = Math.min(this.stepAccumulator, 0.4);
    }

    // Camera.
    this.tangentBasis();
    this.cameraForward();
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    pivot.copy(this.root.position).addScaledVector(up, 1.45);
    cameraPos
      .copy(pivot)
      .addScaledVector(forward, -cosPitch * this.distance)
      .addScaledVector(up, sinPitch * this.distance);

    const minRadius = this.planet.radius + 2.4;
    if (cameraPos.length() < minRadius) cameraPos.setLength(minRadius);

    // Pull the camera in when a landmark would otherwise sit between the
    // camera and the little postie.
    const nearLandmark = this.planet.places.some((place) => this.dir.dot(place.dirVec) > 0.93);
    if (nearLandmark && this.planet.landmarkColliders.length) {
      this.cameraRayDirection.copy(cameraPos).sub(pivot).normalize();
      this.raycaster.set(pivot, this.cameraRayDirection);
      this.raycaster.far = cameraPos.distanceTo(pivot);
      const hits = this.raycaster.intersectObjects(this.planet.landmarkColliders, false);
      const blocker = hits.find((hit) => {
        if (!hit.object.isMesh) return false;
        const material = hit.object.material;
        return !(material && material.transparent && material.opacity < 0.3);
      });
      if (blocker) {
        const allowed = Math.max(1.5, blocker.distance - 0.4);
        cameraPos.copy(pivot).addScaledVector(this.cameraRayDirection, allowed);
      }
    }

    if (!this.cameraInitialized) {
      this.camera.position.copy(cameraPos);
      this.cameraInitialized = true;
    } else {
      this.camera.position.lerp(cameraPos, 1 - Math.exp(-7 * dt));
    }
    lookAt.copy(pivot).addScaledVector(forward, 0.7);
    this.camera.up.copy(up);
    this.camera.lookAt(lookAt);
  }

  nearbyNpc(maxAngle = 0.17) {
    if (!this.enabled) return null;
    let best = null;
    let bestDot = Math.cos(maxAngle);
    for (const npc of this.world.npcs) {
      const dir = new THREE.Vector3(npc.dir[0], npc.dir[1], npc.dir[2]);
      const dot = this.dir.dot(dir);
      if (dot > bestDot) {
        bestDot = dot;
        best = npc;
      }
    }
    if (!best) return null;
    return { npc: best, distance: Math.acos(clamp(bestDot, -1, 1)) };
  }

  networkState() {
    this.tangentBasis();
    const heading = Math.atan2(
      this.facing.dot(this.tmp.east),
      this.facing.dot(this.tmp.north),
    );
    return {
      dir: [this.dir.x, this.dir.y, this.dir.z],
      heading,
    };
  }

  compassAngle(targetDir) {
    this.tangentBasis();
    const forward = this.cameraForward();
    const right = this.tmp.right.crossVectors(this.tmp.up, forward).normalize();
    const target = new THREE.Vector3(targetDir[0], targetDir[1], targetDir[2]);
    const tangent = target.clone().sub(this.dir.clone().multiplyScalar(target.dot(this.dir)));
    if (tangent.lengthSq() < 1e-6) return 0;
    tangent.normalize();
    return Math.atan2(tangent.dot(right), tangent.dot(forward));
  }
}
