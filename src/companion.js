import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EXACT } from './rocket-stage.js';

// The assembled Ember rides behind the content after the Burn section:
// it parks beside the specs heading, rides the test-log line, waits by the
// contact form, then settles horizontally on the footer dock.

const ROCKET_LENGTH = 3.7; // scene units (metres) of the assembled stack
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const ROLL_PER_PX = 0.0022;

export function createCompanion({ canvas, pieces, textures, reducedMotion }) {
  const $ = (s) => document.querySelector(s);
  const anchors = {
    specs: $('#specs'),
    specsHead: $('#specs .section-head'),
    track: $('[data-log-track]'),
    intro: $('.contact__intro'),
    contactTitle: $('#contact-title'),
    dock: $('[data-dock]'),
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4); key.position.set(4, 6, 5);
  const rim = new THREE.DirectionalLight(0xf2a814, 4); rim.position.set(-4, 3, -6);
  const under = new THREE.DirectionalLight(0x8aa0c8, 0.5); under.position.set(-2, -5, 3);
  scene.add(key, rim, under);

  const CAM_Z = 10;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const material = new THREE.MeshStandardMaterial({
    map: textures.map, normalMap: textures.normalMap,
    roughnessMap: textures.orm, metalnessMap: textures.orm, metalness: 1, roughness: 1,
  });
  const pivot = new THREE.Group();
  const roller = new THREE.Group();
  pieces.forEach((p) => {
    const m = new THREE.Mesh(p.geometry, material);
    m.position.copy(p.center);
    roller.add(m);
  });
  pivot.add(roller);
  scene.add(pivot);

  // ---------- Keyframes, measured from the live layout ----------
  let W = 1, H = 1, keys = [];
  const doc = (el) => {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    return { top, bottom: top + r.height, height: r.height, left: r.left, width: r.width, cx: r.left + r.width / 2, cy: top + r.height / 2 };
  };

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (Object.values(anchors).some((el) => !el)) return;

    const narrow = W <= 860;
    const specs = doc(anchors.specs);
    const head = doc(anchors.specsHead);
    const track = doc(anchors.track);
    const intro = doc(anchors.intro);
    const title = doc(anchors.contactTitle);
    const dock = doc(anchors.dock);
    const lineY = track.top + parseFloat(getComputedStyle(anchors.track).paddingTop);
    const maxScroll = document.documentElement.scrollHeight - H;
    const rideLen = W * (narrow ? 0.44 : 0.24);
    const rideGap = narrow ? 44 : 70;

    // y is either fixed in the viewport (`sy`) or pinned to a page position (`docY`).
    keys = [
      // Enter from below the fold while the Burn section slides away.
      { S: specs.top - H, x: W * 1.08, sy: H * 1.15, len: W * 0.5, rz: 1.05, ry: -0.5, rx: 0.1 },
      // Beside the specs heading.
      narrow
        ? { S: specs.top - H * 0.05, x: W * 0.72, docY: head.top - 34, len: W * 0.5, rz: 0.28, ry: -0.5, rx: 0.1 }
        : { S: specs.top - H * 0.05, x: W * 0.72, docY: head.cy, len: W * 0.34, rz: 0.3, ry: -0.5, rx: 0.1 },
      // Tucked low-right while the spec table is read.
      { S: specs.bottom - H, x: W * (narrow ? 0.86 : 0.88), sy: H * 0.86, len: W * (narrow ? 0.34 : 0.19), rz: 1.15, ry: -0.3, rx: 0.1 },
      // Ride along the test-log line, left → right (y stays glued to the line).
      { S: lineY - H * 0.74, x: W * (narrow ? 0.3 : 0.2), docY: lineY - rideGap, len: rideLen, rz: 0.04, ry: 0.35, rx: 0.16, glue: true },
      { S: lineY - H * 0.3, x: W * (narrow ? 0.7 : 0.8), docY: lineY - rideGap, len: rideLen, rz: -0.02, ry: 0.22, rx: 0.16 },
      // Waiting by the contact form.
      narrow
        ? { S: title.top - H * 0.28, x: W * 0.8, docY: title.cy, len: W * 0.36, rz: 0.95, ry: -0.4, rx: 0.1 }
        : { S: intro.bottom - H * 0.62, x: intro.cx, docY: intro.bottom + Math.min(150, H * 0.18), len: Math.min(W * 0.3, intro.width * 0.85), rz: 0.42, ry: -0.45, rx: 0.12 },
      // Seated on the footer dock: horizontal.
      { S: maxScroll, x: W / 2, docY: dock.top + dock.height * 0.42, len: Math.min(W * (narrow ? 0.7 : 0.56), 980), rz: 0, ry: -0.1, rx: 0.2, final: true },
    ];
    // Keep triggers in order even on unusual viewport heights.
    for (let i = keys.length - 2; i >= 0; i--) {
      if (keys[i].S >= keys[i + 1].S) keys[i].S = keys[i + 1].S - H * 0.35;
    }
    finalRoll = Math.round((keys.at(-1).S * ROLL_PER_PX) / (Math.PI / 2)) * (Math.PI / 2);
  }

  let finalRoll = 0;
  const yAt = (k, scroll) => (k.docY !== undefined ? k.docY - scroll : k.sy);

  function sample(scroll) {
    if (!keys.length) return null;
    const last = keys.length - 1;
    let i = 0;
    while (i < last && scroll >= keys[i + 1].S) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, last)];
    const raw = a === b ? 1 : clamp01((scroll - a.S) / (b.S - a.S));
    const t = scroll < keys[0].S ? 0 : ease(raw);
    const ty = a.glue ? raw : t;
    const settle = b.final ? t : a.final ? 1 : 0;
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(yAt(a, scroll), yAt(b, scroll), ty),
      len: lerp(a.len, b.len, t),
      rz: lerp(a.rz, b.rz, t),
      ry: lerp(a.ry, b.ry, t),
      rx: lerp(a.rx, b.rx, t),
      settle,
    };
  }

  // ---------- Frame loop ----------
  const cur = { x: 0, y: 0, len: 1, rz: 0, ry: 0, rx: 0, settle: 0 };
  let primed = false;
  let active = false;
  let last = performance.now();
  let idle = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const scroll = window.scrollY;
    const on = keys.length > 0 && scroll > keys[0].S - 4;
    if (on !== active) { active = on; canvas.classList.toggle('is-on', on); }
    if (!active) { primed = false; return; }

    const target = sample(scroll);
    const k = EXACT || reducedMotion || !primed ? 1 : 1 - Math.exp(-dt * 9);
    for (const p in cur) cur[p] += (target[p] - cur[p]) * k;
    primed = true;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    if (!reducedMotion) idle += dt * 0.25 * (1 - cur.settle);

    // Screen px → world units on the z = 0 plane.
    const u = (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(15))) / H;
    const wobble = (1 - cur.settle) * (reducedMotion ? 0 : 1);
    pivot.position.set((cur.x - W / 2) * u, -(cur.y - H / 2) * u + Math.sin(now / 900) * 0.03 * wobble, 0);
    pivot.scale.setScalar((cur.len * u) / ROCKET_LENGTH);
    pivot.rotation.set(cur.rx + pointer.y * 0.05 * wobble, cur.ry + pointer.x * 0.08 * wobble, cur.rz);
    roller.rotation.x = lerp(scroll * ROLL_PER_PX + idle, finalRoll, cur.settle);
    renderer.render(scene, camera);
  }

  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
  new ResizeObserver(relayout).observe(document.body);
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(relayout);
  layout();
  renderer.setAnimationLoop(frame);

  if (import.meta.env.DEV) window.__companion = { keys: () => keys, cur, layout };
}
