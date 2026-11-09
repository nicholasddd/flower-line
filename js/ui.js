// The HTML layers over the painting: the journal spread, the omakase letter,
// the intercom chat, sound and a small dev panel.

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pageURLs = [];
let spread = 0;
let flipping = false;
let backdropFn = () => {};

// Page geometry as fractions of the open book (matches the 3D journal).
const BOOK = { CW: 0.206, CH: 0.278, W: 0.2, H: 0.27 };
const pct = (v) => `${(v * 100).toFixed(3)}%`;
const RIGHT = { left: pct((BOOK.CW + 0.002) / (2 * BOOK.CW)), top: pct((BOOK.CH - BOOK.H) / 2 / BOOK.CH), width: pct(BOOK.W / (2 * BOOK.CW)), height: pct(BOOK.H / BOOK.CH) };
const LEFT = { ...RIGHT, left: pct((BOOK.CW - 0.002 - BOOK.W) / (2 * BOOK.CW)) };
const ENDPAPER = { left: '0%', top: '0%', width: '50%', height: '100%' };

export function init({ pages }) {
  pageURLs = pages.map((c) => c.toDataURL('image/jpeg', 0.88));
  $('#veil').addEventListener('click', () => backdropFn());
  $('#book').addEventListener('click', (e) => {
    const pg = e.target.closest('.pg');
    if (!pg) return backdropFn();
    if (pg.classList.contains('right')) flip(1);
    else flip(-1);
  });
  addEventListener('keydown', (e) => {
    if (!$('#book').classList.contains('on')) return;
    if (e.key === 'ArrowRight') flip(1);
    if (e.key === 'ArrowLeft') flip(-1);
  });
  setupLetter();
  setupChat();
  setupSound();
}

export function reveal() {
  setTimeout(() => $('#fade').classList.add('gone'), 300);
}

export function onBackdrop(fn) { backdropFn = fn; }

export function veil(on) { $('#veil').classList.toggle('on', on); }

// ---------- journal ----------
function place(el, r) { Object.assign(el.style, r); }

function renderSpread() {
  const l = $('#book .pg.left'), r = $('#book .pg.right');
  const li = spread * 2, ri = spread * 2 + 1;
  place(l, li === 0 ? ENDPAPER : LEFT);
  l.querySelector('img').src = pageURLs[li];
  l.classList.toggle('endpaper', li === 0);
  r.style.visibility = pageURLs[ri] ? 'visible' : 'hidden';
  place(r, RIGHT);
  if (pageURLs[ri]) r.querySelector('img').src = pageURLs[ri];
}

export async function showBook(w, h) {
  spread = 0;
  const b = $('#book');
  b.style.width = `${w}px`;
  b.style.height = `${h}px`;
  renderSpread();
  b.classList.add('on');
  await wait(420);
}

export async function hideBook() {
  if (spread !== 0) {
    // close back to the first spread so the 3D book matches
    $('#book').classList.add('dim');
    await wait(200);
    spread = 0;
    renderSpread();
    $('#book').classList.remove('dim');
  }
  $('#book').classList.remove('on');
  await wait(380);
}

async function flip(dir) {
  const last = Math.ceil(pageURLs.length / 2) - 1;
  const next = spread + dir;
  if (flipping || next < 0 || next > last) return;
  flipping = true;
  const book = $('#book');
  const f = document.createElement('div');
  f.className = 'flipper';
  const front = document.createElement('img');
  const back = document.createElement('img');
  back.className = 'back';
  f.append(front, back);
  if (dir > 0) {
    place(f, RIGHT);
    f.style.transformOrigin = 'left center';
    front.src = pageURLs[spread * 2 + 1];
    back.src = pageURLs[next * 2];
    const r = book.querySelector('.pg.right');
    if (pageURLs[next * 2 + 1]) r.querySelector('img').src = pageURLs[next * 2 + 1];
    else r.style.visibility = 'hidden';
  } else {
    place(f, spread * 2 === 0 ? ENDPAPER : LEFT);
    f.style.transformOrigin = 'right center';
    front.src = pageURLs[spread * 2];
    back.src = pageURLs[next * 2 + 1];
    const l = book.querySelector('.pg.left');
    place(l, next === 0 ? ENDPAPER : LEFT);
    l.querySelector('img').src = pageURLs[next * 2];
  }
  book.appendChild(f);
  f.getBoundingClientRect();
  f.style.transform = `rotateY(${dir > 0 ? -180 : 180}deg)`;
  await wait(820);
  spread = next;
  renderSpread();
  f.remove();
  flipping = false;
}

// ---------- omakase letter ----------
function setupLetter() {
  const form = $('#letter form');
  form.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    pill.parentElement.querySelectorAll('.pill').forEach((p) => p.classList.toggle('picked', p === pill));
    pill.parentElement.dataset.value = pill.textContent;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    form.querySelectorAll('.pills').forEach((p) => { data[p.dataset.name] = p.dataset.value || ''; });
    console.info('omakase request (not sent anywhere yet):', data);
    $('#letter').classList.add('sealed');
  });
  $('#letter').addEventListener('click', (e) => {
    if (e.target.id === 'letter') backdropFn();
  });
}

export async function showLetter() {
  $('#letter').classList.remove('sealed');
  $('#letter').classList.add('on');
  await wait(450);
}

export async function hideLetter() {
  $('#letter').classList.remove('on');
  await wait(400);
}

// ---------- intercom ----------
const REPLIES = [
  'Hello, this is the front carriage. Our florist is still learning to talk through this thing. For now, the envelope on your table is the quickest way to reach us.',
  'Noted. Someone will read this properly once the line is connected.',
  'The conductor says thank you, and asks you to enjoy the view in the meantime.',
];
let replyIndex = 0;

function setupChat() {
  const chat = $('#chat');
  chat.querySelector('.close').addEventListener('click', closeChat);
  chat.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = chat.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, 'me');
    input.value = '';
    const typing = addMsg('…', 'them typing');
    setTimeout(() => {
      typing.remove();
      addMsg(REPLIES[Math.min(replyIndex++, REPLIES.length - 1)], 'them');
      chime(0.5);
    }, 900 + Math.random() * 700);
  });
}

function addMsg(text, who) {
  const log = $('#chat .log');
  const m = document.createElement('p');
  m.className = `msg ${who}`;
  m.textContent = text;
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
  return m;
}

export function toggleChat(origin) {
  const chat = $('#chat');
  if (chat.classList.contains('on')) return closeChat();
  const r = chat.getBoundingClientRect();
  chat.style.transformOrigin = `${origin.x - r.left}px ${origin.y - r.top}px`;
  chat.classList.add('on');
  if (!$('#chat .log').children.length) {
    setTimeout(() => addMsg('Front carriage here. How can we help?', 'them'), 500);
  }
  setTimeout(() => chat.querySelector('input').focus(), 350);
}

export function closeChat() { $('#chat').classList.remove('on'); }

// ---------- sound ----------
let ac = null, master = null, rainGain = null, soundOn = false, raining = false;

function noiseBuffer(ctx, seconds, brown = false) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

function startAudio() {
  ac = new AudioContext();
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  const rumble = ac.createBufferSource();
  rumble.buffer = noiseBuffer(ac, 4, true);
  rumble.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 220;
  const rg = ac.createGain(); rg.gain.value = 0.9;
  rumble.connect(lp).connect(rg).connect(master);
  rumble.start();
  const air = ac.createBufferSource();
  air.buffer = noiseBuffer(ac, 3);
  air.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  const ag = ac.createGain(); ag.gain.value = 0.025;
  air.connect(bp).connect(ag).connect(master);
  air.start();
  const rain = ac.createBufferSource();
  rain.buffer = noiseBuffer(ac, 3);
  rain.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 2500;
  rainGain = ac.createGain();
  rainGain.gain.value = raining ? 0.05 : 0;
  rain.connect(hp).connect(rainGain).connect(master);
  rain.start();
}

function setupSound() {
  const btn = $('#sound');
  btn.addEventListener('click', () => {
    if (!ac) startAudio();
    soundOn = !soundOn;
    btn.classList.toggle('on', soundOn);
    btn.setAttribute('aria-pressed', soundOn);
    master.gain.setTargetAtTime(soundOn ? 0.6 : 0, ac.currentTime, 0.3);
  });
}

export function setRain(on) {
  raining = on;
  if (rainGain) rainGain.gain.setTargetAtTime(on ? 0.05 : 0, ac.currentTime, 0.5);
}

function knock(t, vol) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.08);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 180 + Math.random() * 60; f.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function clack() {
  if (!soundOn || !ac) return;
  const t = ac.currentTime;
  knock(t, 0.9); knock(t + 0.11, 0.7);
  knock(t + 0.52, 0.8); knock(t + 0.63, 0.6);
}

export function chime(vol = 1) {
  if (!soundOn || !ac) return;
  const t = ac.currentTime;
  [[784, 0], [622, 0.28]].forEach(([freq, dt]) => {
    const o = ac.createOscillator();
    o.type = 'sine'; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t + dt);
    g.gain.linearRampToValueAtTime(0.18 * vol, t + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dt + 1.2);
    o.connect(g).connect(master);
    o.start(t + dt); o.stop(t + dt + 1.3);
  });
}

// ---------- dev ----------
export function devPanel(state, weathers, onChange) {
  const p = $('#dev');
  p.hidden = false;
  const hour = p.querySelector('[name=hour]');
  const label = p.querySelector('.hour');
  const now = new Date();
  hour.value = state.hour ?? now.getHours() + now.getMinutes() / 60;
  const show = () => {
    const h = Math.floor(hour.value), m = Math.round((hour.value - h) * 60);
    label.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  show();
  hour.addEventListener('input', () => { state.hour = parseFloat(hour.value); show(); onChange(); });
  const sel = p.querySelector('[name=weather]');
  sel.innerHTML = weathers.map((w) => `<option${w === state.weather ? ' selected' : ''}>${w}</option>`).join('');
  sel.addEventListener('change', () => { state.weather = sel.value; onChange(); });
}

export function fps(v, scale) {
  const el = $('#dev .fps');
  if (el) el.textContent = `${v.toFixed(0)} fps · ${Math.round(scale * 100)}%`;
}
