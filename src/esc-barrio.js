/* El resto de la calle: cielo, calzada, casas de enfrente, luces colgadas de lado a lado, farolas, el puesto de castañas
   y la gente que pasa. Todo se repite cada tres tiendas (PER) y se recoloca con la cámara, así que la calle no se acaba. */
import {THREE, mergeGeometries, rng, lerp, clamp, vnoise, fbm, LOWQ, M, canvasTex, phTex, dotTex, puffTex, BX, CY, TOR, SPH, PLN, o3} from './kit.js';
import {E, PASO, S} from './esc-calle.js';
import {Bloques} from './esc-bloque.js';
import {arbolito, guirnalda, corona} from './esc-follaje.js';
import {Figura} from './esc-gente.js';
import {juntar, CUBOS} from './esc-geo.js';

export const PER = PASO * 3, ZF = 420;   // periodo de la calle y fachada de enfrente
const GLb = (r, g, b) => new THREE.MeshBasicMaterial({color: new THREE.Color(r, g, b)}), C = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: .8, ...o});

const cartel = (t, bg) => canvasTex(512, 72, (g, w, h) => {g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9a441'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#f6dfa4'; g.font = '400 40px "Alfa Slab One", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 2)}, 'cartel' + t);
export class Barrio {
  constructor(sc, D, M) {
    this.sc = sc; this.t = 0; this.grupos = []; this.bloques = new Bloques(sc, D, M);
    this.cielo(); this.follaje(D); this.curiosidades(); this.fondo();
  }
  /* guirnaldas y coronas de abeto de las fachadas (van con el bloque) */
  follaje(D) {const L = [], A = (g, m) => L.push([g, m]), inner = new THREE.Group(); D.guirnaldas.forEach((q, i) => guirnalda(A, q.p, q.r, Math.round(q.p.length * 9), {semilla: 5 + i})); D.coronas.forEach(([x, y, z, R, r], i) => {const s = z > 200 ? Math.PI : 0, M = new THREE.Matrix4().makeRotationY(s).setPosition(x, y, z), n0 = L.length; corona(A, 0, 0, 0, R, r, {semilla: 3 + i}); for (let k = n0; k < L.length; k++) L[k][0].applyMatrix4(M)}); juntar(L, inner, {sombra: false}); this.bloques.grupos.forEach((G, i) => G.add(i ? inner.clone() : inner))}
  /* noche nublada de nevada: el resplandor de la ciudad enciende las nubes por abajo */
  cielo() {
    const G = this.sky = new THREE.Group(), m = new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {t: {value: 0}}, vertexShader: 'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `uniform float t;varying vec3 d;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float f(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+7.;a*=.5;}return s;}
void main(){vec3 v=normalize(d);float e=max(v.y,0.);vec2 p=v.xz/(e+.22)*1.3+vec2(t*.004,0.);float c=f(p+f(p*1.7)*.7),b=f(p*3.1+4.);vec3 base=mix(vec3(.052,.046,.052),vec3(.010,.013,.024),smoothstep(0.,.55,e));vec3 nub=mix(vec3(.10,.078,.070),vec3(.026,.028,.040),smoothstep(0.,.6,e));vec3 col=mix(base,nub,smoothstep(.34,.72,c)*(.6+.5*b));float lu=pow(max(0.,dot(v,normalize(vec3(.72,.42,-.1)))),60.);col+=vec3(.16,.17,.21)*lu*smoothstep(.75,.35,c);gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}); this.skyM = m; G.add(new THREE.Mesh(new THREE.SphereGeometry(2300, 32, 16), m)); G.traverse(o => {o.renderOrder = 20; o.frustumCulled = false}); this.sc.add(G);
  }
  /* puesto de castañas, árboles en maceta y muñeco de nieve; y tres personas que pasan por enfrente */
  curiosidades() {
    const G = this.cg = new THREE.Group(), L = [], A = (g, m, x, y, z, rx = 0, ry = 0, rz = 0) => {g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); L.push([g, m])}, bulbs = [];
    // castañas
    {const x = 214, z = 122; A(CY(15, 12, 34, 18), E.iron, x, 24, z); A(CY(17, 17, 3, 18), E.dark, x, 42, z); A(CY(14, 14, 2, 18), GLb(2.6, .8, .18), x, 43, z); const r = rng(4); for (let i = 0; i < 26; i++) {const a = r() * 6.28, q = Math.sqrt(r()) * 12; A(SPH(1.9, 8, 6), i % 3 ? C(0x4a2413, {roughness: .5}) : C(0x6b3a1c, {roughness: .5}), x + Math.cos(a) * q, 45.4, z + Math.sin(a) * q)} for (const a of [0, 2.1, 4.2]) A(CY(1.2, 1.2, 12, 6), E.iron, x + Math.cos(a) * 11, 5, z + Math.sin(a) * 11); A(CY(1.4, 1.4, 96, 8), E.bench, x + 30, 48, z + 4); for (let i = 0; i < 8; i++) {const g = new THREE.ConeGeometry(42, 18, 1, 1, true, i * Math.PI / 4, Math.PI / 4); A(g, i % 2 ? E.red : E.frame, x + 30, 100, z + 4)} A(new THREE.ConeGeometry(20, 8, 16), E.snow, x + 30, 107, z + 4); A(BX(40, 20, 2), E.bench, x + 34, 34, z + 18, 0, .1, 0); A(PLN(38, 15), new THREE.MeshBasicMaterial({map: cartel('Castañas', '#5a1620')}), x + 34, 34, z + 19.4, 0, .1, 0); A(PLN(38, 15), new THREE.MeshBasicMaterial({map: cartel('Castañas', '#5a1620')}), x + 33.6, 34, z + 16.6, 0, .1 + Math.PI, 0); for (let q = 0; q < 22; q++) {const a = q / 22 * 6.28; bulbs.push([x + 30 + Math.cos(a) * 41, 91, z + 4 + Math.sin(a) * 41])}}
    // abetos en maceta y muñeco de nieve
    for (const [x, z, s] of [[140, 116, 1.4], [480, 114, 1.6], [820, 114, 1.5]]) {A(CY(9 * s, 7 * s, 13 * s, 14), E.post, x, 6.5 * s, z); A(CY(9.6 * s, 9.6 * s, 2 * s, 14), E.gold, x, 13 * s, z); A(CY(1.3 * s, 2 * s, 16 * s, 8), E.bench, x, 20 * s, z); arbolito((g, m) => L.push([g, m]), x, 16 * s, z, 18 * s, 44 * s, {luces: bulbs, nl: 46, semilla: x, dens: 1.15}); for (let q = 0; q < 12; q++) {const u = (q + .5) / 12, a = q * 2.4 + 1, rr = 17.4 * s * Math.pow(1 - u * .9, .82); A(SPH(1.3 * s, 10, 8), [E.red, E.gold][q % 2], x + Math.cos(a) * rr, (16 + 44 * (.02 + u * .84)) * s - rr * .24, z + Math.sin(a) * rr)} A(SPH(2.6 * s, 12, 9), GLb(2.8, 2, .7), x, 61 * s, z)}
    {const x = 878, z = 120; A(SPH(15, 20, 14), E.snow, x, 13, z); A(SPH(10.5, 18, 12), E.snow, x, 34, z); A(SPH(7.6, 18, 12), E.snow, x, 49, z); A(new THREE.ConeGeometry(1.2, 7, 8), C(0xe8772e), x, 49, z - 10, -Math.PI / 2); for (const q of [-2.6, 2.6]) A(SPH(.9, 8, 6), E.dark, x + q, 51.6, z - 6.8); A(CY(6.4, 6.4, 9, 16), E.dark, x, 59, z); A(CY(10, 10, 1.4, 18), E.dark, x, 55, z); A(TOR(7.6, 2, 18).rotateX(Math.PI / 2), E.red, x, 42, z); for (const sd of [-1, 1]) A(CY(.7, .9, 22, 6), E.bench, x + sd * 17, 38, z, 0, 0, sd * -1)}
    const inner = new THREE.Group(); juntar(L, inner, {sombra: false}); const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}), bulbs.length), B = [[2.2, .3, .25], [2.2, 1.5, .5], [.35, .9, 2.2], [.35, 1.9, .6]]; bulbs.forEach(([x, y, z], i) => {o3.position.set(x, y, z); o3.rotation.set(0, 0, 0); o3.scale.set(1, 1, 1); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); im.setColorAt(i, new THREE.Color(...B[i % 4]))}); inner.add(im);
    this.copias = [0, 1].map(i => {const g = i ? inner.clone() : inner; G.add(g); return g}); this.sc.add(G);
    // humo del puesto
    this.humo = [0, 1, 2, 3].map(i => {const s = new THREE.Sprite(new THREE.SpriteMaterial({map: puffTex, transparent: true, depthWrite: false, opacity: 0, color: 0xcfd6ea})); s.userData.u = i / 4; this.sc.add(s); return s});
    // castañera y gente que pasa por enfrente
    const R = [{abrigo: 0x3d4f3a, abrigo2: 0x2c3a2a, bufanda: 0xd9a441, bufanda2: 0xd9a441, boina: 0x7a2f33, pelo: 0x8d8a88}, {abrigo: 0x2f3b5c, abrigo2: 0x232c46, bufanda: 0xb3162a, bufanda2: 0xb3162a, boina: 0xb3162a, pelo: 0x2a1a12}, {abrigo: 0x6b5236, abrigo2: 0x55402a, bufanda: 0x2c6b4f, bufanda2: 0x2c6b4f, boina: 0x2c6b4f, pelo: 0x5a3a22}];
    this.gente = (LOWQ ? R.slice(0, 1) : R).map((r, i) => {const f = new Figura('madre', r, .5); if (i === 0) {f.bag.visible = false; f.yaw = Math.PI / 2 + .25; f.look.p = .05} this.sc.add(f.g); return f}); this.paseantes = [null, {x: -200, v: 26, z: 366}, {x: 420, v: -30, z: 392}];
  }
  /* al fondo de la calle, un gran árbol iluminado y las torres del pueblo entre la bruma */
  fondo() {
    this.fin = [-1, 1].map(sd => {const G = new THREE.Group(), L = [], az = C(0x1a2350); const m = new THREE.MeshBasicMaterial({color: 0x1d2552, fog: false}), m2 = new THREE.MeshBasicMaterial({color: 0x171d47, fog: false}), sn = new THREE.MeshBasicMaterial({color: 0x4a5796, fog: false}), w = new THREE.MeshBasicMaterial({color: new THREE.Color(1.1, .72, .34), fog: false});
      for (const [z, h, b] of [[-330, 330, 260], [-120, 250, 200], [40, 210, 190], [420, 230, 200], [620, 320, 260], [860, 260, 240], [-620, 280, 300]]) {L.push([BX(60, h, b).translate(60, h / 2, z), m2]); L.push([new THREE.ConeGeometry(b * .74, 110, 4, 1).rotateY(Math.PI / 4).translate(60, h + 50, z), m]); L.push([new THREE.ConeGeometry(b * .72, 60, 4, 1).rotateY(Math.PI / 4).translate(58, h + 78, z), sn]); const r = rng(z + 900); for (let q = 0; q < 7; q++) L.push([BX(2, 20, 13).translate(60 - sd * 31, 60 + r() * (h - 90), z + (r() - .5) * b * .8), w])}
      L.push([BX(80, 520, 92).translate(90, 260, 330), m]); L.push([new THREE.ConeGeometry(74, 230, 4).rotateY(Math.PI / 4).translate(90, 635, 330), m2]); L.push([new THREE.ConeGeometry(66, 190, 4).rotateY(Math.PI / 4).translate(88, 655, 330), sn]);
      const by = new Map(); L.forEach(([g, mm]) => {if (!by.has(mm)) by.set(mm, []); by.get(mm).push([g, mm])}); by.forEach(l => juntar(l.map(([g, mm]) => {mm.userData.solo = true; return [g, mm]}), G, {sombra: false}));
      // árbol
      const T = [], pino = new THREE.MeshBasicMaterial({color: 0x12352c, fog: false}), nv = new THREE.MeshBasicMaterial({color: 0x3d5a78, fog: false}); pino.userData.solo = nv.userData.solo = true; for (let i = 0; i < 6; i++) {const y = 70 + i * 62, r = 150 - i * 23; T.push([new THREE.ConeGeometry(r, 130, 20).translate(-90, y + 40, 222), pino]); T.push([new THREE.ConeGeometry(r * .7, 60, 20).translate(-90, y + 76, 222), nv])} juntar(T, G, {sombra: false});
      const n = 260, p = new Float32Array(n * 3), c = new Float32Array(n * 3), r = rng(31), K = [[1.6, .35, .3], [1.7, 1.2, .45], [.4, .8, 1.8], [.45, 1.5, .6], [1.7, 1.4, 1]]; for (let i = 0; i < n; i++) {const u = Math.pow(r(), .8), y = 40 + u * 400, rr = (158 - u * 150) * (.86 + r() * .2), a = r() * 6.28; p.set([-90 + Math.cos(a) * rr, y, 222 + Math.sin(a) * rr], i * 3); c.set(K[i % 5], i * 3)} const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({size: 5, sizeAttenuation: false, map: dotTex, transparent: true, depthWrite: false, vertexColors: true, fog: false, blending: THREE.AdditiveBlending})); G.add(pts);
      for (const [y, s, k] of [[230, 900, .16], [492, 170, .9]]) {const h = new THREE.Sprite(new THREE.SpriteMaterial({map: dotTex, color: new THREE.Color(1, .72, .36).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false})); h.position.set(-100, y, 222); h.scale.set(s, s, 1); G.add(h)}
      if (sd < 0) {G.scale.x = 1; G.rotation.y = 0} G.userData.sd = sd; G.traverse(o => {o.frustumCulled = false}); this.sc.add(G); return G});
  }
  /* las luces de la calle se van encendiendo (u de 0 a 1) */
  encender(u) {this.on = u; this.bloques.encender(u)}
  hoy(v) {this.cg.visible = !v; this.hoyV = v; this.gente.forEach(f => {f.g.visible = !v}); this.humo.forEach(s => {s.visible = !v})}
  /* mirando un escaparate de frente no se ve nada de esto */
  ver(v) {this.sky.visible = v; this.cg.visible = v && !this.hoyV; const g = v && !this.hoyV; this.humo.forEach(h => {h.visible = g}); this.gente.forEach(f => {f.g.visible = g}); if (!v) this.fin.forEach(g => {g.visible = false})}
  /* cx: cámara; dir: hacia dónde se anda; u: píxeles por unidad a distancia 1 (para los halos) */
  mover(cx, dir, dt, t, kpx) {
    const c = Math.round(cx / PASO) * PASO, p0 = Math.round((cx + dir * 260) / PER) * PER; this.sky.position.x = cx; this.bloques.mover(cx, dir, t);
    this.copias.forEach((g, i) => {g.position.x = p0 + (i ? (dir > 0 ? PER : -PER) : 0)}); this.fin.forEach(G => {G.position.x = cx + G.userData.sd * 1500; G.visible = G.userData.sd === dir && this.sky.visible});
    const hx = p0 + 214; this.humo.forEach((s, i) => {const u = (t * .22 + i / 4) % 1; s.position.set(hx + Math.sin(t + i * 2) * 3 + u * 8, 48 + u * 52, 122); s.scale.setScalar(14 + u * 34); s.material.opacity = .2 * Math.sin(u * Math.PI)});
    this.gente.forEach((f, i) => {const q = this.paseantes[i]; if (!q) {f.g.position.set(p0 + 206, -6, 152); f.update(dt, t, 0); return} q.x += q.v * dt; if (q.x < cx - 900) q.x += 1800; else if (q.x > cx + 900) q.x -= 1800; f.g.position.set(q.x, 0, q.z); f.yaw = q.v > 0 ? 0 : Math.PI; f.update(dt, t, Math.abs(q.v))});
    this.bloques.bm.color.setScalar(.85 + .15 * Math.sin(t * 1.3));
  }
}
