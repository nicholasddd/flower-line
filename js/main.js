import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FLOWERS, COLS, ROWS, rng, buildAtlas, brushCanvas, paperCanvas, grainCanvas, signCanvas, buildPages, cellRect } from './paint.js';
import { computeEnv, rollWeather, WEATHERS } from './env.js';
import * as UI from './ui.js';
import { PLACES, buildPlace } from './places.js';

await Promise.all([
  document.fonts.load('64px "Pinyon Script"'),
  document.fonts.load('36px "Caveat"'),
  document.fonts.load('20px "Cormorant Garamond"'),
]).catch(() => {});

// ---------- constants ----------
const CAM_POS = new THREE.Vector3(0, 1.32, 1.3);
const CAM_TARGET = new THREE.Vector3(0, 1.38, -1);
const WALL_Z = -1.0;
const WIN = { cx: 0, cy: 1.5, w: 1.9, h: 1.1, r: 0.24 };
const GROUND_Y = -0.9; // the fields lie below the embankment the line runs on
// Each stretch of line is one long flower field; everything else lies beyond
// it in the distance. The same tables drive the shaders and the scenery.
const L = 440, GAP = 3.5, PERIOD = L * 16, WRAP = PERIOD * 16;
const FIELD_END = Array(16).fill(L - GAP - 2); // fields run end to end, a path between each
const COUNTRY = [1, 0, 2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 0, 2, 1, 0]; // 0 meadow, 1 rice paddy, 2 ploughed
// Each field has a place behind it, chosen to suit the flower and its
// colour (see places.js). These tables feed the shaders.
const WATER = PLACES.map((p) => p.water);
const GRADE = PLACES.map((p) => new THREE.Color(1, 1, 1).lerp(new THREE.Color(p.grade[0]), p.grade[1]));
const MIST = PLACES.map((p) => p.mist);
const RISE = PLACES.map((p) => p.rise), ROUGH = PLACES.map((p) => p.rough);
const linear = (c) => new THREE.Color(c);
const LAMP = { sp: 32, off: 12, z: -5.5 };
const POLE = { sp: 48, off: 30, z: -1.9 };
const SPEED = 10;
const TOP = 0.78; // table surface height

const params = new URLSearchParams(location.search);
const state = {
  hour: params.has('hour') ? parseFloat(params.get('hour')) : null,
  weather: WEATHERS.includes(params.get('weather')) ? params.get('weather') : rollWeather(),
  dev: params.has('dev'),
};
const clockHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

// ---------- renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.fog = new THREE.Fog(0xffffff, 40, 400);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.03, 1400);
camera.position.copy(CAM_POS);
camera.lookAt(CAM_TARGET);
const camRest = new THREE.PerspectiveCamera(); // a camera, so lookAt points its -z forward
camRest.position.copy(CAM_POS);
camRest.lookAt(CAM_TARGET);
camRest.updateMatrixWorld();

window.__three = { renderer, scene, camera, state };

// ---------- painted textures ----------
const tex = (c, { repeat = [1, 1], srgb = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
};
const painted = (base, brush = {}, mat = {}, repeat = [1, 1]) =>
  new THREE.MeshStandardMaterial({ map: tex(brushCanvas(base, brush), { repeat }), roughness: 0.9, metalness: 0, ...mat });

const atlasCanvas = buildAtlas();
const atlasTex = tex(atlasCanvas);
atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping;
const pages = buildPages(atlasCanvas);

// ---------- shared uniforms ----------
const U = {
  uTravel: { value: 0 }, uTime: { value: 0 },
  uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uFogCol: { value: new THREE.Color() }, uFogNear: { value: 40 }, uFogFar: { value: 400 },
  uNight: { value: 0 }, uWind: { value: 0.2 }, uRain: { value: 0 }, uCloudShade: { value: 0.1 },
  uLampCol: { value: new THREE.Color('#ffb066') },
  uLampSp: { value: LAMP.sp }, uLampOff: { value: LAMP.off }, uLampZ: { value: LAMP.z },
  uL: { value: L }, uGap: { value: GAP }, uGroundY: { value: GROUND_Y },
  uFEnd: { value: FIELD_END }, uCountry: { value: COUNTRY }, uWater: { value: WATER },
  uFarCol: { value: PLACES.map((p) => linear(p.far)) }, uHillCol: { value: PLACES.map((p) => linear(p.hill)) },
  uWaterCol: { value: PLACES.map((p) => linear(p.waterCol)) }, uRiseK: { value: PLACES.map((p) => p.rise) },
  uPeakK: { value: PLACES.map((p) => p.peaks) }, uShore: { value: PLACES.map((p) => p.shore) },
  uRough: { value: PLACES.map((p) => p.rough) }, uRidge: { value: PLACES.map((p) => p.ridge) }, uPat: { value: PLACES.map((p) => p.pat) },
};

const GLSL_COMMON = /* glsl */`
uniform float uTravel, uTime, uNight, uFogNear, uFogFar, uLampSp, uLampOff, uLampZ, uL, uGap, uGroundY, uWind, uRain;
uniform vec3 uSunCol, uAmb, uSunDir, uFogCol, uLampCol;
uniform float uFEnd[16], uCountry[16], uCloudShade, uWater[16], uRiseK[16], uPeakK[16], uShore[16], uRough[16], uRidge[16], uPat[16];
uniform vec3 uFarCol[16], uHillCol[16], uWaterCol[16];
// a per-place value at this point of the line, eased across the joins
float segF(float a[16], float tx, float wid){
  float fi = floor(tx/uL), local = tx - fi*uL;
  float p = a[int(mod(fi - 1., 16.))], c = a[int(mod(fi, 16.))], n = a[int(mod(fi + 1., 16.))];
  return mix(mix(p, c, smoothstep(-wid, wid, local)), n, smoothstep(uL - wid, uL + wid, local));
}
vec3 segV3(vec3 a[16], float tx, float wid){
  float fi = floor(tx/uL), local = tx - fi*uL;
  vec3 p = a[int(mod(fi - 1., 16.))], c = a[int(mod(fi, 16.))], n = a[int(mod(fi + 1., 16.))];
  return mix(mix(p, c, smoothstep(-wid, wid, local)), n, smoothstep(uL - wid, uL + wid, local));
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<5;i++){ v += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return v; }
// how much of this stretch of line has water of a kind (1 sea, 2 lake),
// blended across the joins between stretches
float waterW(float tx, float kind, float wid){
  float fi = floor(tx/uL), local = tx - fi*uL;
  float p = step(abs(uWater[int(mod(fi - 1., 16.))] - kind), .5);
  float a = step(abs(uWater[int(mod(fi, 16.))] - kind), .5);
  float b = step(abs(uWater[int(mod(fi + 1., 16.))] - kind), .5);
  return mix(mix(p, a, smoothstep(-wid, wid, local)), b, smoothstep(uL - wid, uL + wid, local));
}
// the shoreline: just past the flowers, pushed out round a headland mid-stretch
float shoreZ(float tx){
  float local = tx - floor(tx/uL)*uL;
  float head = smoothstep(230., 270., local) * smoothstep(350., 310., local);
  return -segF(uShore, tx, 40.) - 5.*fbm(vec2(tx*.03, 7.)) - 44.*head;
}
// Beyond the flowers the land rises into hills, so farms, lakes and villages
// show over the field. Flat where there is water. Mirrored by riseAt() in JS.
float riseAt(float tx, float z){
  float lake = waterW(tx, 2., 60.), sea = waterW(tx, 1., 60.);
  float R = max(2., 7. + 5.*sin(tx*.0047) + 3.*sin(tx*.013 + 1.3));
  // rolling hills and hollows, from a few crossed waves (rolls() in JS)
  float rolls = sin(tx*.021 + z*.013)*.5 + sin(tx*.047 - z*.031 + 1.7)*.3 + sin(tx*.009 + z*.027 + 4.1)*.6 + sin(tx*.083 + z*.06 + 2.3)*.15;
  float land = R * segF(uRiseK, tx, 80.) * smoothstep(-44., -154., z)
             + segF(uRough, tx, 80.) * smoothstep(-44., -95., z) * (rolls + 1.6) * 3.;
  return land * (1. - max(sea, lake));
}
vec3 lampLight(float tx, float z, float y){
  float lx = floor((tx - uLampOff)/uLampSp + .5)*uLampSp + uLampOff;
  float dx = tx - lx, dz = z - uLampZ, dy = y - (uGroundY + 3.0);
  return uLampCol * uNight * 6. / (1. + (dx*dx + dz*dz + dy*dy) * .9);
}
vec3 fogIt(vec3 c, vec3 w){ float d = length(w - cameraPosition); return mix(c, uFogCol, smoothstep(uFogNear, uFogFar, d)); }
`;

// ---------- sky ----------
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { ...U, uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3() }, uCloud: { value: 0.2 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_COMMON + /* glsl */`
      uniform vec3 uTop, uHor, uMoonDir; uniform float uCloud;
      varying vec3 vW;
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        float e = d.y;
        vec3 col = mix(uHor, uTop, pow(clamp(e*1.8 + .02, 0., 1.), .65));
        float sd = max(dot(d, uSunDir), 0.);
        float sunVis = (1. - uNight) * (1. - uCloud*.85);
        col += uSunCol * (smoothstep(.9992, .9996, sd)*6. + pow(sd, 10.)*.25 + pow(sd, 3.)*.08) * sunVis;
        float md = dot(d, uMoonDir);
        col = mix(col, vec3(1., .96, .86)*1.6, smoothstep(.99955, .9997, md) * uNight * (1. - uCloud*.7));
        col += vec3(.5,.55,.8) * pow(max(md,0.), 400.) * .2 * uNight;
        vec2 sp = d.xz / (d.y + .25) * 140.;
        vec2 id = floor(sp);
        float h = hash12(id);
        float star = step(.986, h) * smoothstep(.35, 0., length(fract(sp) - .5)) * (.6 + .4*sin(uTime*2. + h*80.));
        col += star * uNight * (1. - uCloud) * smoothstep(.02, .15, e) * 1.6;
        // painterly clouds on a high plane
        vec2 cuv = d.xz / (d.y + .06);
        cuv.x += uTime*.006 + uTravel*.00025;
        float n = fbm(cuv*.9) * .7 + fbm(cuv*3.1)*.3;
        float cov = smoothstep(1. - uCloud - .12, 1. - uCloud + .22, n) * smoothstep(-.01, .06, e);
        float lit = clamp(dot(normalize(vec3(cuv.x, 1., cuv.y)), uSunDir)*.5 + .5, 0., 1.);
        vec3 cloudCol = mix(uHor*.85, mix(vec3(1.), uSunCol*.6 + .4, .5), lit*(1.-uNight)) ;
        cloudCol = mix(cloudCol, uHor*.55 + vec3(.04,.05,.09), uNight*.8);
        cloudCol *= 1. - uRain*.35;
        col = mix(col, cloudCol, cov*.95);
        col = mix(col, uFogCol, smoothstep(.12, -.02, e) * (uFogNear < 10. ? .9 : .35));
        gl_FragColor = vec4(col, 1.);
      }`,
  })
);
sky.renderOrder = -10;
scene.add(sky);

// ---------- distant hills ----------
function hillLayer(z, base, amp, freq, shade, haze, bumpy, seed, peak = 0, seaKeep = 0, overLake = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 420),
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: { ...U, uBase: { value: base }, uAmp: { value: amp }, uFreq: { value: freq }, uShade: { value: shade }, uHaze: { value: haze }, uBumpy: { value: bumpy }, uSeed: { value: seed }, uPeak: { value: peak }, uSeaKeep: { value: seaKeep }, uOverLake: { value: overLake } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_COMMON + /* glsl */`
        uniform float uBase, uAmp, uFreq, uHaze, uBumpy, uSeed, uPeak, uSeaKeep, uOverLake, uShade;
        varying vec3 vW;
        void main(){
          float tx = vW.x + uTravel;
          float h = uBase + uAmp * (fbm(vec2(tx*uFreq + uSeed, uSeed)) - .25);
          h += uBumpy * (abs(sin(tx*.35 + vnoise(vec2(tx*.08, uSeed))*6.)) * 1.6 + vnoise(vec2(tx*.6, 3.))*1.4);
          // mountain ranges rise out of the plain for a while, then fall away
          float range = 0.;
          if (uPeak > 0.) {
            // broad massifs with rounded shoulders: warped, low-frequency
            // noise rather than sharp ridges
            range = smoothstep(.3, .65, fbm(vec2(tx*.0005 + uSeed*3., 1.7)));
            float warp = fbm(vec2(tx*.0012, 9.));
            float m = fbm(vec2(tx*uFreq*1.1 + warp*2.5 + uSeed, 5.));
            m = smoothstep(.25, .85, m);
            float pk = uPeak * segF(uPeakK, tx, 200.);
            h += pk * range * (m*m*(3. - 2.*m)) + pk*.08*range*vnoise(vec2(tx*.03, 2.));
          }
          // over the sea the land falls away, leaving only distant headlands
          h = uBase + (h - uBase) * segF(uRidge, tx, 160.);
          float sw = waterW(tx, 1., 160.);
          h = mix(h, uBase - 60. + (h - uBase)*uSeaKeep, sw);
          h = mix(h, uBase - 60., waterW(tx, 2., 160.)*(1. - uOverLake));
          if (vW.y > h) discard;
          float rim = smoothstep(h - 3., h, vW.y);
          float n = vnoise(vec2(tx*uFreq*25., vW.y*.35));
          vec3 c = segV3(uHillCol, tx, 160.) * uShade * (uAmb + uSunCol*.55) * (.82 + .22*rim + .16*n);
          if (uPeak > 0.) {
            // rocky streaks, lit faces, then snow above the line
            float streak = vnoise(vec2(tx*.05, vW.y*.03));
            c *= .9 + .2*streak;
            // snow only near the summits, patchy, bluish in the haze
            float snowLine = h - 10. - 8.*vnoise(vec2(tx*.02, 4.));
            float snow = smoothstep(snowLine, snowLine + 6., vW.y + (streak - .5)*12.)
              * smoothstep(uBase + uPeak*.5, uBase + uPeak*.65, h) * (1. - sw);
            c = mix(c, vec3(.86,.9,1.)*(uAmb*.8 + uSunCol*.45), snow*.8);
          }
          c += uLampCol * uNight * .04 * step(.985, hash12(floor(vec2(tx*.4, vW.y*.8)))) * step(vW.y, h - 1.);
          c = mix(c, uFogCol, clamp(uHaze*.55 + (uFogNear < 10. ? .5 : 0.), 0., 1.));
          gl_FragColor = vec4(c, 1.);
        }`,
    })
  );
  m.position.set(0, GROUND_Y + 200, z);
  scene.add(m);
  return m;
}
hillLayer(-640, GROUND_Y + 10, 30, 0.002, 1.2, 0.4, 0, 5.3, 130, 0.35, 1);
hillLayer(-560, GROUND_Y + 40, 70, 0.0025, 1.05, 0.55, 0, 3.1, 0, 0, 1);
hillLayer(-330, GROUND_Y + 14, 36, 0.005, 0.8, 0.35, 0, 8.7);
hillLayer(-150, GROUND_Y + 12, 6, 0.02, 0.6, 0.18, 1, 1.3);

// ---------- ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1600, 600, 200, 75).rotateX(-Math.PI / 2).translate(0, GROUND_Y, -300 - 1.25),
  new THREE.ShaderMaterial({
    fog: false,
    uniforms: { ...U, uTints: { value: FLOWERS.map((f) => new THREE.Color(f.tint)) }, uRows: { value: FLOWERS.map((f) => f.rows) } },
    vertexShader: GLSL_COMMON + `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); w.y += riseAt(w.x + uTravel, w.z); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_COMMON + /* glsl */`
      uniform vec3 uTints[16]; uniform float uRows[16];
      varying vec3 vW;
      void main(){
        float tx = vW.x + uTravel, z = vW.z;
        float fi = floor(tx/uL); int t = int(mod(fi, 16.)); float local = tx - fi*uL;
        float n1 = fbm(vec2(tx*.16, z*.45)), n2 = vnoise(vec2(tx*1.1, z*5.));
        vec3 col = mix(vec3(.08,.15,.045), vec3(.19,.26,.08), n1) * (.8 + .4*n2);
        float bed = smoothstep(-1.3, -2.2, z) * smoothstep(-50., -39., z);
        float fEnd = uFEnd[t]; int ck = int(uCountry[t]);
        float band = smoothstep(-15., -13., z); // flowers by the line, all the way along
        float inField = mix(smoothstep(uGap, uGap + 3., local) * smoothstep(fEnd, fEnd - 3., local), smoothstep(uGap, uGap + 3., local), band);
        float onPath = step(local, uGap) + step(fEnd + .8, local) * step(local, fEnd + .8 + uGap) * (1. - band);
        float country = step(fEnd + .8 + uGap, local) * (1. - band);
        vec3 soil = vec3(.15,.1,.06) * (.8 + .4*n2);
        vec3 bedCol = mix(vec3(.07,.13,.04), uTints[t]*.6, smoothstep(-5., -32., z)*.85);
        if (uRows[t] > .5 && fract(tx/1.5) < .28) bedCol = mix(soil, bedCol, smoothstep(-25., -45., z));
        col = mix(col, bedCol, bed*inField);
        col = mix(col, vec3(.32,.26,.17)*(.8+.4*n2), bed*onPath);
        vec3 cc;
        if (ck == 1) {
          // rice paddies: bright young rice in plots split by low earth bunds,
          // some still flooded and catching the sky
          cc = vec3(.26,.42,.12) * (.85 + .3*n1);
          vec2 plot = vec2(tx/11., z/9.);
          if (hash12(floor(plot) + fi) < .35) cc = mix(cc, vec3(.2,.32,.26) + uFogCol*.12, .7 - .2*n2);
          float bund = max(step(fract(plot.x), .06), step(fract(plot.y), .08));
          cc = mix(cc, vec3(.2,.17,.09)*(.8+.4*n2), bund*.8);
        } else if (ck == 2) {
          // ploughed earth with a stubble edge
          cc = vec3(.3,.22,.12) * (.75 + .5*n1) * (.8 + .25*sin(z*4.5 + n2));
          cc = mix(cc, vec3(.42,.36,.18)*(.8+.4*n2), smoothstep(-6., -2.5, z));
        } else {
          // rough meadow with a sprinkle of wild flowers
          cc = mix(vec3(.12,.22,.06), vec3(.26,.32,.1), n1) * (.8 + .4*n2);
          float sp = hash12(floor(vec2(tx*4., z*7.)));
          cc = mix(cc, sp > .5 ? vec3(.9,.85,.6) : vec3(.8,.5,.6), step(.985, sp) * smoothstep(-25., -6., z));
        }
        col = mix(col, cc, bed*country);
        // beyond the flowers the ground takes the place's own colour
        vec3 farC = segV3(uFarCol, tx, 60.) * (.82 + .3*n1) * (.92 + .16*n2);
        float pat = uPat[t];
        if (pat > .5 && pat < 1.5) {
          // salt crust: pale polygons with darker seams, and shallow pools of sky
          vec2 q = vec2(tx*.09, z*.22) + .4*vec2(vnoise(vec2(tx*.03, z*.05)), vnoise(vec2(z*.04, tx*.02)));
          vec2 f = abs(fract(q) - .5);
          float seam = smoothstep(.44, .5, max(f.x, f.y));
          farC = mix(vec3(.93,.95,.9)*(.92 + .1*n2), vec3(.7,.78,.72), seam*.7);
          float pool = smoothstep(.62, .68, fbm(vec2(tx*.012, z*.03)));
          farC = mix(farC, uFogCol*1.05, pool*.8);
        } else if (pat > 1.5) {
          // wind ripples across the dunes
          farC *= .9 + .14*sin(tx*.9 + z*1.7 + 3.*vnoise(vec2(tx*.05, z*.1)));
        }
        col = mix(col, farC, smoothstep(-40., -50., z));
        // sea or a wide lake beyond the shore
        float sea = waterW(tx, 1., 40.), lake = waterW(tx, 2., 40.);
        float zs = shoreZ(tx);
        float wet = 0.;
        vec3 wcol = vec3(0.);
        if (sea > 0.) {
          float s = smoothstep(zs + .5, zs - .5, z);
          col = mix(col, vec3(.55,.5,.4)*(.8+.4*n2), sea*smoothstep(zs + 4., zs + 1., z)*(1. - s));
          wet = sea*s;
          vec3 wc = segV3(uWaterCol, tx, 60.);
          wcol = mix(wc*.75, wc*1.15 + .03, smoothstep(-60., -300., z));
        }
        if (lake > 0.) {
          float s = smoothstep(zs + .5, zs - .5, z);
          col = mix(col, vec3(.3,.36,.16)*(.8+.4*n2), lake*smoothstep(zs + 4., zs + 1., z)*(1. - s)); // reedy bank
          wet = max(wet, lake*s);
          vec3 lc = segV3(uWaterCol, tx, 60.);
          wcol = mix(wcol, mix(lc*.8, lc*1.1 + .03, smoothstep(-60., -300., z)), lake);
        }
        if (wet > 0.) {
          // ripples and glints of sky
          float rip = vnoise(vec2(tx*.6, z*3.)) * vnoise(vec2(tx*.15 + uTime*.3, z*.8));
          wcol = mix(wcol, uFogCol, .08 + .12*rip);
          wcol += uSunCol * pow(rip, 3.) * .5 * (1. - uNight);
          col = mix(col, wcol, wet);
        }
        col *= 1. - uRain*.25;
        vec3 nrm = normalize(cross(dFdx(vW), dFdy(vW)));
        if (nrm.y < 0.) nrm = -nrm;
        float slope = mix(max(uSunDir.y, 0.)*.9 + .1, max(dot(nrm, uSunDir), 0.)*.72 + .05, smoothstep(-42., -60., z)); // gentler on the far land so its colour isn't bleached
        vec3 c = col * (uAmb*(.75 + .25*nrm.y) + uSunCol*slope);
        if (wet > 0.) c = mix(c, wcol * (uAmb*.6 + uSunCol*.4) + wcol*.15, wet);
        c += col * lampLight(tx, z, uGroundY);
        gl_FragColor = vec4(fogIt(c, vW), 1.);
      }`,
  })
);
scene.add(ground);

// ---------- flowers: one wrapped instance cloud, typed by track position ----------
function buildFlowerField() {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const aBase = [], aRand = [], aKind = [];
  const R = rng(7);
  for (let z = -1.75; z > -40;) {
    const d = CAM_POS.z - z;
    const W = 2 * (0.5 * d + 2.6);
    const dz = 0.05 + -z * 0.01;
    const densF = z > -6 ? 24 : z > -18 ? 16 : 10;
    const nf = Math.round(W * dz * densF), ng = Math.round(W * dz * densF * 0.55);
    for (let i = 0; i < nf + ng; i++) {
      aBase.push(-W / 2 + R() * W, z - R() * dz, W);
      aRand.push(R(), R(), R(), R());
      aKind.push(i < nf ? 0 : 1);
    }
    z -= dz;
  }
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(new Float32Array(aBase), 3));
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(new Float32Array(aRand), 4));
  geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(aKind), 1));
  geo.instanceCount = aKind.length;

  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      ...U, uAtlas: { value: atlasTex },
      uHeights: { value: FLOWERS.map((f) => f.height) },
      uRows: { value: FLOWERS.map((f) => f.rows) },
      uHueVar: { value: FLOWERS.map((f) => f.hueVar) },
    },
    vertexShader: GLSL_COMMON + /* glsl */`
      attribute vec3 aBase; attribute vec4 aRand; attribute float aKind;
      uniform float uHeights[16]; uniform float uRows[16]; uniform float uHueVar[16];
      varying vec2 vUv; varying vec3 vW; varying float vCell; varying float vHue; varying float vTop; varying vec3 vTone;
      void main(){
        float W = aBase.z;
        float x = mod(aBase.x - uTravel + W*.5, W) - W*.5;
        float tx = x + uTravel;
        float fi = floor(tx/uL); int t = int(mod(fi, 16.)); float local = tx - fi*uL;
        float fEnd = uFEnd[t]; int ck = int(uCountry[t]);
        bool band = -aBase.y < 14.; // flowers by the line, all the way along
        bool country = local > fEnd + .8 + uGap && !band;
        bool isF = aKind < .5 && !country;
        float far = max(0., -aBase.y - 6.) / 40.;
        float h = isF ? uHeights[t]*(.9 + .2*aRand.y) : (.28 + .32*aRand.y) * clamp(uHeights[t] / .6, .35, 1.); // grass stays below short flowers
        h *= 1. + far*(isF ? .3 : 1.3);
        float edge = band ? local - uGap : min(local - uGap, fEnd - local);
        if (isF && (edge < 0. || fract(aRand.w*7.3)*6. > edge)) h = 0.;
        if (country) {
          if (ck == 1) {
            // rice: short even tufts; nothing on the bunds or in flooded plots (matches the ground)
            vec2 plot = vec2(tx/11., aBase.y/9.);
            bool wet = hash12(floor(plot) + fi) < .35;
            bool bund = fract(plot.x) < .06 || fract(plot.y) < .08;
            h = (wet || bund) ? 0. : .32 + .12*aRand.y;
            h *= 1. + far*1.3;
          } else if (ck == 2) h *= aRand.z < .2 ? .5 : 0.;
          else h *= 1.5;
        }
        if (isF && uRows[t] > .5 && fract(tx/1.5) < .16) h = 0.;
        if (!isF && !country && edge < 0. && -aBase.y < 40.) h *= .5;
        vec3 p = position;
        float sway = sin(uTime*(1.4 + aRand.z) + tx*.35 + aRand.z*6.) * (.03 + uWind*.07) + uWind*.04;
        p.x = p.x*h + sway*h*p.y*p.y;
        p.y *= h;
        vec3 wp = vec3(x + p.x, uGroundY + p.y - .04, aBase.y);
        vUv = uv; if (aRand.w > .5) vUv.x = 1. - vUv.x;
        float variant = aRand.x > .5 ? 1. : 0.;
        vCell = isF ? float(t)*2. + variant : 32. + floor(aRand.x*7.99);
        float rowHash = hash12(vec2(floor(tx/1.5), 3.));
        vHue = isF ? (uRows[t] > .5 ? rowHash - .5 : aRand.y - .5) * uHueVar[t] * 2. : 0.;
        // Shades: broad drifts where the colour runs deeper or paler, each
        // plant a little different, and shorter plants sitting in their
        // neighbours' shade.
        float drift = fbm(vec2(tx*.045, aBase.y*.11) + float(t)*3.1);
        float hRel = isF ? h / (uHeights[t]*(1. + far*.3)) : 1.;
        vTone = vec3(
          (.9 + .2*aRand.z) * (.93 + .14*drift) * mix(.7, 1., smoothstep(.92, 1.08, hRel)),
          (.92 + .16*fract(aRand.z*13.7)),
          0.);
        if (country && ck == 1) vTone.x *= 1.5; // young rice is a fresh, light green
        vW = wp; vTop = uv.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
      }`,
    fragmentShader: GLSL_COMMON + /* glsl */`
      uniform sampler2D uAtlas;
      varying vec2 vUv; varying vec3 vW; varying float vCell; varying float vHue; varying float vTop; varying vec3 vTone;
      vec3 hueShift(vec3 c, float a){
        const vec3 k = vec3(.57735);
        float ca = cos(a), sa = sin(a);
        return c*ca + cross(k, c)*sa + k*dot(k, c)*(1. - ca);
      }
      void main(){
        float cell = floor(vCell + .5);
        float col = mod(cell, ${COLS}.), row = floor(cell / ${COLS}.);
        vec2 auv = vec2((col + vUv.x) / ${COLS}., 1. - (row + 1. - vUv.y) / ${ROWS}.);
        vec4 c = texture2D(uAtlas, auv);
        if (c.a < .5) discard;
        vec3 alb = c.rgb;
        float hue = vHue + vTone.z;
        if (abs(hue) > .001) alb = max(hueShift(alb, hue*6.2831), 0.);
        float lum = dot(alb, vec3(.299, .587, .114));
        alb = max(mix(vec3(lum), alb, vTone.y), 0.);           // deeper or paler
        alb *= mix(.6, 1., smoothstep(.06, .5, lum));           // darker petal folds
        float soft = texture2D(uAtlas, auv, 3.).a;
        alb *= 1. - (1. - smoothstep(.55, .97, soft)) * mix(.7, .3, smoothstep(.5, .85, lum));      // shaded edge round each bloom
        alb *= vTone.x;
        alb *= 1. - uRain*.2;
        float shade = mix(.32, 1., smoothstep(0., .6, vTop));
        // cloud shadows drifting across the field
        float cs = smoothstep(.42, .62, fbm(vec2((vW.x + uTravel)*.012 - uTime*.02, vW.z*.03)));
        shade *= 1. - cs * min(uCloudShade*1.3, .55);
        float back = pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.), 4.) * (1. - uNight);
        vec3 light = uAmb*mix(vec3(.82,.86,1.12), vec3(1.), vTop)*shade + uSunCol*(.25 + .75*vTop)*shade + uSunCol*back*.9*vTop;
        vec3 o = alb*light + alb*lampLight(vW.x + uTravel, vW.z, vW.y);
        gl_FragColor = vec4(fogIt(o, vW), 1.);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
buildFlowerField();

// ---------- rain outside ----------
const rainMesh = (() => {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  const n = 2600, off = new Float32Array(n * 3);
  const R = rng(4);
  for (let i = 0; i < n; i++) { off[i * 3] = R() * 16; off[i * 3 + 1] = R() * 8; off[i * 3 + 2] = R() * 18; }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  geo.instanceCount = n;
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { ...U },
    vertexShader: GLSL_COMMON + /* glsl */`
      attribute vec3 aOff;
      void main(){
        vec3 vel = vec3(-${SPEED}.*.9, -12., 0.);
        vec3 p = mod(aOff + vel*uTime, vec3(16., 8., 18.)) + vec3(-8., uGroundY - .4, -19.5);
        vec3 dir = normalize(vel);
        vec3 side = normalize(cross(dir, vec3(0., 0., 1.)));
        vec3 wp = p + side*position.x*.025 + dir*position.y*.7;
        gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.);
      }`,
    fragmentShader: GLSL_COMMON + `void main(){ gl_FragColor = vec4((uAmb + uSunCol*.5)*.9 + uLampCol*uNight*.15, .32 * uRain); }`,
  }));
  m.frustumCulled = false;
  m.visible = false;
  scene.add(m);
  return m;
})();

// ---------- carriage interior ----------
function rrShape(w, h, r, cx = 0, cy = 0, P = THREE.Shape) {
  const s = new P();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const shadowy = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };

const interior = new THREE.Group();
scene.add(interior);

const M = {
  wall: painted('#7a5a4c', { n: 1600, spread: 12, len: 40, width: 7, angle: Math.PI / 2, seed: 2 }, {}, [0.6, 0.6]),
  wainscot: painted('#4c3329', { n: 1400, spread: 14, len: 60, width: 5, angle: Math.PI / 2, seed: 3 }, { roughness: 0.7 }, [0.8, 0.8]),
  frame: painted('#a7a6b4', { n: 900, spread: 14, len: 20, width: 5, seed: 4 }, { metalness: 0.2, roughness: 0.5 }, [2, 2]),
  rim: painted('#9a5a36', { n: 600, spread: 16, len: 16, width: 4, seed: 5 }, { metalness: 0.25, roughness: 0.45 }, [3, 3]),
  seat: painted('#8f8fb0', { n: 2000, spread: 16, len: 10, width: 6, seed: 6, grain: 0.08 }, { roughness: 1 }, [1.5, 1.5]),
  seatDark: painted('#5f5f80', { n: 1200, spread: 12, len: 10, width: 6, seed: 7 }, { roughness: 1 }),
  cloth: painted('#ece4d4', { n: 900, spread: 10, len: 14, width: 4, seed: 8 }, { roughness: 1 }, [2, 2]),
  table: painted('#b5784c', { n: 1500, spread: 18, len: 70, width: 5, angle: 0, seed: 9 }, { roughness: 0.55 }, [1, 1]),
  floor: painted('#2c2226', { n: 1200, spread: 10, len: 30, width: 8, seed: 10 }, {}, [2, 2]),
  ceiling: painted('#3a2b27', { n: 800, spread: 10, len: 30, width: 8, seed: 11 }, {}, [2, 2]),
  metal: new THREE.MeshStandardMaterial({ color: '#b9b9c4', metalness: 0.8, roughness: 0.3 }),
};

// wall with the window cut out
{
  const upper = new THREE.Shape();
  upper.moveTo(-3.5, 0.9); upper.lineTo(3.5, 0.9); upper.lineTo(3.5, 2.6); upper.lineTo(-3.5, 2.6); upper.lineTo(-3.5, 0.9);
  upper.holes.push(rrShape(WIN.w, WIN.h, WIN.r, WIN.cx, WIN.cy, THREE.Path));
  const wall = shadowy(new THREE.Mesh(new THREE.ShapeGeometry(upper, 24), M.wall));
  wall.position.z = WALL_Z;
  M.wall.shadowSide = THREE.DoubleSide;
  M.wall.side = THREE.DoubleSide;
  interior.add(wall);
  const lower = shadowy(new THREE.Mesh(new THREE.PlaneGeometry(7, 0.9).translate(0, 0.45, 0), M.wainscot));
  lower.position.z = WALL_Z;
  interior.add(lower);
  const rail = shadowy(new THREE.Mesh(new THREE.BoxGeometry(7, 0.035, 0.03), M.wainscot));
  rail.position.set(0, 0.9, WALL_Z + 0.015);
  interior.add(rail);

  // frame: an outer silver ring and a copper inner lip
  const ring = rrShape(WIN.w + 0.1, WIN.h + 0.1, WIN.r + 0.05);
  ring.holes.push(rrShape(WIN.w, WIN.h, WIN.r, 0, 0, THREE.Path));
  const frame = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 24 }), M.frame));
  frame.position.set(WIN.cx, WIN.cy, WALL_Z);
  interior.add(frame);
  const lip = rrShape(WIN.w + 0.01, WIN.h + 0.01, WIN.r);
  lip.holes.push(rrShape(WIN.w - 0.03, WIN.h - 0.03, WIN.r - 0.015, 0, 0, THREE.Path));
  const lipM = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(lip, { depth: 0.06, bevelEnabled: false, curveSegments: 24 }), M.rim));
  lipM.position.set(WIN.cx, WIN.cy, WALL_Z - 0.05);
  interior.add(lipM);

  // rivets around the frame
  const pts = rrShape(WIN.w + 0.058, WIN.h + 0.058, WIN.r + 0.029).getSpacedPoints(52);
  const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0055, 8, 6), M.metal, pts.length - 1);
  pts.slice(0, -1).forEach((p, i) => rivets.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x + WIN.cx, p.y + WIN.cy, WALL_Z + 0.05)));
  interior.add(rivets);

  // sill
  const sill = shadowy(new THREE.Mesh(new RoundedBoxGeometry(WIN.w + 0.3, 0.03, 0.09, 2, 0.008), M.wainscot));
  sill.position.set(0, WIN.cy - WIN.h / 2 - 0.115, WALL_Z + 0.045);
  interior.add(sill);
}

// floor and ceiling
{
  const floor = shadowy(new THREE.Mesh(new THREE.PlaneGeometry(8, 6).rotateX(-Math.PI / 2).translate(0, 0, 2), M.floor), false, true);
  interior.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 6).rotateX(Math.PI / 2).translate(0, 2.6, 2), M.ceiling);
  interior.add(ceil);
}

// facing seats
for (const side of [-1, 1]) {
  const g = new THREE.Group();
  const base = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.66), M.seatDark));
  base.position.set(0.86 * side, 0.17, -0.62);
  const cushion = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.15, 0.72, 4, 0.05), M.seat));
  cushion.position.set(0.86 * side, 0.42, -0.62);
  const back = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.86, 0.72, 4, 0.05), M.seat));
  back.position.set(1.2 * side, 0.9, -0.62);
  back.rotation.z = -0.07 * side;
  const head = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.24, 0.5, 2, 0.01), M.cloth));
  head.position.set(1.12 * side + 0.05 * side * 0.07, 1.18, -0.62);
  head.rotation.z = -0.07 * side;
  g.add(base, cushion, back, head);
  interior.add(g);
}

// table
{
  const top = shadowy(new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.04, 0.72, 3, 0.012), M.table));
  top.position.set(0, TOP - 0.02, -0.64);
  const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, TOP - 0.04, 12), M.metal));
  leg.position.set(0, (TOP - 0.04) / 2, -0.5);
  const foot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.02, 24), M.metal));
  foot.position.set(0, 0.01, -0.5);
  interior.add(top, leg, foot);
}

// ---------- things on the table ----------
const interactive = [];
const PAGE = { W: 0.2, H: 0.27 };

function cellTexture(index) {
  const t = atlasTex.clone();
  t.repeat.set(1 / COLS, 1 / ROWS);
  t.offset.set((index % COLS) / COLS, 1 - (Math.floor(index / COLS) + 1) / ROWS);
  t.needsUpdate = true;
  return t;
}

function coverCanvas() {
  const c = brushCanvas('#2f4a3e', { size: 512, n: 2600, spread: 14, len: 14, width: 6, seed: 31, grain: 0.06 });
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(214,180,110,0.85)';
  ctx.lineWidth = 5;
  ctx.strokeRect(34, 34, 444, 444);
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, 420, 420);
  const cell = cellRect(13 * 2);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(256, 230, 92, 120, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#efe5cf';
  ctx.fill();
  ctx.clip();
  ctx.filter = 'sepia(0.3) saturate(0.8)';
  ctx.drawImage(atlasCanvas, cell.x, cell.y, 256, 256, 150, 120, 212, 212);
  ctx.restore();
  ctx.fillStyle = 'rgba(214,180,110,0.9)';
  ctx.font = '44px "Pinyon Script", cursive';
  ctx.textAlign = 'center';
  ctx.fillText('pressed along the line', 256, 420);
  return c;
}

function pageEdgeCanvas(seed) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  const R = rng(seed);
  ctx.fillStyle = '#e6dcc4';
  ctx.fillRect(0, 0, 512, 64);
  for (let y = 0; y < 64; y += 1.5) {
    ctx.fillStyle = `rgba(${120 + R() * 60},${100 + R() * 40},${70 + R() * 30},${0.12 + R() * 0.2})`;
    ctx.fillRect(0, y, 512, 0.7);
  }
  const hues = ['#c46a7a', '#7a8fd0', '#e3b04a', '#6f8a4a', '#a35aa8'];
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = hues[Math.floor(R() * hues.length)];
    ctx.globalAlpha = 0.7;
    ctx.fillRect(R() * 512, 6 + R() * 52, 6 + R() * 30, 1.5 + R() * 2);
  }
  ctx.globalAlpha = 1;
  return c;
}

const journal = (() => {
  const { W, H } = PAGE;
  const CW = 0.206, CH = 0.278, ct = 0.006, T = 0.062;
  const g = new THREE.Group();
  const leatherTex = tex(brushCanvas('#2f4a3e', { size: 256, n: 1600, spread: 14, len: 12, width: 6, seed: 32, grain: 0.06 }));
  const leather = new THREE.MeshStandardMaterial({ map: leatherTex, roughness: 0.7 });
  const coverTop = new THREE.MeshStandardMaterial({ map: tex(coverCanvas()), roughness: 0.65 });
  const endTex = tex(pages[0]);
  endTex.center.set(0.5, 0.5);
  endTex.rotation = Math.PI;
  const endpaper = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.9 });
  const firstPage = new THREE.MeshStandardMaterial({ map: tex(pages[1]), roughness: 0.95 });
  const edges = new THREE.MeshStandardMaterial({ map: tex(pageEdgeCanvas(41)), roughness: 1 });
  const back = shadowy(new THREE.Mesh(new THREE.BoxGeometry(CW, ct, CH), leather));
  back.position.set(CW / 2, ct / 2, 0);
  const spine = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.012, T, CH, 2, 0.004), leather));
  spine.position.set(-0.003, T / 2, 0);
  const block = shadowy(new THREE.Mesh(new THREE.BoxGeometry(W, T - 2 * ct, H), [edges, edges, firstPage, edges, edges, edges]));
  block.position.set(W / 2 + 0.002, T / 2, 0);
  const pivot = new THREE.Group();
  pivot.position.set(0, T - ct / 2, 0);
  const cover = shadowy(new THREE.Mesh(new THREE.BoxGeometry(CW, ct, CH), [leather, leather, coverTop, endpaper, leather, leather]));
  cover.position.set(CW / 2, 0, 0);
  pivot.add(cover);
  g.add(back, spine, block, pivot);

  // pressed things poking out between the pages
  const R = rng(55);
  const bits = [[26, 0.09], [10, 0.07], [30, 0.06], [16, 0.08], [6, 0.05], [22, 0.06]];
  bits.forEach(([cell, s], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: cellTexture(cell), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }));
    const y = ct + 0.006 + R() * (T - 2 * ct - 0.012);
    if (i % 2 === 0) m.position.set(W + 0.002 + s * 0.22, y, -H / 2 + 0.04 + R() * (H - 0.08));
    else m.position.set(0.03 + R() * (W - 0.06), y, H / 2 + s * 0.22);
    m.rotation.y = (R() - 0.5) * 0.8;
    m.castShadow = true;
    g.add(m);
  });
  // ribbon bookmark trailing onto the table
  const ribbonMat = new THREE.MeshStandardMaterial({ color: '#8a2e34', roughness: 0.6, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.009, 0.07).rotateX(-Math.PI / 2), ribbonMat);
  ribbon.position.set(0.12, 0.0015, H / 2 + 0.03);
  ribbon.rotation.y = 0.25;
  g.add(ribbon);

  g.position.set(-0.33, TOP, -0.665);
  g.rotation.y = -0.16;
  g.userData = { kind: 'journal', pivot, CW, CH, T, home: { p: g.position.clone(), q: g.quaternion.clone() } };
  interior.add(g);
  interactive.push(g);
  return g;
})();

function letterCanvas() {
  const c = paperCanvas(512, 61, '#f3ecdc');
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2e2620';
  ctx.textAlign = 'center';
  ctx.font = '64px "Pinyon Script", cursive';
  ctx.fillText('Omakase', 256, 120);
  ctx.strokeStyle = 'rgba(60,45,30,0.35)';
  ctx.lineWidth = 2;
  for (let y = 190; y < 480; y += 44) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(452, y); ctx.stroke(); }
  return c;
}

function envelopeCanvas() {
  const c = paperCanvas(512, 62, '#ead9bb');
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(110,80,50,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 512); ctx.lineTo(256, 230); ctx.lineTo(512, 512);
  ctx.stroke();
  return c;
}

const envelope = (() => {
  const EW = 0.22, EH = 0.15, ET = 0.005;
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ map: tex(envelopeCanvas()), roughness: 0.95 });
  const paperPlain = new THREE.MeshStandardMaterial({ color: '#e2cfae', roughness: 0.95 });
  const body = shadowy(new THREE.Mesh(new THREE.BoxGeometry(EW, ET, EH), [paperPlain, paperPlain, paper, paperPlain, paperPlain, paperPlain]));
  body.position.y = ET / 2;
  const letter = new THREE.Mesh(new THREE.BoxGeometry(EW - 0.016, 0.0012, EH - 0.012),
    [paperPlain, paperPlain, new THREE.MeshStandardMaterial({ map: tex(letterCanvas()), roughness: 1 }), paperPlain, paperPlain, paperPlain]);
  letter.position.set(0, ET / 2, 0.002);
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-EW / 2, 0); flapShape.lineTo(EW / 2, 0); flapShape.lineTo(0, -EH * 0.6); flapShape.lineTo(-EW / 2, 0);
  const flapMat = new THREE.MeshStandardMaterial({ color: '#dcc6a2', roughness: 0.95, side: THREE.DoubleSide });
  const flap = shadowy(new THREE.Mesh(new THREE.ShapeGeometry(flapShape).rotateX(-Math.PI / 2), flapMat));
  const pivot = new THREE.Group();
  pivot.position.set(0, ET + 0.0006, -EH / 2);
  pivot.add(flap);
  const seal = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.004, 24), new THREE.MeshStandardMaterial({ color: '#8e2a2a', roughness: 0.4, metalness: 0.1 })));
  seal.position.set(0, 0.002, EH * 0.5);
  pivot.add(seal);
  g.add(body, letter, pivot);
  g.position.set(0.11, TOP, -0.45);
  g.rotation.y = 0.28;
  g.userData = { kind: 'envelope', pivot, letter, EW, EH, ET, home: { p: g.position.clone(), q: g.quaternion.clone() } };
  interior.add(g);
  interactive.push(g);
  return g;
})();

// ---------- the drink: whatever suits the weather and the hour ----------
// Rain brings a mug of hot cocoa, a grey day a pot of tea, a hot afternoon a
// fizzing soda with its can, a fresh morning a latte, a mild cloudy day a
// Thai iced tea, and the night a glass of chamomile.
const steamTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return tex(c);
})();
const steamPuffs = [];
function addSteam(g, x, y, z, n = 5) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    m.userData = { x, y, z, phase: i / n, g };
    m.scale.setScalar(0.04);
    g.add(m);
    steamPuffs.push(m);
  }
}
const clearGlass = () => new THREE.MeshStandardMaterial({ color: '#dfeef0', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
const iceMat = new THREE.MeshStandardMaterial({ color: '#f4fbff', transparent: true, opacity: 0.55, roughness: 0.1 });
const ceramic = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 });
function ice(g, list, y) {
  list.forEach(([x, z, r]) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.018, 0.02, 2, 0.004), iceMat);
    m.position.set(x, y, z);
    m.rotation.set(r, r * 0.7, r * 0.3);
    g.add(m);
  });
}
function mug(g, color, rimY = 0.09, r = 0.036) {
  const body = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, rimY, 24, 1, true), Object.assign(ceramic(color), { side: THREE.DoubleSide })));
  body.position.y = rimY / 2;
  const base = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 24).rotateX(-Math.PI / 2), ceramic(color));
  base.position.y = 0.002;
  const handle = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI * 1.2), ceramic(color)));
  handle.position.set(r + 0.004, rimY * 0.5, 0);
  handle.rotation.z = -Math.PI * 0.6;
  g.add(body, base, handle);
}
function sodaLabel() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#f4a6b8'); g.addColorStop(1, '#e8607e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 4, 0, 6.3); ctx.fill(); }
  ctx.fillStyle = '#fffaf0';
  ctx.font = '52px "Pinyon Script", cursive';
  ctx.textAlign = 'center';
  ctx.fillText('lychee', 128, 80);
  return tex(c);
}

const drink = (() => {
  const root = new THREE.Group();
  const V = {};

  // Thai iced tea
  {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.031, 0.13, 24, 1, true), clearGlass());
    glass.position.y = 0.065;
    const tea = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.09, 24), ceramic('#d0702a')));
    tea.position.y = 0.047;
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0342, 0.012, 24), ceramic('#f2d6b0'));
    cream.position.y = 0.097;
    ice(g, [[0.01, 0.008, 0.3], [-0.012, -0.006, 1.1], [0.002, -0.014, 2.0]], 0.1);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.2, 8), ceramic('#4f8a5a'));
    straw.position.set(0.012, 0.13, 0.006);
    straw.rotation.z = -0.22;
    g.add(glass, tea, cream, straw);
    V.icedTea = g;
  }
  // lychee soda: a tall glass fizzing over ice, the can beside it
  {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.03, 0.15, 24, 1, true), clearGlass());
    glass.position.y = 0.075;
    const soda = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.029, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#f6d4dc', transparent: true, opacity: 0.75, roughness: 0.1 }));
    soda.position.y = 0.062;
    ice(g, [[0.008, 0.006, 0.4], [-0.01, -0.004, 1.3], [0.001, -0.012, 2.2], [-0.004, 0.01, 0.9]], 0.112);
    const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0018, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }), 40);
    const R = rng(9);
    for (let i = 0; i < 40; i++) bubbles.setMatrixAt(i, new THREE.Matrix4().makeTranslation((R() - 0.5) * 0.05, 0.01 + R() * 0.11, (R() - 0.5) * 0.05));
    bubbles.userData.fizz = true;
    const lime = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 20), ceramic('#b9d86a'));
    lime.position.set(0.026, 0.148, 0);
    lime.rotation.z = 1.2;
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.21, 8), ceramic('#f2f0ea'));
    straw.position.set(-0.01, 0.15, 0.004);
    straw.rotation.z = 0.2;
    const can = new THREE.Group();
    const canBody = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.11, 24), [new THREE.MeshStandardMaterial({ map: sodaLabel(), roughness: 0.35, metalness: 0.3 }), M.metal, M.metal]));
    canBody.position.y = 0.055;
    can.add(canBody);
    can.position.set(0.085, 0, 0.03);
    can.rotation.y = 2.2;
    g.add(glass, soda, bubbles, lime, straw, can);
    V.soda = g;
  }
  // hot cocoa with marshmallows
  {
    const g = new THREE.Group();
    mug(g, '#c7563f');
    const cocoa = new THREE.Mesh(new THREE.CircleGeometry(0.033, 24).rotateX(-Math.PI / 2), ceramic('#5a3424'));
    cocoa.position.y = 0.082;
    g.add(cocoa);
    const R = rng(4);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.009, 0.012, 2, 0.003), ceramic(i % 2 ? '#fbeef2' : '#ffffff'));
      m.position.set((R() - 0.5) * 0.04, 0.085, (R() - 0.5) * 0.04);
      m.rotation.y = R() * 3;
      g.add(m);
    }
    addSteam(g, 0, 0.1, 0);
    V.cocoa = g;
  }
  // a small pot of tea and a cup on its saucer
  {
    const g = new THREE.Group();
    const pot = new THREE.Group();
    const body = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), ceramic('#e9e4da')));
    body.scale.y = 0.8;
    body.position.y = 0.042;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), ceramic('#e9e4da'));
    lid.position.y = 0.084;
    const spout = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, 0.05, 10), ceramic('#e9e4da')));
    spout.position.set(0.055, 0.055, 0);
    spout.rotation.z = -0.9;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16), ceramic('#e9e4da'));
    handle.position.set(-0.05, 0.05, 0);
    pot.add(body, lid, spout, handle);
    pot.position.set(-0.03, 0, -0.02);
    const cup = new THREE.Group();
    const saucer = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.005, 24), ceramic('#e9e4da')));
    cup.add(saucer);
    const c = new THREE.Group();
    mug(c, '#e9e4da', 0.045, 0.03);
    c.position.y = 0.004;
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20).rotateX(-Math.PI / 2), ceramic('#b56a2c'));
    tea.position.y = 0.042;
    cup.add(c, tea);
    cup.position.set(0.09, 0, 0.04);
    addSteam(cup, 0, 0.06, 0, 4);
    g.add(pot, cup);
    V.tea = g;
  }
  // a latte with a heart in the foam, on a saucer
  {
    const g = new THREE.Group();
    const saucer = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.005, 24), ceramic('#f0ebe2')));
    const c = new THREE.Group();
    mug(c, '#f0ebe2', 0.055, 0.038);
    c.position.y = 0.004;
    const foam = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24).rotateX(-Math.PI / 2), (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d');
      x.fillStyle = '#b8835a'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#f6ead8';
      x.beginPath(); x.moveTo(32, 48); x.bezierCurveTo(6, 30, 18, 10, 32, 24); x.bezierCurveTo(46, 10, 58, 30, 32, 48); x.fill();
      return new THREE.MeshStandardMaterial({ map: tex(cv), roughness: 0.6 });
    })());
    foam.position.y = 0.055;
    foam.rotation.y = 1.4;
    g.add(saucer, c, foam);
    addSteam(g, 0, 0.07, 0, 3);
    V.latte = g;
  }
  // chamomile in a clear glass mug, tea-bag tag hanging over the rim
  {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.1, 24, 1, true), clearGlass());
    glass.position.y = 0.05;
    const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.032, 0.075, 24), new THREE.MeshStandardMaterial({ color: '#e9c25a', transparent: true, opacity: 0.8, roughness: 0.1 }));
    tea.position.y = 0.039;
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.001), ceramic('#f4efe4'));
    tag.position.set(0.04, 0.075, 0.01);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.04, 4), ceramic('#f4efe4'));
    string.position.set(0.038, 0.098, 0.006);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI * 1.2), clearGlass());
    handle.position.set(0.04, 0.05, 0);
    handle.rotation.z = -Math.PI * 0.6;
    g.add(glass, tea, tag, string, handle);
    addSteam(g, 0, 0.09, 0, 4);
    V.chamomile = g;
  }

  for (const g of Object.values(V)) { g.visible = false; root.add(g); }
  root.userData.variants = V;
  root.position.set(-0.4, TOP, -0.86);
  interior.add(root);
  return root;
})();

function pickDrink(env) {
  const V = drink.userData.variants;
  const h = env.hour;
  let k = 'icedTea';
  if (env.rain) k = 'cocoa';
  else if (env.night > 0.5) k = 'chamomile';
  else if (env.weather === 'fog' || env.weather === 'overcast') k = 'tea';
  else if (env.weather === 'clear' && h >= 11 && h < 17) k = 'soda';
  else if (h < 10.5) k = 'latte';
  for (const [name, g] of Object.entries(V)) g.visible = name === k;
}

function updateSteam(dt) {
  for (const m of steamPuffs) {
    if (!m.userData.g.parent?.visible && !m.userData.g.visible) continue;
    const u = m.userData;
    u.phase = (u.phase + dt * 0.35) % 1;
    const p = u.phase;
    m.position.set(u.x + Math.sin(p * 6 + u.y * 40) * 0.012, u.y + p * 0.12, u.z);
    m.scale.setScalar(0.03 + p * 0.06);
    m.material.opacity = Math.sin(p * Math.PI) * 0.35;
  }
}

// ---------- the bouquet: wrapped, ribboned, carried a long way ----------
// Someone is bringing these to the one they love. Their seat is empty for the
// moment; the flowers lie on the table with the letter tucked against them.
{
  const B = new THREE.Group();
  // kraft paper cone with a blush tissue lining, lying on its side
  const kraftMat = painted('#b8916a', { n: 700, spread: 14, len: 30, width: 6, seed: 70 }, { side: THREE.DoubleSide });
  const tissueMat = painted('#f2d2d6', { n: 400, spread: 10, len: 20, width: 5, seed: 71 }, { side: THREE.DoubleSide });
  const cone = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 18, 1, true).rotateZ(-Math.PI / 2), kraftMat));
  cone.position.x = -0.01;
  cone.scale.set(1, 0.55, 1);
  const tissue = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.26, 18, 1, true, 0.3, 4.8).rotateZ(-Math.PI / 2), tissueMat);
  tissue.position.x = -0.03;
  tissue.scale.set(1, 0.6, 1);
  B.add(cone, tissue);
  // stems poking out of the narrow end
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4f6d38', roughness: 0.8 });
  // The bouquet lies tilted, open end resting on the table, so the stems
  // leave the tip and lie flat along the table (TILT undoes the tilt).
  const TILT = 0.19;
  for (let i = 0; i < 6; i++) {
    const st = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.1, 6).rotateZ(Math.PI / 2), stemMat));
    st.position.set(0.14 + 0.05 * Math.cos(TILT), 0.05 * Math.sin(TILT) + 0.003 + (i % 2) * 0.004, (i - 2.5) * 0.005);
    st.rotation.set(0, (i - 2.5) * 0.04, TILT);
    B.add(st);
  }
  // satin ribbon round the neck, tails trailing on the table
  const ribbonMat = new THREE.MeshStandardMaterial({ color: '#9e2b3a', roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
  const band = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 20).rotateY(Math.PI / 2), ribbonMat));
  band.position.x = 0.08;
  band.scale.set(1, 0.55, 1);
  B.add(band);
  for (const s of [-1, 1]) {
    const loop = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 14), ribbonMat));
    loop.position.set(0.08, 0.022, s * 0.02);
    loop.rotation.set(Math.PI / 2, 0, s * 0.6);
    loop.scale.set(1, 0.6, 1);
    const tail = shadowy(new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.1).rotateX(-Math.PI / 2), ribbonMat));
    tail.position.set(0.15, 0.002, s * 0.045);
    tail.rotation.set(0, s * 0.5, TILT);
    B.add(loop, tail);
  }
  // the blooms: deep red roses, blush peonies, white ranunculus, eucalyptus
  // and baby's breath, gathered in a dome at the open end
  const R = rng(1414);
  const kinds = [
    { c: ['#7c1424', '#a3283a', '#c9475a'], s: 0.045 },
    { c: ['#c4607e', '#e08aa2', '#f2b6c6'], s: 0.055 },
    { c: ['#d8d2c8', '#efeae0', '#fffaf2'], s: 0.038 },
  ];
  const bloomMats = kinds.map((k) => k.c.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true })));
  const petalGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#6f8f78', roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 16; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.085;
    const ki = [0, 1, 0, 1, 0, 2, 1, 0][i % 8]; // mostly roses and peonies
    const k = kinds[ki];
    const bloom = new THREE.Group();
    // layered petals: outer pale, inner deeper, each a little cupped
    for (let l = 0; l < 3; l++) {
      const p = shadowy(new THREE.Mesh(petalGeo, bloomMats[ki][2 - l]));
      const sz = k.s * (1 - l * 0.28);
      p.scale.set(sz * 0.55, sz, sz);
      p.position.x = l * k.s * 0.18;
      p.rotation.set(R() * 3, R() * 3, R() * 3);
      bloom.add(p);
    }
    bloom.position.set(-0.17 - Math.cos(rr * 12) * 0.02 - R() * 0.02, Math.sin(a) * rr * 0.6 + 0.01, Math.cos(a) * rr);
    bloom.rotation.z = Math.sin(a) * 0.4;
    bloom.rotation.y = -Math.cos(a) * 0.5;
    B.add(bloom);
  }
  for (let i = 0; i < 14; i++) {
    const leaf = shadowy(new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), leafMat));
    const a = R() * Math.PI * 2;
    leaf.position.set(-0.12 - R() * 0.06, Math.sin(a) * 0.06, Math.cos(a) * 0.1);
    leaf.rotation.set(R() * 3, R() * 3, R() * 3);
    B.add(leaf);
  }
  const breath = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0035, 6, 4), new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 0.9 }), 30);
  for (let i = 0; i < 30; i++) {
    const a = R() * Math.PI * 2, rr = 0.06 + R() * 0.05;
    breath.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-0.16 - R() * 0.07, Math.sin(a) * rr * 0.6 + 0.01, Math.cos(a) * rr));
  }
  B.add(breath);
  B.scale.setScalar(1.25);
  B.position.set(0.3, TOP + 0.036, -0.7);
  B.rotation.set(0, 0.32, -TILT, 'YXZ');
  interior.add(B);

  // a return ticket, punched, by the journal
  const ticketCanvas = (() => {
    const c = paperCanvas(256, 88, '#efe4c8');
    const x = c.getContext('2d');
    x.fillStyle = '#7a2e2e'; x.fillRect(0, 0, 256, 40);
    x.fillStyle = '#f6efe0'; x.font = '26px "Cormorant Garamond", serif'; x.textAlign = 'center';
    x.fillText('FLOWER LINE', 128, 29);
    x.fillStyle = '#3a2e26'; x.font = '22px "Caveat", cursive';
    x.fillText('Return  ·  to the end of the line', 128, 120);
    x.fillText('Seat 14  ·  Carriage 3', 128, 168);
    x.fillStyle = '#efe4c8'; x.beginPath(); x.arc(220, 210, 10, 0, 6.3); x.fill();
    return c;
  })();
  const ticket = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.0008, 0.075), [null, null, new THREE.MeshStandardMaterial({ map: tex(ticketCanvas), roughness: 1 }), null, null, null].map((m) => m ?? new THREE.MeshStandardMaterial({ color: '#efe4c8' }))), false, true);
  ticket.position.set(-0.14, TOP + 0.0004, -0.47);
  ticket.rotation.y = -0.35;
  interior.add(ticket);
}

// intercom above the window
const intercom = (() => {
  const g = new THREE.Group();
  const face = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9cdb4'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#3a3230';
    for (let y = 26; y < 106; y += 12) for (let x = 30; x < 150; x += 12) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#5a4a40';
    ctx.font = '22px "Cormorant Garamond", serif';
    ctx.fillText('CALL', 182, 104);
    return tex(c);
  })();
  const shell = new THREE.MeshStandardMaterial({ color: '#8c7a5c', metalness: 0.6, roughness: 0.4 });
  const box = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.035, 3, 0.012), [shell, shell, shell, shell, new THREE.MeshStandardMaterial({ map: face, roughness: 0.7 }), shell]));
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b94a3a', roughness: 0.4 }));
  btn.position.set(0.055, 0.008, 0.02);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshStandardMaterial({ color: '#2a3a2a', emissive: '#7dff9a', emissiveIntensity: 0.3 }));
  led.position.set(0.055, -0.03, 0.019);
  g.add(box, btn, led);
  g.position.set(0, WIN.cy + WIN.h / 2 + 0.2, WALL_Z + 0.02);
  g.userData = { kind: 'intercom', led, home: { p: g.position.clone(), q: g.quaternion.clone() } };
  interior.add(g);
  interactive.push(g);
  return g;
})();

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x332222, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 0.5, far: 22 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.015;
sun.target.position.set(0, 0.8, -0.5);
scene.add(sun, sun.target);
const cabinLamp = new THREE.PointLight('#ffc48a', 0, 6, 1.4);
cabinLamp.position.set(0, 2.35, 0.3);
scene.add(cabinLamp);
const passLamp = new THREE.PointLight('#ffb066', 0, 9, 1.2);
scene.add(passLamp);

// ---------- trackside props: poles, lamps, signs ----------
const outside = new THREE.Group();
scene.add(outside);
const darkMetal = new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.7, metalness: 0.3 });
const poles = Array.from({ length: 3 }, () => {
  const g = new THREE.Group();
  const mast = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.16, 7, 0.16), darkMetal), true, false);
  mast.position.y = GROUND_Y + 3.5;
  const arm = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), darkMetal), true, false);
  arm.position.set(0, GROUND_Y + 6.2, 1.1);
  g.add(mast, arm);
  g.position.z = POLE.z;
  outside.add(g);
  return g;
});

const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,0.5)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  return tex(c);
})();
const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', emissive: '#ffcf8a', emissiveIntensity: 0 });
const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false });
const lamps = Array.from({ length: 4 }, () => {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.2, 8), darkMetal);
  post.position.y = GROUND_Y + 1.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), darkMetal);
  arm.position.set(0, GROUND_Y + 3.15, 0.22);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 10, 1, true), lampHeadMat);
  head.position.set(0, GROUND_Y + 3.05, 0.45);
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(1.3, 1.3, 1);
  glow.position.set(0, GROUND_Y + 2.95, 0.45);
  g.add(post, arm, head, glow);
  g.position.z = LAMP.z;
  outside.add(g);
  return g;
});

const signMats = FLOWERS.map((f) => new THREE.MeshStandardMaterial({ map: tex(signCanvas(f.name)), roughness: 0.9 }));
const woodMat = new THREE.MeshStandardMaterial({ color: '#5a4230', roughness: 0.9 });
const signs = Array.from({ length: 3 }, () => {
  const g = new THREE.Group();
  const board = shadowy(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.69), signMats[0]), true, false);
  board.position.y = GROUND_Y + 1.6;
  for (const s of [-1, 1]) {
    const leg = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), woodMat), true, false);
    leg.position.set(s * 0.9, GROUND_Y + 0.8, -0.04);
    leg.scale.y = 1.4;
    g.add(leg);
  }
  g.add(board);
  g.userData.board = board;
  g.position.z = -8;
  outside.add(g);
  return g;
});

// ---------- the countryside behind the flowers ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  roof: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.45); s.lineTo(-0.5, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  })(),
  crown: new THREE.IcosahedronGeometry(1, 1),
  trunk: new THREE.CylinderGeometry(0.08, 0.13, 1, 6).translate(0, 0.5, 0),
  plane: new THREE.PlaneGeometry(1, 1),
  bale: new THREE.CylinderGeometry(0.6, 0.6, 1, 14).rotateX(Math.PI / 2),
  tower: new THREE.CylinderGeometry(0.9, 1.4, 7, 8).translate(0, 3.5, 0),
  cap: new THREE.ConeGeometry(1.25, 1.5, 8).translate(0, 0.75, 0),
  blade: new THREE.BoxGeometry(0.5, 4.2, 0.05).translate(0, 2.1, 0),
  steeple: new THREE.ConeGeometry(0.9, 4, 4).translate(0, 2, 0),
  hip: new THREE.ConeGeometry(0.75, 0.42, 4).rotateY(Math.PI / 4).translate(0, 0.21, 0),
  leg: new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0),
};
const mats = (list, extra = {}) => list.map((c, i) => painted(c, { size: 128, n: 300, spread: 14, len: 14, width: 4, seed: 100 + i }, { flatShading: true, ...extra }));
const MAT = {
  walls: mats(['#efe8dc', '#e8d9bf', '#d9c6aa', '#f3f0ea', '#cfd8d0', '#e6cfc4']),
  roofs: mats(['#c4452e', '#a53a2c', '#3f5f6c', '#7a4a3a', '#c8693a', '#5a4a6a']),
  greens: mats(['#3a5a2a', '#4b6b32', '#2e4a28', '#5a7638', '#41603a']),
  trunk: new THREE.MeshStandardMaterial({ color: '#4a3628', roughness: 1 }),
  win: new THREE.MeshStandardMaterial({ color: '#2a2c34', emissive: '#ffbe6a', emissiveIntensity: 0, roughness: 0.4 }),
  door: new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.9 }),
  bale: painted('#c9a55a', { size: 128, n: 400, spread: 18, len: 10, width: 3, seed: 140 }),
  barn: painted('#a8402e', { size: 128, n: 400, spread: 14, len: 30, width: 4, angle: Math.PI / 2, seed: 141 }),
  mill: painted('#e9e2d2', { size: 128, n: 300, spread: 10, len: 14, width: 4, seed: 142 }),
  sail: new THREE.MeshStandardMaterial({ color: '#efe6d4', roughness: 0.9, side: THREE.DoubleSide }),
  cows: [painted('#f2eee6', { size: 64, n: 60, spread: 8, len: 20, width: 10, seed: 150 }), painted('#7a4a30', { size: 64, n: 60, spread: 10, len: 20, width: 8, seed: 151 }), painted('#2c2a2a', { size: 64, n: 60, spread: 6, len: 20, width: 8, seed: 152 })],
  wool: painted('#efe8d8', { size: 64, n: 200, spread: 12, len: 6, width: 4, seed: 153 }, { flatShading: true }),
  hoof: new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 1 }),
  fence: new THREE.MeshStandardMaterial({ color: '#7a6248', roughness: 1 }),
  stone: painted('#b9b2a4', { size: 128, n: 300, spread: 12, len: 10, width: 6, seed: 154 }, { flatShading: true }),
  jroof: painted('#3d4350', { size: 64, n: 100, spread: 8, len: 20, width: 4, seed: 155 }, { flatShading: true }),
  jwall: painted('#efe6d4', { size: 64, n: 100, spread: 6, len: 20, width: 4, seed: 156 }),
  vermilion: painted('#c8432e', { size: 64, n: 80, spread: 10, len: 16, width: 4, seed: 157 }),
  blossom: painted('#f2c4d2', { size: 64, n: 200, spread: 14, len: 8, width: 5, seed: 158 }, { flatShading: true }),
  pine: painted('#24402e', { size: 64, n: 200, spread: 10, len: 8, width: 5, seed: 159 }, { flatShading: true }),
  water: new THREE.MeshBasicMaterial({ map: tex(brushCanvas('#8098b0', { size: 256, n: 1400, spread: 26, len: 40, width: 3, angle: 0, seed: 143 }), { repeat: [6, 2] }) }),
};
const pick = (arr, R) => arr[Math.floor(R() * arr.length)];


function addTree(g, R, x, z, s = 1, tall = false, leaf = null) {
  const t = new THREE.Group();
  const h = (tall ? 2.2 : 1.6 + R() * 1.4) * s;
  const trunk = new THREE.Mesh(G.trunk, MAT.trunk);
  trunk.scale.set(s * 1.5, h, s * 1.5);
  t.add(trunk);
  const mat = leaf ?? pick(MAT.greens, R);
  const blobs = tall ? 1 : 2 + Math.floor(R() * 2);
  for (let i = 0; i < blobs; i++) {
    const c = new THREE.Mesh(G.crown, mat);
    const r = (tall ? 1.1 : 1.4 + R() * 1.1) * s;
    if (tall) {
      // a poplar: one upright column that starts low on the trunk; spin it
      // only about its own axis so it never tips over
      c.scale.set(r * (0.9 + R() * 0.3), r * 4, r);
      c.position.set(0, h * 0.45 + r * 4, 0);
      c.rotation.y = R() * 3;
    } else {
      c.scale.set(r * (0.9 + R() * 0.3), r * (0.8 + R() * 0.3), r);
      c.position.set((R() - 0.5) * s * 1.6, h + r * 0.6 + i * 0.4 * s, (R() - 0.5) * s);
      c.rotation.set(R() * 3, R() * 3, R() * 3);
    }
    t.add(c);
  }
  t.position.set(x, GROUND_Y, z);
  g.add(t);
}

function addHouse(g, R, x, z, o = {}) {
  const w = o.w ?? 5 + R() * 3.5, d = o.d ?? 4 + R() * 2, h = o.h ?? 3 + R() * 1.6;
  const hg = new THREE.Group();
  const body = new THREE.Mesh(G.box, o.wall ?? pick(MAT.walls, R));
  body.scale.set(w, h, d);
  const roof = new THREE.Mesh(G.roof, o.roof ?? pick(MAT.roofs, R));
  const sy = (Math.min(w, d) * 0.48) / 0.45;
  if (o.ridgeX ?? R() < 0.6) { roof.rotation.y = Math.PI / 2; roof.scale.set(d * 1.12, sy, w * 1.08); }
  else roof.scale.set(w * 1.1, sy, d * 1.1);
  roof.position.y = h;
  hg.add(body, roof);
  const nWin = Math.max(1, Math.floor(w / 1.7));
  const doorAt = Math.floor(R() * (nWin + 1));
  for (let i = 0; i <= nWin; i++) {
    const px = -w / 2 + ((i + 0.5) / (nWin + 1)) * w;
    const p = new THREE.Mesh(G.plane, i === doorAt ? MAT.door : MAT.win);
    if (i === doorAt) { p.scale.set(0.9, 1.8, 1); p.position.set(px, 0.9, d / 2 + 0.02); }
    else { p.scale.set(0.8, 0.9, 1); p.position.set(px, h * 0.55, d / 2 + 0.02); }
    hg.add(p);
  }
  if (R() < 0.5) {
    const ch = new THREE.Mesh(G.box, MAT.walls[2]);
    ch.scale.set(0.5, h * 0.5, 0.5);
    ch.position.set(w * 0.25, h + h * 0.15, 0);
    hg.add(ch);
  }
  hg.position.set(x, GROUND_Y, z);
  hg.rotation.y = o.rot ?? (R() - 0.5) * 0.35;
  g.add(hg);
}

function addWindmill(g, R, x, z, spinners) {
  const m = new THREE.Group();
  m.add(new THREE.Mesh(G.tower, MAT.mill));
  const cap = new THREE.Mesh(G.cap, MAT.roofs[3]);
  cap.position.y = 7;
  m.add(cap);
  const hub = new THREE.Group();
  hub.position.set(0, 7.3, 1.3);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(G.blade, MAT.sail);
    b.rotation.z = (i * Math.PI) / 2;
    hub.add(b);
  }
  hub.rotation.z = R() * 6;
  hub.userData.speed = 0.5 + R() * 0.4;
  spinners.push(hub);
  m.add(hub);
  m.position.set(x, GROUND_Y, z);
  g.add(m);
}

function addLighthouse(g, x, z, white = false) {
  const l = new THREE.Group();
  const tower = new THREE.Mesh(G.tower, MAT.mill);
  tower.scale.set(0.9, 2.2, 0.9);
  const band = new THREE.Mesh(G.trunk, white ? MAT.mill : MAT.vermilion);
  band.scale.set(9, 2.2, 9);
  band.position.y = 8;
  const lamp = new THREE.Mesh(G.box, MAT.win);
  lamp.scale.set(1.3, 1.4, 1.3);
  lamp.position.y = 15.4;
  const cap = new THREE.Mesh(G.cap, MAT.vermilion);
  cap.scale.set(0.8, 0.9, 0.8);
  cap.position.y = 16.8;
  l.add(tower, band, lamp, cap);
  l.position.set(x, GROUND_Y, z);
  g.add(l);
}

const placeKit = { THREE, L, GROUND_Y, painted, G, MAT, addHouse, addTree, addLighthouse };

function spawnField(k) {
  const g = new THREE.Group();
  const R = rng(k * 7919 + 13);
  const t16 = ((k % 16) + 16) % 16;
  const spinners = [];
  buildPlace(PLACES[t16].name, placeKit, g, R);

  // sit everything on the rising ground
  for (const c of g.children) c.position.y += riseAt(k * L + c.position.x, c.position.z);
  outside.add(g);
  return { g, spinners };
}
const fields = new Map();

// JS twins of the shader's waterW() and riseAt(), for placing scenery
const sstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function waterAt(tx, kind, wid) {
  const fi = Math.floor(tx / L), local = tx - fi * L;
  const is = (k) => (Math.abs(WATER[((k % 16) + 16) % 16] - kind) < 0.5 ? 1 : 0);
  const a = THREE.MathUtils.lerp(is(fi - 1), is(fi), sstep(-wid, wid, local));
  return THREE.MathUtils.lerp(a, is(fi + 1), sstep(L - wid, L + wid, local));
}
function segAt(arr, tx, wid) {
  const fi = Math.floor(tx / L), local = tx - fi * L;
  const at = (k) => arr[((k % 16) + 16) % 16];
  const a = THREE.MathUtils.lerp(at(fi - 1), at(fi), sstep(-wid, wid, local));
  return THREE.MathUtils.lerp(a, at(fi + 1), sstep(L - wid, L + wid, local));
}
function riseAt(tx, z) {
  tx = ((tx % WRAP) + WRAP) % WRAP;
  const lake = waterAt(tx, 2, 40), sea = waterAt(tx, 1, 60);
  const R = Math.max(2, 7 + 5 * Math.sin(tx * 0.0047) + 3 * Math.sin(tx * 0.013 + 1.3));
  const rolls = Math.sin(tx * 0.021 + z * 0.013) * 0.5 + Math.sin(tx * 0.047 - z * 0.031 + 1.7) * 0.3 + Math.sin(tx * 0.009 + z * 0.027 + 4.1) * 0.6 + Math.sin(tx * 0.083 + z * 0.06 + 2.3) * 0.15;
  const land = R * segAt(RISE, tx, 80) * sstep(-44, -154, z) + segAt(ROUGH, tx, 80) * sstep(-44, -95, z) * (rolls + 1.6) * 3;
  return land * (1 - Math.max(sea, lake));
}

// ---------- painterly post pass ----------
let rtScale = 1;
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
const grainTex = tex(grainCanvas(256), { srgb: false });
const post = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  defines: { R: 3 },
  uniforms: { tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2() }, uGrain: { value: grainTex }, uTime: { value: 0 }, uExposure: { value: 1 }, uNight: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, uGrain; uniform vec2 uRes; uniform float uTime, uExposure, uNight;
    varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x + .03)) / (x*(2.43*x + .59) + .14), 0., 1.); }
    vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
    void main(){
      vec2 px = 1. / uRes;
      vec2 g = texture2D(uGrain, vUv * uRes / 256.).rg - .5;
      vec2 uv = vUv + g * px * 2.2;
      vec3 m0 = vec3(0), m1 = vec3(0), m2 = vec3(0), m3 = vec3(0);
      vec3 s0 = vec3(0), s1 = vec3(0), s2 = vec3(0), s3 = vec3(0);
      for (int j = -R; j <= R; j++) for (int i = -R; i <= R; i++) {
        vec3 c = texture2D(tDiffuse, uv + vec2(i, j) * px).rgb;
        c = c / (1. + c);
        vec3 c2 = c*c;
        if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
        if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
        if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
        if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
      }
      float n = float((R + 1) * (R + 1));
      m0 /= n; m1 /= n; m2 /= n; m3 /= n;
      float v0 = dot(abs(s0/n - m0*m0), vec3(1)), v1 = dot(abs(s1/n - m1*m1), vec3(1));
      float v2 = dot(abs(s2/n - m2*m2), vec3(1)), v3 = dot(abs(s3/n - m3*m3), vec3(1));
      vec3 col = m0; float best = v0;
      if (v1 < best) { best = v1; col = m1; }
      if (v2 < best) { best = v2; col = m2; }
      if (v3 < best) { best = v3; col = m3; }
      col = col / max(1. - col, .001);
      col = aces(col * uExposure);
      float luma = dot(col, vec3(.2126, .7152, .0722));
      col = clamp(mix(vec3(luma), col, 1.22), 0., 1.);
      col = toSRGB(col);
      // warm the shadows, cool the night a touch
      float l = dot(col, vec3(.299, .587, .114));
      col = mix(col, col * vec3(1.04, .98, .92) + vec3(.02, .0, .03) * (1. - l), .6);
      col = mix(col, col * vec3(.92, .96, 1.08), uNight * .4);
      // canvas tooth
      float tooth = texture2D(uGrain, vUv * uRes / 180. + .37).b - .5;
      col *= 1. + tooth * .09;
      vec2 q = vUv - .5;
      col *= 1. - dot(q, q) * .55;
      gl_FragColor = vec4(col, 1.);
    }`,
});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

// ---------- glass: drops and streaks, drawn crisp over the painting ----------
const glassMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uFade: { value: 1 }, uNight: { value: 0 }, uTint: { value: new THREE.Color() } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uRain, uFade, uNight; uniform vec3 uTint;
    varying vec2 vP;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)))) * 43758.5453); }
    void main(){
      float a = 0.; vec3 c = vec3(1.);
      // beaded drops that come and go
      vec2 p = vP / .022;
      vec2 id = floor(p), f = fract(p);
      vec2 o = h22(id);
      float life = fract(uTime*.07 + o.x*7.);
      float r = (.12 + .22*o.y) * smoothstep(0., .1, life) * step(.45, h21(id + 3.));
      float d = length(f - o*.6 - .2);
      float drop = smoothstep(r, r*.55, d);
      a += drop * .55;
      // runs blown sideways by the train's speed
      vec2 dir = normalize(vec2(-1., -.28));
      mat2 rot = mat2(dir.x, -dir.y, dir.y, dir.x);
      vec2 q = rot * vP;
      vec2 cell = vec2(.32, .035);
      vec2 qi = floor(q / cell);
      float hh = h21(qi.yy + 9.);
      float tx = fract(q.x / cell.x * .25 + uTime*(.35 + hh*.5) + hh*10.);
      float qy = fract(q.y / cell.y) - .5;
      float head = smoothstep(.12, .0, length(vec2((tx - .5) * 4., qy * 1.6))) * step(.55, hh);
      float trail = smoothstep(.08, .0, abs(qy)) * smoothstep(.5, .1, tx) * smoothstep(0., .2, tx) * step(.55, hh) * .35;
      a += head * .8 + trail;
      a *= uRain;
      // faint smudges and a reflected sheen
      float sheen = smoothstep(.0, .5, 1. - abs(vP.x*.5 + vP.y + .1) * 3.) * .035;
      float warm = uNight * .07 * smoothstep(.2, -.6, vP.y);
      vec3 col = mix(vec3(1.), uTint, .4);
      float alpha = clamp(a * .55 + sheen + warm, 0., .8) * uFade;
      col = mix(col, vec3(1., .78, .5), clamp(warm / max(alpha, .001) * uFade, 0., 1.));
      gl_FragColor = vec4(col, alpha);
    }`,
});
const glassScene = new THREE.Scene();
const glass = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(WIN.w, WIN.h, WIN.r), 24), glassMat);
glass.position.set(WIN.cx, WIN.cy, WALL_Z - 0.02);
glassScene.add(glass);

// ---------- environment ----------
let env;
function applyEnv() {
  env = computeEnv(state.hour ?? clockHour(), state.weather);
  U.uSunCol.value.copy(env.sunCol).multiplyScalar(env.sunI);
  U.uAmb.value.copy(env.amb).multiplyScalar(env.ambI * 0.75);
  U.uSunDir.value.copy(env.night > 0.5 ? env.moonDir : env.sunDir);
  U.uFogCol.value.copy(env.fog);
  U.uFogNear.value = env.fogNear;
  U.uFogFar.value = env.fogFar;
  U.uNight.value = env.night;
  U.uWind.value = env.wind;
  U.uRain.value = env.rain;
  U.uCloudShade.value = env.cloud;
  sky.material.uniforms.uTop.value.copy(env.top);
  sky.material.uniforms.uHor.value.copy(env.hor);
  sky.material.uniforms.uMoonDir.value.copy(env.moonDir);
  sky.material.uniforms.uCloud.value = env.cloud;
  scene.fog.color.copy(env.fog);
  scene.fog.near = env.fogNear;
  scene.fog.far = env.fogFar;
  hemi.color.copy(env.top).lerp(env.amb, 0.5);
  hemi.groundColor.set('#3a2a24').lerp(env.amb, 0.2);
  hemi.intensity = env.ambI * 1.5;
  scene.environmentIntensity = (1 - env.night) * (1 - env.cloud * 0.5) * 0.32 + 0.05;
  sun.color.copy(env.sunCol);
  sun.intensity = env.sunI * 1.2;
  sun.position.copy(sun.target.position).addScaledVector(env.lightDir, 9);
  cabinLamp.intensity = env.interior * 2.4;
  lampHeadMat.emissiveIntensity = env.night * 3;
  glowMat.opacity = env.night;
  MAT.win.emissiveIntensity = env.night * 2.2;
  MAT.water.color.copy(env.hor).lerp(env.top, 0.4).multiplyScalar(1.6);
  rainMesh.visible = env.rain > 0;
  glassMat.uniforms.uRain.value = env.rain;
  glassMat.uniforms.uNight.value = env.night;
  glassMat.uniforms.uTint.value.copy(env.hor);
  post.uniforms.uNight.value = env.night;
  post.uniforms.uExposure.value = THREE.MathUtils.lerp(1.0, 1.15, env.night) * (env.cloud > 0.8 ? 1.12 : 1);
  UI.setRain(env.rain > 0);
  pickDrink(env);
}
applyEnv();
setInterval(() => { if (state.hour == null) applyEnv(); }, 60000);

// ---------- resize ----------
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const w = Math.round(innerWidth * rtScale), h = Math.round(innerHeight * rtScale);
  rt.setSize(w, h);
  post.uniforms.uRes.value.set(w, h);
}
addEventListener('resize', resize);
resize();

// ---------- pointer, hover, focus ----------
const pointer = new THREE.Vector2(), mouse = new THREE.Vector2(), mouseEase = new THREE.Vector2();
const ray = new THREE.Raycaster();
let hovered = null, focus = null, busy = false, hinted = false;
addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mouse.copy(pointer);
});

function ownerOf(obj) {
  while (obj && !interactive.includes(obj)) obj = obj.parent;
  return obj;
}
for (const o of interactive) {
  o.userData.hover = 0;
  o.userData.mats = [];
  o.traverse((m) => {
    if (!m.isMesh) return;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    list.forEach((mat) => { if (!o.userData.mats.includes(mat) && mat.emissive) o.userData.mats.push(mat); });
  });
  o.userData.baseEmissive = o.userData.mats.map((m) => ({ c: m.emissive.clone(), i: m.emissiveIntensity }));
}

const tweens = [];
function tween(dur, fn) {
  return new Promise((res) => tweens.push({ t: 0, dur, fn, res }));
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FOCUS_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

function focusPose(dist, local = new THREE.Vector3()) {
  const p = new THREE.Vector3(local.x, local.y, -dist).applyMatrix4(camRest.matrixWorld);
  const q = camRest.quaternion.clone().multiply(FOCUS_Q);
  return { p, q };
}
function worldPose(o) {
  return { p: o.position.clone(), q: o.quaternion.clone() };
}
async function fly(o, from, to, dur, lift = 0.06) {
  await tween(dur, (t) => {
    const e = ease(t);
    o.position.lerpVectors(from.p, to.p, e);
    o.position.y += Math.sin(Math.PI * e) * lift;
    o.quaternion.slerpQuaternions(from.q, to.q, e);
  });
}

// size of the open journal on screen, matched by the HTML spread
function bookLayout() {
  const { CW, CH } = journal.userData;
  const aspect = (2 * CW) / CH;
  const wpx = Math.min(innerWidth * 0.8, innerHeight * 0.8 * aspect);
  const dist = (2 * CW * innerHeight) / (wpx * 2 * tanHalf());
  return { wpx, hpx: wpx / aspect, dist };
}

async function openJournal() {
  busy = true; focus = journal; hinted = true;
  const { pivot, T } = journal.userData;
  const lay = bookLayout();
  const to = focusPose(lay.dist + T);
  await fly(journal, worldPose(journal), to, 1.0);
  await tween(0.8, (t) => { pivot.rotation.z = ease(t) * Math.PI; });
  UI.veil(true);
  await UI.showBook(lay.wpx, lay.hpx);
  journal.visible = false;
  busy = false;
}
async function closeJournal() {
  busy = true;
  const { pivot, home } = journal.userData;
  journal.visible = true;
  UI.veil(false);
  await UI.hideBook();
  await tween(0.6, (t) => { pivot.rotation.z = (1 - ease(t)) * Math.PI; });
  await fly(journal, worldPose(journal), home, 0.9);
  focus = null; busy = false;
}

async function openEnvelope() {
  busy = true; focus = envelope; hinted = true;
  const { pivot, letter, EW, ET } = envelope.userData;
  const wpx = Math.min(innerWidth * 0.36, 520);
  const dist = (EW * innerHeight) / (wpx * 2 * tanHalf());
  await fly(envelope, worldPose(envelope), focusPose(dist + ET, new THREE.Vector3(0, -0.02, 0)), 0.9);
  await tween(0.5, (t) => { pivot.rotation.x = -ease(t) * Math.PI * 0.92; });
  await tween(0.6, (t) => { letter.position.z = 0.002 - ease(t) * 0.11; });
  UI.veil(true);
  await UI.showLetter();
  envelope.visible = false;
  busy = false;
}
async function closeEnvelope() {
  busy = true;
  const { pivot, letter, home } = envelope.userData;
  envelope.visible = true;
  UI.veil(false);
  await UI.hideLetter();
  await tween(0.45, (t) => { letter.position.z = 0.002 - (1 - ease(t)) * 0.11; });
  await tween(0.4, (t) => { pivot.rotation.x = -(1 - ease(t)) * Math.PI * 0.92; });
  await fly(envelope, worldPose(envelope), home, 0.8);
  focus = null; busy = false;
}

function screenOf(o) {
  const v = o.getWorldPosition(new THREE.Vector3()).project(camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}

let ledBlink = 0;
function pressIntercom() {
  hinted = true;
  ledBlink = 1.2;
  UI.chime();
  UI.toggleChat(screenOf(intercom));
}

addEventListener('click', (e) => {
  if (e.target !== canvas) return;
  if (busy) return;
  if (focus === journal) return closeJournal();
  if (focus === envelope) return closeEnvelope();
  if (!hovered) return;
  const kind = hovered.userData.kind;
  if (kind === 'journal') openJournal();
  else if (kind === 'envelope') openEnvelope();
  else if (kind === 'intercom') pressIntercom();
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || busy) return;
  if (focus === journal) closeJournal();
  else if (focus === envelope) closeEnvelope();
  else UI.closeChat();
});
UI.onBackdrop(() => {
  if (busy) return;
  if (focus === journal) closeJournal();
  else if (focus === envelope) closeEnvelope();
});

// ---------- dev panel ----------
if (state.dev) {
  UI.devPanel(state, WEATHERS, () => applyEnv());
}

// ---------- loop ----------
// ?at=<metres> starts further down the line, for checking a particular stretch
let travel = parseFloat(params.get('at')) || 0, time = 0, last = performance.now(), nextJoint = travel + 25, jolt = 0;
let frames = 0, frameAcc = 0, qualityChecks = 0;
const hoverColor = new THREE.Color('#ffd9a0');

function updateProps() {
  const range = 26;
  const place = (pool, sp, off, setup) => {
    const k0 = Math.ceil((travel - range - off) / sp), k1 = Math.floor((travel + range - off) / sp);
    let j = 0;
    for (let k = k0; k <= k1 && j < pool.length; k++, j++) {
      pool[j].visible = true;
      pool[j].position.x = k * sp + off - travel;
      if (setup) setup(pool[j], k);
    }
    for (; j < pool.length; j++) pool[j].visible = false;
  };
  place(poles, POLE.sp, POLE.off);
  place(lamps, LAMP.sp, LAMP.off);
  place(signs, L, 1.6, (s, k) => { s.userData.board.material = signMats[((k % 16) + 16) % 16]; });

  // light from the nearest lamp sweeps through the carriage
  const k = Math.round((travel - LAMP.off) / LAMP.sp);
  const lx = k * LAMP.sp + LAMP.off - travel;
  passLamp.position.set(lx, GROUND_Y + 3, LAMP.z + 0.5);
  passLamp.intensity = env.night * 14 * Math.exp(-(lx * lx) / 18);

  // countryside, one group per field
  const f0 = Math.floor((travel - 90) / L), f1 = Math.floor((travel + 170) / L);
  for (const [k2, f] of fields) {
    if (k2 < f0 || k2 > f1) {
      outside.remove(f.g);
      f.g.traverse((o) => { if (o.userData.own) o.geometry.dispose(); });
      fields.delete(k2);
    }
  }
  for (let k2 = f0; k2 <= f1; k2++) {
    if (!fields.has(k2)) fields.set(k2, spawnField(k2));
    const f = fields.get(k2);
    f.g.position.x = k2 * L - travel;
  }
}

// Tint sky, haze and ambient light towards the current field's palette,
// easing across the joins between stretches.
const _grade = new THREE.Color(), _g2 = new THREE.Color();
function applyGrade() {
  const fi = Math.floor(travel / L), local = travel - fi * L;
  const at = (k) => GRADE[((k % 16) + 16) % 16];
  const ss = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  _grade.copy(at(fi - 1)).lerp(at(fi), ss(-60, 60, local));
  _g2.copy(_grade).lerp(at(fi + 1), ss(L - 60, L + 60, local));
  U.uFogCol.value.copy(env.fog).multiply(_g2);
  scene.fog.color.copy(U.uFogCol.value);
  sky.material.uniforms.uHor.value.copy(env.hor).multiply(_g2);
  sky.material.uniforms.uTop.value.copy(env.top).lerp(_grade.copy(env.top).multiply(_g2), 0.6);
  U.uAmb.value.copy(env.amb).multiplyScalar(env.ambI * 0.75).multiply(_grade.set(1, 1, 1).lerp(_g2, 0.5));
  const mist = segAt(MIST, travel, 60);
  U.uFogNear.value = env.fogNear * (1 - mist * 0.5);
  U.uFogFar.value = env.fogFar * (1 - mist * 0.5);
  scene.fog.near = U.uFogNear.value;
  scene.fog.far = U.uFogFar.value;
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  time += dt;
  travel += SPEED * dt;

  // rail joints: a double knock and a small jolt
  if (travel > nextJoint) {
    nextJoint += 25;
    jolt = 1;
    UI.clack();
  }
  jolt = Math.max(0, jolt - dt * 3);

  U.uTravel.value = travel % WRAP;
  U.uTime.value = time;
  glassMat.uniforms.uTime.value = time;
  updateProps();
  applyGrade();
  for (const f of fields.values()) for (const s of f.spinners) s.rotation.z -= dt * s.userData.speed;

  // camera: parallax with the mouse, sway of the carriage
  const settle = focus ? 0 : 1;
  mouseEase.lerp(mouse.clone().multiplyScalar(settle), 1 - Math.exp(-dt * 3));
  const sway = Math.sin(time * 1.7) * 0.0025 + Math.sin(time * 0.63) * 0.002 + jolt * jolt * 0.004 * Math.sin(time * 40);
  camera.position.set(CAM_POS.x + mouseEase.x * 0.08, CAM_POS.y + mouseEase.y * 0.035 + sway * settle, CAM_POS.z);
  camera.lookAt(CAM_TARGET.x + mouseEase.x * 0.02, CAM_TARGET.y + mouseEase.y * 0.01, CAM_TARGET.z);
  camera.rotateZ(Math.sin(time * 0.9) * 0.0018 * settle);
  sky.position.copy(camera.position);
  drink.rotation.z = Math.sin(time * 1.7) * 0.004 + jolt * 0.01 * Math.sin(time * 30);
  updateSteam(dt);

  // tweens
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    tw.fn(tw.t);
    if (tw.t >= 1) { tweens.splice(i, 1); tw.res(); }
  }

  // hover
  if (!focus && !busy) {
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(interactive, true)[0];
    hovered = hit ? ownerOf(hit.object) : null;
  } else hovered = null;
  canvas.style.cursor = hovered || focus ? 'pointer' : 'default';
  const hintPulse = hinted ? 0 : Math.max(0, Math.sin(time * 1.3 - 2)) ** 8 * 0.6;
  for (const o of interactive) {
    const target = o === hovered ? 1 : 0;
    o.userData.hover += (target - o.userData.hover) * (1 - Math.exp(-dt * 10));
    const h = o.userData.hover;
    if (!focus || o !== focus) {
      if (o.userData.kind !== 'intercom' && o !== focus) o.position.y = o.userData.home.p.y + h * 0.012;
    }
    const glow = Math.max(h * 0.18, hintPulse * 0.12);
    o.userData.mats.forEach((m, i) => {
      const b = o.userData.baseEmissive[i];
      m.emissive.copy(hoverColor).multiplyScalar(glow / Math.max(b.i, 0.01)).add(b.c);
    });
  }
  ledBlink = Math.max(0, ledBlink - dt);
  const led = intercom.userData.led.material;
  led.emissiveIntensity = ledBlink > 0 ? (Math.sin(ledBlink * 20) > 0 ? 3 : 0.3) : 0.3 + 0.2 * Math.sin(time * 2);

  glassMat.uniforms.uFade.value += ((focus ? 0 : 1) - glassMat.uniforms.uFade.value) * (1 - Math.exp(-dt * 6));

  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  renderer.autoClear = false;
  renderer.render(glassScene, camera);
  renderer.autoClear = true;

  // adaptive quality: drop the painting resolution if frames are slow
  frames++; frameAcc += dt;
  if (frameAcc > 2.5) {
    const ms = (frameAcc / frames) * 1000;
    if (qualityChecks++ > 0 && ms > 24 && rtScale > 0.56) { rtScale -= 0.15; resize(); }
    UI.fps(1000 / ms, rtScale);
    frames = 0; frameAcc = 0;
  }
  requestAnimationFrame(frame);
}

UI.init({ pages });
// tick(n): run n frames by hand, for testing while the page is in the background
Object.assign(window.__three, { openJournal, closeJournal, openEnvelope, closeEnvelope, pressIntercom, U, ground, tick: (n = 1) => { for (let i = 0; i < n; i++) frame(last + 16); } });
requestAnimationFrame((t) => { last = t; frame(t); UI.reveal(); });
