const get = (id) => document.getElementById(id);
const number = document.querySelector('.number');
const topLine = get('line-top');
const bottomLine = get('line-bottom');
const caption = document.querySelector('.caption');
const wave = get('wave');
const spectrum = get('spectrum');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const transitionPresets = [
  { duration: 480, topDelay: 0, bottomDelay: 45, captionDelay: 90,
    numberMask: 'horizontal', waveMask: 'horizontal', spectrumMask: 'inset(0 0 100%)' },
  { duration: 550, topDelay: 0, bottomDelay: 145, captionDelay: 185,
    numberMask: 'horizontal', waveMask: 'horizontal', spectrumMask: 'inset(100% 0 0)' },
  { duration: 420, topDelay: 100, bottomDelay: 0, captionDelay: 125,
    numberMask: 'inset(50% 0)', waveMask: 'inset(0 50%)', spectrumMask: 'inset(0 0 100%)' },
  { duration: 510, topDelay: 30, bottomDelay: 30, captionDelay: 120,
    numberMask: 'inset(0 50%)', waveMask: 'inset(50% 0)', spectrumMask: 'inset(0 100% 0 0)' },
  { duration: 460, topDelay: 125, bottomDelay: 45, captionDelay: 75,
    numberMask: 'inset(0 0 100%)', waveMask: 'inset(100% 0 0)', spectrumMask: 'horizontal' },
  { duration: 530, topDelay: 0, bottomDelay: 80, captionDelay: 140,
    numberMask: 'inset(50%)', waveMask: 'inset(50%)', spectrumMask: 'inset(50% 0)' },
];
let lastTransition = -1;
let steps = [];
let current = 0;
let animations = [];

async function loadSteps() {
  const response = await fetch('./steps.json');
  if (!response.ok) throw new Error('Unable to load steps.json: ' + response.status);
  const data = await response.json();
  const textFields = ['title', 'note', 'time', 'lineTop', 'lineBottom', 'track'];
  if (!Array.isArray(data) || !data.length || !data.every((step) =>
    step && textFields.every((field) => typeof step[field] === 'string') &&
    Number.isFinite(step.chartSeed))) {
    throw new Error('Invalid step data in steps.json');
  }
  return data;
}

function renderPageCount(label) {
  const counter = get('page-count');
  counter.textContent = label + ' / ' + steps.length;
  counter.setAttribute('aria-label', '第 ' + (current + 1) + ' 頁，共 ' + steps.length + ' 頁');
}

function renderNumber(label) {
  const spacing = 210;
  number.setAttribute('viewBox', '0 0 ' + (spacing * label.length - 10) + ' 303');
  const digits = [...label].map((digit, index) => {
    const glyph = document.createElementNS(number.namespaceURI, 'use');
    glyph.setAttribute('href', '#digit-' + digit);
    glyph.setAttribute('x', index * spacing);
    return glyph;
  });
  get('number-digits').replaceChildren(...digits);
}

function formatStepNumber(index) {
  return String(index + 1).padStart(2, '0');
}

function renderStep(step, label) {
  renderNumber(label);
  get('time').textContent = label + ' / T+' + step.time;
  get('title').textContent = step.title;
  get('caption').textContent = step.note;
  topLine.textContent = step.lineTop;
  bottomLine.textContent = step.lineBottom;
  get('signal-name').textContent = 'TRACK ' + label + ' / ' + step.track;
  get('channel').textContent = 'REC ' + label;
}

function show(index, direction = 0) {
  current = (index + steps.length) % steps.length;
  const label = formatStepNumber(current);
  renderStep(steps[current], label);
  renderPageCount(label);
  drawCharts();
  animateTransition(direction);
}

function pickTransition() {
  const available = transitionPresets.length - (lastTransition >= 0 ? 1 : 0);
  let index = Math.floor(Math.random() * available);
  if (lastTransition >= 0 && index >= lastTransition) index++;
  lastTransition = index;
  return transitionPresets[index];
}

function animateTransition(direction) {
  animations.forEach((animation) => animation.cancel());
  animations = [];
  if (!direction || reducedMotion.matches) return;

  const preset = pickTransition();
  const timing = { duration: preset.duration, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' };
  const horizontalMask = direction > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
  const mask = (value) => value === 'horizontal' ? horizontalMask : value;
  animations = [
    reveal(number, mask(preset.numberMask), timing),
    animateLine(topLine, '100%', { ...timing, delay: preset.topDelay }),
    animateLine(bottomLine, '-100%', { ...timing, delay: preset.bottomDelay }),
    caption.animate([
      { opacity: 0, translate: '0 12px' },
      { opacity: 1, translate: '0 0' },
    ], { ...timing, delay: preset.captionDelay }),
    reveal(wave, mask(preset.waveMask), { ...timing, delay: 55 }),
    reveal(spectrum, mask(preset.spectrumMask),
      { ...timing, delay: 90 }),
  ];
}

function reveal(element, mask, timing) {
  return element.animate([{ clipPath: mask }, { clipPath: 'inset(0)' }], timing);
}

function animateLine(line, offset, timing) {
  return line.animate([
    { transform: 'translateX(' + offset + ')' },
    { transform: 'translateX(0)' },
  ], timing);
}

function canvasContext(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width, canvas.height);
  return ctx;
}

function drawCharts() {
  const seed = steps[current].chartSeed;
  drawWaveform(canvasContext(wave), seed);
  drawSpectrum(canvasContext(spectrum), seed);
}

function noise(sample, seed) {
  const value = Math.sin(sample * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawWaveform(waveContext, seed) {
  for (let row = 0; row < 2; row++) {
    const baseline = .25 + row * .5;
    waveContext.fillStyle = '#8a95a02f';
    waveContext.fillRect(0, baseline, 1, .006);
    for (let sample = 0; sample < 165; sample++) {
      const x = sample / 165;
      const envelope = .036 + .13 * Math.abs(Math.sin(x * 12 + row + seed));
      const amplitude = envelope * (.22 + .78 * noise(sample + row * 181, seed));
      waveContext.fillStyle = 'rgba(33,44,60,' + (.21 + .52 * noise(sample + 370, seed)) + ')';
      waveContext.fillRect(x, baseline - amplitude, .0031, amplitude * 2);
    }
  }

}

function drawSpectrum(ctx, seed) {
  const ground = ctx.createLinearGradient(0, 0, 1, 1);
  ground.addColorStop(0, '#7294b9');
  ground.addColorStop(.56, '#c3cce2');
  ground.addColorStop(1, '#8ca7be');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, 1, 1);
  for (let band = 0; band < 138; band++) {
    const x = band / 138;
    const y = noise(band + 12, seed) * .69;
    const width = .003 + noise(band + 80, seed) * .052;
    const height = .16 + noise(band + 143, seed) * .65;
    const stripe = ctx.createLinearGradient(x, 0, x + width, 0);
    const alpha = .07 + noise(band + 215, seed) * .34;
    const color = band % 4 ? '38,76,122,' : '228,234,246,';
    stripe.addColorStop(0, 'rgba(' + color + '0)');
    stripe.addColorStop(.37, 'rgba(' + color + alpha + ')');
    stripe.addColorStop(1, 'rgba(' + color + '0)');
    ctx.fillStyle = stripe;
    ctx.fillRect(x, y, width, height);
  }
  ctx.fillStyle = '#36527522';
  for (let row = 1; row < 10; row++) ctx.fillRect(0, row / 10, 1, .0011);
  for (let column = 1; column < 8; column++) ctx.fillRect(column / 8, 0, .0016, 1);
}

function advance(direction) {
  show(current + direction, direction);
}

function normalizeTitle(title) {
  return title.normalize('NFKC').trim().toLowerCase();
}

function clearSearchResults() {
  const results = get('title-matches');
  const input = get('title-query');
  results.hidden = true;
  results.replaceChildren();
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  get('search-status').textContent = '';
}

function jumpToResult(index) {
  get('title-query').value = '';
  clearSearchResults();
  if (index !== current) show(index, Math.sign(index - current));
  get('title').focus({ preventScroll: true });
}

function findTitleMatches(query) {
  return steps.flatMap(({ title }, index) => {
    const position = normalizeTitle(title).indexOf(query);
    if (position < 0) return [];
    const rank = normalizeTitle(title) === query ? 0 : position === 0 ? 1 : 2;
    return [{ title, index, rank }];
  }).sort((first, second) => first.rank - second.rank);
}

function createTitleOption({ title, index }) {
  const option = document.createElement('li');
  option.id = 'title-match-' + index;
  option.dataset.step = index;
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', 'false');
  const name = document.createElement('span');
  name.textContent = title;
  const label = document.createElement('span');
  label.textContent = formatStepNumber(index);
  option.append(name, label);
  return option;
}

function selectTitleOption(option, scroll = false) {
  const results = get('title-matches');
  results.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
  option.setAttribute('aria-selected', 'true');
  get('title-query').setAttribute('aria-activedescendant', option.id);
  if (scroll) scrollSearchOptionIntoView(results, option);
}

function scrollSearchOptionIntoView(results, option) {
  const insetTop = option.offsetTop - results.scrollTop;
  const insetBottom = insetTop + option.offsetHeight;
  if (insetTop < 0) results.scrollTop += insetTop;
  if (insetBottom > results.clientHeight) results.scrollTop += insetBottom - results.clientHeight;
}

function refreshTitleMatches() {
  clearSearchResults();
  const input = get('title-query');
  const query = normalizeTitle(input.value);
  if (!query) return;
  const matches = findTitleMatches(query);
  if (!matches.length) {
    get('search-status').textContent = '找不到符合的標題';
    return;
  }

  const results = get('title-matches');
  results.append(...matches.map(createTitleOption));
  results.hidden = false;
  results.scrollTop = 0;
  input.setAttribute('aria-expanded', 'true');
  selectTitleOption(results.firstElementChild);
}

function submitTitleSearch(event) {
  event.preventDefault();
  const results = get('title-matches');
  if (results.hidden) refreshTitleMatches();
  const selected = results.querySelector('[aria-selected="true"]');
  if (selected) jumpToResult(Number(selected.dataset.step));
}

function handleTitleSearchKey(event) {
  if (event.isComposing) return;
  if (event.key === 'Tab' || event.key === 'Escape') {
    clearSearchResults();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const results = get('title-matches');
  if (results.hidden) {
    refreshTitleMatches();
    return;
  }

  const currentOption = results.querySelector('[aria-selected="true"]');
  const next = event.key === 'ArrowDown'
    ? currentOption.nextElementSibling ?? results.firstElementChild
    : currentOption.previousElementSibling ?? results.lastElementChild;
  selectTitleOption(next, true);
}

function bindTitleSearch() {
  const form = get('title-search');
  const input = get('title-query');
  form.addEventListener('submit', submitTitleSearch);
  input.addEventListener('input', (event) => {
    if (!event.isComposing) refreshTitleMatches();
  });
  input.addEventListener('compositionend', refreshTitleMatches);
  input.addEventListener('keydown', handleTitleSearchKey);
  get('title-matches').addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) jumpToResult(Number(option.dataset.step));
  });
  document.addEventListener('pointerdown', (event) => {
    if (!form.contains(event.target)) clearSearchResults();
  });
}

function bindNavigation() {
  bindTitleSearch();
  get('previous').addEventListener('click', () => advance(-1));
  get('next').addEventListener('click', () => advance(1));
  document.addEventListener('keydown', handleNavigationKey);
}

function handleNavigationKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
  if (event.target.closest?.('#title-search')) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  if (!event.repeat) advance(event.key === 'ArrowRight' ? 1 : -1);
}

function showLoadError(error) {
  console.error(error);
  get('title').textContent = '資料載入失敗';
  get('caption').textContent = location.protocol === 'file:'
    ? '請透過本機 HTTP 伺服器開啟網站，以讀取 steps.json。'
    : '請確認 steps.json 存在且資料格式正確。';
  get('previous').disabled = true;
  get('next').disabled = true;
}

async function initialize() {
  steps = await loadSteps();
  get('title-query').disabled = false;
  bindNavigation();
  show(0);
  new ResizeObserver(drawCharts).observe(document.querySelector('.instruments'));
}

initialize().catch(showLoadError);
