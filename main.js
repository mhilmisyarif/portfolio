const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Theme toggle ----------
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

function currentTheme() {
  if (root.dataset.theme) return root.dataset.theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function labelThemeToggle() {
  themeToggle.setAttribute('aria-label', `Switch to ${currentTheme() === 'dark' ? 'light' : 'dark'} theme`);
}
themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (error) { /* storage can be blocked; the choice then lasts for this visit */ }
  labelThemeToggle();
});
labelThemeToggle();

// ---------- Mobile menu ----------
const menuToggle = document.getElementById('menu-toggle');
const nav = document.getElementById('site-nav');

function setMenu(open) {
  nav.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
}
menuToggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
    setMenu(false);
    menuToggle.focus();
  }
});

// ---------- Current section in the nav ----------
const navLinks = new Map([...nav.querySelectorAll('a')].map((link) => [link.getAttribute('href').slice(1), link]));
const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const [id, link] of navLinks) {
      if (id === entry.target.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }
}, { rootMargin: '-45% 0px -50% 0px' });
for (const id of navLinks.keys()) {
  const section = document.getElementById(id);
  if (section) sectionObserver.observe(section);
}

// ---------- Scroll reveal ----------
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -8% 0px' });
for (const group of document.querySelectorAll('.card-list, .pipeline, .project-grid, .skill-grid, .timeline')) {
  [...group.querySelectorAll(':scope > .reveal')].forEach((item, index) => item.style.setProperty('--delay', `${Math.min(index, 5) * 50}ms`));
}
for (const item of document.querySelectorAll('.reveal')) revealObserver.observe(item);

// ---------- Recipe demo ----------
// These are illustrative samples in the model's output format, replayed token by token.
const samples = [
  {
    label: 'Ayam, kecap manis',
    ingredients: 'ayam, kecap manis, bawang putih',
    title: 'Ayam Kecap Manis',
    steps: [
      'Tumis bawang putih hingga harum.',
      'Masukkan ayam, aduk hingga berubah warna.',
      'Tuang kecap manis dan sedikit air.',
      'Masak dengan api kecil hingga bumbu meresap.',
    ],
  },
  {
    label: 'Nasi, telur, cabai',
    ingredients: 'nasi, telur, bawang merah, cabai',
    title: 'Nasi Goreng Telur',
    steps: [
      'Haluskan bawang merah dan cabai.',
      'Tumis bumbu halus hingga harum, lalu orak-arik telur.',
      'Masukkan nasi, aduk rata dengan api besar.',
      'Bumbui dengan garam, sajikan selagi hangat.',
    ],
  },
  {
    label: 'Bayam, jagung',
    ingredients: 'bayam, jagung manis, bawang merah',
    title: 'Sayur Bening Bayam',
    steps: [
      'Didihkan air bersama irisan bawang merah.',
      'Masukkan jagung manis, masak hingga empuk.',
      'Tambahkan bayam, garam dan sedikit gula.',
      'Angkat segera setelah bayam layu.',
    ],
  },
];

const presetRow = document.getElementById('demo-presets');
const output = document.getElementById('demo-output');
const status = document.getElementById('demo-status');
const runButton = document.getElementById('demo-run');
let selected = 0;
let runId = 0;

function recipeTokens(sample) {
  const parts = [
    ['tok', '<|start-recipe|>'], ['text', ` ${sample.title}\n`],
    ['tok', '<|start-ingredients|>'], ['text', ` ${sample.ingredients}\n`],
    ['tok', '<|start-steps|>'], ['text', '\n'],
  ];
  sample.steps.forEach((step, index) => parts.push(['text', `${index + 1}. ${step}\n`]));
  parts.push(['tok', '<|end-recipe|>']);
  // Control tokens arrive whole; ordinary text arrives one word at a time.
  return parts.flatMap(([kind, value]) => (kind === 'tok' ? [[kind, value]] : value.match(/\s*\S+\s*|\s+/g).map((word) => [kind, word])));
}

function append(kind, value) {
  if (kind === 'tok') {
    const span = document.createElement('span');
    span.className = 'tok';
    span.textContent = value;
    output.append(span);
  } else {
    output.append(document.createTextNode(value));
  }
}

function generate() {
  const id = ++runId; // a newer run replaces any run still streaming
  const sample = samples[selected];
  const tokens = recipeTokens(sample);
  output.textContent = '';
  status.textContent = '';

  const finish = () => { status.textContent = `Recipe generated: ${sample.title}.`; };
  if (reduceMotion.matches) {
    tokens.forEach(([kind, value]) => append(kind, value));
    finish();
    return;
  }

  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.setAttribute('aria-hidden', 'true');
  output.append(caret);

  let index = 0;
  const step = () => {
    if (id !== runId) return;
    if (index >= tokens.length) { finish(); return; }
    const [kind, value] = tokens[index++];
    caret.remove();
    append(kind, value);
    output.append(caret);
    output.scrollTop = output.scrollHeight;
    setTimeout(step, kind === 'tok' ? 220 : 55);
  };
  setTimeout(step, 350);
}

samples.forEach((sample, index) => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = sample.label;
  chip.setAttribute('aria-pressed', String(index === selected));
  chip.addEventListener('click', () => {
    selected = index;
    [...presetRow.children].forEach((other, otherIndex) => other.setAttribute('aria-pressed', String(otherIndex === index)));
    generate();
  });
  presetRow.append(chip);
});
runButton.addEventListener('click', generate);
generate();

document.getElementById('year').textContent = new Date().getFullYear();
