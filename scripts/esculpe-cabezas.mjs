/* Las cabezas. Metros, +x hacia delante, +y arriba; el origen es la base del cuello. Cada una es un juego de medidas sobre la
   misma anatomía (cráneo, cara, mejillas, barbilla, cuencas y párpados, nariz con aletas, labios y orejas). */
import {clamp, lerp, sstep, gauss, sabs, smin, smax, sph, ell, cap, poli, oclusion, normalesTri, tubo, azar, grad} from './esculpe-sdf.mjs';

const BASE = {
  paso: .0026, tris: 8200, ci: [-.02, -.09, 0], cs: [.145, .25, .14],
  cr: [-.012, .126, 0], crR: [.114, .106, .111], ca: [.022, .078, 0], caR: [.085, .08, .09], k1: .05,
  me: [.054, .056, .047], meR: .04, meK: .036, ba: [.071, .014, 0], baR: [.027, .023, .032], baK: .042, mand: null,
  E: [.073, .1, .0445], R: .027, yaw: .16, cuenca: .8, w: .9, au: .64, al: .54, inc: .03, pliegue: .0009, bolsa: .0005,
  ceja: {y: .138, h: .0065, z0: .02, z1: .066, r: .0011, l: .012, n: 46, arco: .006, k: .0015}, arcoCeja: 0,
  nz: {a: [.1, .1, 0], b: [.1235, .0715, 0], r0: .0062, r: .0125, w: .0098, ala: .0078, k: .016},
  my: .0365, w2: .0195, hu: .0034, hl: .0046, lx: .0046, bc: .0016, surco: .0008,
  or: [-.006, .088, .112], orR: [.021, .031, .011], cue: [[-.012, .05, 0], [-.018, -.09, 0], .05, .05], arrugas: [], mejRubor: [.074, .062, .06, .03], pest: 0, dientes: 1,
};
const con = (a, b) => ({...a, ...b, nz: {...a.nz, ...(b.nz || {})}, ceja: {...a.ceja, ...(b.ceja || {})}});
const NINO = con(BASE, {tris: 10000, cr: [-.012, .122, 0], crR: [.114, .104, .111], E: [.071, .0915, .0462], R: .0318, cuenca: .5, w: .93, au: .67, al: .58, bolsa: 0, pliegue: .0011, ceja: {y: .139, h: .0052, z0: .025, z1: .064, r: .00062, l: .0088, n: 64, k: .0012, arco: .004}, nz: {a: [.098, .094, 0], b: [.1155, .0665, 0], r: .0105, w: .0084, ala: .0064, r0: .0052}, me: [.055, .0515, .051], meR: .0445, my: .0335, w2: .0178, hu: .0031, hl: .0042, mejRubor: [.076, .056, .062, .03]});
const MADRE = con(BASE, {
  tris: 9000, cr: [-.02, .138, 0], crR: [.105, .103, .099], ca: [.02, .088, 0], caR: [.08, .084, .081], k1: .045, me: [.054, .077, .043], meR: .033, meK: .032, ba: [.0745, .017, 0], baR: [.0175, .0165, .018], baK: .04, mand: [[.0, .054, .05], [.056, .018, .008], .018, .01, .036],
  E: [.0675, .111, .04], R: .0272, yaw: .14, cuenca: .58, w: .96, au: .62, al: .44, inc: .08, pliegue: .0009, ceja: {y: .1515, h: .006, z0: .0185, z1: .0605, r: .00052, l: .0092, n: 72, arco: .006, k: .0008}, arcoCeja: 0,
  nz: {a: [.092, .112, 0], b: [.1115, .0805, 0], r0: .005, r: .0094, w: .0079, ala: .0058, k: .014}, my: .0478, w2: .0192, hu: .0039, hl: .0053, lx: .0052, bc: .0012, surco: .0009,
  or: [-.012, .092, .0955], orR: [.018, .029, .009], cue: [[-.014, .06, 0], [-.022, -.1, 0], .04, .042], mejRubor: [.07, .077, .054, .028], pest: 1,
});
const MAYOR = con(MADRE, {
  tris: 10500, me: [.05, .068, .043], meR: .033, baR: [.021, .018, .025], mand: [[.0, .046, .055], [.058, .012, .017], .021, .016, .03], au: .54, al: .4, inc: -.03, pliegue: .0014, bolsa: .0012, hu: .003, hl: .0046, lx: .0044, ceja: {n: 50, r: .0006, y: .148}, orR: [.02, .034, .009], w2: .0215, bc: .0016,
  arrugas: [['naso', .0011, .0034], ['pata', .0007, .0016], ['frente', .00055, .0022], ['boca', .0004, .0012], ['bolsa', .0008, .0026]],
});
const HOMBRE = con(BASE, {
  tris: 9000, cr: [-.016, .136, 0], crR: [.108, .104, .1], ca: [.02, .082, 0], caR: [.08, .096, .08], k1: .045, me: [.05, .07, .044], meR: .031, meK: .03, ba: [.073, .0, 0], baR: [.023, .022, .029], baK: .036, mand: [[-.005, .038, .056], [.06, .0, .022], .02, .017, .03],
  E: [.068, .11, .0395], R: .0245, yaw: .13, cuenca: .7, w: .93, au: .54, al: .42, inc: .02, ceja: {y: .144, h: .0055, z0: .0165, z1: .06, r: .00075, l: .0115, n: 110, arco: .004, k: .0016}, arcoCeja: .002,
  nz: {a: [.094, .112, 0], b: [.1265, .072, 0], r0: .0066, r: .0128, w: .0108, ala: .0082, k: .015}, my: .035, w2: .0225, hu: .0034, hl: .0046, lx: .0046, bc: .001, or: [-.012, .09, .0985], orR: [.021, .033, .0105], cue: [[-.014, .05, 0], [-.022, -.1, 0], .052, .054], mejRubor: [.064, .074, .054, .03],
});
const VIEJO = con(HOMBRE, {
  tris: 10500, crR: [.108, .1, .1], me: [.054, .066, .045], meR: .036, nz: {b: [.131, .068, 0], r: .0165, r0: .0075, w: .0125, ala: .0102}, au: .5, al: .42, inc: -.05, pliegue: .0016, bolsa: .0016, orR: [.023, .039, .0115], ceja: {n: 110, r: .0011, l: .016, y: .143}, hu: .0026, hl: .0042,
  arrugas: [['naso', .0013, .004], ['pata', .0009, .0018], ['frente', .0009, .0026], ['bolsa', .0011, .003]],
});

function crea(P, nombre) {
  const {E, R, nz: NZ, w2: W} = P, cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
  const ojo = (x, y, s) => {const dx = x - E[0], dy = y - E[1], dz = s - E[2]; return [dx * cy + dz * sy, dy, -dx * sy + dz * cy]};
  const up = u => {const t = clamp(1 - (u / P.w) ** 2, 0, 1); return P.au * Math.pow(t, .62) + P.inc * u}, lo = u => {const t = clamp(1 - (u / P.w) ** 2, 0, 1); return -P.al * Math.pow(t, .8) + P.inc * u};
  const base = (x, y, z) => {
    const s = sabs(z); let d = ell(x - P.cr[0], y - P.cr[1], z, ...P.crR); d = smin(d, ell(x - P.ca[0], y - P.ca[1], z, ...P.caR), P.k1);
    if (P.mand) d = smin(d, cap(x, y, s, P.mand[0], P.mand[1], P.mand[2], P.mand[3]), P.mand[4]);
    d = smin(d, sph(x - P.me[0], y - P.me[1], s - P.me[2], P.meR), P.meK); d = smin(d, ell(x - P.ba[0], y - P.ba[1], z, ...P.baR), P.baK); d = smin(d, cap(x, y, z, P.cue[0], P.cue[1], P.cue[2], P.cue[3]), .035);
    if (P.arcoCeja) d = smin(d, cap(x, y, s, [E[0] + R * .98, P.ceja.y - .004, P.ceja.z0 - .003], [E[0] + R * .55, P.ceja.y, P.ceja.z1 - .012], .006 + P.arcoCeja * .4, .005), .02 + P.arcoCeja);
    d = smax(d, -sph(x - E[0] - R * 1.05, y - E[1] - R * .02, s - E[2] + R * .04, R * P.cuenca), .022); return d;
  };
  const cara0 = (x, y, z) => {
    const s = sabs(z); let d = base(x, y, z); const n = NZ;
    d = smin(d, cap(x, y, z, n.a, n.b, n.r0, n.r * .82), n.k); d = smin(d, sph(x - n.b[0] + .001, y - n.b[1], z, n.r), .007); d = smin(d, ell(x - n.b[0] + n.r * .62, y - n.b[1] + n.r * .34, s - n.w, n.ala * 1.12, n.ala * .92, n.ala * .85), .0052);
    d = smax(d, -ell(x - n.b[0] + n.r * .3, y - n.b[1] + n.r * .82, s - n.w * .52, n.r * .3, n.r * .3, n.r * .2), .003); return d;
  };
  // dónde está la superficie de la cara por delante
  const xDe = (f, y, z) => {let x = .17; for (let i = 0; i < 60; i++) {const d = f(x, y, z); x -= d * .8; if (Math.abs(d) < 4e-5 || x < -.05) break} return x};
  const TB = []; for (let i = 0; i <= 40; i++) TB.push(xDe(base, P.my, i / 40 * .05)); const xc = s => {const q = clamp(s / .05, 0, 1) * 40, i = Math.min(39, Math.floor(q)); return lerp(TB[i], TB[i + 1], q - i)}, yc = s => P.my + P.bc * Math.min(1.6, (s / W) ** 2);
  const labios = (x, y, s) => {const t = Math.sqrt(clamp(1 - (s / W) ** 2, 0, 1)), X = x - xc(s), Y = y - yc(s), fuera = Math.max(0, s - W * .985) * 1.2, hu = P.hu * (.06 + .94 * Math.pow(t, .9)) * (1 - .24 * gauss(s, .0035) + .12 * gauss(s - .0062, .0045)), hl = P.hl * (.06 + .94 * Math.pow(t, .75)), lx = P.lx * (.16 + .84 * t), e = (a, b, ra, rb) => (Math.hypot(a / ra, b / rb) - 1) * Math.min(ra, rb); const pu = fuera + .0026 * (1 - t) ** 2; return [e(X + .0008, Y - hu * .72, lx, hu * 1.02) + pu, e(X + .0006, Y + hl * .78, lx * 1.06, hl) + pu]};
  const ARR = P.arrugas.map(([t, h, w]) => ({t, h, w, L: t === 'naso' ? [[0, NZ.b[1] + .004, NZ.w + .011], [0, P.my + .016, W + .004], [0, P.my - .006, W + .0085]] : t === 'boca' ? [[0, P.my + .002, W + .003], [0, P.my - .014, W + .004]] : t === 'bolsa' ? [[0, E[1] - R * .62, E[2] - R * .7], [0, E[1] - R * .96, E[2]], [0, E[1] - R * .72, E[2] + R * .72]] : null}));
  const surcos = (x, y, s) => {let o = 0; if (x < .02) return 0; for (const A of ARR) {
    if (A.L) {const [d, t] = poli(0, y, s, A.L); o += A.h * gauss(d, A.w) * Math.sin(Math.PI * clamp(t * .86 + .1, 0, 1)) - A.h * .5 * gauss(d - A.w * 1.7, A.w)}
    else if (A.t === 'pata') {const dz = s - E[2] - R * 1.06, dy = y - E[1]; if (dz > -.004) {const r = Math.hypot(dz, dy), a = Math.atan2(dy, dz + .004); for (const q of [-.5, -.1, .32]) o += A.h * gauss((a - q) * Math.max(.004, r), A.w) * sstep(.001, .006, r) * sstep(.022, .012, r)}}
    else if (A.t === 'frente') for (const q of [.02, .031, .042]) o += A.h * gauss(y - P.ceja.y - q - .003 * Math.cos(s * 60), A.w) * sstep(.052, .03, s)} return o};
  const f = (x, y, z) => {
    const s = sabs(z), q = ojo(x, y, s), u = q[2] / R, v = q[1] / R, rr = Math.hypot(q[0], q[1], q[2]); let d = cara0(x, y, z);
    if (rr < R * 2.2) {
      d = smin(d, rr - R * 1.15, .008);
      if (q[0] > 0 && Math.abs(u) < 1.15) {const t = clamp(1 - (u / 1.15) ** 2, 0, 1); d += P.pliegue * gauss(v - up(u) - .24 * t, .075) * t * sstep(.1, .5, q[0] / R); d -= P.bolsa * gauss(v - lo(u) + .3 * t, .13) * t}
      d = smax(d, -(rr - R * 1.045), .0006); const a = Math.max(v - up(u), lo(u) - v) * R * .86, ap = Math.max(a, -q[0] + R * .12, (Math.abs(u) - P.w) * R); d = smax(d, -ap, .0026);
    }
    if (x > .02 && y < P.my + .05) {
      const [a, b] = labios(x, y, s); d = smin(d, a, .0034); d = smin(d, b, .004); const X = xc(s), Y = y - yc(s); d += P.surco * gauss(z, .0028) * sstep(P.my + .004, P.my + .008, y) * sstep(NZ.b[1] - .006, NZ.b[1] - .012, y); d += .0007 * gauss(Y + P.hl * 2.5, .0032) * sstep(W * .8, .004, s);
      if (s < W * 1.1) {const gr = Math.max(Math.abs(Y) - .00066 * Math.pow(clamp(1 - (s / (W * .97)) ** 2, 0, 1), .35), s - W * .97, X - .0062 - x, x - X - .02); d = smax(d, -gr, .0011); d = smax(d, -ell(x - X + .0142, y - P.my + .0012, z, .0118, .0092, W * .84), .0012)}
      d += .0005 * gauss(Math.hypot(s - W - .0008, Y), .0024);
    }
    if (ARR.length) d += surcos(x, y, s);
    { // oreja
      const ox = x - P.or[0], oy = y - P.or[1], oz = s - P.or[2]; if (Math.hypot(ox, oy, oz) < .06) {const a = .5, b = .16, x1 = ox * Math.cos(a) + oz * Math.sin(a), z1 = -ox * Math.sin(a) + oz * Math.cos(a), x2 = x1 * Math.cos(b) + oy * Math.sin(b), y2 = -x1 * Math.sin(b) + oy * Math.cos(b), [A, Bb, C] = P.orR; let e = ell(x2, y2 - .002, z1, A, Bb, C); e = smin(e, ell(x2 - A * .22, y2 + Bb * .86, z1 + .001, A * .46, Bb * .3, C * .8), .008);
        e = smax(e, -ell(x2 - A * .12, y2 - Bb * .02, z1 - C * .95, A * .66, Bb * .7, C * .85), .004); e = smin(e, cap(x2, y2, z1, [A * .05, -Bb * .28, C * .35], [-A * .34, Bb * .42, C * .42], .0026, .0022), .0045); e = smax(e, -ell(x2 - A * .22, y2 + Bb * .16, z1 - C * .5, A * .32, Bb * .3, C * .9), .003); e = smin(e, ell(x2 - A * .62, y2 + Bb * .2, z1 - C * .3, A * .2, Bb * .22, C * .4), .004); d = smin(d, e, .006)}
    }
    return d;
  };
  const fo = (x, y, z) => {const s = sabs(z); return Math.min(f(x, y, z), sph(x - E[0], y - E[1], s - E[2], R))};
  const caja = [0, 1, 2].map(i => [P.ci[i] - (i === 1 ? 0 : P.cs[i]) + (i === 0 ? .01 : 0), P.ci[i] + P.cs[i] + (i === 1 ? .1 : 0) + (i === 0 ? .03 : 0)]);
  caja[1] = [-.085, .245]; caja[0] = [-.14, .15]; caja[2] = [-.14, .14];
  const H = {f, caja, paso: P.paso, tris: P.tris};
  H.denso = [x => 1 + 1.5 * sstep(.045, .075, x), y => 1 + 3.3 * gauss(y - P.my, .011) + 1.1 * gauss(y - E[1], .034) + .5 * gauss(y - NZ.b[1], .02) - .45 * sstep(.17, .21, y) - .4 * sstep(0, -.04, y), z => 1 + 1.1 * gauss(z, .07)];
  // fuera lo que no se ve: el hueco del ojo por detrás y el corte del cuello
  H.vale = (x, y, z) => {const q = ojo(x, y, sabs(z)), rr = Math.hypot(...q); if (rr < R * 1.09 && q[0] < -R * .45) return false; return y > -.078};
  const mate = (x, y, z) => {const s = sabs(z), X = xc(s); return s < W * 1.02 && x < X - .0042 && x > X - .034 && Math.abs(y - P.my) < .012 ? 1 : 0};
  H.pinta = M => {
    const n = M.p.length / 3, c = new Float32Array(n * 4), m = P.mejRubor; for (let i = 0; i < n; i++) {
      const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], s = sabs(z), ao = oclusion(fo, x, y, z, M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], .026), [a, b] = labios(x, y, s), lab = x > .05 ? sstep(.0026, .0004, Math.min(a, b)) * sstep(W * 1.06, W * .9, s) : 0;
      const rub = clamp(gauss(Math.hypot(x - m[0], y - m[1], s - m[2]), m[3]) * .95 + .5 * gauss(Math.hypot(x - NZ.b[0], y - NZ.b[1], z), NZ.r * 1.7) + .55 * gauss(Math.hypot(x - P.or[0], y - P.or[1], s - P.or[2]), .03) + .22 * gauss(Math.hypot(x - P.ba[0] - .02, y - P.ba[1], z), .02) + .3 * gauss(Math.hypot(...ojo(x, y, s)) - R * 1.1, R * .12) * (x > E[0] ? 1 : 0), 0, 1); const mt = mate(x, y, z);
      c.set([ao, rub, mt ? .4 : lab, mt * 64 / 255], i * 4);
    } return c;
  };
  /* ---------- cejas, dientes y lengua ---------- */
  H.extras = () => {
    const L = [], rnd = azar(7), C = P.ceja, yB = t => C.y + C.h * Math.sin(Math.PI * clamp(t * .95 + .1, 0, 1)) - .005 * t * t + C.arco * .25;
    for (const sd of [-1, 1]) for (let i = 0; i < C.n; i++) {
      const t = (i + rnd() * .9) / C.n, z = lerp(C.z0, C.z1, t) + (rnd() - .5) * .002, y = yB(t) + (rnd() - .5) * C.k * 2 + (rnd() - .5) * .0042 * (1 - t * .55), l = C.l * (.7 + rnd() * .5) * (1 - .25 * t), an = lerp(.95, -.42, Math.pow(t, .55)) + (rnd() - .5) * .22, P0 = []; for (let k = 0; k < 4; k++) {const r = k / 3, zz = z + Math.cos(an) * l * r, yy = y + Math.sin(an) * l * r - .0012 * r * r, x = xDe(f, yy, zz * sd) + .0006 + .0011 * Math.sin(r * 2.4); P0.push([x, yy, zz * sd])}
      L.push(tubo(P0, u => {const k = Math.max(.12, 1 - u * u) * Math.min(1, .5 + u * 4); return [C.r * k, C.r * .7 * k]}, {lados: 4, seg: 3, arr: [1, 0, 0], color: u => [.72 + u * .28, rnd(), 0, 192 / 255]}));
    }
    if (P.dientes) {const D = []; for (let i = 0; i <= 8; i++) {const z = lerp(-1, 1, i / 8) * W * .78, s = Math.abs(z); D.push([xc(s) - .0072, P.my + .0016 + .0016 * (s / W) ** 2, z])} L.push(tubo(D, u => {const k = Math.sqrt(Math.max(.1, 1 - (u * 2 - 1) ** 4)); return [.0021 * k, .0036 * k]}, {lados: 8, seg: 16, arr: [0, 1, 0], color: u => [.8, 0, 0, 128 / 255]}))}
    {const T = [[xc(0) - .03, P.my - .004, 0], [xc(0) - .02, P.my - .0038, 0], [xc(0) - .0095, P.my - .0055, 0]]; L.push(tubo(T, u => {const k = Math.sqrt(Math.max(.06, 1 - u ** 3)); return [W * .5 * k, .0028 * k]}, {lados: 10, seg: 8, arr: [0, 1, 0], color: () => [.7, 0, .75, 64 / 255]}))}
    return L;
  };
  /* ---------- gestos ---------- */
  H.morphs = M => {
    const n = M.p.length / 3, C = P.ceja, o = {}, fr = x => sstep(.015, .055, x), B0 = normalesTri(M.p, M.ix), sg = z => z < 0 ? -1 : 1;
    const esBoca = (x, y, z) => {const s = Math.abs(z), X = xc(s); return s < W * 1.06 && x < X - .002 && x > X - .04 && Math.abs(y - P.my) < .013};
    const G = {
      /* abre la mandíbula */
      abre: (x, y, z, a) => {const s = Math.abs(z), Y = y - yc(s), den = esBoca(x, y, z), k1 = den ? (a === 128 ? 0 : x < xc(s) - .016 ? sstep(.004, -.004, Y) : sstep(.0001, -.0004, Y)) : sstep(.0001, -.0009, Y), es = s < W ? Math.pow(clamp(1 - (s / W) ** 2, 0, 1), .42) : 0, prof = sstep(-.002, -.02, Y), k = k1 * lerp(den ? Math.max(.35, es) : es, 1, prof) * sstep(-.075, -.03, y) * fr(x) * sstep(.062, .026, s) * sstep(.016, .045, x), hx = 0, hy = P.my + .035, an = -.21 * k, dx = x - hx, dy = y - hy, c = Math.cos(an), q = Math.sin(an); const uy = !den && Y > 0 && s < W ? .0021 * es * gauss(Y, .006) : 0; return [dx * c - dy * q - dx, dx * q + dy * c - dy + uy, 0]},
      son: (x, y, z) => {const s = Math.abs(z), Y = y - P.my, g = gauss(Math.hypot(s - W, Y * .9), .0135) * fr(x), b = gauss(Math.hypot(Math.max(0, s - W * .6) * .6, Y), .011) * fr(x), ch = gauss(Math.hypot(s - P.me[2] + .002, y - P.me[1] - .002), .022) * fr(x), lp = gauss(Math.hypot(s - E[2], (y - E[1] + R * .72) * 1.4), R * .62) * fr(x), sl = clamp(s / W, 0, 1.2); return [-.0045 * g + .0034 * ch - .0012 * b, .0066 * g + .0038 * ch - .0012 * b * (1 - sl) + .0026 * lp, sg(z) * (.0072 * g + .0016 * ch)]},
      o: (x, y, z) => {const s = Math.abs(z), Y = y - P.my, g = gauss(Math.hypot(Math.max(0, s - W * .5) * .9, Y), .0145) * fr(x); return [.0052 * g * (esBoca(x, y, z) ? .4 : 1), -.001 * g, -z * .46 * g]},
      triste: (x, y, z) => {const s = Math.abs(z), Y = y - P.my, g = gauss(Math.hypot(s - W, Y * .9), .012) * fr(x), c = gauss(Math.hypot(s * .7, y - P.ba[1] - .006), .016) * fr(x), ll = gauss(Math.hypot(s * .55, Y + P.hl), .006) * fr(x); return [-.0012 * g + .0014 * ll, -.0066 * g + .0022 * c + .0012 * ll, sg(z) * -.0008 * g]},
      cejaAlza: (x, y, z) => {const s = Math.abs(z), g = gauss((y - C.y - .004) * (y < C.y ? 1.25 : .7), .017) * gauss(Math.max(0, s - C.z1 + .012) + Math.max(0, C.z0 - .004 - s), .016) * fr(x); return [-.0008 * g, .0068 * g, 0]},
      cejaPena: (x, y, z) => {const s = Math.abs(z), v = gauss((y - C.y - .003) * (y < C.y ? 1.2 : .75), .016) * fr(x), i = gauss(Math.max(0, Math.abs(s - C.z0 - .004) - .004), .012) * v, e = gauss(s - C.z1 + .004, .014) * v; return [.0004 * i, .0075 * i - .0036 * e, sg(z) * -.0016 * i]},
      cejaFrunce: (x, y, z) => {const s = Math.abs(z), v = gauss((y - C.y - .002) * 1.1, .014) * fr(x), i = gauss(Math.max(0, Math.abs(s - C.z0 - .006) - .006), .012) * v; return [.001 * i, -.0048 * i, sg(z) * -.0026 * i]},
    };
    for (const k in G) {const p = new Float32Array(n * 3), q = new Float32Array(n * 3); for (let i = 0; i < n; i++) {const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], d = G[k](x, y, z, Math.round(M.c[i * 4 + 3] * 255)); for (let a = 0; a < 3; a++) {const v = Math.abs(d[a]) < 2e-5 ? 0 : d[a]; p[i * 3 + a] = v; q[i * 3 + a] = M.p[i * 3 + a] + v}} const N1 = normalesTri(q, M.ix), nn = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) {const v = N1[i] - B0[i]; nn[i] = Math.abs(v) < .01 ? 0 : v} o[k] = {p, n: nn}} return o;
  };
  /* ---------- párpados que se mueven (giran sobre el eje de los dos ojos; borde a 0°) ---------- */
  H.parpados = () => {
    const L = [], r = R * 1.026; for (const sd of [-1, 1]) {
      const M = {p: [], n: [], c: [], uv: [], ix: []}, NL = 18, NF = 8; for (let j = 0; j <= NF; j++) for (let i = 0; i <= NL; i++) {const la = lerp(-1.42, 1.42, i / NL), fi = j / NF * 1.75, x = Math.cos(la) * Math.cos(fi), y = Math.cos(la) * Math.sin(fi), z = Math.sin(la), g = j === 0 ? .992 : 1; M.p.push(E[0] + x * r * g, E[1] + y * r * g, sd * E[2] + z * r * g); M.n.push(x, y, z); M.c.push(.93, j < 2 ? .34 : .16, 0, 0); M.uv.push(i / NL, j / NF)}
      const w = NL + 1; for (let j = 0; j < NF; j++) for (let i = 0; i < NL; i++) {const a = j * w + i, b = a + 1, c = a + w, d = c + 1; M.ix.push(a, c, b, b, c, d)} L.push(M);
      const arc = []; for (let i = 0; i <= 10; i++) {const la = lerp(-1.12, 1.12, i / 10); arc.push([E[0] + Math.cos(la) * r * 1.012, E[1] - .0004, sd * E[2] + Math.sin(la) * r * 1.012])} const gz = P.pest ? .00125 : .00085; L.push(tubo(arc, u => {const k = Math.sqrt(Math.max(.03, Math.sin(Math.PI * u))); return [gz * k, gz * .8 * k]}, {lados: 5, seg: 14, arr: [0, 1, 0], color: () => [.5, 0, 0, 1]}));
      if (P.pest) for (let i = 0; i < 9; i++) {const la = sd * lerp(-.25, 1.12, i / 8), l = lerp(.0062, .0088, Math.sin(Math.PI * (.1 + i / 8 * .75))), c = [E[0] + Math.cos(la) * r * 1.012, E[1], sd * E[2] + Math.sin(la) * r * 1.012], o = [Math.cos(la * 1.2), -.25, Math.sin(la * 1.2)], T = [0, 1, 2, 3].map(k => {const t = k / 3; return [c[0] + o[0] * l * t, c[1] + (o[1] * t + .4 * t * t) * l, c[2] + o[2] * l * t]}); L.push(tubo(T, u => {const k = Math.max(.12, 1 - u); return [.00062 * k, .00062 * k]}, {lados: 4, seg: 4, arr: [0, 1, 0], color: () => [.5, 0, 0, 1]}))}
    } return L;
  };
  H.P = P; H.xDe = xDe; H.base = base; H.nombre = nombre; H.pelos = () => {const o = PEINADOS[nombre](H, base); if (nombre === 'hombre') {o.bigote = bigote(H, .9); o.barba = barba(H)} return o}; return H;
}
import {PEINADOS, bigote, barba} from './esculpe-pelo.mjs';
export const CABEZAS = {nino: crea(NINO, 'nino'), madre: crea(MADRE, 'madre'), mayor: crea(MAYOR, 'mayor'), hombre: crea(HOMBRE, 'hombre'), viejo: crea(VIEJO, 'viejo')};
export const OJOS = Object.fromEntries(Object.entries({nino: NINO, madre: MADRE, mayor: MAYOR, hombre: HOMBRE, viejo: VIEJO}).map(([k, P]) => [k, {E: P.E, R: P.R, au: P.au, al: P.al}]));
