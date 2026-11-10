// Sky, light and weather from the viewer's clock and a dice roll.
import * as THREE from 'three';

export const WEATHERS = ['clear', 'cloudy', 'overcast', 'rain', 'fog'];

export function rollWeather() {
  const r = Math.random();
  if (r < 0.38) return 'clear';
  if (r < 0.63) return 'cloudy';
  if (r < 0.75) return 'overcast';
  if (r < 0.92) return 'rain';
  return 'fog';
}

const SUNRISE = 6.3, SUNSET = 18.2;

// Rough solar elevation in degrees, close enough for the tropics.
export function sunElevation(h) {
  if (h >= SUNRISE && h <= SUNSET) return Math.sin(((h - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI) * 72;
  const nightLen = 24 - (SUNSET - SUNRISE);
  const t = h > SUNSET ? (h - SUNSET) / nightLen : (h + 24 - SUNSET) / nightLen;
  return -Math.sin(t * Math.PI) * 55;
}

const KEYS = [
  { e: -55, top: '#040a26', hor: '#14245a', sun: '#8ea6ff', sunI: 0.32, amb: '#2b3a6c', ambI: 0.42, fog: '#141c38' },
  { e: -12, top: '#0a1a4c', hor: '#2a3c84', sun: '#9ab0ff', sunI: 0.34, amb: '#33447a', ambI: 0.48, fog: '#1e2a52' },
  { e: -4,  top: '#283a8c', hor: '#f0809a', sun: '#ff9a7a', sunI: 0.5,  amb: '#6a6aa0', ambI: 0.62, fog: '#8f7c9c' },
  { e: 3,   top: '#4a74c8', hor: '#ff9a5c', sun: '#ffaa66', sunI: 1.5,  amb: '#a1aed6', ambI: 0.8,  fog: '#e6b49c' },
  { e: 14,  top: '#2a7ae0', hor: '#8cc4f0', sun: '#ffe2bc', sunI: 2.1,  amb: '#bcd2ec', ambI: 0.95, fog: '#c6d8e6' },
  { e: 72,  top: '#1e6ad8', hor: '#84bcf0', sun: '#fff5e6', sunI: 2.5,  amb: '#cde0f4', ambI: 1.05, fog: '#c4daec' },
];

const _a = new THREE.Color(), _b = new THREE.Color();
function lerpColor(out, ha, hb, t) {
  _a.set(ha); _b.set(hb);
  return out.copy(_a).lerp(_b, t);
}

const CLOUD = { clear: 0.18, cloudy: 0.5, overcast: 0.82, rain: 0.94, fog: 0.62 };

export function computeEnv(hour, weather) {
  const e = sunElevation(hour);
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((e - A.e) / (B.e - A.e), 0, 1);
  const env = {
    hour, weather, elevation: e,
    top: lerpColor(new THREE.Color(), A.top, B.top, t),
    hor: lerpColor(new THREE.Color(), A.hor, B.hor, t),
    sunCol: lerpColor(new THREE.Color(), A.sun, B.sun, t),
    amb: lerpColor(new THREE.Color(), A.amb, B.amb, t),
    fog: lerpColor(new THREE.Color(), A.fog, B.fog, t),
    sunI: THREE.MathUtils.lerp(A.sunI, B.sunI, t),
    ambI: THREE.MathUtils.lerp(A.ambI, B.ambI, t),
    night: THREE.MathUtils.clamp((-e - 1) / 9, 0, 1),
    cloud: CLOUD[weather],
    rain: weather === 'rain' ? 1 : 0,
    wind: weather === 'rain' ? 1 : weather === 'overcast' ? 0.5 : 0.2,
  };

  // Overcast skies lose colour and direct light.
  const grey = (c, k) => {
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    c.lerp(new THREE.Color(l, l, l * 1.04), k);
  };
  const ck = Math.max(0, env.cloud - 0.3) / 0.7;
  grey(env.top, ck * 0.55);
  grey(env.hor, ck * 0.45);
  grey(env.fog, ck * 0.55);
  env.sunI *= 1 - ck * 0.72;
  env.ambI *= 1 + ck * 0.15;
  if (weather === 'rain') {
    env.top.multiplyScalar(0.72); env.hor.multiplyScalar(0.78); env.fog.multiplyScalar(0.8);
    env.ambI *= 0.85;
  }
  env.fogNear = weather === 'fog' ? 6 : weather === 'rain' ? 18 : 40;
  env.fogFar = weather === 'fog' ? 75 : weather === 'rain' ? 160 : 420;

  // Sun drifts from the right of the window in the morning to the left at dusk.
  const dayT = THREE.MathUtils.clamp((hour - SUNRISE) / (SUNSET - SUNRISE), 0, 1);
  const az = THREE.MathUtils.lerp(0.9, -0.9, dayT);
  const elR = THREE.MathUtils.degToRad(Math.max(e, -6));
  env.sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(elR), Math.sin(elR), -Math.cos(az) * Math.cos(elR)).normalize();
  env.moonDir = new THREE.Vector3(-0.28, 0.2, -0.94).normalize();

  // The direction the light comes in through the window: the sun by day,
  // the moon at night. Clamped so it always lands somewhere on the table.
  const lightEl = env.night > 0.5 ? 0.42 : THREE.MathUtils.clamp(Math.sin(elR), 0.18, 0.75);
  const lx = env.night > 0.5 ? -0.3 : Math.sin(az) * 0.8;
  env.lightDir = new THREE.Vector3(lx, lightEl, -1).normalize();
  env.interior = THREE.MathUtils.clamp((-e + 4) / 10, 0, 1);
  return env;
}
