import * as THREE from 'three';
import { animate, stagger } from 'animejs';
import { splitText } from 'animejs/text';
import { loadRocket, loadTextures } from './model.js';
import { createRocketStage } from './rocket-stage.js';
import { createParticleField } from './particle-field.js';
import { createCompanion } from './companion.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- Load the hardware ----------
const loader = $('[data-loader]');
const loaderPct = $('[data-loader-pct]');
const manager = new THREE.LoadingManager();
const loaded = new Promise((resolve) => { manager.onLoad = resolve; });
manager.onProgress = (_, done, total) => {
  loaderPct.textContent = String(Math.round((done / total) * 100)).padStart(3, '0');
};

async function boot() {
  const textures = loadTextures(manager);
  const { pieces, fullGeometry } = await loadRocket(manager);
  await loaded;

  const stage = createRocketStage({ root: $('.stage'), pieces, textures, reducedMotion });
  createParticleField({ root: $('.burn'), fullGeometry, reducedMotion });
  createCompanion({ canvas: $('[data-companion]'), pieces, textures, reducedMotion });

  await animate(loader, { opacity: [1, 0], duration: reducedMotion ? 1 : 500, ease: 'outQuad' });
  loader.remove();
  stage.playIntro();
  introCopy();
}

function introCopy() {
  if (reducedMotion) return;
  const title = $('[data-split]');
  const { chars } = splitText(title, { chars: { wrap: 'clip' } });
  animate(chars, { y: ['105%', '0%'], duration: 1100, delay: stagger(24, { start: 250 }), ease: 'outExpo' });
  animate(['.hero .eyebrow', '.hero__lede', '.hero__ctas', '.hero__specs', '.hero__meta'], {
    opacity: [0, 1], y: [16, 0], duration: 900, delay: stagger(90, { start: 650 }), ease: 'outQuart',
  });
}

boot().catch((err) => {
  console.error(err);
  loader.querySelector('p').textContent = 'Could not load the 3D model. The rest of the page still works.';
  setTimeout(() => loader.remove(), 1800);
});

// ---------- Nav background once past the stage ----------
const nav = $('.nav');
const stageEl = $('.stage');
const updateNav = () => nav.classList.toggle('is-solid', window.scrollY > stageEl.offsetHeight - window.innerHeight * 1.05);
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// ---------- Reveal on scroll + metric count-up ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
  });
}, { threshold: 0.2 });
$$('[data-reveal]').forEach((el) => io.observe(el));

const countIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    countIO.unobserve(en.target);
    const end = Number(en.target.dataset.count);
    if (reducedMotion || end === 0) return;
    const o = { n: 0 };
    animate(o, { n: end, duration: 1800, ease: 'outExpo', onUpdate: () => { en.target.textContent = Math.round(o.n); } });
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

// ---------- Spec tabs (arrow keys move between tabs) ----------
const tabs = $$('[role="tab"]');
function selectTab(tab, focus = true) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
  if (focus) tab.focus();
  const panel = $(`#${tab.getAttribute('aria-controls')}`);
  if (!reducedMotion) animate(panel.querySelectorAll('tr'), { opacity: [0, 1], x: [-8, 0], duration: 500, delay: stagger(30), ease: 'outQuart' });
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab, false));
  tab.addEventListener('keydown', (e) => {
    const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    selectTab(tabs[(map[e.key] + tabs.length) % tabs.length]);
  });
});

// ---------- Test log scroller ----------
const track = $('[data-log-track]');
const prev = $('[data-log-prev]');
const next = $('[data-log-next]');
const step = () => track.querySelector('.log__item').offsetWidth;
const updateLogButtons = () => {
  prev.disabled = track.scrollLeft < 8;
  next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
};
prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
track.addEventListener('scroll', updateLogButtons, { passive: true });
window.addEventListener('resize', updateLogButtons);
updateLogButtons();

// ---------- Document requests jump to the form with the right box ticked ----------
const form = $('[data-form]');
$$('[data-doc]').forEach((btn) => btn.addEventListener('click', () => {
  const box = form.querySelector(`input[name="docs"][value="${btn.dataset.doc}"]`);
  if (box) box.checked = true;
  $('#contact').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  setTimeout(() => $('#f-name').focus({ preventScroll: true }), reducedMotion ? 0 : 700);
}));

// ---------- Form validation + confirmation ----------
const messages = {
  name: 'Enter your name.',
  email: 'Enter a work email like name@company.com.',
  organization: 'Enter your organization.',
  program: 'Choose the program closest to yours.',
};
function validate(field) {
  const err = document.getElementById(field.getAttribute('aria-describedby'));
  let msg = '';
  if (field.required && !field.value.trim()) msg = messages[field.name];
  else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) msg = messages.email;
  field.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) err.textContent = msg;
  return !msg;
}
form.querySelectorAll('[required]').forEach((f) => {
  f.addEventListener('blur', () => { if (f.value) validate(f); });
  f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') validate(f); });
});

function addWorkingDays(date, n) {
  const d = new Date(date);
  while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) n--; }
  return d;
}

const success = $('[data-success]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = [...form.querySelectorAll('[required]')];
  const results = fields.map(validate);
  const firstBad = fields[results.indexOf(false)];
  if (firstBad) { firstBad.focus(); return; }
  const data = new FormData(form);
  $('[data-success-name]').textContent = String(data.get('name')).trim().split(' ')[0];
  $('[data-success-date]').textContent = addWorkingDays(new Date(), 2).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  form.hidden = true;
  success.hidden = false;
  success.focus();
  if (!reducedMotion) animate(success, { opacity: [0, 1], y: [16, 0], duration: 600, ease: 'outQuart' });
});
$('[data-reset]').addEventListener('click', () => {
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach((f) => f.setAttribute('aria-invalid', 'false'));
  success.hidden = true;
  form.hidden = false;
  $('#f-name').focus();
});
