// The sixteen places the line passes, one behind each flower field. Each has
// a palette (sky tint, haze, the ground beyond the flowers, the hills, water,
// mist) and a builder that sets out its scenery in the distance.
//
// water: 0 land, 1 sea, 2 lake.  rise: how steeply the land climbs behind the
// field.  peaks: how much the far mountain range shows.  shore: how far back
// the shoreline sits when there is water.

export const PLACES = [
  { name: 'volcanoIsland', grade: ['#dff4ff', 0.25], far: '#7aa860', hill: '#9c94b0', water: 1, waterCol: '#1fa6b0', rise: 0, peaks: 0, mist: 0.1, shore: 46 },
  { name: 'saltFlats',     grade: ['#e8fff4', 0.25], far: '#c4e8d4', hill: '#7f9cc8', water: 0, waterCol: '#000000', rise: 0, peaks: 1, mist: 0.1, shore: 46 },
  { name: 'medTown',       grade: ['#ffd8d0', 0.45], far: '#b8a070', hill: '#c09a88', water: 0, waterCol: '#000000', rise: 1.5, peaks: 0, mist: 0.35, shore: 46 },
  { name: 'metropolis',    grade: ['#cfeef0', 0.4],  far: '#6f9a80', hill: '#8fb4bc', water: 0, waterCol: '#000000', rise: 0.2, peaks: 0, mist: 0.6, shore: 46 },
  { name: 'oceanCliffs',   grade: ['#d6e4ff', 0.3],  far: '#5f8a4a', hill: '#3a4a60', water: 1, waterCol: '#1a3f9a', rise: 0, peaks: 0, mist: 0.1, shore: 46 },
  { name: 'canyon',        grade: ['#fff0dc', 0.45], far: '#d89a68', hill: '#c8704a', water: 0, waterCol: '#000000', rise: 0.6, peaks: 0.3, mist: 0.15, shore: 46 },
  { name: 'blueCity',      grade: ['#ffe2c8', 0.35], far: '#b8a070', hill: '#a88a6a', water: 0, waterCol: '#000000', rise: 1.4, peaks: 0, mist: 0.25, shore: 46 },
  { name: 'basalt',        grade: ['#ddd0ec', 0.45], far: '#36343a', hill: '#2e2c34', water: 0, waterCol: '#000000', rise: 0.8, peaks: 1.3, mist: 0.4, shore: 46 },
  { name: 'templeCity',    grade: ['#e4f0e4', 0.35], far: '#5a7a48', hill: '#4a6a50', water: 0, waterCol: '#000000', rise: 1.3, peaks: 0, mist: 0.65, shore: 46 },
  { name: 'whiteCity',     grade: ['#f4eeff', 0.4],  far: '#a8b898', hill: '#b8c4c0', water: 0, waterCol: '#000000', rise: 0.3, peaks: 0, mist: 0.35, shore: 46 },
  { name: 'alpineLake',    grade: ['#e0fff4', 0.3],  far: '#6a9a58', hill: '#6a8aa0', water: 2, waterCol: '#7fd8c0', rise: 0, peaks: 1.1, mist: 0.15, shore: 46 },
  { name: 'oldTown',       grade: ['#fff0d8', 0.3],  far: '#7a9a58', hill: '#7a8a70', water: 0, waterCol: '#000000', rise: 1.3, peaks: 0, mist: 0.25, shore: 46 },
  { name: 'karsts',        grade: ['#e4fff0', 0.35], far: '#5a8a58', hill: '#4a7a5a', water: 2, waterCol: '#3f9a7c', rise: 0, peaks: 0, mist: 0.5, shore: 46 },
  { name: 'industrial',    grade: ['#d4e0f4', 0.4],  far: '#6a7a6a', hill: '#5a6a84', water: 0, waterCol: '#000000', rise: 0.2, peaks: 0, mist: 0.4, shore: 46 },
  { name: 'desert',        grade: ['#ffe8c4', 0.45], far: '#e0a048', hill: '#d08a48', water: 0, waterCol: '#000000', rise: 0.9, peaks: 0, mist: 0.1, shore: 46 },
  { name: 'coralCity',     grade: ['#ffdcc8', 0.45], far: '#9a9a68', hill: '#c8988a', water: 1, waterCol: '#2f86b0', rise: 0, peaks: 0, mist: 0.2, shore: 150 },
];

// ---------- builders ----------
// kit: { THREE, L, GROUND_Y, painted, G, MAT, addHouse, addTree, addLighthouse }

let M = null; // materials, made once
function mats(kit) {
  if (M) return M;
  const { THREE, painted } = kit;
  const p = (c, seed, o = {}) => painted(c, { size: 128, n: 260, spread: 12, len: 16, width: 5, seed }, { flatShading: true, ...o });
  const bands = (c1, c2, seed) => {
    // sandstone strata: horizontal bands
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    for (let y = 0; y < 128; y += 8) { x.fillStyle = (y / 8) % 2 ? c1 : c2; x.fillRect(0, y, 128, 8 + (y % 3)); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1, flatShading: true });
  };
  const glassTower = (c, seed) => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = c; x.fillRect(0, 0, 64, 128);
    for (let y = 0; y < 128; y += 6) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, y, 64, 2); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(i * 11, 0, 3, 128); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.35, emissive: '#ffd8a0', emissiveIntensity: 0, emissiveMap: t });
  };
  M = {
    island: p('#7c7298', 400),
    islandDark: p('#645c80', 401),
    mineral: p('#f4f2ec', 402),
    peach: ['#f4c4a0', '#f8d4b4', '#eeb898', '#f6dcc4'].map((c, i) => p(c, 410 + i)),
    terracotta: ['#c4603a', '#b8502e', '#d0704a'].map((c, i) => p(c, 420 + i)),
    glass: ['#9fd0d4', '#8cc0d8', '#b4dce0', '#7fb0cc'].map((c, i) => glassTower(c, 430 + i)),
    cliff: p('#3a4250', 440),
    sandstone: [bands('#d8885a', '#c8704a', 450), bands('#e09a6a', '#cc7a50', 451)],
    indigo: ['#4a64b4', '#5a78c4', '#3e58a4', '#6a88cc'].map((c, i) => p(c, 460 + i)),
    fort: p('#c89a6a', 470),
    basalt: p('#1e1c22', 480),
    jade: p('#4f9a7a', 490),
    templeWall: p('#e8dcc4', 491),
    templeRed: p('#a83a2a', 492),
    pine: p('#2a4a32', 493),
    white: p('#f6f4f0', 500, { roughness: 0.4 }),
    sage: p('#a8c0a0', 501),
    concrete: p('#a8a49c', 510),
    concreteDark: p('#7a766e', 511),
    cream: ['#f2e6cc', '#ece0c4', '#f6ecd8'].map((c, i) => p(c, 520 + i)),
    copper: p('#5fa08a', 523),
    gold: new THREE.MeshStandardMaterial({ color: '#d8a83a', metalness: 0.7, roughness: 0.35 }),
    karst: p('#2f6a3a', 530),
    karstRock: p('#8a948a', 531),
    slate: ['#5a6a88', '#6a7a98', '#4a5a78'].map((c, i) => p(c, 540 + i)),
    silo: p('#8a98b0', 543),
    sand: p('#d89a50', 550),
    arch: bands('#c8703a', '#b8602e', 551),
    coral: ['#f4a090', '#f8b8a4', '#f2c4b4', '#f6d0a8', '#e8a0a8'].map((c, i) => p(c, 560 + i)),
  };
  return M;
}

// a simple building: box body and a flat or pitched roof
function cube(kit, g, x, z, w, h, d, wall, roof = null, pitched = false) {
  const { THREE, G, GROUND_Y } = kit;
  const b = new THREE.Mesh(G.box, wall);
  b.scale.set(w, h, d);
  b.position.set(x, GROUND_Y, z);
  g.add(b);
  if (roof) {
    const r = new THREE.Mesh(pitched ? G.roof : G.box, roof);
    if (pitched) { r.scale.set(w * 1.1, Math.min(w, d) * 0.9, d * 1.1); r.position.set(x, GROUND_Y + h, z); }
    else { r.scale.set(w * 1.02, 0.4, d * 1.02); r.position.set(x, GROUND_Y + h, z); }
    g.add(r);
  }
  return b;
}

function cone(kit, g, x, z, r, h, mat, seg = 7) {
  const { THREE, GROUND_Y } = kit;
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 3), mat);
  m.position.set(x, GROUND_Y + h / 2 - 0.5, z);
  m.userData.own = true;
  g.add(m);
  return m;
}

const B = {
  volcanoIsland(kit, g, R, M) {
    const { L } = kit;
    // a lavender-grey volcano far out to sea, a lower islet beside it
    const v = cone(kit, g, L * 0.45, -330, 75, 30, M.island, 9);
    v.scale.set(1, 1, 0.4);
    cone(kit, g, L * 0.85, -300, 36, 9, M.islandDark, 8).scale.set(1, 1, 0.4);
  },
  saltFlats(kit, g, R, M) {
    const { L } = kit;
    // terraced white mineral mounds standing on the mint flats
    for (let i = 0; i < 26; i++) {
      const x = R() * L, z = -(60 + R() * 160), s = 0.6 + R() * 1.4;
      for (let t = 0; t < 4; t++) {
        const m = cube(kit, g, x, z, (9 - t * 2) * s, (1.4 + t * 0.4) * s, (6 - t * 1.3) * s, M.mineral);
        m.position.y += t * 1.4 * s;
      }
      if (R() < 0.4) cone(kit, g, x + 8 * s, z, 2.5 * s, 9 * s, M.mineral, 6);
    }
  },
  medTown(kit, g, R, M) {
    const { L, MAT } = kit;
    // a peach hillside town packed with terracotta roofs, a campanile
    for (let i = 0; i < 160; i++) {
      const x = R() * L, z = -(48 + R() * 110);
      const w = 4 + R() * 4, h = 3.5 + R() * 3.5;
      cube(kit, g, x, z, w, h, 4 + R() * 3, M.peach[i % 4], M.terracotta[i % 3], R() < 0.7);
    }
    const t = cube(kit, g, L * (0.3 + R() * 0.4), -110, 4, 22, 4, M.peach[0]);
    cone(kit, g, t.position.x, -110, 3.4, 5, M.terracotta[0], 4).position.y += 22;
    for (let i = 0; i < 20; i++) kit.addTree(g, R, R() * L, -(46 + R() * 100), 0.8, true, MAT.greens[0]);
  },
  metropolis(kit, g, R, M) {
    const { L } = kit;
    // pale teal and blue-glass towers dissolving into mist
    for (let i = 0; i < 60; i++) {
      const x = R() * L, z = -(150 + R() * 150);
      const w = 8 + R() * 10, h = 50 + R() * 110 * (R() < 0.3 ? 1.3 : 0.7);
      cube(kit, g, x, z, w, h, w * (0.7 + R() * 0.6), M.glass[i % 4]);
      if (R() < 0.25) cone(kit, g, x, z, 1.2, 30, M.glass[0], 6).position.y += h;
    }
  },
  oceanCliffs(kit, g, R, M) {
    // dark sea cliffs out on the headland and a white lighthouse
    const hx = 290;
    for (let i = 0; i < 14; i++) {
      const c = cube(kit, g, hx + (R() - 0.5) * 90, -(50 + R() * 40), 8 + R() * 14, 3 + R() * 7, 8 + R() * 10, M.cliff);
      c.position.y -= 3;
      c.rotation.y = R() * 3;
    }
    kit.addLighthouse(g, hx + 10, -84, true);
  },
  canyon(kit, g, R, M) {
    const { L } = kit;
    // monumental sandstone mesas and buttes
    for (let i = 0; i < 18; i++) {
      const x = R() * L, z = -(130 + R() * 200), w = 25 + R() * 50, h = 25 + R() * 45;
      cube(kit, g, x, z, w, h, w * (0.5 + R() * 0.6), M.sandstone[i % 2]).rotation.y = (R() - 0.5) * 0.6;
      if (R() < 0.5) cube(kit, g, x + w * 0.4, z + 5, w * 0.3, h * 0.6, w * 0.3, M.sandstone[(i + 1) % 2]);
    }
  },
  blueCity(kit, g, R, M) {
    const { L } = kit;
    // a hillside of indigo-blue flat-roofed houses under a sandstone fort
    for (let i = 0; i < 180; i++) {
      const x = R() * L, z = -(48 + R() * 100);
      const w = 4 + R() * 4, h = 3.5 + R() * 4;
      cube(kit, g, x, z, w, h, 4 + R() * 3, M.indigo[i % 4], M.indigo[(i + 2) % 4]);
    }
    const fx = L * (0.3 + R() * 0.4);
    cube(kit, g, fx, -150, 90, 18, 20, M.fort);
    for (let i = 0; i < 5; i++) cube(kit, g, fx - 40 + i * 20, -150, 7, 26, 7, M.fort);
  },
  basalt(kit, g, R, M) {
    const { L } = kit;
    // black basalt spires on the charcoal plain
    for (let i = 0; i < 24; i++) {
      const x = R() * L, z = -(55 + R() * 130);
      cone(kit, g, x, z, 5 + R() * 10, 14 + R() * 32, M.basalt, 5).rotation.y = R() * 3;
    }
  },
  templeCity(kit, g, R, M) {
    const { L, THREE, G, GROUND_Y } = kit;
    // halls and pagodas with jade-green tiles among forested hills
    for (let i = 0; i < 40; i++) {
      const x = R() * L, z = -(50 + R() * 110), w = 10 + R() * 12, h = 4 + R() * 3, d = 7 + R() * 5;
      cube(kit, g, x, z, w, h, d, i % 4 ? M.templeWall : M.templeRed);
      const r = new THREE.Mesh(G.hip, M.jade);
      r.scale.set((w + 4) / 1.06, 5 + R() * 3, (d + 4) / 1.06);
      r.position.set(x, GROUND_Y + h, z);
      g.add(r);
    }
    for (let i = 0; i < 5; i++) {
      let y = 0, w = 8;
      const x = R() * L, z = -(80 + R() * 70);
      for (let t = 0; t < 5; t++) {
        const b = cube(kit, g, x, z, w, 3.5, w, M.templeWall);
        b.position.y += y;
        const r = new THREE.Mesh(G.hip, M.jade);
        r.scale.set((w + 5) / 1.06, 3, (w + 5) / 1.06);
        r.position.set(x, GROUND_Y + y + 3.5, z);
        g.add(r);
        y += 5; w *= 0.82;
      }
    }
    for (let i = 0; i < 70; i++) kit.addTree(g, R, R() * L, -(60 + R() * 120), 1.2 + R() * 0.6, true, M.pine);
  },
  whiteCity(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // flowing white towers and sage-green domes
    for (let i = 0; i < 28; i++) {
      const x = R() * L, z = -(100 + R() * 170), h = 30 + R() * 80, r = 6 + R() * 8;
      const pts = [];
      const lean = R() * 0.6;
      for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector2(r * (1 - t * 0.6) * (1 + Math.sin(t * 3.1 + lean * 6) * 0.25), t * h)); }
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), M.white);
      m.userData.own = true;
      m.position.set(x, GROUND_Y, z);
      g.add(m);
    }
    for (let i = 0; i < 10; i++) {
      const x = R() * L, z = -(90 + R() * 150), r = 10 + R() * 14;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.sage);
      d.userData.own = true;
      d.position.set(x, GROUND_Y, z);
      g.add(d);
    }
  },
  alpineLake(kit, g, R, M) {
    const { L } = kit;
    // a monumental stepped concrete hotel on the far slope across the lake
    const hx = L * (0.3 + R() * 0.4), hz = -190;
    for (let t = 0; t < 9; t++) {
      const b = cube(kit, g, hx, hz - t * 6, 110 - t * 8, 5, 12, t % 2 ? M.concrete : M.concreteDark);
      b.position.y += t * 5;
    }
  },
  oldTown(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // cream façades, verdigris copper roofs, golden spires
    for (let i = 0; i < 170; i++) {
      const x = R() * L, z = -(48 + R() * 100);
      cube(kit, g, x, z, 4 + R() * 4, 5 + R() * 4, 5 + R() * 3, M.cream[i % 3], M.copper, true);
    }
    for (let i = 0; i < 4; i++) {
      const x = R() * L, z = -(90 + R() * 50);
      cube(kit, g, x, z, 5, 26, 5, M.cream[0]);
      const s = new THREE.Mesh(new THREE.ConeGeometry(2.6, 14, 8), M.gold);
      s.position.set(x, GROUND_Y + 33, z);
      g.add(s);
    }
  },
  karsts(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // tall emerald limestone towers standing in still jade water
    for (let i = 0; i < 26; i++) {
      const x = R() * L, z = -(120 + R() * 200), r = 9 + R() * 10, h = 28 + R() * 45;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, h, 9, 3), i % 3 ? M.karst : M.karstRock);
      body.userData.own = true;
      body.position.set(x, GROUND_Y + h / 2 - 1, z);
      const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 9, 6), M.karst);
      top.userData.own = true;
      top.scale.y = 0.8;
      top.position.set(x, GROUND_Y + h - 1, z);
      g.add(body, top);
    }
  },
  industrial(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // slate-blue silos, elevated bridges, geometric blocks
    for (let i = 0; i < 10; i++) {
      const x = R() * L, z = -(140 + R() * 130), n = 2 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const r = 7 + R() * 4, h = 40 + R() * 25;
        const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), M.silo);
        s.userData.own = true;
        s.position.set(x + k * r * 2.1, GROUND_Y + h / 2, z);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.slate[2]);
        cap.userData.own = true;
        cap.scale.y = 0.35;
        cap.position.set(x + k * r * 2.1, GROUND_Y + h, z);
        g.add(s, cap);
      }
    }
    for (let i = 0; i < 26; i++) cube(kit, g, R() * L, -(120 + R() * 160), 14 + R() * 26, 8 + R() * 24, 14 + R() * 20, M.slate[i % 3]);
    for (let i = 0; i < 3; i++) {
      const z = -(130 + R() * 100), y = 22 + R() * 10;
      const deck = cube(kit, g, L / 2, z, L, 2.5, 6, M.slate[1]);
      deck.position.y += y;
      for (let x = 10; x < L; x += 45) cube(kit, g, x, z, 3, y, 3, M.slate[2]);
    }
  },
  desert(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // sculptural rock arches on the dunes and a far observatory
    for (let i = 0; i < 6; i++) {
      const x = R() * L, z = -(120 + R() * 140), r = 14 + R() * 16;
      const a = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.28, 8, 18, Math.PI), M.arch);
      a.userData.own = true;
      a.position.set(x, GROUND_Y - 2, z);
      a.rotation.y = (R() - 0.5) * 0.8;
      g.add(a);
    }
    const ox = L * (0.2 + R() * 0.6), oz = -230;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 18), M.white);
    drum.userData.own = true;
    drum.position.set(ox, GROUND_Y + 5, oz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
    dome.userData.own = true;
    dome.position.set(ox, GROUND_Y + 10, oz);
    g.add(drum, dome);
  },
  coralCity(kit, g, R, M) {
    const { L } = kit;
    // stacked pastel houses with white balconies running down to the sea
    for (let i = 0; i < 200; i++) {
      const x = R() * L, z = -(48 + R() * 95);
      const back = (-z - 48) / 95;
      const w = 5 + R() * 4, h = 4 + R() * 4 + back * 10;
      cube(kit, g, x, z, w, h, 5 + R() * 3, M.coral[i % 5], M.white);
      if (R() < 0.5) cube(kit, g, x, z + 2.8, w * 0.8, 0.4, 1.2, M.white).position.y += h * 0.55;
    }
  },
};

export function buildPlace(name, kit, g, R) {
  B[name]?.(kit, g, R, mats(kit));
}

// night: let the glass towers glow
export function placesNight(night) {
  if (M) for (const m of M.glass) m.emissiveIntensity = night * 0.9;
}
