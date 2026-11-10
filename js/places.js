// The sixteen places the line passes, one behind each flower field: natural
// landscapes only, with at most a few small houses on the hills. Each has a
// palette (sky tint, haze, the ground beyond the flowers, the hills, water,
// mist) and a builder that sets out its scenery in the distance.
//
// water: 0 land, 1 sea, 2 lake.  rise: how steeply the land climbs behind the
// field.  rough: how much it rolls into hills and hollows.  ridge: how tall the
// bands of hills behind are.  peaks: how much the far mountain range shows.
// shore: how far back the shoreline sits.  pat: 1 salt crust, 2 dune ripples.

export const PLACES = [
  { name: 'volcanoIsland', grade: ['#dff4ff', 0.25], far: '#7aa860', hill: '#9c94b0', water: 1, waterCol: '#1fa6b0', rise: 0, peaks: 0, mist: 0.1, shore: 46, rough: 0, ridge: 1.0, pat: 0 },
  { name: 'saltFlats',     grade: ['#e8fff4', 0.25], far: '#c4e8d4', hill: '#7f9cc8', water: 0, waterCol: '#000000', rise: 0, peaks: 1, mist: 0.1, shore: 46, rough: 0, ridge: 0.4, pat: 1 },
  { name: 'peachHills',    grade: ['#ffd8d0', 0.45], far: '#b8a46a', hill: '#c09a88', water: 0, waterCol: '#000000', rise: 1.6, peaks: 0, mist: 0.35, shore: 46, rough: 1.2, ridge: 1.0, pat: 0 },
  { name: 'mistRidges',    grade: ['#cfeef0', 0.4],  far: '#5f8a70', hill: '#6f9ca4', water: 0, waterCol: '#000000', rise: 1.0, peaks: 0.6, mist: 0.6, shore: 46, rough: 0.8, ridge: 2.0, pat: 0 },
  { name: 'oceanCliffs',   grade: ['#d6e4ff', 0.3],  far: '#5f8a4a', hill: '#3a4a60', water: 1, waterCol: '#1a3f9a', rise: 0, peaks: 0, mist: 0.1, shore: 46, rough: 0, ridge: 1.0, pat: 0 },
  { name: 'canyon',        grade: ['#fff0dc', 0.45], far: '#d89a68', hill: '#c8704a', water: 0, waterCol: '#000000', rise: 0.6, peaks: 0.3, mist: 0.15, shore: 46, rough: 0.3, ridge: 1.2, pat: 0 },
  { name: 'blueHills',     grade: ['#e4e4ff', 0.35], far: '#4f6e62', hill: '#4a5a9a', water: 0, waterCol: '#000000', rise: 0.9, peaks: 0, mist: 0.25, shore: 46, rough: 1.0, ridge: 1.6, pat: 0 },
  { name: 'basalt',        grade: ['#ddd0ec', 0.45], far: '#36343a', hill: '#2e2c34', water: 0, waterCol: '#000000', rise: 0.8, peaks: 1.3, mist: 0.4, shore: 46, rough: 1.2, ridge: 1.4, pat: 0 },
  { name: 'mistForest',    grade: ['#e4f0e4', 0.35], far: '#4a6a40', hill: '#3f6a50', water: 0, waterCol: '#000000', rise: 1.4, peaks: 0, mist: 0.65, shore: 46, rough: 1.0, ridge: 1.5, pat: 0 },
  { name: 'chalkHills',    grade: ['#f4eeff', 0.4],  far: '#9ab088', hill: '#b4c4b0', water: 0, waterCol: '#000000', rise: 0.9, peaks: 0, mist: 0.35, shore: 46, rough: 1.3, ridge: 0.8, pat: 0 },
  { name: 'alpineLake',    grade: ['#e0fff4', 0.3],  far: '#6a9a58', hill: '#6a8aa0', water: 2, waterCol: '#7fd8c0', rise: 0, peaks: 1.1, mist: 0.15, shore: 46, rough: 0, ridge: 1.2, pat: 0 },
  { name: 'cottageHills',  grade: ['#fff0d8', 0.3],  far: '#7a9a58', hill: '#7a8a70', water: 0, waterCol: '#000000', rise: 1.3, peaks: 0, mist: 0.25, shore: 46, rough: 1.0, ridge: 1.0, pat: 0 },
  { name: 'karsts',        grade: ['#e4fff0', 0.35], far: '#5a8a58', hill: '#4a7a5a', water: 2, waterCol: '#3f9a7c', rise: 0, peaks: 0, mist: 0.5, shore: 46, rough: 0, ridge: 1.0, pat: 0 },
  { name: 'slateMoor',     grade: ['#d4e0f4', 0.4],  far: '#7a8a6a', hill: '#5a6a84', water: 0, waterCol: '#000000', rise: 0.8, peaks: 0, mist: 0.4, shore: 46, rough: 0.9, ridge: 1.2, pat: 0 },
  { name: 'desert',        grade: ['#ffe8c4', 0.45], far: '#e0a048', hill: '#d08a48', water: 0, waterCol: '#000000', rise: 0.9, peaks: 0, mist: 0.1, shore: 46, rough: 1.4, ridge: 0.6, pat: 2 },
  { name: 'pinkCliffs',    grade: ['#ffdcc8', 0.45], far: '#9a9a68', hill: '#c8988a', water: 1, waterCol: '#2f86b0', rise: 0, peaks: 0, mist: 0.2, shore: 46, rough: 0, ridge: 1.0, pat: 0 },
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
  M = {
    island: p('#7c7298', 400),
    islandDark: p('#645c80', 401),
    peach: ['#f4c4a0', '#f8d4b4', '#eeb898', '#f6dcc4'].map((c, i) => p(c, 410 + i)),
    terracotta: ['#c4603a', '#b8502e', '#d0704a'].map((c, i) => p(c, 420 + i)),
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
  saltFlats() {
    // nothing stands on the flats: the crust and shallow pools are painted on
    // the ground, and the blue mountains rise beyond
  },
  peachHills(kit, g, R, M) {
    const { L } = kit;
    // warm peach hills with lines of cypress and a few farmhouses
    for (let i = 0; i < 10; i++) cube(kit, g, R() * L, -(60 + R() * 90), 5 + R() * 3, 3.5 + R() * 1.5, 5, M.peach[i % 4], M.terracotta[i % 3], true);
    for (let r = 0; r < 6; r++) {
      const x0 = R() * L, z = -(55 + R() * 100);
      for (let i = 0; i < 6 + R() * 6; i++) kit.addTree(g, R, x0 + i * 4, z, 1, true, M.pine);
    }
    for (let i = 0; i < 30; i++) kit.addTree(g, R, R() * L, -(50 + R() * 110), 0.8 + R() * 0.3);
  },
  mistRidges(kit, g, R, M) {
    const { L } = kit;
    // pale teal ridges dissolving into mist, dark firs on the near slopes
    for (let i = 0; i < 90; i++) kit.addTree(g, R, R() * L, -(55 + R() * 130), 1.1 + R() * 0.6, true, M.pine);
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
  blueHills(kit, g, R, M) {
    const { L } = kit;
    // indigo-blue hills, a few whitewashed houses spotted across them
    for (let i = 0; i < 7; i++) cube(kit, g, R() * L, -(60 + R() * 90), 4 + R() * 2, 3 + R(), 4, M.white, M.indigo[i % 4], true);
    for (let i = 0; i < 40; i++) kit.addTree(g, R, R() * L, -(50 + R() * 110), 0.9 + R() * 0.4);
  },
  basalt(kit, g, R, M) {
    const { L } = kit;
    // black basalt spires on the charcoal plain
    for (let i = 0; i < 24; i++) {
      const x = R() * L, z = -(55 + R() * 130);
      cone(kit, g, x, z, 5 + R() * 10, 14 + R() * 32, M.basalt, 5).rotation.y = R() * 3;
    }
  },
  mistForest(kit, g, R, M) {
    const { L } = kit;
    // forested hills in mist, two small wooden cabins at the edge of the trees
    for (let i = 0; i < 2; i++) cube(kit, g, R() * L, -(55 + R() * 20), 5, 3, 4, M.templeWall, M.jade, true);
    for (let i = 0; i < 140; i++) kit.addTree(g, R, R() * L, -(55 + R() * 130), 1.1 + R() * 0.7, R() < 0.7, M.pine);
  },
  chalkHills(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // soft sage-green downs broken by white chalk outcrops
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 3 ? M.sage : M.white);
      m.userData.own = true;
      m.scale.set(20 + R() * 40, 4 + R() * 9, 10 + R() * 14);
      m.position.set(R() * L, GROUND_Y - 1, -(70 + R() * 140));
      g.add(m);
    }
    for (let i = 0; i < 16; i++) cone(kit, g, R() * L, -(60 + R() * 120), 3 + R() * 5, 5 + R() * 9, M.white, 6);
    for (let i = 0; i < 20; i++) kit.addTree(g, R, R() * L, -(50 + R() * 100), 0.9 + R() * 0.4);
  },
  alpineLake(kit, g, R, M) {
    // a couple of chalets and firs out on the headland; the peaks across the water
    const hx = 290;
    for (let i = 0; i < 3; i++) cube(kit, g, hx + (R() - 0.5) * 60, -(56 + R() * 25), 5, 3.2, 4, M.concrete, M.templeRed, true);
    for (let i = 0; i < 18; i++) kit.addTree(g, R, hx + (R() - 0.5) * 80, -(50 + R() * 36), 1 + R() * 0.5, true, M.pine);
  },
  cottageHills(kit, g, R, M) {
    const { L } = kit;
    // green hills, orchards, and cream cottages with copper roofs here and there
    for (let i = 0; i < 12; i++) cube(kit, g, R() * L, -(55 + R() * 100), 5 + R() * 2, 3.4 + R(), 4.5, M.cream[i % 3], M.copper, true);
    for (let i = 0; i < 60; i++) kit.addTree(g, R, R() * L, -(50 + R() * 110), 0.8 + R() * 0.3);
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
  slateMoor(kit, g, R, M) {
    const { L } = kit;
    // slate-blue moorland with stacked stone tors and a few wind-bent trees
    for (let i = 0; i < 22; i++) {
      const x = R() * L, z = -(60 + R() * 150), s = 1 + R() * 2;
      for (let t = 0; t < 3; t++) {
        const b = cube(kit, g, x + (R() - 0.5) * 2 * s, z, (5 - t) * s, 1.6 * s, (4 - t) * s, M.slate[(i + t) % 3]);
        b.position.y += t * 1.5 * s;
        b.rotation.y = R() * 3;
      }
    }
    for (let i = 0; i < 14; i++) kit.addTree(g, R, R() * L, -(55 + R() * 120), 0.8 + R() * 0.3);
  },
  desert(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // sculptural rock arches standing on the dunes
    for (let i = 0; i < 6; i++) {
      const x = R() * L, z = -(120 + R() * 140), r = 14 + R() * 16;
      const a = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.28, 8, 18, Math.PI), M.arch);
      a.userData.own = true;
      a.position.set(x, GROUND_Y - 2, z);
      a.rotation.y = (R() - 0.5) * 0.8;
      g.add(a);
    }
  },
  pinkCliffs(kit, g, R, M) {
    const { L, THREE, GROUND_Y } = kit;
    // weathered coral-pink sandstone bluffs along the shore, white cottages above
    const rock = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(rock, M.coral[i % 5]);
      m.scale.set(5 + R() * 9, 1.5 + R() * 3.5, 3 + R() * 3);
      m.rotation.set(R() * 0.4, R() * 3, R() * 0.4);
      m.position.set(R() * L, GROUND_Y - 0.6, -(46 + R() * 5));
      g.add(m);
    }
    const hx = 290;
    for (let i = 0; i < 4; i++) cube(kit, g, hx + (R() - 0.5) * 60, -(56 + R() * 25), 5, 3.2, 4, M.white, M.coral[0], true);
  },
};

export function buildPlace(name, kit, g, R) {
  B[name]?.(kit, g, R, mats(kit));
}
