/* Un tren completo que da vueltas por una vía. Qué máquina y qué vagones lleva sale del catálogo (TIPOS, esc-trenes.js).
   Los vagones iguales y las ruedas son mallas instanciadas; cada maqueta tiene su tren. */
import {THREE, RT, WB, TM, M, SPH, dotTex, PANEL, PANEL_Y, AD_W, AD_H, drawAd, loadImg, adTex, hostOf, ZAX, QFLIP, LOWQ} from './kit.js';
import {TIPOS, vagon, ruedas, laca, LISA, ligera, ligeraG} from './esc-trenes.js';
import {atM, kindAt, KT} from './esc-vias.js';
import {QS} from './kit.js';
import {VENDER} from './esc-marcas.js';

/* si se ofrecen sitios para marcas (con ?marcas se puede probar) */
export const VENTA = VENDER || QS.has('marcas');

const ADORNO = [['Juguetes', '#7a1020'], ['Caramelos', '#1c5a41'], ['Cartas', '#1d3a78'], ['Regalos', '#8a5a1c']], adornos = [];
const adorno = i => {if (!adornos[i]) {const cv = document.createElement('canvas'); cv.width = AD_W / 2; cv.height = AD_H / 2; const g = cv.getContext('2d'); g.scale(.5, .5); const t = document.createElement('canvas'); t.width = AD_W; t.height = AD_H; drawAd(t, {text: ADORNO[i][0], bg: ADORNO[i][1]}); g.drawImage(t, 0, 0); adornos[i] = new THREE.MeshBasicMaterial({map: adTex(cv), toneMapped: false, color: new THREE.Color(.8, .8, .8)})} return adornos[i]};
export const V = 6.2;   // unidades por segundo: despacio, para verlo pasar
const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), q1 = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), BLANCO = new THREE.Color(1, 1, 1);
let freeM = null;
const freeMat = () => {if (freeM) return freeM; const cv = document.createElement('canvas'); cv.width = AD_W; cv.height = AD_H; drawAd(cv, {text: 'Tu marca aquí', sub: 'Toca el vagón para ponerla', bg: '#16213f', tag: 'Libre'}); return freeM = new THREE.MeshBasicMaterial({map: adTex(cv), toneMapped: false, color: new THREE.Color(.82, .82, .82)})};

/* haz del faro: se apaga en los bordes y cerca de la cámara, para que no se vea el cono */
const HAZ = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexShader: 'varying vec3 n,p;varying float u;void main(){vec4 m=modelViewMatrix*vec4(position,1.);n=normalMatrix*normal;p=m.xyz;u=uv.y;gl_Position=projectionMatrix*m;}', fragmentShader: 'varying vec3 n,p;varying float u;void main(){float k=pow(abs(dot(normalize(n),normalize(p)))+1e-4,3.2)*pow(max(u,0.),1.7)*smoothstep(9.,34.,-p.z);gl_FragColor=vec4(vec3(.2,.15,.08)*k,1.);}'});

export class Tren {
  /* trozos: deja el montaje en this.it para repartirlo entre fotogramas */
  constructor(par, T, o = {}) {this.it = this.haz(par, T, o); if (!o.trozos) while (!this.it.next().done);}
  *haz(par, T, {tipo = 'americana', body = 0x0e4a31, trim = 0xb3121f, cols = ['#8f1d24', '#16492f', '#1f3a6b', '#e6d8b8'], vagones = null, wagons = 0} = {}) {
    this.T = T; this.s = 0; this.w = 0; this.g = new THREE.Group(); par.add(this.g); this.ads = []; this.wag = []; this.tipo = tipo; const D = this.def = TIPOS[tipo] || TIPOS.americana; this.clase = D.clase; this.nombre = D.nombre;
    const cb = laca(body), cr = laca(trim), mat = {cue: cb, tri: cr, cre: laca(0xf0e6d2), lac: TM.lac, lisa: LISA};
    yield; this.cars = D.loco({cb, cr, ...mat}); if (LOWQ) for (const c of this.cars) {yield; ligeraG(c)} this.maq = this.cars.length; let L = vagones || D.v; if (wagons && !vagones) L = Array.from({length: wagons}, (_, k) => D.v[k % D.v.length]);
    // vagones: los iguales comparten mallas instanciadas
    yield; const grupos = new Map(), pon = (nom, k) => {const V = vagon(nom); if (V.grupo) {const g = V.grupo({cb, cr, ...mat}); if (LOWQ) ligeraG(g); this.cars.push(g); return g} const W = new THREE.Group(); W.userData = {len: V.len, top: V.top, wheels: V.wheels, sesgo: V.sesgo || 0, ci: this.cars.length, panel: !!V.panel}; this.cars.push(W); if (!grupos.has(nom)) grupos.set(nom, {V, W: [], c: []}); const G = grupos.get(nom); G.W.push(W); G.c.push(new THREE.Color(cols[k % cols.length])); return W};
    yield; for (const n of new Set(L)) {vagon(n); yield} L.forEach((n, k) => this.wag.push(pon(n, k))); this.wag.forEach((W, k) => {W.userData.ci = this.maq + k}); if (D.cola) pon(D.cola, L.length);
    yield; const ud = c => c.userData, ses = c => ud(c).sesgo || 0; this.off = [0]; for (let i = 1; i < this.cars.length; i++) {const a = this.cars[i - 1], b = this.cars[i]; this.off.push(this.off[i - 1] - (ud(a).len / 2 - ses(a) + ud(b).len / 2 + ses(b) + .5))}
    yield; this.len = -this.off[this.off.length - 1] + 6; this.cars.forEach(c => this.g.add(c));
    yield; const mk = (geo, m, n) => {const q = new THREE.InstancedMesh(geo, m, n); q.castShadow = !m.isMeshBasicMaterial; q.receiveShadow = true; q.frustumCulled = false; this.g.add(q); return q};
    yield; this.iv = [...grupos.values()].map(({V, W, c}) => ({W, im: (LOWQ ? ligera(V.m, mat) : V.m).map(([g, m]) => {const q = mk(g, typeof m === 'string' ? mat[m] : m, W.length); if (m === 'lac' || m === 'lisa') {c.forEach((k, i) => q.setColorAt(i, k)); q.instanceColor.needsUpdate = true} return q})})); this.iv.forEach(v => {v.im[0].userData.con = v.im.slice(1)});
    yield; const R = ruedas(), por = {}; this.cars.forEach((c, ci) => ud(c).wheels.forEach(w => {const k = w.set || (w.big ? 'big' : 'small'); (por[k] = por[k] || []).push({c: ci, ...w, r: w.r || R[k].r})})); this.wl = Object.entries(por).map(([k, l]) => ({l, r: R[k].r, im: (LOWQ ? ligera(R[k].m, {tri: cr}) : R[k].m).map(([g, m]) => mk(g, m === 'tri' ? cr : m, l.length))})); this.wl.forEach(v => {v.im[0].userData.con = v.im.slice(1)});
    // faro con su haz y luces de cola
    yield; const L0 = this.cars[0], lp = L0.userData.lamp, lens = new THREE.Mesh(SPH(.21, 14, 10), M.lamp); lens.position.copy(lp); L0.add(lens);
    yield; if (lp.x < 3.5) lens.scale.setScalar(.8); const cg = new THREE.ConeGeometry(3.6, 20, 24, 1, true); cg.translate(0, -10, 0); cg.rotateZ(Math.PI / 2);
    yield; this.beam = new THREE.Mesh(cg, HAZ); this.beam.position.set(lp.x + .2, lp.y, lp.z); L0.add(this.beam);
    yield; this.pose();
  }
  carS(i) {return this.s + this.off[i]}
  pose() {
    const T = this.T;
    this.cars.forEach((c, i) => {const s = this.s + this.off[i], p = atM(T, s), a = atM(T, s + 2), b = atM(T, s - 2); c.position.set(p.x, p.y, p.z); c.rotation.set(0, -Math.atan2(a.z - b.z, a.x - b.x), Math.atan2(a.y - b.y, Math.hypot(a.x - b.x, a.z - b.z)), 'YZX'); c.updateMatrix()});
    for (const {W, im} of this.iv) {W.forEach((w, i) => im.forEach(q => q.setMatrixAt(i, w.matrix))); im.forEach(q => {q.instanceMatrix.needsUpdate = true})}
    for (const {l, r, im} of this.wl) {l.forEach((w, i) => {const th = this.w / w.r, k = w.r / r; q1.setFromAxisAngle(ZAX, w.z < 0 ? th : -th); if (w.z < 0) q1.premultiply(QFLIP); m2.compose(v1.set(w.x, w.y, w.z), q1, v2.set(k, k, 1)); m1.multiplyMatrices(this.cars[w.c].matrix, m2); im.forEach(q => q.setMatrixAt(i, m1))}); im.forEach(q => {q.instanceMatrix.needsUpdate = true})}
    const U = this.cars[0].userData; U.rods.forEach((r, i) => {const {x0 = -.6, y0 = RT + WB, r: rr = WB * .5} = r.userData, a = this.w / (rr * 2) + i * Math.PI / 2; r.position.x = x0 + Math.cos(a) * rr; r.position.y = y0 - Math.sin(a) * rr}); if (U.gira) for (const [o, v] of U.gira) o.rotation.z = -this.w * v * .12;
    this.beam.visible = !this.inTunnel(0);
  }
  inTunnel(i) {const s = this.carS(i); return kindAt(this.T, s + 3) === KT || kindAt(this.T, s - 2) === KT}
  step(dt) {this.s = (this.s + V * dt) % this.T.L; this.w += V * dt; this.pose()}
  /* dónde sale el humo (null si no echa) */
  chimney(v) {const c = this.cars[0].userData.chimney; return c ? this.cars[0].localToWorld(v.copy(c)) : null}
  /* marca en los dos costados del furgón i (0…): null deja el «Tu marca aquí» */
  async setAd(i, ad) {
    const W = this.wag[i]; if (!W) return; const tok = W.userData.tok = (W.userData.tok || 0) + 1, im = ad ? await loadImg(ad.img) : null; if (W.userData.tok !== tok) return;
    const old = this.ads[i]; if (old && old.mesh) {W.remove(old.mesh); if (old.ad) {old.mesh.material.map.dispose(); old.mesh.material.dispose()}}
    let mat = VENTA ? freeMat() : adorno(i % 4); if (ad) {const cv = document.createElement('canvas'); cv.width = AD_W; cv.height = AD_H; drawAd(cv, {...ad, im, host: ad.url ? hostOf(ad.url) : ''}); mat = new THREE.MeshBasicMaterial({map: adTex(cv), toneMapped: false, color: new THREE.Color(.86, .86, .86)})}
    if (!ad && !VENTA && !W.userData.panel) {this.ads[i] = null; return}
    const mesh = new THREE.Mesh(PANEL, mat); mesh.position.y = PANEL_Y; W.add(mesh); this.ads[i] = {ad: ad || null, mesh};
  }
}
