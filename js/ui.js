// The HTML layers over the painting: the journal spread, the omakase letter,
// the build-your-own bouquet, the intercom chat, sound and a small dev panel.
import { STEMS, WRAPS, CURRENCY, MAX_PER_STEM } from './inventory.js';
import { drawBouquet, stemThumb } from './paint.js';

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

export function init({ pages, atlas }) {
  pageURLs = pages.map((c) => c.toDataURL('image/jpeg', 0.88));
  setupBuilder(atlas);
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

// ---------- build-your-own bouquet ----------
// Every stem is chosen and priced one by one; the preview repaints as the
// bouquet grows. The florist adds greenery and wrapping.
const counts = {};
let wrap = WRAPS[0], atlasCanvas = null;
const money = (n) => `${CURRENCY}${n.toLocaleString('en-US')}`;

function setupBuilder(atlas) {
  atlasCanvas = atlas;
  const list = $('#builder .stems');
  for (const item of STEMS) {
    counts[item.id] = 0;
    const row = document.createElement('div');
    row.className = 'stem' + (item.soldOut ? ' sold' : '');
    row.dataset.id = item.id;
    row.append(stemThumb(atlas, item));
    const label = document.createElement('div');
    label.innerHTML = `<b></b><small></small>`;
    label.querySelector('b').textContent = item.name;
    label.querySelector('small').textContent = item.soldOut ? 'sold out today' : item.note ?? '';
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = `${money(item.price)} / stem`;
    const qty = document.createElement('div');
    qty.className = 'qty';
    qty.innerHTML = `<button type="button" data-d="-1" aria-label="One fewer ${item.name}">−</button><output>0</output><button type="button" data-d="1" aria-label="One more ${item.name}">+</button>`;
    if (item.soldOut) qty.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    row.append(label, price, qty);
    list.append(row);
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const id = b.closest('.stem').dataset.id;
    counts[id] = Math.max(0, Math.min(MAX_PER_STEM, counts[id] + Number(b.dataset.d)));
    refreshBuilder();
  });
  const wraps = $('#builder .wraps');
  for (const w of WRAPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill' + (w === wrap ? ' picked' : '');
    b.innerHTML = `<i></i>`;
    b.querySelector('i').style.background = w.paper;
    b.append(w.name);
    b.addEventListener('click', () => {
      wrap = w;
      wraps.querySelectorAll('.pill').forEach((p) => p.classList.toggle('picked', p === b));
      refreshBuilder();
    });
    wraps.append(b);
  }
  $('#builder form').addEventListener('submit', (e) => {
    e.preventDefault();
    const stems = STEMS.filter((s) => counts[s.id]).map((s) => ({ id: s.id, name: s.name, qty: counts[s.id], price: s.price }));
    const order = { stems, wrap: wrap.id, total: stems.reduce((t, s) => t + s.qty * s.price, 0), ...Object.fromEntries(new FormData(e.target)) };
    console.info('bespoke bouquet (not sent anywhere yet):', order);
    $('#builder').classList.add('sent');
  });
  $('#builder').addEventListener('click', (e) => { if (e.target.id === 'builder') backdropFn(); });
  refreshBuilder();
}

function refreshBuilder() {
  let stems = 0, total = 0;
  const picked = [];
  for (const item of STEMS) {
    const n = counts[item.id];
    stems += n;
    total += n * item.price;
    const row = $(`#builder .stem[data-id="${item.id}"]`);
    row.querySelector('output').textContent = n;
    row.classList.toggle('has', n > 0);
    row.querySelector('[data-d="-1"]').disabled = n === 0;
    if (n) picked.push({ item, n });
  }
  $('#builder .tally strong').textContent = stems ? `${stems} stem${stems > 1 ? 's' : ''} · ${money(total)}` : '0 stems';
  $('#builder .send').disabled = stems === 0;
  $('#builder .empty').style.display = stems ? 'none' : '';
  paintPreview(picked);
}

// Spread the dome's blooms across the chosen stems in proportion to how many
// of each, so the painting reads like the order.
function paintPreview(picked) {
  const c = $('#builder canvas'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (!picked.length) return;
  const total = picked.reduce((t, p) => t + p.n, 0);
  const flowers = [];
  for (let i = 0; i < 13; i++) {
    // pick by proportion, deterministically, so the picture doesn't jump about
    let x = ((i * 7 + 3) % 13 + 0.5) / 13 * total;
    for (const p of picked) { if ((x -= p.n) < 0) { flowers.push(p.item.art ? p.item.art : { colour: p.item.colour, art: null }); break; } }
  }
  drawBouquet(ctx, atlasCanvas, { flowers, paper: wrap.paper, ribbon: wrap.ribbon }, c.width / 2, c.height * 0.5, c.width * 0.95, 4242);
}

export async function showBuilder() {
  $('#builder').classList.remove('sent');
  $('#builder').classList.add('on');
  await wait(450);
}

export async function hideBuilder() {
  $('#builder').classList.remove('on');
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
  rainGain.gain.value = raining ? 0.025 : 0;
  rain.connect(hp).connect(rainGain).connect(master);
  rain.start();
  startMusic();
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
  if (rainGain) rainGain.gain.setTargetAtTime(on ? 0.025 : 0, ac.currentTime, 0.5);
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

// ---------- music: a slow, never-repeating piano tune, made in code ----------
// Electric-piano chords and a wandering arpeggio over a soft pad, through a
// long reverb. Unhurried, like looking out of the window.
const BPM = 70, BEAT = 60 / BPM;
// Fmaj7  Em7  Dm7  Cmaj7  Bbmaj7  Am7  Dm7  G7sus
const CHORDS = [
  [41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [38, 50, 53, 57, 60], [36, 52, 55, 59, 64],
  [34, 50, 53, 57, 62], [33, 52, 55, 60, 64], [38, 53, 57, 60, 65], [31, 53, 55, 60, 62],
];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
let musicBus = null, musicTimer = 0, nextNote = 0, step = 0, phrase = [];

function reverb(seconds) {
  const len = ac.sampleRate * seconds;
  const b = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const v = ac.createConvolver();
  v.buffer = b;
  return v;
}

// a soft FM electric piano: bright on the strike, mellowing as it rings
function epiano(n, t, vel, dur = 2.6) {
  const f = midi(n);
  const car = ac.createOscillator(), mod = ac.createOscillator();
  const mg = ac.createGain(), g = ac.createGain();
  car.frequency.value = f;
  mod.frequency.value = f;
  mg.gain.setValueAtTime(f * 1.6 * vel, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.9);
  mod.connect(mg).connect(car.frequency);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  const pan = ac.createStereoPanner();
  pan.pan.value = (n - 60) / 40;
  car.connect(g).connect(pan).connect(musicBus);
  car.start(t); mod.start(t);
  car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
}

function pad(notes, t, dur) {
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.035, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
  lp.connect(g).connect(musicBus);
  for (const n of notes.slice(1)) for (const det of [-6, 6]) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(n);
    o.detune.value = det;
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.7);
  }
}

function bass(n, t, dur) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = midi(n);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.11, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.01, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t); o.stop(t + dur + 0.05);
}

// each chord lasts two bars of eighth notes; the arpeggio wanders over the
// chord tones an octave or two up, with rests so it breathes
function scheduleStep(t) {
  const ci = Math.floor(step / 16) % CHORDS.length;
  const chord = CHORDS[ci];
  const pos = step % 16;
  if (pos === 0) {
    const len = BEAT * 8;
    bass(chord[0], t, len);
    pad(chord, t, len);
    chord.slice(1, 4).forEach((n, i) => epiano(n, t + i * 0.025, 0.55, 3.5));
    // a new little phrase for this chord
    const tones = [...chord.slice(1).map((n) => n + 12), ...chord.slice(1, 3).map((n) => n + 24)];
    phrase = Array.from({ length: 16 }, (_, i) => (i > 0 && Math.random() < (i % 2 ? 0.3 : 0.55)) ? tones[Math.floor(Math.random() * tones.length)] : 0);
  }
  if (pos === 8 && Math.random() < 0.6) chord.slice(2, 5).forEach((n, i) => epiano(n, t + i * 0.02, 0.35, 2.5));
  const n = phrase[pos];
  if (n) epiano(n, t + (pos % 2 ? 0.03 : 0), 0.35 + Math.random() * 0.3, 2.2);
}

function startMusic() {
  musicBus = ac.createGain();
  musicBus.gain.value = 1.1;
  const verb = reverb(3.2);
  const wet = ac.createGain(); wet.gain.value = 0.45;
  musicBus.connect(master);
  musicBus.connect(verb).connect(wet).connect(master);
  nextNote = ac.currentTime + 0.3;
  musicTimer = setInterval(() => {
    if (!soundOn) { nextNote = ac.currentTime + 0.3; return; }
    while (nextNote < ac.currentTime + 0.4) {
      scheduleStep(nextNote);
      nextNote += BEAT / 2;
      step++;
    }
  }, 100);
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
