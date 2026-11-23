/* El tren del escaparate: un niño pasea de la mano de su madre por una calle nevada y se para a mirar los trenes de los
   escaparates. No hay que hacer nada: el paseo va solo. Se puede mirar alrededor, acercarse al cristal o seguir paseando.
   Tres escenas con la misma cámara: la calle, lo que hay dentro de los escaparates (con su propia luz) y el aire (nieve,
   cristal y vaho). Sin servidor: las marcas salen de esc-marcas.js. */
import {THREE, QS, coarse, LOWQ, REDUCED, lerp, clamp, sstep, tick, canvasTex, dotTex, puffTex, loadModels, drawAd, hostOf, AD_W, AD_H, AD_BG, logoURL, loadImg} from './kit.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {Mundo} from './esc-mundos.js';
import {MAPS} from './esc-vias.js';
import {Tienda, suelos, Huellas, nevada, Figura, rotuloTex, S, PASO, VX, VY0, VY1} from './esc-calle.js';
import {marcasEsc, pedirTexto, cleanText, cleanUrl, isoDay, tiendaDe, sitioDe} from './esc-eco.js';
import {CONTACTO, PRECIO_ROTULO, PRECIO_VAGON, MARCAS} from './esc-marcas.js';
import {au, pasos, traqueteo, setCerca, setSonido, sonidoOn, bells, whistle} from './musica.js';
clearTimeout(window.__boot);

const $ = id => document.getElementById(id), canvas = $('c'), DEBUG = QS.has('debug');
document.body.classList.toggle('lowq', LOWQ); document.body.classList.add('espera');
const NOMBRES = ['La Estación', 'La Cumbre', 'Polo Norte'], K = .88, TILT = .13;   // rótulos propios de cada tienda y escala de las maquetas

/* ================= motor ================= */
const renderer = new THREE.WebGLRenderer({canvas, antialias: LOWQ, powerPreference: 'high-performance', stencil: false});
const MAXPR = Math.min(devicePixelRatio || 1, 2); let dynPR = Math.min(coarse ? 1.5 : 1.75, MAXPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = !LOWQ; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
const calle = new THREE.Scene(), dentro = new THREE.Scene(), aire = new THREE.Scene(); calle.background = new THREE.Color('#0b1330'); calle.fog = new THREE.Fog('#0f1a3e', 420, 1150);
const camera = new THREE.PerspectiveCamera(36, 1, 2, 2600);
{const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({color: 0x161826, side: THREE.BackSide}))); for (const [x, y, z, c, r] of [[-30, 20, 10, [9, 5, 2], 8], [20, 30, 20, [5, 4, 3], 9], [0, 5, 40, [2, 2, 3], 10], [30, 8, -12, [1.5, 2, 5], 6]]) {const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8), new THREE.MeshBasicMaterial({color: new THREE.Color(...c)})); m.position.set(x, y, z); es.add(m)} const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(es, .03).texture; pm.dispose(); dentro.environment = t; dentro.environmentIntensity = .5; calle.environment = t; calle.environmentIntensity = .16}
// luz de la calle: luna fría y, por cada escaparate cercano, una luz cálida
calle.add(new THREE.HemisphereLight(0x7c92dc, 0x4a4660, .85)); const luna = new THREE.DirectionalLight(0xa9bfff, .62); luna.position.set(-160, 300, 260); calle.add(luna);
const calor = [0, 1].map(() => {const l = new THREE.PointLight(0xffb066, 0, 420, 1.3); calle.add(l); return l}), farol = new THREE.PointLight(0xffb870, LOWQ ? 480 : 900, 260, 1.5); calle.add(farol);
// luz de dentro: foco cálido con sombras sobre la maqueta que se mira, y relleno azul
dentro.add(new THREE.HemisphereLight(0x9fb6ff, 0x4a3a3a, .72)); const foco = new THREE.DirectionalLight(0xffe4c4, 1.3); foco.castShadow = !LOWQ; foco.shadow.mapSize.set(2048, 2048); Object.assign(foco.shadow.camera, {left: -92, right: 92, top: 74, bottom: -56, near: 1, far: 300}); foco.shadow.bias = -.0005; foco.shadow.normalBias = .2; dentro.add(foco, foco.target);
let composer = null, bloom = null, grade = null;
if (!LOWQ) {composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, {type: THREE.HalfFloatType, samples: 4})); const p1 = new RenderPass(calle, camera), p2 = new RenderPass(dentro, camera), p3 = new RenderPass(aire, camera); p1.clear = true; p2.clear = p3.clear = false; [p1, p2, p3].forEach(p => composer.addPass(p)); bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .42, .55, .9); composer.addPass(bloom);
  grade = new ShaderPass({uniforms: {tDiffuse: {value: null}, t: {value: 0}}, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform sampler2D tDiffuse;uniform float t;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;c.rgb*=mix(.52,1.,smoothstep(.95,.3,length(d*vec2(1.1,1.))));float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(c.rgb,c.rgb*vec3(.93,.97,1.12),smoothstep(.3,0.,l)*.5);c.rgb=mix(c.rgb,c.rgb*vec3(1.08,1.,.88),smoothstep(.4,1.5,l)*.5);c.rgb=mix(vec3(l),c.rgb,1.12)+(h(vUv*977.+fract(t))-.5)*.012;gl_FragColor=c;}'}); composer.addPass(grade); composer.addPass(new OutputPass())}
const draw = dt => {if (composer) composer.render(dt); else {renderer.clear(); renderer.render(calle, camera); renderer.render(dentro, camera); renderer.render(aire, camera)}};
const portrait = () => camera.aspect < .8;
function resize() {const w = innerWidth, h = innerHeight; renderer.setPixelRatio(dynPR); renderer.setSize(w, h, false); if (composer) {composer.setPixelRatio(dynPR); composer.setSize(w, h)} camera.aspect = w / h; camera.fov = portrait() ? 44 : 36; camera.updateProjectionMatrix()}
addEventListener('resize', resize); resize();

/* ================= lo que hay en la calle ================= */
const tiendas = [], mundos = []; let suelo = null, huellas = null, nieve = null, madre = null, nino = null, cristal = [], vaho = null, alientos = [];
const REL = {glass: null};
function cristales() {
  const tx = canvasTex(512, 320, (g, w, h) => {g.clearRect(0, 0, w, h); const gr = (x, y, r, a) => {const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(235,244,255,${a})`); q.addColorStop(1, 'rgba(235,244,255,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h)}; gr(0, h, 84, .5); gr(w, h, 84, .5); gr(0, 0, 64, .34); gr(w, 0, 64, .34); for (let x = 0; x < w; x += 26) gr(x, h + 14, 30, .3); g.globalAlpha = .035; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w * .1, h); g.lineTo(w * .42, 0); g.lineTo(w * .52, 0); g.lineTo(w * .2, h); g.fill(); g.beginPath(); g.moveTo(w * .62, h); g.lineTo(w * .9, 0); g.lineTo(w * .93, 0); g.lineTo(w * .65, h); g.fill()}, 'cristal');
  cristal = [0, 1, 2].map(() => {const m = new THREE.Mesh(new THREE.PlaneGeometry(VX * 2, VY1 - VY0), new THREE.MeshBasicMaterial({map: tx, transparent: true, depthWrite: false, opacity: .8})); m.position.set(0, (VY0 + VY1) / 2, -1.2); m.renderOrder = 4; aire.add(m); return m});
  vaho = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), new THREE.MeshBasicMaterial({map: puffTex, transparent: true, depthWrite: false, opacity: 0, color: 0xeaf2ff})); vaho.position.z = -.6; vaho.renderOrder = 5; aire.add(vaho);
  alientos = [0, 1, 2, 3, 4, 5].map(() => {const s = new THREE.Sprite(new THREE.SpriteMaterial({map: puffTex, transparent: true, depthWrite: false, opacity: 0, color: 0xdfe8ff})); s.userData = {l: 0}; aire.add(s); return s});
}
let alI = 0; function aliento(f, dir) {const s = alientos[alI = (alI + 1) % alientos.length]; f.head.getWorldPosition(s.position); s.position.x += dir.x * 7; s.position.z += dir.z * 7; s.position.y += 3; s.userData = {l: 1, x: dir.x * 9, z: dir.z * 9}}

/* ================= el paseo ================= */
/* estado: inicio → paseo → llega → mira → sale → paseo… n: escaparate al que van (cualquier entero; la calle da la vuelta) */
const E = {st: 'inicio', n: 0, dir: 1, x: -120, t: 0, vel: 0, u: 0, uT: 0, manual: false, az: 0, azT: 0, el: 0, elT: 0, idle: 0, auto: true};
const WX = n => n * PASO, ZM = 54, ZN = 40, DX = 17, AUTO = 110;   // ZM, ZN: por dónde andan la madre y el niño; AUTO: segundos mirando antes de seguir
const V3 = () => new THREE.Vector3(), tp = V3(), v1 = V3(), v2 = V3(), v3 = V3();
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt)), wrap = a => {while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a};
const giro = (f, a, l, dt) => {f.yaw += wrap(a - f.yaw) * (1 - Math.exp(-l * dt))};
/* anda hasta (x, z): devuelve la velocidad a la que va (0 al llegar) */
function andar(f, x, z, v, dt) {const p = f.g.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < .6) {p.x = x; p.z = z; return 0} const s = Math.min(v, d * 3.2 + 6), m = Math.min(d, s * dt); p.x += dx / d * m; p.z += dz / d * m; if (d > 3) giro(f, Math.atan2(-dz, dx), 9, dt); return s}
function ir(n) {if (E.st === 'inicio' || n === E.n) return; if (E.st === 'llega') {E.pend = n; return} const d = n > E.n ? 1 : -1; if (n === E.n) return; E.dir = d; E.n = n; if (E.st === 'mira') {E.st = 'sale'; E.t = 0} E.auto = true; caption(); hideCard()}
/* dónde se paran: en vertical, a un lado del cristal para no tapar la maqueta */
const sitioN = () => portrait() ? -60 : -25, sitioM = () => portrait() ? -88 : -53;
const enCristal = () => E.st === 'mira' || (E.st === 'llega' && E.t > 1.2);
let pasoN = 0;
function paseo(dt, t) {
  E.t += dt; const M = madre, N = nino; let sm = 0, sn = 0; M.reach = [null, null]; N.reach = [null, null]; let mano = false;
  if (E.st === 'inicio') {M.g.position.set(E.x, 0, ZM); N.g.position.set(E.x + DX, 0, ZN); giro(M, -.12, 4, dt); giro(N, .05 + Math.sin(t * .5) * .1, 3, dt); mano = true; N.tip = Math.max(0, Math.sin(t * 5.2)) * .02 * (Math.sin(t * .8) > .2 ? 1 : 0); N.look.y = damp(N.look.y, .5 + Math.sin(t * .6) * .3, 2, dt); M.look.y = damp(M.look.y, .3, 2, dt); M.look.p = damp(M.look.p, -.2, 2, dt)}
  else if (E.st === 'paseo') {
    const X = WX(E.n), fin = X - (E.dir > 0 ? 62 : -14), d = (fin - E.x) * E.dir; E.vel = damp(E.vel, d > 0 ? clamp(d * 1.1 + 6, 8, 44) : 0, 2.2, dt); E.x += E.vel * E.dir * dt; sm = sn = E.vel;
    M.g.position.x = damp(M.g.position.x, E.x, 8, dt); M.g.position.z = damp(M.g.position.z, ZM, 3, dt); N.g.position.x = damp(N.g.position.x, E.x + DX * E.dir, 8, dt); N.g.position.z = damp(N.g.position.z, ZN, 3, dt); const a = E.dir > 0 ? 0 : Math.PI; giro(M, a, 5, dt); giro(N, a, 5, dt); mano = true; N.tip = 0;
    const cerca = sstep(150, 40, d), s = E.dir > 0 ? 1 : -1; N.look.y = damp(N.look.y, s * (cerca * 1.05 + (d > 200 ? -.9 * sstep(200, 300, d) : 0)) + Math.sin(t * .9) * .12, 3, dt); N.look.p = damp(N.look.p, .06, 3, dt); M.look.y = damp(M.look.y, s * cerca * .5 - s * .1, 2, dt); M.look.p = damp(M.look.p, -.12 * cerca, 2, dt);
    if (d <= .5) {E.st = 'llega'; E.t = 0}
  } else if (E.st === 'llega') {
    const X = WX(E.n); sn = andar(N, X + sitioN(), 10.5, 74, dt); sm = E.t > .55 ? andar(M, X + sitioM(), 24, 34, dt) : 0; if (!sn) giro(N, Math.PI / 2, 8, dt); if (!sm && E.t > .6) giro(M, Math.PI / 2 - .25, 5, dt); N.look.y = damp(N.look.y, 0, 5, dt); M.look.y = damp(M.look.y, 0, 3, dt);
    if (!sn && !sm && E.t > 1.4) {E.st = 'mira'; E.t = 0; E.x = X; E.u = 0; E.uT = REDUCED ? .5 : 0; E.manual = false; E.az = E.azT = E.el = E.elT = 0; E.idle = 0; bells(); caption(); if (E.pend !== undefined) {const p = E.pend; E.pend = undefined; ir(p)}}
  } else if (E.st === 'mira') {
    const w = mundos[tiendaDe(E.n)]; giro(N, Math.PI / 2, 6, dt); giro(M, Math.PI / 2 - .25, 4, dt);
    // el niño sigue el tren con la cabeza, se pone de puntillas y apoya las manos en el cristal
    w.tren.cars[1].getWorldPosition(tp); N.head.getWorldPosition(v1); const hy = Math.atan2(-(tp.z - v1.z), tp.x - v1.x) - N.yaw; N.look.y = damp(N.look.y, clamp(wrap(hy), -.75, .75), 2.2, dt); N.look.p = damp(N.look.p, clamp((tp.y - v1.y) * .006, -.15, .2), 2, dt); N.tip = damp(N.tip || 0, Math.sin(t * .7) > .55 ? .035 : 0, 5, dt);
    for (const i of [0, 1]) {v2.set(N.g.position.x + (i ? 9 : -9), 34 + (N.tip || 0) * S + Math.sin(t * 1.3 + i) * .4, .6); N.reach[i] = v2.clone()}
    const mirando = Math.sin(t * .23) > .1; M.look.y = damp(M.look.y, mirando ? -.5 : clamp(wrap(Math.atan2(-(tp.z - 23), tp.x - M.g.position.x) - M.yaw), -.5, .5), 1.4, dt); M.look.p = damp(M.look.p, mirando ? -.42 : 0, 1.4, dt); N.shoulder(0, v3); if (E.t > 1.2) M.reach[1] = v3.clone().add(v1.set(-1, 3, 4));
    if (!E.manual) E.uT = damp(E.uT, portrait() ? .78 : .62, E.t > 1 ? (REDUCED ? 9 : .2) : 0, dt); E.idle += dt; if (E.idle > AUTO && E.auto && !modal() && $('card').hidden) {ir(E.n + 1)}
    vaho.position.x = N.g.position.x; vaho.position.y = 41; vaho.material.opacity = .34 * Math.max(0, Math.sin(t * 1.5)) * sstep(0, 2, E.t);
  } else if (E.st === 'sale') {
    const X = E.x, bx = X + 8 * E.dir; sm = andar(M, bx, ZM, 30, dt); sn = E.t > .7 ? andar(N, bx + DX * E.dir, ZN, 36, dt) : 0; const a = E.dir > 0 ? 0 : Math.PI; if (!sm) giro(M, a, 5, dt); N.tip = 0; N.look.y = damp(N.look.y, E.t < .7 ? 0 : .9 * E.dir, 3, dt); M.look.y = damp(M.look.y, .25 * E.dir, 2, dt); M.look.p = damp(M.look.p, -.2, 2, dt); if (!sm && !sn && E.t > 1.4) {E.st = 'paseo'; E.t = 0; E.x = bx; E.vel = 0}
  }
  if (E.st !== 'mira') vaho.material.opacity = damp(vaho.material.opacity, 0, 4, dt);
  if (mano) {const mi = E.dir > 0 ? 0 : 1, ci = 1 - mi; v1.set(lerp(M.g.position.x, N.g.position.x, .55), 31 + Math.abs(Math.sin(M.ph)) * .7, lerp(M.g.position.z, N.g.position.z, .52)); M.reach[mi] = v1.clone(); N.reach[ci] = v1.clone()}
  for (const f of [M, N]) {if (f.update(dt, t, f === M ? sm : sn)) {const p = f.g.position, sd = (pasoN++ % 2 ? 1 : -1) * (f.n ? 3 : 4); huellas.put(p.x - Math.sin(f.yaw) * sd, p.z - Math.cos(f.yaw) * sd, -f.yaw, f.n ? 4.6 : 6.4); if (!FAST) pasos(f.n ? .7 : 1)} f.g.updateMatrixWorld(true); for (const i of [0, 1]) if (f.reach[i]) f.aim(i, f.reach[i])}
  for (const s of alientos) {const d = s.userData; if (d.l <= 0) {s.material.opacity = 0; continue} d.l -= dt / 1.5; s.position.x += d.x * dt; s.position.z += d.z * dt; s.position.y += 4 * dt; s.scale.setScalar(5 + (1 - d.l) * 11); s.material.opacity = .22 * Math.max(0, d.l) * sstep(1, .8, d.l)}
}

/* ================= cámara ================= */
const cam = {p: V3(), l: V3()}; let FAST = false;
function camObjetivo(t, P, L) {
  const pt = portrait(), X = E.x;
  if (E.st === 'inicio') {P.set(X + (pt ? 12 : 74) + Math.sin(t * .12) * 4, pt ? 112 : 72, pt ? 400 : 318); L.set(X + (pt ? 12 : 74), pt ? 110 : 66, 0); return 1.4}
  if (E.st === 'paseo') {const d = E.dir; P.set(E.x + d * (pt ? 12 : 34), pt ? 88 : 58, pt ? 372 : 276); L.set(E.x + d * (pt ? 14 : 46), pt ? 92 : 63, 8); return 1.7}
  if (E.st === 'llega' || E.st === 'sale') {const Xw = E.st === 'llega' ? WX(E.n) : E.x; P.set(Xw + (pt ? -26 : 10), pt ? 80 : 66, pt ? 330 : 252); L.set(Xw - (pt ? 28 : 2), pt ? 86 : 72, 0); return 1.25}
  // mirando: de detrás de los dos hasta la nariz pegada al cristal, siguiendo un poco al tren
  const w = mundos[tiendaDe(E.n)], u = E.u, e = Math.pow(u, .85), Xw = WX(E.n); w.tren.cars[2].getWorldPosition(tp); const fo = pt ? lerp(.25, .92, u) : lerp(.1, .8, u * u), tx = pt ? lerp(-26, clamp(tp.x - Xw, -34, 62) * fo, clamp((u - .22) * 2.2, 0, 1)) : clamp(tp.x - Xw, -62, 62) * fo; seg.x = damp(seg.x, tx, .8, segDt); seg.y = damp(seg.y, clamp(tp.y, 34, 62), .8, segDt);
  const z = pt ? lerp(330, 40, e) : lerp(244, 20, e), D = z + 36, az = E.az + Math.sin(t * .11) * .03, el = E.el; L.set(Xw + seg.x, lerp(pt ? 84 : 76, lerp(53, seg.y + 4, .7 * u), Math.min(1, u * 1.5)), -36);
  P.set(clamp(L.x * .5 + Xw * .5 + Math.sin(az) * D, Xw - 72 - z * .5, Xw + 72 + z * .5), clamp(lerp(pt ? 80 : 70, 66, u) + Math.sin(el) * D * .7 + Math.sin(t * .17) * .8, 44, 108 + z * .2), z); return 2.6;
}
const seg = {x: 0, y: 44}; let segDt = 0;
function camara(dt, t) {segDt = dt; E.u = damp(E.u, E.uT, 3.2, dt); E.az = damp(E.az, E.azT, 5, dt); E.el = damp(E.el, E.elT, 5, dt); const l = camObjetivo(t, v1, v2), k = FAST ? 1 : 1 - Math.exp(-l * dt); cam.p.lerp(v1, k); cam.l.lerp(v2, k); camera.position.copy(cam.p); camera.lookAt(cam.l); camera.updateMatrixWorld();
  const c = E.st === 'mira' ? lerp(.45, 1, E.u) : E.st === 'llega' || E.st === 'sale' ? .4 : E.st === 'paseo' ? .12 + .2 * sstep(140, 20, Math.abs(WX(Math.round(E.x / PASO)) - E.x)) : .08; setCerca(c); $('frost').style.opacity = E.st === 'mira' ? (sstep(.55, 1, E.u) * .9).toFixed(2) : 0}
/* las tiendas y las maquetas se recolocan delante de quien pasea; solo se mueve y se dibuja lo que se ve */
function colocar(dt, t) {
  const cx = cam.p.x, half = Math.tan(camera.fov * Math.PI / 360) * camera.aspect * (cam.p.z + 60) + 30;
  for (let k = 0; k < 3; k++) {const x = sitioDe(k, cx, PASO); tiendas[k].g.position.x = x; tiendas[k].g.visible = Math.abs(x - cx) < half + PASO / 2 + 20; const m = mundos[k]; m.g.position.set(x, VY0 + 14.5, -39.5); m.g.rotation.x = TILT; m.g.visible = Math.abs(x - cx) < half + VX; cristal[k].position.x = x; cristal[k].visible = m.g.visible; m.smU.k.value = renderer.getPixelRatio() * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)) * K; if (m.g.visible) m.update(dt, t); else m.tren.s = (m.tren.s + 6.2 * dt) % m.T.L; tiendas[k].bm.material.color.setScalar(.62 + .38 * Math.sin(t * 1.9 + k))}
  const ord = [0, 1, 2].map(k => tiendas[k].g.position.x).sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx)); calor.forEach((l, i) => {l.position.set(ord[i], 82, -26); l.intensity = (LOWQ ? 560 : 1150) * sstep(330, 200, Math.abs(ord[i] - cx))}); foco.position.set(ord[0] - 46, 130, 78); foco.target.position.set(ord[0], 40, -40); foco.target.updateMatrixWorld(); farol.position.set(Math.round((cx + PASO / 2) / PASO) * PASO - PASO / 2 + 8, 128, 84);
  suelo.mover(Math.round(cx / 124) * 0 + cx); nieve.t.value = t; nieve.c.value.set(cam.p.x, 130, Math.max(90, cam.p.z - 150)); nieve.k.value = renderer.getPixelRatio() * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
}

/* ================= gestos: mirar alrededor y acercarse ================= */
const ptrs = new Map(); let pin = 0, tap = null, hov = null;
const toca = () => {E.idle = 0; despierta()};
canvas.addEventListener('pointerdown', e => {try {canvas.setPointerCapture(e.pointerId)} catch (_) {} ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); tap = ptrs.size === 1 ? {x: e.clientX, y: e.clientY, t: e.timeStamp} : null; if (ptrs.size === 2) {const [a, b] = [...ptrs.values()]; pin = Math.hypot(a.x - b.x, a.y - b.y)} canvas.classList.add('dr'); toca()});
canvas.addEventListener('pointermove', e => {const p = ptrs.get(e.pointerId); if (!p) {if (e.pointerType === 'mouse') hov = {x: e.clientX, y: e.clientY}; despierta(); return} const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < (e.pointerType === 'touch' ? 10 : 5)) return; tap = null; E.idle = 0;
  if (ptrs.size === 2) {const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pin > 0) zoom((d / pin - 1) * .9); pin = d; return} if (E.st === 'mira') {const k = 1.6 / Math.min(innerWidth, 900); E.azT = clamp(E.azT - dx * k, -.75, .75); E.elT = clamp(E.elT + dy * k, -.25, .6)} else drag += dx});
let drag = 0;
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => {const was = ev === 'pointerup' && tap && e.timeStamp - tap.t < 500; ptrs.delete(e.pointerId); canvas.classList.remove('dr'); if (was) tocar(e.clientX, e.clientY); else if (!ptrs.size && Math.abs(drag) > 60 && E.st === 'paseo') ir(E.n + (drag < 0 ? 1 : -1)); if (!ptrs.size) drag = 0; tap = null});
function zoom(d) {if (E.st !== 'mira') return; E.manual = true; E.uT = clamp(E.uT + d, 0, 1); toca()}
canvas.addEventListener('wheel', e => {e.preventDefault(); const px = e.deltaY * (e.deltaMode === 1 ? 33 : 1); zoom(-clamp(px, -160, 160) * (e.ctrlKey ? .006 : .0009))}, {passive: false});
canvas.addEventListener('contextmenu', e => e.preventDefault());
/* tocar: un vagón o el rótulo enseñan su marca; un escaparate lejano lleva hasta él */
const RC = new THREE.Raycaster(), ND = new THREE.Vector2(), inv = new THREE.Matrix4(), bx = new THREE.Box3(), ry = new THREE.Ray();
function rayo(x, y) {ND.set(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2); RC.setFromCamera(ND, camera); return RC.ray}
function queHay(x, y) {const R = rayo(x, y), px = 2 * Math.tan(camera.fov * Math.PI / 360) / innerHeight; let best = null, bt = 1e9;
  for (let k = 0; k < 3; k++) {const m = mundos[k]; if (!m.g.visible) continue; m.tren.wag.forEach((W, i) => {if (m.tren.inTunnel(i + 2)) return; W.updateWorldMatrix(true, false); inv.copy(W.matrixWorld).invert(); ry.copy(R).applyMatrix4(inv); const e = 7 * px * v3.setFromMatrixPosition(W.matrixWorld).distanceTo(R.origin) / K; bx.min.set(-3.7 - e, .4 - e, -1.6 - e); bx.max.set(3.7 + e, 4.7 + e, 1.6 + e); const h = ry.intersectBox(bx, v2); if (h) {const t = h.applyMatrix4(W.matrixWorld).distanceTo(R.origin); if (t < bt) {bt = t; best = {k, sitio: i + 1}}}})
    const h = RC.intersectObject(tiendas[k].rot, false)[0]; if (h && h.distance < bt) {bt = h.distance; best = {k, sitio: 'rotulo'}}}
  return best}
function tocar(x, y) {if (!listo || E.st === 'inicio') return; au(); const q = queHay(x, y); if (q) {showCard(q.k, q.sitio); return} hideCard(); if (E.st === 'paseo') {const R = rayo(x, y), t = -R.origin.z / R.direction.z; if (t > 0) {const n = Math.round((R.origin.x + R.direction.x * t) / PASO); if (n !== E.n) ir(n)}}}

/* ================= marcas ================= */
const SITIOS = {1: {}, 2: {}, 3: {}};
const EJ = {1: {rotulo: null, 1: {text: 'Pastelería La Estrella', sub: 'Turrón artesano · ejemplo', bg: '#1d3a78', img: logoURL, tag: 'Patrocinado', url: 'https://www.example.com/'}, 2: {text: '¡Feliz Navidad, amama Maite!', sub: 'Ejemplo de mensaje', bg: '#b3162a'}}, 2: {1: {text: '¡Feliz Navidad, aita!', sub: 'Ejemplo de mensaje', bg: '#1c6b45'}}, 3: {1: {text: 'Juguetería El Abeto', sub: 'Ejemplo de marca', bg: '#7a1020', tag: 'Patrocinado', url: 'https://www.example.com/'}}};
async function ponMarcas() {const M = MARCAS.length ? marcasEsc(MARCAS, isoDay()) : EJ; for (let e = 1; e <= 3; e++) {SITIOS[e] = {...M[e]}; await tiendas[e - 1].setRotulo(M[e].rotulo || null); for (let v = 1; v <= 4; v++) await mundos[e - 1].tren.setAd(v - 1, M[e][v] || null)}}
function showCard(k, sitio) {const A = SITIOS[k + 1][sitio], u = A && A.url ? cleanUrl(A.url) : '', rot = sitio === 'rotulo'; $('card').hidden = false; $('caTag').textContent = `${rot ? 'Rótulo' : 'Vagón ' + sitio} · escaparate ${k + 1}${A ? A.tag ? ' · patrocinado' : '' : ' · libre'}`; $('caName').textContent = A ? A.text || 'Imagen sin texto' : rot ? `Tu marca en «${NOMBRES[k]}»` : 'Pon aquí tu marca o un mensaje'; $('caSub').textContent = A ? A.sub || '' : 'Con tu imagen y un enlace a tu web'; $('caGo').hidden = !u; if (u) {$('caGo').href = u; $('caHost').textContent = hostOf(u)} $('caFree').hidden = !!A; Object.assign($('card').dataset, {k, sitio}); E.idle = 0}
function hideCard() {$('card').hidden = true}
$('caX').onclick = hideCard; $('caFree').onclick = () => openAd($('card').dataset.sitio === 'rotulo' ? 'rot' : 'vag');
const modal = () => document.querySelector('.modal.on'), ed = {tab: 'rot', img: '', text: '', sub: '', url: '', bg: AD_BG[0]};
const edAd = () => ({text: cleanText(ed.text, 32), sub: cleanText(ed.sub, 40), bg: ed.bg, img: ed.img, url: cleanUrl(ed.url) || ''}), vacio = () => !ed.img && !cleanText(ed.text, 32) && !cleanText(ed.sub, 40);
async function drawPrev() {const a = edAd(), im = await loadImg(a.img), cv = $('adPrev'), rot = ed.tab === 'rot'; cv.height = rot ? 128 : AD_H; cv.width = AD_W; if (rot) {const t = rotuloTex(vacio() ? 'Tu marca aquí' : a.text, vacio() ? '' : a.sub, a.bg, im); cv.getContext('2d').drawImage(t.image, 0, 0); t.dispose()} else drawAd(cv, vacio() ? {text: 'Tu marca aquí', sub: 'Sube una imagen o escribe un mensaje', bg: a.bg} : {...a, im, host: a.url ? hostOf(a.url) : ''})}
function syncAd() {const rot = ed.tab === 'rot', pr = rot ? PRECIO_ROTULO : PRECIO_VAGON; $('tabRot').setAttribute('aria-selected', rot); $('tabVag').setAttribute('aria-selected', !rot); $('adLead').innerHTML = rot ? `Tu nombre en <b>el letrero de una tienda</b>, encima del escaparate, por <b>${pr} € al día</b>. Quien lo toca ve tu ficha con tu enlace.` : `Tu imagen o mensaje en los dos costados de <b>un vagón</b>, dando vueltas detrás del cristal, por <b>${pr} € al día</b>.`; $('adAsk').textContent = `Pedir este sitio · ${pr} €`; drawPrev()}
function openAd(tab) {if (tab) ed.tab = tab; hideCard(); $('adOk').hidden = true; $('adErr').textContent = ''; syncAd(); $('adSheet').classList.add('on')}
const closeAd = () => $('adSheet').classList.remove('on');
$('bAd').onclick = () => {au(); openAd()}; $('adX').onclick = closeAd; $('adSheet').addEventListener('click', e => {if (e.target === $('adSheet')) closeAd()}); $('tabRot').onclick = () => {ed.tab = 'rot'; syncAd()}; $('tabVag').onclick = () => {ed.tab = 'vag'; syncAd()};
for (const [id, k] of [['adText', 'text'], ['adSub', 'sub'], ['adUrl', 'url']]) $(id).addEventListener('input', e => {ed[k] = e.target.value; $('adErr').textContent = ''; drawPrev()});
$('adBg').innerHTML = AD_BG.map((c, i) => `<button type="button" role="radio" aria-checked="${i === 0}" aria-label="Color ${i + 1}" style="--c:${c}" data-c="${c}"></button>`).join(''); $('adBg').onclick = e => {const b = e.target.closest('button'); if (!b) return; ed.bg = b.dataset.c; $('adBg').querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b)); drawPrev()};
$('adFile').addEventListener('change', async e => {const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 8e6) {$('adErr').textContent = 'Usa una imagen PNG, JPG o WebP de menos de 8 MB.'; return} const u = URL.createObjectURL(f), im = await loadImg(u); URL.revokeObjectURL(u); if (!im) {$('adErr').textContent = 'No se ha podido leer la imagen.'; return} const k = Math.min(1, 800 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ed.img = c.toDataURL(f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9); $('adFileLbl').textContent = 'Cambiar imagen'; drawPrev()});
function adOk() {if (vacio()) {$('adErr').textContent = 'Sube una imagen o escribe un mensaje.'; return false} if (cleanUrl(ed.url) === null) {$('adErr').textContent = 'Revisa el enlace: tiene que ser una web, por ejemplo tumarca.com o instagram.com/tumarca.'; $('adUrl').focus(); return false} return true}
$('adAsk').onclick = () => {if (!adOk()) return; const rot = ed.tab === 'rot', txt = pedirTexto(edAd(), rot ? 'rotulo' : 'vagon', tiendaDe(E.n) + 1, rot ? PRECIO_ROTULO : PRECIO_VAGON), fin = ok => {$('adOk').hidden = false; $('adOk').textContent = CONTACTO ? 'Se abre tu correo con los datos puestos.' : ok ? 'Datos copiados. Pégalos en un mensaje y adjunta tu imagen.' : 'No se han podido copiar los datos.'}; try {navigator.clipboard.writeText(txt).then(() => fin(true), () => fin(false))} catch (e) {fin(false)} if (CONTACTO) {const a = document.createElement('a'); a.href = `mailto:${CONTACTO}?subject=${encodeURIComponent('Mi marca en el escaparate')}&body=${encodeURIComponent(txt)}`; a.click()}};
let previa = null; async function finPrevia() {if (!previa) return; const p = previa; previa = null; $('prevBack').hidden = true; if (p.rot) await tiendas[p.k].setRotulo(SITIOS[p.k + 1].rotulo || null); else await mundos[p.k].tren.setAd(p.i, SITIOS[p.k + 1][p.i + 1] || null)}
$('adSee').onclick = async () => {if (cleanUrl(ed.url) === null) {adOk(); return} await finPrevia(); const k = tiendaDe(E.n), rot = ed.tab === 'rot', libre = [1, 2, 3, 4].find(v => !SITIOS[k + 1][v]) || 1; previa = {k, rot, i: libre - 1}; const a = vacio() ? {text: 'Tu marca aquí', sub: '', bg: ed.bg, img: ''} : edAd(); if (rot) await tiendas[k].setRotulo(a); else await mundos[k].tren.setAd(libre - 1, a); closeAd(); $('prevBack').hidden = false; E.manual = true; E.uT = rot ? 0 : .6};
$('prevBack').onclick = async () => {await finPrevia(); openAd()};

/* ================= interfaz ================= */
function caption() {const k = tiendaDe(E.n); $('capN').textContent = MAPS[k].nombre; $('capS').textContent = E.st === 'mira' ? `Escaparate ${k + 1} de 3` : E.st === 'inicio' ? '' : 'De camino al escaparate ' + (k + 1)}
let toastT = 0; function toast(m) {const el = $('toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600)}
let quietoT = 0; function despierta() {document.body.classList.remove('quieto'); quietoT = performance.now()}
$('bPrev').onclick = () => {au(); despierta(); ir(E.n - 1)}; $('bNext').onclick = () => {au(); despierta(); ir(E.n + 1)};
const pintaSon = () => $('bSon').classList.toggle('off', !sonidoOn()); pintaSon(); $('bSon').onclick = () => {setSonido(!sonidoOn()); au(); pintaSon()};
const url = () => window.ADVX_ESC_URL || location.origin + location.pathname;
$('bShare').onclick = async () => {const text = '🚂 ¿Te acuerdas de cuando te quedabas embobado mirando el tren de un escaparate?'; if (navigator.share) try {await navigator.share({title: 'El tren del escaparate', text, url: url()}); return} catch (e) {if (e && e.name === 'AbortError') return} try {await navigator.clipboard.writeText(url()); toast('Enlace copiado: pégalo donde quieras')} catch (e) {toast('No se ha podido copiar el enlace')}};
addEventListener('keydown', e => {if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === 'Escape') {if (modal()) closeAd(); else hideCard(); return} if (modal() || /INPUT|TEXTAREA/.test(e.target.tagName) || !listo) return; if (e.key === 'ArrowRight') ir(E.n + 1); else if (e.key === 'ArrowLeft') ir(E.n - 1); else if (e.key === '+' || e.key === '=') zoom(.12); else if (e.key === '-') zoom(-.12)});
function empezar() {if (E.st !== 'inicio' || !listo) return; au(); $('intro').classList.add('ido'); document.body.classList.remove('espera'); E.st = 'paseo'; E.t = 0; E.n = 0; caption(); despierta(); if (!FAST) bells()}
$('go').onclick = empezar;

/* ================= bucle ================= */
let last = performance.now(), listo = false, tG = 0, fA = 0, fN = 0, lastAdj = 0, alT = 0, HOLD = false; const dbg = DEBUG ? Object.assign(document.body.appendChild(document.createElement('div')), {id: 'dbg'}) : null; if (dbg) renderer.info.autoReset = false; let dN = 0, dT = 0;
function paso(dt) {tG += dt; paseo(dt, tG); camara(dt, tG); colocar(dt, tG); alT += dt; if (alT > 1.7) {alT = 0; const f = alI % 2 ? madre : nino; if (E.st !== 'mira' || f === madre) aliento(f, {x: Math.cos(f.yaw), z: -Math.sin(f.yaw)})}}
let tqA = 0; function loop(now) {requestAnimationFrame(loop); const raw = (now - last) / 1000; if (coarse && !ptrs.size && raw < 1 / 40) return; last = now; if (!listo) return; if (!HOLD) paso(Math.min(.05, raw));
  if (E.st === 'mira') {tqA += raw; if (tqA > .9) {tqA = 0; traqueteo(E.u)}} if (hov && !ptrs.size) {canvas.classList.toggle('pt', E.st !== 'inicio' && !!queHay(hov.x, hov.y)); hov = null} if (now - quietoT > 6000) document.body.classList.add('quieto'); if (grade) grade.uniforms.t.value = now / 1000;
  if (dbg) renderer.info.reset(); draw(raw); if (dbg) {dN++; dT += raw; if (dT > .5) {dbg.textContent = `${Math.round(dN / dT)} fps · ${(dT / dN * 1000).toFixed(1)} ms · pr ${dynPR.toFixed(2)} · ${renderer.info.render.calls} dc · ${(renderer.info.render.triangles / 1000).toFixed(0)}k · ${E.st}`; dN = dT = 0}}
  if (!window.__noAdapt && !document.hidden && raw < .2) {fA += raw; if (++fN > 40 && now - lastAdj > 1500) {const a = fA / fN, g = coarse ? 1 / 30 : 1 / 60; fA = fN = 0; lastAdj = now; if (a > g * 1.3) {if (dynPR > 1) {dynPR = Math.max(1, dynPR - .2); resize()} else if (renderer.shadowMap.enabled && a > g * 1.8) {foco.castShadow = false; renderer.shadowMap.enabled = false} else if (bloom && bloom.enabled && a > g * 2) bloom.enabled = false}}}}
const prog = (p, t) => {$('lBar').style.transform = `scaleX(${p})`; if (t) $('go').textContent = t};
/* móvil: materiales con barniz pasados a estándar */
function ligero(root) {const c = new Map(); root.traverse(o => {if (!o.isMesh || !o.material.isMeshPhysicalMaterial) return; let m = c.get(o.material); if (!m) {const p = o.material; m = new THREE.MeshStandardMaterial({color: p.color, map: p.map, roughness: Math.max(.35, p.roughness), metalness: Math.min(.6, p.metalness), emissive: p.emissive, emissiveIntensity: p.emissiveIntensity, transparent: p.transparent, opacity: p.opacity, side: p.side}); c.set(p, m)} o.material = m})}
async function boot() {
  $('intro').classList.add('carga'); prog(.05); const fonts = document.fonts ? Promise.all(['400 80px "Alfa Slab One"', '500 40px Rubik', '400 40px Yesteryear'].map(f => document.fonts.load(f))).catch(() => {}) : null;
  await loadModels(p => prog(.05 + p * .4)); await fonts;
  for (let k = 0; k < 3; k++) {prog(.5 + k * .13, ['Encendiendo los escaparates…', 'Nevando en la montaña…', 'Despertando a los duendes…'][k]); await tick(); const m = new Mundo(k).build(); m.g.scale.setScalar(K); dentro.add(m.g); mundos.push(m); const t = new Tienda(k, NOMBRES[k]); calle.add(t.g); tiendas.push(t)}
  prog(.92, 'Poniendo la bufanda…'); await tick(); suelo = suelos(calle); huellas = new Huellas(calle); nieve = nevada(aire, LOWQ ? 420 : 900); cristales(); madre = new Figura('madre'); nino = new Figura('nino'); calle.add(madre.g, nino.g);
  for (const m of mundos) m.tren.s = m.T.L * .04; await ponMarcas(); if (LOWQ) {ligero(dentro); ligero(calle)}
  FAST = true; paso(1 / 60); FAST = false; listo = true; draw(0); $('intro').classList.remove('carga'); $('go').disabled = false; prog(1, 'Dame la mano'); caption();
}
boot().catch(e => {console.error(e); const f = $('fatal'); f.textContent = 'No se ha podido montar la calle. Recarga la página.'; f.hidden = false});
requestAnimationFrame(loop);

/* gancho para las pruebas */
window.__esc = {get listo() {return listo}, get st() {return E.st}, get n() {return E.n}, get E() {return {...E}}, empezar, ir, mundos, tiendas, sitios: () => SITIOS, zoom, queHay, hold: v => {HOLD = v}, scene: {calle, dentro, aire}, get fly() {return FAST},
  step(sec, d = 1 / 30) {const f = FAST; for (let i = 0; i < sec / d; i++) {FAST = true; paso(d)} FAST = f},
  mirar(u) {E.manual = true; E.u = E.uT = u}, cam: () => ({p: cam.p.toArray().map(v => +v.toFixed(1)), l: cam.l.toArray().map(v => +v.toFixed(1))}), setCam: (p, l) => {cam.p.set(...p); cam.l.set(...l); camera.position.copy(cam.p); camera.lookAt(cam.l); camera.updateMatrixWorld(); colocar(0, tG); draw(0)}, pos: () => ({m: madre.g.position.toArray(), n: nino.g.position.toArray(), ym: madre.yaw, yn: nino.yaw, hn: nino.look.y}),
  manos() {const mi = E.dir > 0 ? 0 : 1, a = v1.clone(), b = v1.clone(), t = (f, i, o) => {f.g.updateMatrixWorld(true); return o.set(0, -f.D.arm, 0).applyMatrix4(f.arm[i].matrixWorld)}; t(madre, mi, a); t(nino, 1 - mi, b); return a.distanceTo(b)},
  vagon(k, i) {const W = mundos[k].tren.wag[i]; W.updateWorldMatrix(true, false); const p = new THREE.Vector3(0, 3, 0).applyMatrix4(W.matrixWorld).project(camera); return {x: (p.x * .5 + .5) * innerWidth, y: (.5 - p.y * .5) * innerHeight}},
  rotulo(k) {const p = tiendas[k].rot.getWorldPosition(new THREE.Vector3()).project(camera); return {x: (p.x * .5 + .5) * innerWidth, y: (.5 - p.y * .5) * innerHeight}},
  perf(n = 60, pr = 1) {const ip = dynPR, ar = renderer.info.autoReset, gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); dynPR = pr; resize(); renderer.info.autoReset = false; for (let i = 0; i < 3; i++) {draw(0); sync()} renderer.info.reset(); draw(0); const c = renderer.info.render.calls, tr = renderer.info.render.triangles; const t0 = performance.now(); for (let i = 0; i < n; i++) {renderer.info.reset(); draw(0); sync()} const ms = (performance.now() - t0) / n; renderer.info.autoReset = ar; dynPR = ip; resize(); return {ms: +ms.toFixed(2), calls: c, tris: tr}}};
