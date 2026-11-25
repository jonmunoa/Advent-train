/* Manos: cuelgan hacia −y desde la muñeca (0,0,0); el pulgar mira hacia +x. La del otro lado se refleja al cargarla. */
import {smin, smax, sph, ell, cap, oclusion, gauss, sstep, tubo} from './esculpe-sdf.mjs';

const pinta = f => M => {const n = M.p.length / 3, c = new Float32Array(n * 4); for (let i = 0; i < n; i++) {const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], ao = oclusion(f, x, y, z, M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], .02); c.set([ao, .12 + .5 * sstep(-.07, -.1, y), 0, 0], i * 4)} return c};
/* dedos: [x, y, z] de la raíz, de la articulación y de la punta, y radios */
const dedos = (x, y, z, D) => {let d = 9; for (const [a, b, c, r0, r1] of D) {const e = smin(cap(x, y, z, a, b, r0, r0 * .96), cap(x, y, z, b, c, r0 * .96, r1), .002); d = smin(d, e, .0022)} return d};
export function manos() {
  const o = {};
  { // mano de mujer o de hombre (se escala): relajada, dedos un poco doblados
    const D = [[[.014, -.05, .004], [.016, -.074, .0075], [.0135, -.094, .001], .0072, .0052], [[.0035, -.053, .005], [.004, -.08, .009], [.003, -.102, .0015], .0075, .0053], [[-.0068, -.052, .0045], [-.0075, -.077, .008], [-.0065, -.097, .001], .007, .005], [[-.0165, -.048, .003], [-.0185, -.067, .0055], [-.017, -.082, .0005], .006, .0044]];
    const f = (x, y, z) => {let d = ell(x + .001, y + .032, z, .0225, .03, .0125); d = smin(d, cap(x, y, z, [0, .02, 0], [0, -.01, 0], .0165, .0165), .018); d = smin(d, ell(x - .012, y + .03, z + .006, .012, .018, .01), .008); d = smin(d, dedos(x, y, z, D), .006); const t = smin(cap(x, y, z, [.014, -.02, -.004], [.03, -.041, -.009], .0095, .0078), cap(x, y, z, [.03, -.041, -.009], [.0335, -.062, -.0095], .0078, .0056), .003); d = smin(d, t, .009); for (const q of [.0125, .003, -.0068, -.0155]) d -= .0009 * gauss(Math.hypot(x - q, y + .052, z - .012), .005); return d};
    o.mano = {f, caja: [[-.04, .05], [-.115, .03], [-.03, .03]], paso: .0017, tris: 1500, pinta: pinta(f)};
  }
  { // manopla
    const f = (x, y, z) => {let d = ell(x + .001, y + .036, z, .03, .042, .0215); d = smin(d, cap(x, y, z, [0, .012, 0], [0, -.012, 0], .023, .024), .016); d = smin(d, cap(x, y, z, [.016, -.016, 0], [.036, -.036, -.002], .0135, .0125), .011); d -= .0012 * gauss(y - .002, .006); return d};
    o.manopla = {f, caja: [[-.045, .06], [-.09, .03], [-.04, .04]], paso: .0026, tris: 800, pinta: pinta(f)};
  }
  /* calzado: el origen es el tobillo y el suelo queda en y = −alto */
  const suela = (x, y, z, {l0, l1, w, alto, gr, r = .006}) => {const u = Math.max(0, Math.min(1, (x - l0) / (l1 - l0))), hw = w * (.72 + .34 * Math.sin(Math.PI * Math.pow(u, .8) * .86 + .25)) * (u > .86 ? Math.sqrt(Math.max(.05, 1 - ((u - .86) / .16) ** 2)) : 1), dx = Math.max(l0 - x, x - l1), q = [Math.max(dx + r, 0), Math.max(Math.abs(y + alto - gr / 2) - gr / 2 + r, 0), Math.max(Math.abs(z) - hw + r, 0)]; return Math.hypot(...q) - r + Math.min(0, Math.max(dx + r, Math.abs(y + alto - gr / 2) - gr / 2 + r, Math.abs(z) - hw + r))};
  { // bota de nieve del niño
    const A = .05, S = {l0: -.062, l1: .104, w: .047, alto: A, gr: .019}, caña = (x, y, z) => {const r = .052 + .004 * sstep(.02, .09, y) + .0022 * Math.sin(y * 150 + x * 12) * sstep(.0, .03, y); return Math.max(Math.hypot(x + .012 - y * .04, z * 1.02) - r, y - .105, -y - .02)};
    const cuero = (x, y, z) => {let d = smin(ell(x - .04, y + .016, z, .07, .036, .046), ell(x + .015, y + .012, z, .052, .042, .046), .03); d = smin(d, caña(x, y, z), .022); d = smin(d, ell(x - .078, y + .022, z, .03, .026, .04), .012); d -= .0016 * gauss(x - .062 + y * .3, .0035) * sstep(.0, -.03, y - .02); return d}, f = (x, y, z) => {let d = cuero(x, y, z); d = Math.max(d, -(y + A - .008)); return Math.min(smin(d, suela(x, y, z, S), .003), d)};
    o.botaNino = {f, caja: [[-.085, .125], [-.06, .12], [-.07, .07]], paso: .0032, tris: 1500, pinta: M => {const n = M.p.length / 3, c = new Float32Array(n * 4); for (let i = 0; i < n; i++) {const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], ao = oclusion(f, x, y, z, M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], .03); c.set([ao, suela(x, y, z, S) < cuero(x, y, z) - .0004 ? 1 : 0, 0, 0], i * 4)} return c}, extras: () => {const L = []; for (let k = 0; k < 4; k++) {const y = .012 + k * .02, x0 = .058 - k * .006, T = [[x0 - .012, y, -.036], [x0 + .006 + .004, y + .003, -.012], [x0 + .008, y + .001, .012], [x0 - .012, y - .001, .036]]; L.push(tubo(T, () => [.0034, .0026], {lados: 6, seg: 8, arr: [0, 1, 0], color: () => [.9, .5, 0, 0]}))} return L}};
  }
  { // bota alta de mujer, con algo de tacón
    const A = .075, S = {l0: -.052, l1: .132, w: .034, alto: A, gr: .011, r: .004}, cuero = (x, y, z) => {let d = smin(ell(x - .052, y + .05, z, .076, .022, .031), ell(x + .012, y + .028, z, .04, .046, .034), .03); const yy = Math.max(0, Math.min(1, y / .31)), r = .041 + .018 * Math.sin(yy * 1.9) + .0026 * Math.sin(y * 95 + x * 20) * sstep(.02, .1, y) * sstep(.24, .1, y); d = smin(d, Math.max(Math.hypot(x + .012 + .006 * yy, z) - r, y - .31, -y - .03), .022); return d}, taco = (x, y, z) => Math.max(Math.abs(x + .032) - .02, Math.abs(z) - .024, -(y + A), y + .03) - .002, f = (x, y, z) => {const d = Math.max(cuero(x, y, z), -(y + A - .004)); return Math.min(smin(d, suela(x, y, z, S), .002), smin(d, taco(x, y, z), .006))};
    o.botaMadre = {f, caja: [[-.092, .15], [-.085, .325], [-.075, .075]], paso: .0034, tris: 1900, pinta: M => {const n = M.p.length / 3, c = new Float32Array(n * 4); for (let i = 0; i < n; i++) {const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], ao = oclusion(f, x, y, z, M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], .03); c.set([ao, Math.min(suela(x, y, z, S), taco(x, y, z)) < cuero(x, y, z) - .0004 ? 1 : 0, 0, 0], i * 4)} return c}};
  }
  { // zapato de hombre
    const A = .075, S = {l0: -.066, l1: .152, w: .041, alto: A, gr: .014, r: .005}, cuero = (x, y, z) => {let d = smin(ell(x - .062, y + .05, z, .088, .026, .038), ell(x + .014, y + .034, z, .05, .046, .038), .03); d = smin(d, Math.max(Math.hypot(x + .016, z) - .046, y - .02, -y - .04), .02); d -= .0014 * gauss(x - .1 + y * .2, .003); return d}, f = (x, y, z) => {const d = Math.max(cuero(x, y, z), -(y + A - .005)); return Math.min(smin(d, suela(x, y, z, S), .002), d)};
    o.zapato = {f, caja: [[-.085, .17], [-.085, .035], [-.06, .06]], paso: .0034, tris: 1300, pinta: M => {const n = M.p.length / 3, c = new Float32Array(n * 4); for (let i = 0; i < n; i++) {const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], ao = oclusion(f, x, y, z, M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], .03); c.set([ao, suela(x, y, z, S) < cuero(x, y, z) - .0004 ? 1 : 0, 0, 0], i * 4)} return c}};
  }
  return o;
}
