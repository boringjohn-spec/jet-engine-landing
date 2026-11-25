import * as THREE from 'three';
import { createTimeline, onScroll } from 'animejs';
import { EXACT } from './rocket-stage.js';

const VERT = /* glsl */`
  uniform float uT, uTime, uForce, uRadius, uPx, uSize, uPulseT;
  uniform vec3 uMouse, uPulse;
  uniform mat3 uTilt;
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec3 aC;
  attribute vec4 aRnd;
  attribute float aKind;
  varying float vHeat;
  varying float vBright;
  varying float vAlpha;

  const float PI = 3.14159265;
  float easeIO(float t) { return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }

  // Shape A, part 2: CFD-style streamlines flowing past the vehicle.
  vec3 stream(vec3 s, float t) {
    float u = fract(s.x + t * 0.07);
    float x = -3.8 + u * 7.6;
    vec2 yz = s.yz;
    float r0 = max(length(yz), 0.18);
    float bump = 0.32 * exp(-pow(x / 2.2, 2.)) / r0;
    yz *= (r0 + bump) / r0;
    return uTilt * vec3(x, yz);
  }

  // Shape C: exhaust plume with shock diamonds, flowing downstream.
  vec3 plume(vec3 c, float t, out float u, out float diamond) {
    u = fract(c.x + t * 0.16);
    float x = -1.7 + u * 7.4;
    float k = abs(sin(PI * u * 5.0));
    float R = (0.3 + 0.95 * pow(u, 0.8)) * (0.56 + 0.44 * k);
    float r = R * sqrt(c.z);
    diamond = pow(1. - k, 10.) * (1. - u * 0.8);
    return vec3(x, cos(c.y) * r, sin(c.y) * r);
  }

  void main() {
    float s = aRnd.x;
    float t1 = easeIO(clamp((uT - s * 0.4) / 0.6, 0., 1.));
    float t2 = easeIO(clamp((uT - 1. - s * 0.4) / 0.6, 0., 1.));
    float ph = aRnd.w * 6.2831;

    vec3 a = aKind > 0.5 ? stream(aA, uTime) : aA;
    a += 0.01 * vec3(sin(uTime * .9 + ph), cos(uTime * .7 + ph * 1.3), sin(uTime * .8 + ph * .7));
    vec3 b = aB + 0.008 * vec3(sin(uTime * 1.1 + ph), cos(uTime * .9 + ph), 0.);
    float u, diamond;
    vec3 c = plume(aC, uTime, u, diamond);

    // Scatter while travelling between shapes, then settle.
    vec3 scatter = (vec3(aRnd.y, aRnd.z, aRnd.w) - 0.5) * 2.2;
    vec3 p = mix(a, b, t1) + scatter * sin(PI * t1);
    p = mix(p, c, t2) + scatter.zxy * sin(PI * t2);

    vec4 wp = modelMatrix * vec4(p, 1.);

    // Cursor: push particles away in screen plane, with a spring-like falloff.
    vec2 dxy = wp.xy - uMouse.xy;
    float dist = length(dxy);
    float f = exp(-dist * dist / (uRadius * uRadius)) * uForce;
    wp.xy += normalize(dxy + 1e-4) * f * 0.8;
    wp.z += f * (aRnd.y - 0.5) * 1.4;

    // Click / tap: an expanding pressure ring.
    vec2 dp = wp.xy - uPulse.xy;
    float pd = length(dp);
    float ring = exp(-pow(pd - uPulseT * 5.5, 2.) / 0.12) * max(0., 1. - uPulseT / 1.3);
    wp.xy += normalize(dp + 1e-4) * ring * 0.55;

    vHeat = clamp(f + ring * 0.8, 0., 1.);
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;

    float streamFade = aKind > 0.5 ? smoothstep(0., .08, fract(aA.x + uTime * .07)) * smoothstep(1., .9, fract(aA.x + uTime * .07)) * 0.55 : 1.;
    vAlpha = mix(mix(streamFade, 1., t1), smoothstep(1., .6, u) * smoothstep(0., .03, u), t2);
    vBright = aRnd.z + t2 * (diamond * 2.4 + (1. - u) * 0.5);
    gl_PointSize = uSize * (0.5 + aRnd.y * 0.9) * uPx / -mv.z * (1. + vHeat * 1.3 + t2 * diamond);
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uAmber, uBone, uHot;
  varying float vHeat;
  varying float vBright;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 col = mix(uAmber, uBone, clamp(vBright - 0.75, 0., 1.));
    col = mix(col, uHot, clamp(vHeat * 1.1 + (vBright - 1.3) * 0.6, 0., 1.));
    gl_FragColor = vec4(col * (0.5 + vBright * 0.55), a * vAlpha * 0.85);
  }
`;

function sampleSurface(geometry, n, out, offset, stride) {
  const pos = geometry.attributes.position;
  const tris = pos.count / 3;
  const areas = new Float32Array(tris);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), T = new THREE.Triangle();
  let total = 0;
  for (let t = 0; t < tris; t++) {
    A.fromBufferAttribute(pos, t * 3); B.fromBufferAttribute(pos, t * 3 + 1); C.fromBufferAttribute(pos, t * 3 + 2);
    total += T.set(A, B, C).getArea();
    areas[t] = total;
  }
  const P = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = tris - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
    A.fromBufferAttribute(pos, lo * 3); B.fromBufferAttribute(pos, lo * 3 + 1); C.fromBufferAttribute(pos, lo * 3 + 2);
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    P.copy(A).addScaledVector(B.sub(A), u).addScaledVector(C.sub(A), v);
    const o = (offset + i) * stride;
    out[o] = P.x; out[o + 1] = P.y; out[o + 2] = P.z;
  }
}

const HOVER_FORCE = 0.35;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export function createParticleField({ root, fullGeometry, reducedMotion }) {
  const sticky = root.querySelector('.burn__sticky');
  const canvas = root.querySelector('[data-burn-canvas]');
  const steps = [...root.querySelectorAll('[data-step]')];
  const words = [...root.querySelectorAll('[data-word]')];
  const ro = {
    stage: root.querySelector('[data-ro-stage]'),
    pc: root.querySelector('[data-ro-pc]'),
    thrust: root.querySelector('[data-ro-thrust]'),
    t: root.querySelector('[data-ro-t]'),
  };

  const small = window.matchMedia('(max-width: 760px)').matches;
  const COUNT = small ? 14000 : 28000;
  const STREAM = Math.round(COUNT * 0.22);
  const SURFACE = COUNT - STREAM;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const tilt = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationZ(0.28));
  const aA = new Float32Array(COUNT * 3);
  const aB = new Float32Array(COUNT * 3);
  const aC = new Float32Array(COUNT * 3);
  const aRnd = new Float32Array(COUNT * 4);
  const aKind = new Float32Array(COUNT);

  // A — the vehicle as a point cloud (scaled up, tilted), plus streamlines.
  sampleSurface(fullGeometry, SURFACE, aA, 0, 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < SURFACE; i++) {
    v.fromArray(aA, i * 3).multiplyScalar(1.5).applyMatrix3(tilt);
    v.toArray(aA, i * 3);
  }
  for (let i = SURFACE; i < COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 0.45 + Math.pow(Math.random(), 0.8) * 2.1;
    aA[i * 3] = Math.random();
    aA[i * 3 + 1] = Math.cos(ang) * r;
    aA[i * 3 + 2] = Math.sin(ang) * r * 0.6;
    aKind[i] = 1;
  }

  // B — injector face: 64 elements in four rings, grooves, and a faint plate.
  const rings = [{ r: 0.55, n: 8 }, { r: 1.15, n: 14 }, { r: 1.78, n: 20 }, { r: 2.36, n: 22 }];
  const elements = rings.flatMap(({ r, n }, ri) => Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2 + ri * 0.21;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }));
  const grooves = [0.28, 0.85, 1.47, 2.07, 2.72];
  for (let i = 0; i < COUNT; i++) {
    const roll = Math.random();
    let x, y, z = gauss() * 0.03;
    if (roll < 0.56) {
      const [ex, ey] = elements[i % elements.length];
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.085;
      x = ex + Math.cos(a) * r; y = ey + Math.sin(a) * r; z += 0.04;
    } else if (roll < 0.82) {
      const r = grooves[i % grooves.length] + gauss() * 0.012;
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * r; y = Math.sin(a) * r;
    } else {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 2.72;
      x = Math.cos(a) * r; y = Math.sin(a) * r; z -= 0.06;
    }
    aB[i * 3] = x * 0.82; aB[i * 3 + 1] = y * 0.82; aB[i * 3 + 2] = z;
  }

  // C — plume parameters (u along the jet, angle, radial fraction); shaped in the shader.
  for (let i = 0; i < COUNT; i++) {
    aC[i * 3] = Math.random();
    aC[i * 3 + 1] = Math.random() * Math.PI * 2;
    aC[i * 3 + 2] = Math.pow(Math.random(), 0.7);
    aRnd[i * 4] = Math.random();
    aRnd[i * 4 + 1] = Math.random();
    aRnd[i * 4 + 2] = Math.pow(Math.random(), 2.2) * 1.6;
    aRnd[i * 4 + 3] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aA', new THREE.BufferAttribute(aA, 3));
  geo.setAttribute('aB', new THREE.BufferAttribute(aB, 3));
  geo.setAttribute('aC', new THREE.BufferAttribute(aC, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 4));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

  const color = (hex) => new THREE.Color(hex);
  const uniforms = {
    uT: { value: 0 }, uTime: { value: 0 }, uForce: { value: 0 }, uRadius: { value: 0.9 },
    uPx: { value: 1 }, uSize: { value: small ? 34 : 26 }, uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uPulse: { value: new THREE.Vector3(99, 99, 0) }, uPulseT: { value: 9 }, uTilt: { value: tilt },
    uAmber: { value: color('#f2a814') }, uBone: { value: color('#e8e4da') }, uHot: { value: color('#fff6e2') },
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(points);

  // Scroll story: model → injector → plume.
  const state = { t: 0, ry: -0.5, rx: 0.15, x: 1 };
  const narrow = () => sticky.clientWidth < 900;
  const tl = createTimeline({
    defaults: { ease: 'inOutCubic' },
    autoplay: onScroll({ target: root, enter: 'top top', leave: 'bottom bottom', sync: reducedMotion || EXACT ? true : 0.12 }),
  })
    .add(state, { t: [0, 1], ry: [-0.5, 0.25], rx: [0.15, -0.1], duration: 1000 }, 900)
    .add(state, { t: [1, 2], ry: [0.25, -0.28], rx: [-0.1, 0.12], duration: 1000 }, 2400)
    .add(state, { x: [1, 0.75], duration: 1000 }, 2400);

  if (import.meta.env.DEV) window.__burn = { state, tl, uniforms };

  // Pointer → world point on the z = 0 plane.
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let inside = false;
  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };
  sticky.addEventListener('pointermove', (e) => {
    const p = toWorld(e);
    if (!p) return;
    if (!inside) uniforms.uMouse.value.copy(p);
    inside = true;
    uniforms.uMouse.value.lerp(p, 0.35);
  });
  sticky.addEventListener('pointerleave', () => { inside = false; });
  sticky.addEventListener('pointerdown', (e) => {
    const p = toWorld(e);
    if (p) { uniforms.uPulse.value.copy(p); uniforms.uPulseT.value = 0; }
  });

  function resize() {
    const w = sticky.clientWidth, h = sticky.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = camera.aspect < 0.85 ? 13.5 : 9.5;
    camera.updateProjectionMatrix();
    uniforms.uPx.value = renderer.getPixelRatio() * (h / 900);
  }
  new ResizeObserver(resize).observe(sticky);
  resize();

  let visible = false;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '120px' }).observe(root);

  const pad = (n, w, d = 1) => n.toFixed(d).padStart(w, '0');
  const stageNames = ['MODEL', 'FIRE', 'FLIGHT'];
  const clock = new THREE.Clock();
  let time = 0;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    time += dt * (reducedMotion ? 0.25 : 1);
    uniforms.uTime.value = time;
    uniforms.uT.value = state.t;
    uniforms.uPulseT.value += dt;
    // Hover strength stays at the gentle resting level; moving doesn't boost it.
    const target = inside ? HOVER_FORCE : 0;
    uniforms.uForce.value += (target - uniforms.uForce.value) * 0.08;

    points.rotation.set(state.rx, state.ry + (reducedMotion ? 0 : Math.sin(time * 0.15) * 0.06), 0);
    // Keep the field in the right ~60% so it never sits under the copy.
    const halfW = Math.tan(THREE.MathUtils.degToRad(17.5)) * camera.position.z * camera.aspect;
    points.position.x = narrow() ? 0 : halfW * 0.4 * state.x;
    points.position.y = narrow() ? -1.2 : 0;

    const sf = state.t;
    steps.forEach((el, i) => {
      const on = Math.max(0, 1 - Math.abs(sf - i) * 1.6);
      el.style.setProperty('--on', on.toFixed(3));
      el.classList.toggle('is-active', Math.round(sf) === i);
    });
    words.forEach((el, i) => el.classList.toggle('is-on', sf > i - 0.5));
    const burn = Math.max(0, Math.min(1, sf - 1));
    const jitter = burn > 0.05 ? Math.sin(time * 23) * 0.3 + Math.sin(time * 7.1) * 0.2 : 0;
    if (ro.stage) ro.stage.textContent = stageNames[Math.min(2, Math.round(sf))];
    if (ro.pc) ro.pc.textContent = pad(burn * 32 + jitter, 4);
    if (ro.thrust) ro.thrust.textContent = pad(burn * 24.1 + jitter * 0.6, 4);
    if (ro.t) ro.t.textContent = burn > 0.05 ? pad((time % 18.4), 5, 2) : '00.00';
    renderer.render(scene, camera);
  });
}
