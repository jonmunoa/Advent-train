/* Un tren de vapor completo (máquina, ténder, furgones con marca y furgón de cola) que da vueltas por una vía.
   Los furgones y las ruedas son mallas instanciadas; cada maqueta tiene el suyo. */
import {THREE, RT, WB, WS, GAUGE, WLEN, WTOP, WHALF, TM, M, wagonGeos, bigWheelGeos, smallWheelGeos, buildLoco, buildTender, buildCaboose, SPH, coneTex, dotTex,
  PANEL, PANEL_Y, AD_W, AD_H, drawAd, loadImg, adTex, hostOf, ZAX, ONE, QFLIP, lerp} from './kit.js';
import {atM, kindAt, KT} from './esc-vias.js';

export const V = 6.2;   // unidades por segundo: despacio, para verlo pasar
let GEO = null;
const geos = () => GEO || (GEO = {w: wagonGeos(), b: bigWheelGeos(), s: smallWheelGeos()});
const lac = c => new THREE.MeshPhysicalMaterial({color: c, roughness: .3, clearcoat: 1, clearcoatRoughness: .06});
const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), q1 = new THREE.Quaternion(), v1 = new THREE.Vector3();
let freeM = null;
const freeMat = () => {if (freeM) return freeM; const cv = document.createElement('canvas'); cv.width = AD_W; cv.height = AD_H; drawAd(cv, {text: 'Tu marca aquí', sub: 'Toca el vagón para ponerla', bg: '#16213f', tag: 'Libre'}); return freeM = new THREE.MeshBasicMaterial({map: adTex(cv), toneMapped: false, color: new THREE.Color(.82, .82, .82)})};

/* haz del faro: se apaga en los bordes y cerca de la cámara, para que no se vea el cono */
const HAZ = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexShader: 'varying vec3 n,p;varying float u;void main(){vec4 m=modelViewMatrix*vec4(position,1.);n=normalMatrix*normal;p=m.xyz;u=uv.y;gl_Position=projectionMatrix*m;}', fragmentShader: 'varying vec3 n,p;varying float u;void main(){float k=pow(abs(dot(normalize(n),normalize(p)))+1e-4,2.2)*pow(max(u,0.),1.5)*smoothstep(9.,34.,-p.z);gl_FragColor=vec4(vec3(.3,.23,.12)*k,1.);}'});

export class Tren {
  constructor(par, T, {wagons = 4, body = 0x0e4a31, trim = 0xb3121f, cols = ['#8f1d24', '#16492f', '#1f3a6b', '#e6d8b8']} = {}) {
    this.T = T; this.s = 0; this.w = 0; this.g = new THREE.Group(); par.add(this.g); this.ads = []; this.wag = [];
    const cb = lac(body), cr = lac(trim), G = geos();
    this.cars = [buildLoco(cb, cr), buildTender(cr)];
    for (let i = 0; i < wagons; i++) {const W = new THREE.Group(); W.userData = {len: WLEN + .2, top: WTOP, wheels: [-2.95, -1.95, 1.95, 2.95].flatMap(x => [-1, 1].map(sd => ({x, y: RT + WS, z: sd * GAUGE, big: false})))}; this.cars.push(W); this.wag.push(W)}
    this.cars.push(buildCaboose(cr));
    this.off = [0]; for (let i = 1; i < this.cars.length; i++) this.off.push(this.off[i - 1] - (this.cars[i - 1].userData.len / 2 + this.cars[i].userData.len / 2 + .55));
    this.len = -this.off[this.off.length - 1] + 6;
    this.cars.forEach(c => this.g.add(c));
    this.wl = []; this.cars.forEach((c, ci) => c.userData.wheels.forEach(w => this.wl.push({c: ci, ...w})));
    const mk = (geo, mat, n) => {const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.g.add(m); return m};
    const nb = this.wl.filter(w => w.big).length;
    this.iw = [mk(G.w.lac, TM.lac, wagons), mk(G.w.blk, TM.black, wagons), mk(G.w.gld, TM.brass, wagons)]; this.ib = [mk(G.b.body, cr, nb), mk(G.b.tire, TM.steel, nb)]; this.is = [mk(G.s.body, cr, this.wl.length - nb), mk(G.s.tire, TM.steel, this.wl.length - nb)];
    for (let i = 0; i < wagons; i++) this.iw[0].setColorAt(i, new THREE.Color(cols[i % cols.length])); this.iw[0].instanceColor.needsUpdate = true;
    // faro con su haz y luces de cola
    const L = this.cars[0], lp = L.userData.lamp, lens = new THREE.Mesh(SPH(.21, 14, 10), M.lamp); lens.position.copy(lp); L.add(lens);
    const cg = new THREE.ConeGeometry(3.6, 20, 24, 1, true); cg.translate(0, -10, 0); cg.rotateZ(Math.PI / 2);
    this.beam = new THREE.Mesh(cg, HAZ); this.beam.position.set(lp.x + .2, lp.y, lp.z); L.add(this.beam);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(11, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: dotTex, color: new THREE.Color(.5, .36, .16), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); glow.position.set(9, RT + .05, 0); L.add(glow);
    this.pose();
  }
  carS(i) {return this.s + this.off[i]}
  pose() {
    const T = this.T;
    this.cars.forEach((c, i) => {const s = this.s + this.off[i], p = atM(T, s), a = atM(T, s + 2), b = atM(T, s - 2); c.position.set(p.x, p.y, p.z); c.rotation.set(0, -Math.atan2(a.z - b.z, a.x - b.x), Math.atan2(a.y - b.y, Math.hypot(a.x - b.x, a.z - b.z)), 'YZX'); c.updateMatrix()});
    this.wag.forEach((W, i) => this.iw.forEach(im => im.setMatrixAt(i, W.matrix)));
    let kb = 0, ks = 0;
    for (const w of this.wl) {const th = this.w / (w.big ? WB : WS); q1.setFromAxisAngle(ZAX, w.z < 0 ? th : -th); if (w.z < 0) q1.premultiply(QFLIP); m2.compose(v1.set(w.x, w.y, w.z), q1, ONE); m1.multiplyMatrices(this.cars[w.c].matrix, m2); if (w.big) {this.ib.forEach(im => im.setMatrixAt(kb, m1)); kb++} else {this.is.forEach(im => im.setMatrixAt(ks, m1)); ks++}}
    [...this.iw, ...this.ib, ...this.is].forEach(im => {im.instanceMatrix.needsUpdate = true});
    const R = this.cars[0].userData.rods, th = this.w / WB; R.forEach((r, i) => {const a = th + i * Math.PI / 2; r.position.x = -.6 + Math.cos(a) * WB * .5; r.position.y = RT + WB - Math.sin(a) * WB * .5});
    this.beam.visible = !this.inTunnel(0);
  }
  inTunnel(i) {const s = this.carS(i); return kindAt(this.T, s + 3) === KT || kindAt(this.T, s - 2) === KT}
  step(dt) {this.s = (this.s + V * dt) % this.T.L; this.w += V * dt; this.pose()}
  chimney(v) {return this.cars[0].localToWorld(v.copy(this.cars[0].userData.chimney))}
  /* marca en los dos costados del furgón i (0…): null deja el «Tu marca aquí» */
  async setAd(i, ad) {
    const W = this.wag[i]; if (!W) return; const tok = W.userData.tok = (W.userData.tok || 0) + 1, im = ad ? await loadImg(ad.img) : null; if (W.userData.tok !== tok) return;
    const old = this.ads[i]; if (old) {W.remove(old.mesh); if (old.ad) {old.mesh.material.map.dispose(); old.mesh.material.dispose()}}
    let mat = freeMat(); if (ad) {const cv = document.createElement('canvas'); cv.width = AD_W; cv.height = AD_H; drawAd(cv, {...ad, im, host: ad.url ? hostOf(ad.url) : ''}); mat = new THREE.MeshBasicMaterial({map: adTex(cv), toneMapped: false, color: new THREE.Color(.86, .86, .86)})}
    const mesh = new THREE.Mesh(PANEL, mat); mesh.position.y = PANEL_Y; W.add(mesh); this.ads[i] = {ad: ad || null, mesh};
  }
}
