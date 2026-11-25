import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// The source FBX is a single mesh. We split it into flight modules so the
// exploded view can pull it apart. Units below are the FBX's own (≈ cm).
const SCALE = 0.01; // → metres: the stack is 3.7 m long, 0.3 m across
const AXIS_CENTER = 38.9; // midpoint of the body along its long (x) axis

// Seams along the body where no triangle straddles the cut, found by scanning
// the mesh. Cutting here gives clean ring edges instead of jagged ones.
const CUTS = [
  [-79.93, 'chamber'],
  [-57.77, 'injector'],
  [65.29, 'tank'],
  [99.28, 'vent'],
  [152.09, 'avionics'],
  [170.37, 'payload'],
  [Infinity, 'fairing'],
];

// Ordered nose → tail. `axial` / `radial` are exploded-view offsets in metres.
export const MODULES = [
  { id: 'probe', code: '01', name: 'Air-data probe', detail: 'Pitot-static, sampled at 1 kHz', axial: 1.76 },
  { id: 'fairing', code: '02', name: 'Ogive fairing', detail: 'Carbon/epoxy, 3:1 ogive', axial: 1.41 },
  { id: 'payload', code: '03', name: 'Payload adapter', detail: 'Ø300 mm, 12-bolt interface', axial: 1.12 },
  { id: 'avionics', code: '04', name: 'Flight computer', detail: 'Triple-redundant, 1 kHz telemetry', axial: 0.78 },
  { id: 'canards', code: '05', name: 'Roll-control canards', detail: 'Electromechanical, ±15°', axial: 0.78, radial: 0.3 },
  { id: 'vent', code: '06', name: 'Vent & fill valve', detail: 'Pad-side N₂O fill and relief', axial: 0.41 },
  { id: 'tank', code: '07', name: 'N₂O oxidizer tank', detail: 'Filament-wound carbon, 62 bar', axial: 0.0 },
  { id: 'raceway', code: '08', name: 'Umbilical raceway', detail: 'Power and data to the pad', axial: 0.0, radial: 0.3 },
  { id: 'injector', code: '09', name: 'Injector head', detail: '64 elements, printed Inconel 718', axial: -0.45 },
  { id: 'chamber', code: '10', name: 'Fuel grain & chamber', detail: 'Paraffin-HTPB, inert until lit', axial: -0.9 },
  { id: 'fins', code: '11', name: 'Fin can', detail: '4 × clipped delta, swappable', axial: -1.07, radial: 0.34 },
  { id: 'nozzle', code: '12', name: 'Ablative nozzle', detail: 'Silica-phenolic, expansion ratio 8', axial: -1.68 },
];

const RADIAL = new Set(['fins', 'canards', 'raceway']);

function classify(center, size, isBody) {
  if (isBody) return 'body';
  const x = center.x;
  if (x > 198) return 'probe';
  if (x > 115 && x < 145) return 'canards';
  if (x < -120 && size.x < 30) return 'nozzle';
  if (x < -90 && size.x > 50) return 'fins';
  return 'raceway';
}

// The FBX still references the original 4K PNG textures. We replace its material
// with our compressed WebP set, so answer those requests with a blank pixel.
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export async function loadRocket(manager) {
  manager.setURLModifier((url) => (/\.png$/i.test(url) ? BLANK_PNG : url));
  const fbx = await new FBXLoader(manager).loadAsync('/models/engine.fbx');
  let src;
  fbx.traverse((o) => { if (o.isMesh && !src) src = o; });
  const g = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  const triCount = pos.count / 3;

  // Weld by position, then union-find triangles into connected parts.
  const weld = new Map();
  const wid = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    let id = weld.get(k);
    if (id === undefined) { id = weld.size; weld.set(k, id); }
    wid[i] = id;
  }
  const parent = new Int32Array(weld.size).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < triCount; t++) {
    const a = find(wid[t * 3]);
    parent[find(wid[t * 3 + 1])] = a;
    parent[find(wid[t * 3 + 2])] = a;
  }
  const comps = new Map();
  for (let t = 0; t < triCount; t++) {
    const r = find(wid[t * 3]);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(t);
  }
  const parts = [...comps.values()].sort((a, b) => b.length - a.length);

  // Bucket triangles into pieces: { moduleId, tris[] }.
  const pieces = [];
  const v = new THREE.Vector3();
  parts.forEach((tris, i) => {
    const box = new THREE.Box3();
    for (const t of tris) for (let k = 0; k < 3; k++) box.expandByPoint(v.fromBufferAttribute(pos, t * 3 + k));
    const type = classify(box.getCenter(new THREE.Vector3()), box.getSize(new THREE.Vector3()), i === 0);
    if (type !== 'body') {
      // Radial modules keep each sub-part separate so it can fly outward on its own.
      const existing = !RADIAL.has(type) && pieces.find((p) => p.module === type);
      if (existing) existing.tris.push(...tris);
      else pieces.push({ module: type, tris: [...tris] });
      return;
    }
    const slices = new Map();
    for (const t of tris) {
      const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3;
      const id = CUTS.find(([cut]) => cx < cut)[1];
      if (!slices.has(id)) slices.set(id, []);
      slices.get(id).push(t);
    }
    slices.forEach((list, id) => pieces.push({ module: id, tris: list }));
  });

  // Whole-rocket geometry (scaled, centred) for the particle field.
  const full = g.clone();
  full.translate(-AXIS_CENTER, 0, 0);
  full.scale(SCALE, SCALE, SCALE);

  // Build one BufferGeometry per piece, centred on its own bounds.
  const built = pieces.map((p) => {
    const n = p.tris.length * 3;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
    let o = 0;
    for (const t of p.tris) {
      for (let k = 0; k < 3; k++, o++) {
        const i = t * 3 + k;
        P[o * 3] = (pos.getX(i) - AXIS_CENTER) * SCALE;
        P[o * 3 + 1] = pos.getY(i) * SCALE;
        P[o * 3 + 2] = pos.getZ(i) * SCALE;
        N[o * 3] = nor.getX(i); N[o * 3 + 1] = nor.getY(i); N[o * 3 + 2] = nor.getZ(i);
        if (uv) { U[o * 2] = uv.getX(i); U[o * 2 + 1] = uv.getY(i); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.computeBoundingBox();
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    geo.computeBoundingSphere();
    const radialDir = new THREE.Vector3(0, center.y, center.z);
    if (radialDir.lengthSq() < 1e-6) radialDir.set(0, 1, 0);
    radialDir.normalize();
    return { module: p.module, geometry: geo, center, radialDir };
  });

  return { pieces: built, fullGeometry: full };
}

export function loadTextures(manager) {
  const tl = new THREE.TextureLoader(manager);
  const map = tl.load('/models/engine_basecolor.webp');
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = tl.load('/models/engine_normal.webp');
  const orm = tl.load('/models/engine_orm.webp');
  [map, normalMap, orm].forEach((t) => { t.anisotropy = 4; });
  return { map, normalMap, orm };
}
