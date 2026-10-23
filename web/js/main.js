import * as THREE from 'three';
import { Api } from './api.js';
import { Planet } from './planet.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { createCharacter } from './character.js';

const canvas = document.getElementById('scene');
const fadeElement = document.getElementById('fade');
const api = new Api();
const audio = new AudioEngine();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const viewportFov = () => (window.innerWidth < 700 ? 57 : 51);
const camera = new THREE.PerspectiveCamera(
  viewportFov(),
  window.innerWidth / window.innerHeight,
  0.1,
  1100,
);
camera.position.set(0, 16, 64);

const hemisphere = new THREE.HemisphereLight(0xffe7c9, 0x5d7c9f, 2.05);
scene.add(hemisphere);

const sunLight = new THREE.DirectionalLight(0xfff0d2, 2.7);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -19;
sunLight.shadow.camera.right = 19;
sunLight.shadow.camera.top = 19;
sunLight.shadow.camera.bottom = -19;
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 160;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight);
scene.add(sunLight.target);

const fillLight = new THREE.DirectionalLight(0x9fc7e9, 0.55);
fillLight.position.set(-50, -30, -40);
scene.add(fillLight);

const remoteColors = ['#6f95d8', '#d7a45f', '#5fc6b6', '#b78cd8', '#e3b94f', '#91c46c', '#e9775f', '#cf7f9f'];

let world = null;
let planet = null;
let player = null;
let ui = null;
let mode = 'boot';
let elapsed = 0;
let previousTime = performance.now();
let heartbeatBusy = false;
let pendingEmote = null;
let heartbeatTimer = null;
let interacting = false;

const remotes = new Map();
const npcCharacters = new Map();
const effects = [];

const NPC_HATS = {
  poppy: 'hat_postman',
  ada: 'hat_sailor',
  milo: 'hat_straw',
  nia: 'hat_flower',
  tom: 'none',
  ruby: 'hat_sailor',
  pip: 'hat_straw',
};

const NPC_PROPS = {
  poppy: 'letter',
  ada: 'lantern',
  milo: 'bread',
  nia: 'shell',
  tom: 'staff',
  ruby: 'flag',
  pip: 'brush',
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

async function init() {
  try {
    world = await api.world();
  } catch (error) {
    const bootText = document.querySelector('.boot-text');
    if (bootText) bootText.textContent = `没能连上微光星球 · ${error.message || '等一下再刷新'} `;
    document.getElementById('boot')?.addEventListener('click', () => window.location.reload());
    return;
  }

  planet = new Planet(scene, world);

  player = new Player({
    scene,
    camera,
    planet,
    world,
    domElement: canvas,
    onFootstep: (water) => {
      audio.step(water);
      if (water) spawnRipple(player.root.position, player.dir);
    },
  });

  ui = new UI({
    api,
    world,
    audio,
    handlers: {
      onStart: startGame,
      onState: applyState,
      onBlockingChange: (blocking) => {
        player.setLocked(blocking);
        if (blocking) ui.setPrompt(null);
      },
      onEmote: sendEmote,
      onJoystick: (x, y) => player.setJoystick(x, y),
      onJump: () => player.jump(),
      onInteract: () => handleInteract(),
    },
  });

  buildNpcs();
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (!player?.enabled || ui.isBlocking()) return;
    handleInteract();
  });
  ui.finishBoot();
  mode = 'title';
  window.__tiny = {
    get player() { return player; },
    get planet() { return planet; },
    get ui() { return ui; },
    get api() { return api; },
    get world() { return world; },
  };
  window.__worldNpcs = world.npcs;
  requestAnimationFrame(loop);
}

function buildNpcs() {
  for (const npc of world.npcs) {
    const place = world.places.find((item) => item.id === npc.place);
    if (!place) continue;
    const placeDir = new THREE.Vector3(...place.dir).normalize();
    const target = npc.id === 'poppy' ? planet.startDir : planet.postDir;
    const frame = planet.frameAt(placeDir, target);
    const seed = hashString(npc.id);
    const side = npc.id === 'poppy' ? -1.3 : ((seed % 5) - 2) * 0.32;
    const forward = npc.id === 'poppy' ? 2.2 : 2.9;
    const position = planet
      .surfacePoint(placeDir, 0.02)
      .addScaledVector(frame.forward, forward)
      .addScaledVector(frame.right, side);
    const up = position.clone().normalize();
    const facing = planet.frameAt(up, target).forward.clone();

    const character = createCharacter({
      name: npc.name,
      subtitle: npc.title,
      hat: NPC_HATS[npc.id] || 'hat_straw',
      bodyColor: npc.body,
      accentColor: npc.accent,
      prop: NPC_PROPS[npc.id] || null,
      scale: 0.94 + (seed % 8) * 0.012,
      seed,
    });
    character.group.position.copy(position);
    setCharacterBasis(character.group, up, facing);
    scene.add(character.group);

    // The visual stand-in is placed in front of the building, a few steps
    // from the server's interaction anchor. Point local navigation at what
    // the player can actually see; the server's proximity check is wider.
    npc.dir = [up.x, up.y, up.z];
    npcCharacters.set(npc.id, {
      character,
      up,
      defaultFacing: facing,
      facing: facing.clone(),
    });
  }
}

function setCharacterBasis(group, up, facing) {
  const tangent = facing.clone().addScaledVector(up, -facing.dot(up));
  if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1);
  tangent.normalize();
  const right = new THREE.Vector3().crossVectors(up, tangent).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, tangent);
  group.quaternion.setFromRotationMatrix(basis);
}

function updateNpcs(dt) {
  for (const npc of npcCharacters.values()) {
    let targetFacing = npc.defaultFacing;
    const characterPosition = npc.character.group.position;
    if (player?.enabled) {
      const toPlayer = player.root.position.clone().sub(characterPosition);
      if (toPlayer.lengthSq() < 36) {
        const tangent = toPlayer.addScaledVector(npc.up, -toPlayer.dot(npc.up));
        if (tangent.lengthSq() > 0.001) targetFacing = tangent.normalize();
      }
    }
    npc.facing.lerp(targetFacing, 1 - Math.exp(-4 * dt));
    npc.facing.addScaledVector(npc.up, -npc.facing.dot(npc.up));
    if (npc.facing.lengthSq() < 1e-6) npc.facing.copy(npc.defaultFacing);
    npc.facing.normalize();
    setCharacterBasis(npc.character.group, npc.up, npc.facing);
    npc.character.update(dt, elapsed, { moving: false, speed: 0 });
    const distance = camera.position.distanceTo(npc.character.group.position);
    npc.character.setNameTagOpacity(clamp01((distance - 2.6) / 2.6));
  }
}

async function startGame(name) {
  try {
    await audio.start();
  } catch {
    // The game is perfectly playable in silence.
  }
  const response = await api.login(name);
  const state = response.state;

  player.spawn(state);
  ui.enterGame(state);
  mode = 'play';
  flashFade();
  audio.click();

  ui.toast(
    response.welcome ? `欢迎来到微光星球，${state.player.name}。` : `欢迎回来，${state.player.name}。`,
    { icon: '🌏', duration: 4200 },
  );

  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => sendHeartbeat(), 2200);
  sendHeartbeat();
}

function flashFade() {
  fadeElement.classList.add('on');
  window.setTimeout(() => fadeElement.classList.remove('on'), 380);
}

function applyState(state) {
  if (!player || !state) return;
  if (state.player?.hat) player.setHat(state.player.hat);
  player.setHasLetter(Boolean(state.letter));
}

function sendEmote(kind) {
  if (!player?.enabled || !kind) return;
  player.character.setEmote(kind);
  audio.emote(kind);
  sendHeartbeat(kind);
}

async function handleInteract() {
  if (!player?.enabled || ui?.isBlocking() || interacting) return;
  const nearby = player.nearbyNpc(0.18);
  if (!nearby) return;
  await openTalk(nearby.npc);
}

async function openTalk(npc) {
  if (interacting) return;
  interacting = true;
  try {
    const net = player.networkState();
    const talk = await api.talk({ npcId: npc.id, dir: net.dir, heading: net.heading });
    ui.updateState(talk.state);
    if (talk.achievements?.length) ui.showAchievementToasts(talk.achievements);
    showNpcDialog(npc, talk);
  } catch (error) {
    audio.error();
    ui.toast(error.message || 'TA 好像没听见你说话。', { icon: '⚠️', kind: 'error' });
  } finally {
    interacting = false;
  }
}

function showNpcDialog(npc, talk) {
  const state = api.state;
  const isTarget = state.letter?.npc_id === npc.id;
  const actions = [];

  if (isTarget) {
    actions.push({ label: '递上信件', primary: true, onClick: () => deliverLetter(npc) });
  }

  if (npc.id === 'poppy') {
    if (!state.letter) {
      actions.push({ label: '领一封信', primary: true, onClick: () => acceptLetter() });
    }
    actions.push({ label: '任务板', onClick: () => ui.openPanel('tasks') });
    actions.push({ label: '集邮册', onClick: () => ui.openPanel('collection') });
    actions.push({ label: '帽子铺', onClick: () => ui.openPanel('shop') });
  } else if (!isTarget) {
    actions.push({ label: '再聊一句', primary: true, onClick: () => openTalk(npc) });
  }

  actions.push({
    label: isTarget ? '继续送信' : '再见',
    onClick: () => ui.closeDialog(),
  });

  ui.showDialog({
    npcId: npc.id,
    name: npc.name,
    title: npc.title,
    line: talk.line,
    actions,
  });
}

async function acceptLetter() {
  if (ui.busy) return;
  ui.setBusy(true);
  try {
    const net = player.networkState();
    const response = await api.acceptLetter({ dir: net.dir, heading: net.heading });
    ui.updateState(response.state);
    audio.bell();
    ui.showDialog({
      npcId: 'poppy',
      name: '波比',
      title: '邮局局长',
      line: response.message,
      actions: [
        { label: '出发送信', primary: true, onClick: () => ui.closeDialog() },
        { label: '先看看任务', onClick: () => ui.openPanel('tasks') },
      ],
    });
    ui.toast('信件已经放进邮包', { icon: '✉️' });
  } catch (error) {
    audio.error();
    ui.toast(error.message || '邮局里一阵手忙脚乱。', { icon: '⚠️', kind: 'error' });
  } finally {
    ui.setBusy(false);
  }
}

async function deliverLetter(npc) {
  if (ui.busy) return;
  ui.setBusy(true);
  try {
    const net = player.networkState();
    const response = await api.deliver({ npcId: npc.id, dir: net.dir, heading: net.heading });
    const after = response.state;
    ui.updateState(after);
    audio.deliver();
    ui.showAchievementToasts(response.achievements);
    spawnConfetti(player.root.position);
    ui.toast('信件送达 · +35 金币', { icon: '🪙', duration: 3600 });
    if (after.tasks.some((task) => task.status === 'completed')) {
      window.setTimeout(() => {
        ui.toast('有任务可以领奖了，打开任务板看看吧。', { icon: '📮' });
      }, 800);
    }
    ui.showDialog({
      npcId: npc.id,
      name: npc.name,
      title: npc.title,
      line: response.message,
      actions: [{ label: '继续散步', primary: true, onClick: () => ui.closeDialog() }],
    });
  } catch (error) {
    audio.error();
    ui.toast(error.message || '这封信还送不出去。', { icon: '⚠️', kind: 'error' });
  } finally {
    ui.setBusy(false);
  }
}

async function sendHeartbeat(emote = null) {
  if (!player?.enabled || !api.hasGuest) return;
  if (heartbeatBusy) {
    if (emote) pendingEmote = emote;
    return;
  }
  heartbeatBusy = true;
  const net = player.networkState();
  const outgoingEmote = emote || pendingEmote;
  pendingEmote = null;
  try {
    const response = await api.heartbeat({
      dir: net.dir,
      heading: net.heading,
      emote: outgoingEmote,
    });
    ui.setOnline(response.online);
    updateRemotePlayers(response.players);
  } catch {
    // The planet will try again on the next tick.
  } finally {
    heartbeatBusy = false;
  }
}

function updateRemotePlayers(players) {
  const now = performance.now();
  const seen = new Set();

  for (const presence of players) {
    seen.add(presence.id);
    let remote = remotes.get(presence.id);
    if (!remote) {
      const seed = hashString(presence.id);
      const character = createCharacter({
        name: presence.name,
        subtitle: '同行旅人',
        hat: presence.hat || 'hat_postman',
        bodyColor: remoteColors[seed % remoteColors.length],
        accentColor: '#f7e4b6',
        scale: 0.97,
        seed,
      });
      character.group.position.copy(planet.surfacePoint(new THREE.Vector3(...presence.dir), 0.02));
      scene.add(character.group);
      remote = {
        character,
        dir: new THREE.Vector3(...presence.dir),
        targetDir: new THREE.Vector3(...presence.dir),
        heading: presence.heading || 0,
        targetHeading: presence.heading || 0,
        lastSeen: now,
        lastEmote: null,
      };
      remotes.set(presence.id, remote);
      applyRemoteOrientation(remote);
    }

    remote.targetDir.set(...presence.dir);
    remote.targetHeading = presence.heading || 0;
    remote.lastSeen = now;
    if (presence.hat) remote.character.setHat(presence.hat);
    if (presence.emote && presence.emote !== remote.lastEmote) {
      remote.character.setEmote(presence.emote);
    }
    remote.lastEmote = presence.emote || null;
  }

  for (const [id, remote] of remotes) {
    if (!seen.has(id) && now - remote.lastSeen > 18000) {
      scene.remove(remote.character.group);
      remotes.delete(id);
    }
  }
}

function applyRemoteOrientation(remote) {
  const up = remote.dir.clone().normalize();
  let reference = Math.abs(up.y) > 0.985 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const north = reference.clone().addScaledVector(up, -reference.dot(up));
  if (north.lengthSq() < 1e-6) {
    reference = new THREE.Vector3(1, 0, 0);
    north.copy(reference).addScaledVector(up, -reference.dot(up));
  }
  north.normalize();
  const east = new THREE.Vector3().crossVectors(up, north).normalize();
  const facing = north
    .multiplyScalar(Math.cos(remote.heading))
    .addScaledVector(east, Math.sin(remote.heading))
    .normalize();
  const right = new THREE.Vector3().crossVectors(up, facing).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, facing);
  remote.character.group.quaternion.setFromRotationMatrix(basis);
}

function updateRemotes(dt) {
  const now = performance.now();
  for (const [id, remote] of remotes) {
    if (now - remote.lastSeen > 20000) {
      scene.remove(remote.character.group);
      remotes.delete(id);
      continue;
    }
    const previousDir = remote.dir.clone();
    remote.dir.lerp(remote.targetDir, 1 - Math.exp(-4.5 * dt)).normalize();
    let difference = remote.targetHeading - remote.heading;
    difference = ((difference + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    remote.heading += difference * (1 - Math.exp(-7 * dt));

    const moved = previousDir.angleTo(remote.dir);
    const terrain = planet.terrainInfo(remote.dir);
    remote.character.group.position.copy(planet.surfacePoint(remote.dir, 0.02));
    applyRemoteOrientation(remote);
    remote.character.update(dt, elapsed, {
      moving: moved > 0.00002,
      speed: moved > 0.00002 ? 3.2 : 0,
      water: terrain.water,
    });
    const distance = camera.position.distanceTo(remote.character.group.position);
    remote.character.setNameTagOpacity(clamp01((distance - 2.2) / 2.4));
  }
}

function spawnRipple(center, up) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xe8feff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.33, 20), material);
  mesh.position.copy(center).addScaledVector(up, 0.1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up.clone().normalize());
  scene.add(mesh);
  effects.push({ kind: 'ripple', mesh, material, age: 0, life: 0.9 });
}

function spawnConfetti(center) {
  const up = center.clone().normalize();
  const frame = planet.frameAt(up);
  const palette = [0xe9775f, 0xf2b84a, 0x4fae9f, 0xf7f1df, 0x9ecfe0, 0xb78cd8];
  for (let i = 0; i < 22; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: palette[i % palette.length],
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), material);
    mesh.position
      .copy(center)
      .addScaledVector(up, 1.1 + Math.random() * 0.5)
      .addScaledVector(frame.right, (Math.random() - 0.5) * 0.8)
      .addScaledVector(frame.forward, (Math.random() - 0.5) * 0.8);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(mesh);
    const velocity = frame.right
      .clone()
      .multiplyScalar((Math.random() - 0.5) * 4.2)
      .addScaledVector(frame.forward, (Math.random() - 0.5) * 4.2)
      .addScaledVector(up, 2.2 + Math.random() * 3.2);
    effects.push({
      kind: 'confetti',
      mesh,
      material,
      velocity,
      up,
      age: 0,
      life: 1.3 + Math.random() * 0.7,
      spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
    });
  }
}

function updateEffects(dt) {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index];
    effect.age += dt;
    const progress = effect.age / effect.life;
    if (progress >= 1) {
      scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.material.dispose();
      effects.splice(index, 1);
      continue;
    }
    if (effect.kind === 'ripple') {
      const scale = 1 + progress * 3;
      effect.mesh.scale.setScalar(scale);
      effect.material.opacity = 0.7 * (1 - progress);
    } else {
      effect.velocity.addScaledVector(effect.up, -9.5 * dt);
      effect.mesh.position.addScaledVector(effect.velocity, dt);
      effect.mesh.rotation.x += effect.spin.x * dt;
      effect.mesh.rotation.y += effect.spin.y * dt;
      effect.mesh.rotation.z += effect.spin.z * dt;
      effect.material.opacity = 1 - progress;
      effect.mesh.scale.setScalar(1 - Math.max(0, progress - 0.7) * 1.8);
    }
  }
}

function updateInteractionHints() {
  if (!player?.enabled || !ui) return;
  if (ui.isBlocking()) {
    ui.setPrompt(null);
    return;
  }
  const nearby = player.nearbyNpc(0.17);
  if (!nearby) {
    ui.setPrompt(null);
  } else {
    const npc = nearby.npc;
    const letter = api.state?.letter;
    let text;
    if (letter && letter.npc_id === npc.id) text = `把信交给${npc.name}`;
    else if (npc.id === 'poppy') text = letter ? '和波比聊聊' : '领取一封信';
    else text = `和${npc.name}聊聊天`;
    ui.setPrompt(text);
  }
  if (ui.trackTarget) ui.updateCompass(player.compassAngle(ui.trackTarget));
}

function updateLighting() {
  if (!planet) return;
  const focus = player?.enabled ? player.root.position : new THREE.Vector3(0, 0, 0);
  sunLight.position.copy(focus).addScaledVector(planet.sunDirection, 72);
  sunLight.target.position.copy(focus);
  sunLight.target.updateMatrixWorld();
}

function updateTitleCamera() {
  const angle = 1.95 + elapsed * 0.018;
  const radius = 86 + Math.sin(elapsed * 0.11) * 4;
  const height = 16 + Math.sin(elapsed * 0.16) * 6;
  camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 1.5, 0);
}

function loop(now) {
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  elapsed += dt;

  if (planet) planet.update(dt, elapsed);
  if (mode === 'title') updateTitleCamera(dt);
  if (player?.enabled) player.update(dt, elapsed);
  updateNpcs(dt);
  updateRemotes(dt);
  updateEffects(dt);
  updateLighting();
  updateInteractionHints();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = viewportFov();
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('pagehide', () => {
  if (api.hasGuest) api.logout();
});

init();
