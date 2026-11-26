/* Tocar el escenario (sin DOM): qué hay bajo el dedo en una maqueta y la nube de chispas con la que se responde.
   La respuesta la monta escaparates.js: la nieve salta, el abeto se sacude la nieve, en la casa llaman a la puerta (resbala
   la nieve del tejado y la chimenea echa humo), el árbol grande brilla, el hielo tintinea y por el cielo pasa una estrella
   fugaz. En la calle, el niño y la madre se vuelven y saludan. Nada de puntos ni premios: solo que lo que tocas responda */
import {THREE, dotTex} from './kit.js';
import {pondE, riverD} from './esc-vias.js';

const UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Vector3(), _o = new THREE.Vector3(), _b = new THREE.Box3(), _r = new THREE.Ray();
/* distancia por el rayo hasta una esfera de radio r, o Infinity si no la toca */
const bola = (R, x, y, z, r) => R.distanceSqToPoint(_c.set(x, y, z)) < r * r ? Math.max(0, R.origin.distanceTo(_c) - r * .5) : Infinity;
/* la chimenea más cercana a una casa (las casas apuntan su chimenea en smokeAt) */
const chimenea = (M, x, z) => {let b = null, bd = 13; for (const c of M.smokeAt) {const d = Math.hypot(c.x - x, c.z - z); if (d < bd) {bd = d; b = c}} return b};

/* qué hay bajo el rayo R (coordenadas de la maqueta, dirección unitaria) con el suelo a tg (null si no lo toca):
   {k: 'arbol' | 'abeto' | 'casa' | 'hielo' | 'nieve' | 'cielo', …} */
export function queToca(M, R, tg) {
  let k = null, bt = tg === null ? Infinity : tg + 1.5;
  for (const a of M.arbolesN || []) {const H = 50 * a.sc, r = 17 * a.sc; for (const [f, q] of [[.25, .9], [.5, .66], [.75, .4], [.95, .2]]) {const t = bola(R, a.x, a.y + H * f, a.z, r * q); if (t < bt) {bt = t; k = {k: 'arbol', x: a.x, y: a.y, z: a.z, h: H, r}}}}
  for (const a of M.abetosN || []) for (const [f, q] of [[.28, .36], [.52, .27], [.76, .17]]) {const t = bola(R, a.x, a.y + a.h * f, a.z, a.h * q + .45); if (t < bt) {bt = t; k = {k: 'abeto', x: a.x, y: a.y, z: a.z, h: a.h}}}
  for (const [x, z, ry, hw, hd, hh] of M.bloq || []) {
    const y = M.gy(x, z); _r.origin.copy(R.origin).sub(_o.set(x, y, z)).applyAxisAngle(UP, -ry); _r.direction.copy(R.direction).applyAxisAngle(UP, -ry);
    _b.min.set(-hw - .3, -1, -hd - .3); _b.max.set(hw + .3, hh * 1.35, hd + .3); if (!_r.intersectBox(_b, _c)) continue; const t = _c.distanceTo(_r.origin); if (t < bt) {bt = t; k = {k: 'casa', x, y, z, ry, hw, hd, hh, chim: chimenea(M, x, z)}}
  }
  if (k) return k; if (tg === null) return {k: 'cielo'};
  const p = R.at(tg, new THREE.Vector3()), m = M.m;
  return {k: pondE(m, p.x, p.z) < 1 || riverD(m, p.x, p.z) < 3.4 ? 'hielo' : 'nieve', x: p.x, y: p.y, z: p.z};
}

/* chispas: puntos que brillan (se suman a lo de detrás), con su gravedad y su vida; un solo dibujo para todas.
   mx: tamaño máximo en píxeles por unidad de tamaño (en la calle, 5; en las maquetas, que van en miniatura, más) */
export function nubeChispas(par, n, mx = 5) {
  const p = new Float32Array(n * 3).fill(-9999), c = new Float32Array(n * 3), a = new Float32Array(n), tm = new Float32Array(n).fill(5), D = Array.from({length: n}, () => ({l: 0})), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('a', new THREE.BufferAttribute(a, 1)); g.setAttribute('tm', new THREE.BufferAttribute(tm, 1));
  const u = {k: {value: 500}, mx: {value: mx}, map: {value: dotTex}}, m = new THREE.Points(g, new THREE.ShaderMaterial({uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'uniform float k,mx;attribute float a,tm;attribute vec3 color;varying vec3 c;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(tm*k/-mv.z*(.45+.55*min(1.,a)),1.5,tm*mx);c=color*a;gl_Position=projectionMatrix*mv;}', fragmentShader: 'uniform sampler2D map;varying vec3 c;void main(){gl_FragColor=vec4(c*texture2D(map,gl_PointCoord).a,1.);}'}));
  m.frustumCulled = false; m.visible = false; par.add(m); let i = 0;
  return {
    m,
    /* q chispas desde (x, y, z) a velocidad v en todas direcciones (o hacia d), con gravedad g0, vida life, colores cols y tamaño tam */
    lanza(x, y, z, q, v, g0, life, cols, tam = 5, piel = 0, d = null) {m.visible = true; for (let k = 0; k < q; k++) {const o = D[i = (i + 1) % n], th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), s = v * (Math.random() < piel ? .92 + Math.random() * .12 : .55 + Math.random() * .5); tm[i] = tam; Object.assign(o, {l: 1, life: life * (.7 + Math.random() * .5), vx: Math.sin(ph) * Math.cos(th) * s + (d ? d.x : 0), vy: Math.cos(ph) * s + (d ? d.y : 0), vz: Math.sin(ph) * Math.sin(th) * s + (d ? d.z : 0), g: g0}); p.set([x, y, z], i * 3); c.set(cols[k % cols.length], i * 3)} g.attributes.tm.needsUpdate = true},
    paso(dt, px) {u.k.value = px; if (!m.visible) return; let v = 0; for (let k = 0; k < n; k++) {const o = D[k]; if (o.l <= 0) {a[k] = 0; continue} v++; o.l -= dt / o.life; o.vy -= o.g * dt; const f = Math.exp(-1.1 * dt); o.vx *= f; o.vy *= f; o.vz *= f; p[k * 3] += o.vx * dt; p[k * 3 + 1] += o.vy * dt; p[k * 3 + 2] += o.vz * dt; a[k] = Math.max(0, o.l) * 1.6} g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.a.needsUpdate = true; if (!v) m.visible = false},
    get vivas() {let v = 0; for (const o of D) if (o.l > 0) v++; return v}
  };
}

/* estrellas fugaces: una cabeza que cruza el cielo dejando un rastro de chispas */
export function fugaces() {
  const L = [];
  return {
    /* desde p (mundo) hacia la dirección dir, a vel u/s durante dur s, con chispas de tamaño tam en la nube ch */
    lanza(ch, p, dir, vel, tam, dur = .9) {L.push({ch, p: p.clone(), q: p.clone(), v: dir.clone().setLength(vel), t: 0, dur, tam})},
    paso(dt) {for (let i = L.length - 1; i >= 0; i--) {const f = L[i]; f.t += dt; if (f.t > f.dur) {L.splice(i, 1); continue} f.q.copy(f.p); f.p.addScaledVector(f.v, dt); const k = 1 - f.t / f.dur, e = Math.min(1, f.t * 8) * k, v = f.v.length(), n = Math.min(12, Math.ceil(v * dt / (f.tam * .5)));
      // el rastro se reparte por el tramo recorrido en este fotograma: una línea seguida aunque vaya deprisa
      for (let j = 1; j <= n; j++) {const u = j / n, x = f.q.x + (f.p.x - f.q.x) * u, y = f.q.y + (f.p.y - f.q.y) * u, z = f.q.z + (f.p.z - f.q.z) * u; f.ch.lanza(x, y, z, 1, v * .01, 0, (.14 + .14 * e) * (.6 + .4 * u), [[2.6 * e, 2.5 * e, 2.1 * e]], f.tam * (.6 + .5 * e))} f.ch.lanza(f.p.x, f.p.y, f.p.z, 1, v * .03, v * .02, .45 * e + .1, Math.random() < .5 ? [[1.5, 1.4, 1]] : [[1, 1.2, 1.8]], f.tam * .45)}},
    get n() {return L.length}
  };
}
