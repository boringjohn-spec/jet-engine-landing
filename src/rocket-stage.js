import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { animate, createTimeline, onScroll, stagger } from 'animejs';
import { MODULES } from './model.js';

// Colours injected after tone mapping, so they are written as sRGB 0–1 values.
const srgb = (hex) => { const c = parseInt(hex.slice(1), 16); return new THREE.Vector3((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255); };
const INK = srgb('#18191b');
const PAPER_FILL = srgb('#f1eee7');
const HI_FILL = srgb('#f7d488');
const SVG_NS = 'http://www.w3.org/2000/svg';
// ?exact in the URL locks the 3D to the scrollbar with no smoothing (handy for QA).
export const EXACT = new URLSearchParams(window.location.search).has('exact');

const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

// Poses: where the stack sits on screen at each beat of the scroll story.
// k = 0 hero · 1 exploded · 2 reassembled. Separate presets for portrait.
function posePresets(aspect) {
  if (aspect < 0.85) {
    // Portrait: lean the stack steeply so it uses the screen's long diagonal.
    const d1 = 8.9 / aspect;
    return [
      { x: 0.1, y: -1.05, rx: 0.1, ry: -0.35, rz: 1.1, dist: 7.4 },
      { x: 0, y: -0.045 * d1, rx: -0.15, ry: 0.4, rz: Math.PI - 1.08, dist: d1 },
      { x: 0, y: -0.6, rx: -0.2, ry: 0.1, rz: Math.PI - 1.4, dist: 7.6 },
    ];
  }
  // Fit by width: visible half-width at distance d is d · tan(16°) · aspect.
  const halfW = (d) => 0.287 * d * aspect;
  const d0 = Math.min(7, Math.max(5.2, 8.6 / aspect));
  const d1 = Math.max(8.4, 14.2 / aspect);
  const d2 = Math.max(5, 9.4 / aspect);
  return [
    { x: halfW(d0) * 0.34, y: -0.05, rx: 0.06, ry: -0.58, rz: 0.3, dist: d0 },
    // Exploded: nose top-left → tail bottom-right, leaving the top-right and
    // bottom-left corners free for the two label columns.
    { x: 0.07 * d1 * aspect, y: -0.075 * d1, rx: -0.2, ry: 0.55, rz: Math.PI - 0.22, dist: d1 },
    { x: 0, y: -0.5, rx: -0.24, ry: 0.06, rz: Math.PI - 0.02, dist: d2 },
  ];
}

export function createRocketStage({ root, pieces, textures, reducedMotion }) {
  const sticky = root.querySelector('.stage__sticky');
  const canvas = root.querySelector('[data-stage-canvas]');
  const svg = root.querySelector('[data-leaders]');
  const statusPct = root.querySelector('[data-status-pct]');
  const statusTicks = [...root.querySelectorAll('[data-status-ticks] i')];
  const focusCard = root.querySelector('[data-focus]');
  const focusCode = root.querySelector('[data-focus-code]');
  const focusName = root.querySelector('[data-focus-name]');
  const focusDetail = root.querySelector('[data-focus-detail]');
  let narrow = false;
  let focusAnchor = { x: 0, y: 0 };
  let focused = null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4); key.position.set(4, 6, 5);
  const rim = new THREE.DirectionalLight(0xf2a814, 4.5); rim.position.set(-4, 3, -6);
  const under = new THREE.DirectionalLight(0x8aa0c8, 0.5); under.position.set(-2, -5, 3);
  scene.add(key, rim, under);

  const pivot = new THREE.Group();
  const roller = new THREE.Group();
  pivot.add(roller);
  scene.add(pivot);

  // Shared outline hull (inverted, pushed out in screen space) for the line-drawing mode.
  const hullMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: INK }, uWidth: { value: 1.25 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: /* glsl */`
      uniform float uWidth; uniform vec2 uRes;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(normalMatrix * normal);
        clip.xy += normalize(vn.xy + 1e-5) * uWidth * 2.0 / uRes * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uColor;
      void main() { if (uOpacity < 0.01) discard; gl_FragColor = vec4(uColor, uOpacity); }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  function makeMaterial() {
    const uniforms = { uPaper: { value: 0 }, uHi: { value: 0 }, uPaperColor: { value: PAPER_FILL }, uHiColor: { value: HI_FILL } };
    const m = new THREE.MeshStandardMaterial({
      map: textures.map,
      normalMap: textures.normalMap,
      roughnessMap: textures.orm,
      metalnessMap: textures.orm,
      metalness: 1,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uPaper; uniform float uHi; uniform vec3 uPaperColor; uniform vec3 uHiColor;')
        .replace('#include <dithering_fragment>', `
          vec3 paperFill = mix(uPaperColor, uHiColor, uHi);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, paperFill, uPaper);
          #include <dithering_fragment>`);
    };
    m.customProgramCacheKey = () => 'kiln-paper';
    m.userData.uniforms = uniforms;
    return m;
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const modules = MODULES.map((def, i) => ({
    def,
    i,
    group: new THREE.Group(),
    pieces: [],
    mat: makeMaterial(),
    lineMat: new THREE.LineBasicMaterial({ color: new THREE.Color().setRGB(INK.x, INK.y, INK.z), transparent: true, opacity: 0, toneMapped: false }),
    axialCenter: 0,
    roll: (i % 2 ? 1 : -1) * rand(0.35, 0.7),
    state: { e: 0, a: reducedMotion ? 1 : 0, d: 0 },
    hi: 0,
  }));
  const byId = Object.fromEntries(modules.map((m) => [m.def.id, m]));

  pieces.forEach((p) => {
    const m = byId[p.module];
    if (!m) return;
    const mesh = new THREE.Mesh(p.geometry, m.mat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry, 28), m.lineMat);
    const hull = new THREE.Mesh(p.geometry, hullMat);
    hull.renderOrder = 2;
    edges.renderOrder = 3;
    mesh.add(edges, hull);
    m.group.add(mesh);
    const dir = new THREE.Vector3().randomDirection();
    m.pieces.push({
      mesh,
      base: p.center.clone(),
      dir: p.radialDir.clone(),
      intro: dir.multiplyScalar(rand(1.6, 3.6)).add(new THREE.Vector3(0, 0, rand(0.5, 2.5))),
      introRot: new THREE.Euler(rand(-3, 3), rand(-3, 3), rand(-3, 3)),
    });
  });
  modules.forEach((m) => {
    m.axialCenter = m.pieces.reduce((s, p) => s + p.base.x, 0) / Math.max(1, m.pieces.length);
    roller.add(m.group);
  });

  // ---------- Callout labels + leader lines ----------
  const labels = new Map([...root.querySelectorAll('[data-mod]')].map((el) => [el.dataset.mod, el]));
  const leaderGroup = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(leaderGroup);
  modules.forEach((m) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('pathLength', '1');
    path.setAttribute('class', 'leader');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '3');
    dot.setAttribute('class', 'leader-dot');
    leaderGroup.append(path, dot);
    m.path = path;
    m.dot = dot;
    m.label = labels.get(m.def.id);
    m.side = m.label?.closest('[data-side]')?.dataset.side || 'right';
    m.column = m.label ? [...m.label.parentElement.children].indexOf(m.label) : 0;
  });

  // ---------- State driven by scroll ----------
  const state = { k: 0, paper: 0, focus: -1, spin: 0, hero: 1 };
  const moduleStates = modules.map((m) => m.state);
  const stageRect = { w: 1, h: 1 };
  let presets = posePresets(1.6);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function measure() {
    stageRect.w = sticky.clientWidth;
    stageRect.h = sticky.clientHeight;
    renderer.setSize(stageRect.w, stageRect.h, false);
    camera.aspect = stageRect.w / stageRect.h;
    camera.updateProjectionMatrix();
    hullMat.uniforms.uRes.value.set(stageRect.w, stageRect.h);
    svg.setAttribute('viewBox', `0 0 ${stageRect.w} ${stageRect.h}`);
    presets = posePresets(camera.aspect);
    const base = sticky.getBoundingClientRect();
    narrow = stageRect.w <= 860;
    if (narrow && focusCard) {
      const r = focusCard.getBoundingClientRect();
      focusAnchor = { x: r.left - base.left + 28, y: r.top - base.top };
    }
    modules.forEach((m) => {
      if (!m.label) return;
      const r = m.label.getBoundingClientRect();
      m.lx = m.side === 'right' ? r.left - base.left - 10 : r.right - base.left + 10;
      m.ly = r.top - base.top + r.height / 2;
    });
  }

  // Scroll story. Timeline units are arbitrary; the scroll observer maps
  // the whole pinned section onto the full 0 → 10000 range.
  const tl = createTimeline({
    defaults: { ease: 'inOutQuad' },
    autoplay: onScroll({ target: root, enter: 'top top', leave: 'bottom bottom', sync: reducedMotion || EXACT ? true : 0.14 }),
  });
  tl.add(state, { hero: [1, 0], duration: 700, ease: 'inQuad' }, 0)
    .add('[data-hero]', { opacity: [1, 0], y: [0, -48], duration: 700, ease: 'inQuad' }, 0)
    .add('[data-hero-aside]', { opacity: [1, 0], duration: 500 }, 0)
    .add(state, { k: [0, 1], duration: 1700, ease: 'inOutCubic' }, 200)
    .add(moduleStates, { e: [0, 1], duration: 1500, delay: stagger(85, { from: 'center' }), ease: 'inOutQuart' }, 900)
    .add(state, { paper: [0, 1], duration: 700, ease: 'inOutSine' }, 2700)
    .add('[data-xv]', { opacity: [0, 1], y: [28, 0], duration: 600, ease: 'outQuad' }, 2900)
    .add(moduleStates, { d: [0, 1], duration: 650, delay: stagger(70) }, 3300)
    .add(state, { focus: [-0.6, 11.6], duration: 2600, ease: 'linear' }, 4500)
    .add(state, { spin: [0, 0.9], duration: 4000, ease: 'inOutSine' }, 3300)
    .add(moduleStates, { d: [1, 0], duration: 450, delay: stagger(30, { from: 'last' }) }, 7100)
    .add('[data-xv]', { opacity: [1, 0], y: [0, -24], duration: 450, ease: 'inQuad' }, 7300)
    .add(state, { paper: [1, 0], duration: 600, ease: 'inOutSine' }, 7600)
    .add(moduleStates, { e: [1, 0], duration: 1400, delay: stagger(70, { from: 'last' }), ease: 'inOutQuart' }, 7900)
    .add(state, { k: [1, 2], duration: 1500, ease: 'inOutCubic' }, 8500)
    .add('[data-reassembled]', { opacity: [0, 1], y: [24, 0], duration: 500, ease: 'outQuad' }, 9400);

  // Load-in: parts scatter in from random positions and assemble.
  function playIntro() {
    if (reducedMotion) return;
    animate(moduleStates, { a: [0, 1], duration: 1900, delay: stagger(65, { from: 'random' }), ease: 'outExpo' });
  }

  // ---------- Frame loop ----------
  const v = new THREE.Vector3();
  let visible = true;
  let last = performance.now();
  let idleRoll = 0;

  function applyPose() {
    const k = state.k;
    const a = k <= 1 ? presets[0] : presets[1];
    const b = k <= 1 ? presets[1] : presets[2];
    const t = k <= 1 ? k : k - 1;
    pivot.position.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), 0);
    pivot.rotation.set(
      lerp(a.rx, b.rx, t) + pointer.y * 0.06,
      lerp(a.ry, b.ry, t) + pointer.x * 0.12,
      lerp(a.rz, b.rz, t),
    );
    camera.position.set(0, 0, lerp(a.dist, b.dist, t));
    camera.lookAt(0, 0, 0);
  }

  function updateModules() {
    const paper = state.paper;
    let assembled = 0;
    modules.forEach((m) => {
      const { e, a, d } = m.state;
      assembled += e;
      m.group.position.x = m.def.axial * e;
      m.group.rotation.x = m.roll * e;
      const r = (m.def.radial || 0) * e;
      for (const p of m.pieces) {
        const ia = 1 - a;
        p.mesh.position.copy(p.base).addScaledVector(p.dir, r).addScaledVector(p.intro, ia);
        p.mesh.rotation.set(p.introRot.x * ia, p.introRot.y * ia, p.introRot.z * ia);
      }
      const hi = paper > 0.5 ? Math.max(0, 1 - Math.abs(state.focus - m.i) * 1.15) : 0;
      m.hi = hi;
      m.mat.userData.uniforms.uPaper.value = paper;
      m.mat.userData.uniforms.uHi.value = hi * 0.85;
      m.lineMat.opacity = paper;
      if (m.label) {
        m.label.style.setProperty('--d', d.toFixed(3));
        m.label.style.setProperty('--hi', hi.toFixed(3));
        m.label.classList.toggle('is-focus', hi > 0.55);
      }
    });
    hullMat.uniforms.uOpacity.value = paper;

    // Phones: a single caption card tracks whichever part is in focus.
    const top = modules.reduce((best, m) => (m.hi > (best?.hi ?? 0.001) ? m : best), null);
    if (top !== focused && top) {
      focused = top;
      focusCode.textContent = top.def.code;
      focusName.textContent = top.def.name;
      focusDetail.textContent = top.def.detail;
    }
    if (!top) focused = null;
    sticky.style.setProperty('--focus-o', (focused ? Math.min(1, focused.state.d * paper * 1.5) : 0).toFixed(3));

    const pct = Math.round((assembled / modules.length) * 100);
    if (statusPct) statusPct.textContent = `${String(pct).padStart(3, '0')}%`;
    const lit = Math.round((pct / 100) * statusTicks.length);
    statusTicks.forEach((t, i) => t.classList.toggle('on', i < lit));
    document.documentElement.style.setProperty('--p', paper.toFixed(3));
    sticky.style.setProperty('--hero-o', state.hero.toFixed(3));
  }

  function updateLeaders() {
    modules.forEach((m) => {
      const d = m.state.d;
      if (!m.label || d < 0.002 || (narrow && m !== focused)) {
        m.path.style.opacity = '0';
        m.dot.style.opacity = '0';
        return;
      }
      // Anchor on the module's centre line; radial modules point at their spread.
      v.set(m.axialCenter, (m.def.radial || 0) * m.state.e * 0.55, 0);
      m.group.localToWorld(v);
      v.project(camera);
      const ax = (v.x * 0.5 + 0.5) * stageRect.w;
      const ay = (-v.y * 0.5 + 0.5) * stageRect.h;
      const right = m.side === 'right';
      // Run level until just short of the part, then angle in. Columns are ordered
      // so these nested elbows never cross.
      const ex = right ? Math.min(m.lx - 16, ax + 36) : Math.max(m.lx + 16, ax - 36);
      m.path.setAttribute('d', narrow
        ? `M${focusAnchor.x.toFixed(1)} ${focusAnchor.y.toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)}`
        : `M${m.lx.toFixed(1)} ${m.ly.toFixed(1)} H${ex.toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)}`);
      m.path.style.opacity = '1';
      m.path.style.strokeDashoffset = (1 - d).toFixed(3);
      m.path.classList.toggle('is-focus', m.hi > 0.55);
      m.dot.setAttribute('cx', ax.toFixed(1));
      m.dot.setAttribute('cy', ay.toFixed(1));
      m.dot.style.opacity = smooth(0.85, 1, d).toFixed(3);
      m.dot.classList.toggle('is-focus', m.hi > 0.55);
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    if (!reducedMotion) idleRoll += dt * 0.22 * (0.3 + state.hero * 0.7);
    roller.rotation.x = idleRoll + state.spin;
    applyPose();
    updateModules();
    pivot.updateMatrixWorld(true);
    updateLeaders();
    renderer.render(scene, camera);
  }

  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    // Paper mode only exists inside the stage; never let it leak onto the nav elsewhere.
    if (!visible) document.documentElement.style.setProperty('--p', '0');
  }, { rootMargin: '100px' }).observe(root);
  const ro = new ResizeObserver(() => measure());
  ro.observe(sticky);
  measure();
  renderer.setAnimationLoop(frame);

  if (import.meta.env.DEV) window.__stage = { state, modules, tl };
  return { playIntro, measure };
}
