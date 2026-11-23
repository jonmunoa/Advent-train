/* El niño, su madre y quien pasa por la acera de enfrente. Procedurales, en metros (se escalan por S).
   Cada pieza junta su geometría en tres telas (lana, punto y liso) con el color en los vértices; las telas llevan un
   contraluz suave para que se recorten de noche. */
import {THREE, mergeGeometries, rng, lerp, clamp, vnoise, canvasTex, pixTex, geoOnly, BX, CY} from './kit.js';
import {S} from './esc-calle.js';

/* ---------- telas ---------- */
const nrm = (size, f, k, key) => {const hh = new Float32Array(size * size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hh[y * size + x] = f(x, y); const H = (a, b) => hh[((b + size) % size) * size + ((a + size) % size)]; const t = pixTex(size, (x, y) => {const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1); return [(-dx / l * .5 + .5) * 255, (-dy / l * .5 + .5) * 255, (1 / l * .5 + .5) * 255]}, key, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t};
const lanaN = nrm(128, (x, y) => {const w = 2 * Math.PI / 128; let h = 0; for (const [a, b, p] of [[9, 5, 0], [-6, 11, 2], [14, -9, 4], [3, 17, 1], [21, 6, 5]]) h += Math.sin(x * w * a + Math.sin(y * w * 3 + p) * 1.4 + y * w * b + p); return h * .18 + vnoise(x * .7, y * .7) * .25}, 2.2, 'lanaN');
const puntoN = nrm(128, (x, y) => {const u = x % 16, v = (y + (u < 8 ? u : 16 - u) * 1.1) % 16, d = Math.abs(u % 8 - 4) / 4; return Math.sqrt(Math.max(0, 1 - d * d)) * (.55 + .45 * Math.sin(v / 16 * Math.PI * 2))}, 1.7, 'puntoN');
const rim = (m, k) => {m.onBeforeCompile = s => {s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{float rm=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),2.6);totalEmissiveRadiance+=(diffuseColor.rgb*.8+.06)*rm*vec3(.62,.6,.86)*${k.toFixed(2)};}`)}; return m};
/* una sola tela para todo: el vértice dice si es liso (0), lana (1) o punto (2) */
const TELA = {liso: 0, lana: 1, punto: 2}, paño = (() => {const m = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .9, normalMap: lanaN}); m.onBeforeCompile = s => {s.uniforms.puntoMap = {value: puntoN}; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float tk;varying float vTk;varying vec2 vTu;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvTk=tk;vTu=uv;'); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D puntoMap;varying float vTk;varying vec2 vTu;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor=mix(.6,.97,step(.5,vTk));').replace('#include <normal_fragment_maps>', 'vec3 nL=texture2D(normalMap,vTu*11.).xyz*2.-1.,nP=texture2D(puntoMap,vTu*5.).xyz*2.-1.;nL.xy*=.34;nP.xy*=.8;vec3 mapN=vTk<.5?vec3(0.,0.,1.):vTk<1.5?nL:nP;normal=normalize(tbn*mapN);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{float rm=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),2.6);totalEmissiveRadiance+=(diffuseColor.rgb*.8+.06)*rm*vec3(.62,.6,.86)*(vTk<.5?.3:.55);}')}; return m})();
const tela = (n, sc, rep, rough) => {if (n) {n = n.clone(); n.repeat.set(rep, rep); n.needsUpdate = true} return rim(new THREE.MeshStandardMaterial({vertexColors: true, roughness: rough, normalMap: n || null, normalScale: new THREE.Vector2(sc, sc)}), n ? .55 : .3)};
const puntoG = tela(puntoN, .8, 5, 1), MT = {paño};
/* gorro de punto con cenefa nórdica */
const gorroT = canvasTex(256, 128, (g, w, h) => {g.fillStyle = '#b81c2c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5efe2'; const p = ['..#..', '.###.', '#####', '.###.', '..#..'], px = 4; for (let X = 0; X < w; X += 32) p.forEach((r, y) => [...r].forEach((c, x) => {if (c === '#') g.fillRect(X + 6 + x * px, 60 + y * px, px, px)})); for (let x = 0; x < w; x += 8) {g.fillRect(x, 88, 4, 4); g.fillRect(x + 4, 92, 4, 4); g.fillRect(x, 48, 4, 4); g.fillRect(x + 4, 44, 4, 4)} g.fillRect(0, 98, w, 3); g.fillRect(0, 36, w, 3); g.fillStyle = 'rgba(40,0,0,.18)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1)}, 'gorro');
MT.gorro = rim(new THREE.MeshStandardMaterial({map: gorroT, roughness: 1, normalMap: puntoG.normalMap}), .5);

const lathe = (pts, n = 40, sx = 1, sz = 1) => {const c = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(...p))), g = new THREE.LatheGeometry(c.getPoints(Math.round(pts.length * (1 + 2.6 * DET))), dd(n)); g.scale(sx, 1, sz); return g};
/* prenda con pliegues: el borde de abajo ondula */
const vuelo = (g, y0, y1, n, amp, ph = 0) => {const p = g.attributes.position; for (let i = 0; i < p.count; i++) {const y = p.getY(i), k = Math.pow(clamp((y1 - y) / (y1 - y0), 0, 1), 1.4); if (k <= 0) continue; const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 + amp * k * (Math.sin(a * n + ph) * .7 + Math.sin(a * (n * 2 + 1) + ph * 2) * .3); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f)} g.computeVertexNormals(); return g};
const peluda = (g, amp, f) => {const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) {const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = (vnoise(x * f + 7, y * f + z * f * 1.7) - .5) * amp; p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d)} g.computeVertexNormals(); return g};
let DET = 1; const dd = n => Math.max(6, Math.round(n * DET));
const aro = (r, t, n = 40) => new THREE.TorusGeometry(r, t, dd(12), dd(n)), SPH = (r, a = 12, b = 9) => new THREE.SphereGeometry(r, dd(a), dd(b)), TOR = (r, t, n = 28) => new THREE.TorusGeometry(r, t, dd(8), dd(n));
const cap = (r, l, a = 12) => new THREE.CapsuleGeometry(r, l, dd(5), dd(a)), tubo = (pts, r, n = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), dd(n), r, dd(8));
const _m = new THREE.Matrix4(), _c = new THREE.Color();
/* lista de [geometría, tela, color, x, y, z, rx, ry, rz] → una malla por tela */
function pieza(list, par) {
  const by = {}; for (const [g0, t, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0] of list) {let g = g0; g.applyMatrix4(_m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); g = geoOnly(g); if (t !== 'gorro') {const n = g.attributes.position.count, a = new Float32Array(n * 3); _c.set(c); for (let i = 0; i < n; i++) a.set([_c.r, _c.g, _c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('tk', new THREE.BufferAttribute(new Float32Array(n).fill(TELA[t]), 1))} (by[t === 'gorro' ? t : 'paño'] ||= []).push(g)}
  const G = new THREE.Group(); for (const t in by) G.add(new THREE.Mesh(mergeGeometries(by[t], false), MT[t])); par.add(G); return G;
}
export const ROPA = {
  nino: {abrigo: 0x27498c, abrigo2: 0x1d3870, bufanda: 0xc41e2e, bufanda2: 0xf3ecdd, pelo: 0x6b4426, bota: 0x8a5a2b, pant: 0x2a2c36, mano: 0xc41e2e},
  madre: {abrigo: 0x8f2136, abrigo2: 0x74172a, bufanda: 0xe9dcc0, bufanda2: 0xe9dcc0, pelo: 0x4a2c1c, bota: 0x3b2418, pant: 0x2b2530, mano: 0x33221a, boina: 0xe9dcc0},
};
const PIEL = 0xf0c4a4, OJO = 0x1c1410, MEJ = 0xe98f86, ORO = 0xd9a441, CUERO = 0x4a2c1c, BLANCO = 0xf4efe4;

export class Figura {
  constructor(tipo, ropa, det = 1) {
    DET = det;
    const n = this.n = tipo === 'nino', R = {...ROPA[n ? 'nino' : 'madre'], ...ropa}; this.g = new THREE.Group(); this.g.scale.setScalar(S); this.b = new THREE.Group(); this.g.add(this.b); this.ph = 0; this.alt = n ? 1.05 : 1.7;
    const D = this.D = n ? {hip: .3, sho: .67, sw: .14, arm: .31, lw: .07} : {hip: .78, sho: 1.34, sw: .185, arm: .56, lw: .085};
    // piernas (pivotan en la cadera)
    this.leg = [-1, 1].map(sd => {const p = new THREE.Group(); p.position.set(0, D.hip, sd * D.lw); this.b.add(p);
      n ? pieza([[cap(.06, .14), 'lana', R.pant, 0, -.1, 0], [lathe([[.066, -.06], [.07, 0], [.067, .06], [.072, .075]]), 'liso', R.bota, .005, -.2, 0], [SPH(.072, 16, 10).scale(1.4, .6, .92), 'liso', R.bota, .04, -.26, 0], [BX(.18, .022, .12), 'liso', 0x2a1a10, .035, -.29, 0], [TOR(.066, .017, 18).rotateX(Math.PI / 2), 'punto', BLANCO, 0, -.135, 0]], p)
        : pieza([[cap(.066, .4), 'punto', R.pant, 0, -.28, 0], [lathe([[.06, -.16], [.066, -.1], [.078, .02], [.083, .15]]), 'liso', R.bota, 0, -.56, 0], [SPH(.08, 16, 10).scale(1.55, .55, .86), 'liso', R.bota, .05, -.735, 0], [BX(.05, .06, .08), 'liso', 0x1c110a, -.045, -.75, 0], [peluda(aro(.084, .022, 48).rotateX(Math.PI / 2), .012, 170), 'lana', BLANCO, 0, -.41, 0]], p); return p});
    // abrigo
    if (n) {
      pieza([[vuelo(lathe([[.2, .25], [.208, .27], [.192, .4], [.168, .55], [.152, .65], [.11, .715], [0, .735]], 48, .92, 1.1), .25, .52, 6, .05, .6), 'lana', R.abrigo], [lathe([[.2, .252], [.15, .3], [.1, .31]], 32, .92, 1.1), 'lana', R.abrigo2],
        [BX(.012, .4, .012), 'lana', R.abrigo2, -.172, .47, 0, 0, 0, -.14], [BX(.02, .05, .17), 'lana', R.abrigo2, -.163, .5, 0, 0, 0, -.1], ...[-1, 1].map(s => [CY(.016, .016, .012, 12).rotateZ(Math.PI / 2), 'liso', ORO, -.176, .5, s * .062]),
        ...[-1, 1].flatMap(s => [[BX(.1, .085, .014), 'lana', R.abrigo2, .06, .4, s * .198, s * .12], [BX(.11, .028, .018), 'lana', R.abrigo2, .06, .44, s * .196, s * .12]]), ...[.36, .46, .56].flatMap(y => [[cap(.013, .05).rotateX(Math.PI / 2), 'liso', 0xc08a4a, .186 - (y - .36) * .13, y, 0], [BX(.008, .008, .12), 'liso', CUERO, .184 - (y - .36) * .13, y, 0]]),
        // capucha caída sobre la espalda
        [SPH(.12, 22, 14).scale(.72, .92, 1.16), 'lana', R.abrigo, -.112, .66, 0, 0, 0, .25], [TOR(.098, .024, 26), 'lana', R.abrigo2, -.12, .728, 0, Math.PI / 2 - .35, 0, 0], [SPH(.088, 16, 10).scale(.7, .35, 1.05), 'lana', R.abrigo2, -.115, .73, 0],
        [TOR(.1, .046, 28).rotateX(Math.PI / 2), 'punto', R.bufanda, .006, .745, 0], [TOR(.094, .036, 28).rotateX(Math.PI / 2 + .16), 'punto', R.bufanda, .01, .785, 0]], this.b);
      this.tail = new THREE.Group(); this.tail.position.set(-.168, .775, .075); this.b.add(this.tail); this.cola(R.bufanda, R.bufanda2, .1, .085)}
    else {
      pieza([[vuelo(lathe([[.33, .46], [.338, .49], [.3, .7], [.232, .95], [.196, 1.05], [.215, 1.18], [.212, 1.28], [.17, 1.36], [.09, 1.405], [0, 1.41]], 56, .9, 1.06), .46, .98, 7, .065, 1), 'lana', R.abrigo], [lathe([[.325, .465], [.22, .52], [.14, .53]], 40, .9, 1.06), 'lana', R.abrigo2],
        [peluda(aro(.335, .034, 84).rotateX(Math.PI / 2).scale(.9, 1, 1.06), .018, 150), 'lana', BLANCO, 0, .475, 0], [TOR(.198, .024, 40).rotateX(Math.PI / 2).scale(.92, 1.2, 1.08), 'liso', CUERO, 0, 1.05, 0], [BX(.03, .07, .08), 'liso', ORO, .19, 1.05, 0],
        [BX(.014, .52, .016), 'lana', R.abrigo2, -.222, .8, 0, 0, 0, -.16], ...[-1, 1].flatMap(s => [[BX(.018, .018, .018), 'liso', ORO, -.19, 1.05, s * .07], [BX(.1, .02, .016), 'lana', R.abrigo2, .13, .86, s * .235, 0, s * .4, .15]]), ...[1.15, 1.25, .92, .78].map(y => [SPH(.017, 10, 7), 'liso', ORO, y > 1.1 ? .2 : .255 - (y - .74) * .22, y, .01]),
        [peluda(aro(.122, .058, 72).rotateX(Math.PI / 2), .02, 150), 'lana', BLANCO, -.004, 1.405, 0], [peluda(SPH(.12, 36, 24).scale(.5, .9, 1.2), .018, 150), 'lana', BLANCO, -.1, 1.365, 0]], this.b);
      this.tail = new THREE.Group(); this.tail.position.set(-.205, 1.41, .07); this.b.add(this.tail); this.cola(R.bufanda, R.bufanda2, .125, .085);
      this.bag = pieza([[BX(.12, .24, .24), 'liso', 0xc79a5c, 0, .7, .36], [BX(.1, .02, .22), 'liso', 0x8a6232, 0, .825, .36], [TOR(.1, .011, 22), 'liso', 0x6b4426, 0, .88, .36, 0, Math.PI / 2, 0], [BX(.075, .13, .1), 'liso', 0xb3162a, .0, .85, .33, 0, .3, 0], [BX(.08, .135, .018), 'liso', ORO, 0, .85, .33, 0, .3, 0], [cap(.028, .22), 'liso', 0xc98b4a, .01, .92, .43, .25, 0, .12]], this.b)}
    // brazos (pivotan en el hombro; se estiran un poco para llegar a la otra mano)
    this.arm = [-1, 1].map(sd => {const p = new THREE.Group(); p.position.set(0, D.sho, sd * D.sw); this.b.add(p);
      n ? pieza([[lathe([[.052, -.245], [.056, -.23], [.058, -.12], [.06, -.02], [.052, .04], [0, .062]], 22), 'lana', R.abrigo], [TOR(.05, .017, 18).rotateX(Math.PI / 2), 'punto', BLANCO, 0, -.243, 0], [SPH(.05, 16, 12).scale(.86, 1.18, .78), 'punto', R.mano, 0, -.3, 0], [cap(.019, .03), 'punto', R.mano, .038, -.285, 0, 0, 0, .5]], p)
        : pieza([[lathe([[.066, -.44], [.072, -.42], [.07, -.25], [.075, -.06], [.066, .04], [0, .08]], 24), 'lana', R.abrigo], [peluda(aro(.066, .026, 44).rotateX(Math.PI / 2), .012, 180), 'lana', BLANCO, 0, -.435, 0], [SPH(.05, 16, 12).scale(.8, 1.35, .74), 'liso', R.mano, 0, -.525, 0], [cap(.016, .05), 'liso', R.mano, .04, -.51, 0, 0, 0, .4]], p); return p});
    // cabeza
    const h = this.head = new THREE.Group(); h.position.set(0, n ? .79 : 1.45, 0); this.b.add(h);
    if (n) pieza([[SPH(.122, 26, 18).scale(.97, 1.02, .98), 'liso', PIEL, 0, .1, 0], [SPH(.018, 12, 9), 'liso', PIEL, .12, .072, 0], [SPH(.015, 12, 9).scale(.5, 1.15, .9), 'liso', 0x7a2a2a, .117, .03, 0], ...[-1, 1].flatMap(s => [[SPH(.021, 14, 10).scale(.55, 1.1, .9), 'liso', 0xffffff, .107, .102, s * .045], [SPH(.0155, 14, 10).scale(.6, 1.1, .95), 'liso', OJO, .115, .103, s * .043], [SPH(.0048, 8, 6), 'liso', 0xffffff, .124, .11, s * .04], [cap(.0055, .026, 6), 'liso', R.pelo, .112, .138, s * .046, Math.PI / 2 + s * .12, 0, 0], [SPH(.024, 12, 9).scale(.3, .75, 1), 'liso', MEJ, .102, .058, s * .066], [SPH(.028, 10, 8), 'liso', PIEL, 0, .088, s * .122],
      // orejeras con trencita
      [SPH(.05, 12, 9).scale(.9, 1.2, .35), 'punto', R.mano, -.005, .085, s * .128], [cap(.011, .1), 'punto', R.mano, -.005, -.02, s * .132, s * -.12], [peluda(SPH(.021, 18, 14), .008, 260), 'lana', BLANCO, -.005, -.085, s * .14]]),
      [peluda(new THREE.SphereGeometry(.13, dd(24), dd(12), 0, 6.28, 0, 1.95), .01, 90), 'lana', R.pelo, -.012, .09, 0, 0, 0, .34], [new THREE.SphereGeometry(.143, dd(30), dd(14), 0, 6.28, 0, 1.5), 'gorro', 0, -.014, .128, 0, 0, 0, .2], [aro(.139, .029, 44).rotateX(Math.PI / 2), 'punto', BLANCO, -.012, .133, 0, 0, 0, .2]], h);
    else pieza([[SPH(.112, 26, 18).scale(.94, 1.14, .94), 'liso', PIEL, 0, .1, 0], [CY(.05, .06, .1, 14), 'liso', PIEL, 0, -.02, 0], [SPH(.019, 10, 8).scale(1, 1.3, .9), 'liso', PIEL, .11, .09, 0], ...[-1, 1].flatMap(s => [[SPH(.017, 12, 9).scale(.5, 1.05, .9), 'liso', 0xffffff, .094, .124, s * .041], [SPH(.0125, 12, 9).scale(.6, 1.1, .95), 'liso', OJO, .1005, .124, s * .04], [SPH(.004, 8, 6), 'liso', 0xffffff, .108, .13, s * .037], [cap(.0045, .03, 6), 'liso', R.pelo, .1, .155, s * .042, Math.PI / 2 + s * .14, 0, 0], [SPH(.022, 12, 9).scale(.3, .75, 1), 'liso', MEJ, .093, .075, s * .06], [SPH(.012, 8, 6), 'liso', ORO, .01, .04, s * .112]]), [SPH(.016, 10, 8).scale(.5, .5, 1.5), 'liso', 0xb8423f, .102, .045, 0],
      [peluda(SPH(.132, 40, 28).scale(.9, 1.06, 1), .008, 90), 'lana', R.pelo, -.038, .1, 0], [peluda(SPH(.074, 30, 22), .006, 120), 'lana', R.pelo, -.15, .02, 0], [TOR(.05, .014, 22), 'liso', R.mano === 0x33221a ? 0xb3162a : ORO, -.122, .045, 0, 0, Math.PI / 2, 0], ...[-1, 1].map(s => [tubo([[.06, .16, s * .09], [.0, .05, s * .115], [-.06, -.02, s * .09], [-.12, 0, s * .03]], .018, 18), 'lana', R.pelo]),
      [SPH(.15, 28, 14).scale(1, .46, 1.04), 'lana', R.boina || R.bufanda, -.035, .205, .012, .1, 0, .3], [TOR(.118, .02, 30).rotateX(Math.PI / 2), 'punto', R.boina || R.bufanda, -.006, .168, 0, 0, 0, .2], [cap(.009, .02), 'lana', R.boina || R.bufanda, -.06, .28, .02]], h);
    if (n) {this.pom = new THREE.Group(); pieza([[peluda(SPH(.068, 50, 34), .024, 150), 'lana', BLANCO]], this.pom); this.pom.position.set(-.04, .3, 0); h.add(this.pom)}
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: canvasTex(64, 64, g => {const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(8,10,26,.82)'); r.addColorStop(1, 'rgba(8,10,26,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64)}, 'sombra'), transparent: true, depthWrite: false})); bl.position.set(0, .016, .04); bl.scale.set(n ? .66 : 1, 1, n ? .8 : 1.2); bl.renderOrder = 3; this.g.add(bl);
    this.yaw = 0; this.look = {y: 0, p: 0}; this.sp = 0; this.reach = [null, null];
  }
  /* la cola de la bufanda: tres tramos blandos encadenados, con flecos */
  cola(c, c2, l, w) {this.tr = []; let p = this.tail; for (let i = 0; i < 3; i++) {const g = new THREE.Group(); g.position.y = i ? -l : 0; p.add(g); const L = [[cap(w * .5, l * .9).scale(.42, 1, 1.1), 'punto', i === 2 ? c2 : c, 0, -l * .5, 0]]; if (i === 2) for (let q = -2; q <= 2; q++) L.push([cap(.006, .035, 6), 'punto', c, 0, -l - .045, q * w * .2]); pieza(L, g); this.tr.push(g); p = g}}
  shoulder(i, v) {return this.arm[i].getWorldPosition(v)}
  /* apunta un brazo a un punto del mundo */
  aim(i, p) {const a = this.arm[i], v = this.b.worldToLocal(_a.copy(p)).sub(a.position), l = v.length(); a.quaternion.setFromUnitVectors(_dn, v.normalize()); a.scale.set(1, clamp(l / this.D.arm, .75, 1.3), 1)}
  /* sp: velocidad (u/s). Devuelve true cuando pisa */
  update(dt, t, sp) {
    const n = this.n, paso = n ? 21 : 33; this.sp = lerp(this.sp, sp, 1 - Math.exp(-7 * dt)); const k = clamp(this.sp / 38, 0, 1.4), old = this.ph; this.ph += this.sp * dt / paso * Math.PI; const s = Math.sin(this.ph), A = (n ? .62 : .46) * Math.min(1, k * 1.2); this.leg[0].rotation.z = s * A; this.leg[1].rotation.z = -s * A;
    const idle = 1 - Math.min(1, k * 2), kk = Math.min(1, k); this.b.position.y = Math.abs(Math.cos(this.ph)) * (n ? .024 : .02) * kk + (this.tip || 0); this.b.rotation.z = -.035 * k; this.b.rotation.x = s * .03 * k; this.b.rotation.y = s * (n ? .09 : .05) * kk; this.b.scale.y = 1 + Math.sin(t * 1.7 + (n ? 1 : 0)) * .006 * idle;
    for (const i of [0, 1]) if (!this.reach[i]) {const a = this.arm[i]; a.scale.y = lerp(a.scale.y, 1, 1 - Math.exp(-6 * dt)); _e2.set((i ? 1 : -1) * -.14, 0, (i ? -s : s) * A * .75); a.quaternion.slerp(_q2.setFromEuler(_e2), 1 - Math.exp(-8 * dt))}
    this.g.rotation.y = this.yaw; this.head.rotation.set(0, this.look.y, this.look.p, 'YZX'); this.tr.forEach((g, i) => {g.rotation.z = -.04 - k * (.26 - i * .1) - Math.sin(t * 4 - i * .9) * .07 * (.25 + k); g.rotation.x = Math.sin(t * 2.6 - i) * .06 * (.3 + k)}); if (this.pom) {this.pom.position.y = .3 + Math.abs(Math.cos(this.ph)) * .01 * kk; this.pom.rotation.z = s * .12 * kk} return k > .15 && Math.floor(old / Math.PI) !== Math.floor(this.ph / Math.PI);
  }
}
const _a = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0), _e2 = new THREE.Euler(), _q2 = new THREE.Quaternion();
