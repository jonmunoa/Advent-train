/* Figuras de las maquetas que se esculpen: el reno (mira hacia +x; el suelo está en y = 0 y la cruz a 1,15). Máscaras en el color de
   los vértices: R oclusión, G pelo claro, B pelo oscuro y pezuñas, A 0 pelo, 128 negro (ojos y nariz), 192 cuerna. */
import {smin, smax, sph, ell, cap, oclusion, gauss, sstep, tubo} from './esculpe-sdf.mjs';

export function juguetes() {
  const f = (x, y, z) => {
    const s = Math.sqrt(z * z + 1e-5); let d = ell(x + .06, y - .98, z, .47, .245, .215); d = smin(d, ell(x - .32, y - .97, z, .25, .29, .215), .12); d = smin(d, ell(x + .42, y - 1.02, z, .24, .25, .215), .12);
    // cuello con la melena del pecho y cabeza
    let c = cap(x, y, z, [.42, 1.1, 0], [.73, 1.46, 0], .185, .115); c = smin(c, cap(x, y, z, [.5, .9, 0], [.72, 1.3, 0], .13, .09), .09); d = smin(d, c, .11);
    let h = cap(x, y, z, [.75, 1.52, 0], [1.02, 1.43, 0], .112, .078); h = smin(h, ell(x - 1.07, y - 1.415, z, .085, .07, .072), .05); h = smin(h, ell(x - .8, y - 1.585, s - .05, .07, .045, .05), .04); h = smax(h, -ell(x - 1.135, y - 1.43, s - .036, .018, .014, .014), .012); h = smax(h, -Math.max(Math.abs(y - 1.378 - (x - 1.08) * .1) - .004, Math.abs(x - 1.1) - .07), .008); d = smin(d, h, .07);
    d = smin(d, ell(x - .7 + (s - .19) * .25, y - 1.6 - (s - .19) * .1, s - .19, .042, .05, .1), .03);
    // patas: delante y detrás, con rodilla, corvejón, menudillo y pezuña
    let p = cap(x, y, s, [.33, .92, .11], [.335, .5, .125], .105, .058); p = smin(p, cap(x, y, s, [.335, .5, .125], [.325, .14, .13], .056, .04), .04); p = smin(p, sph(x - .33, y - .49, s - .125, .062), .03); p = smin(p, cap(x, y, s, [.325, .13, .13], [.37, .04, .13], .05, .06), .03);
    let q = cap(x, y, s, [-.42, .95, .1], [-.34, .62, .125], .17, .085); q = smin(q, cap(x, y, s, [-.34, .62, .125], [-.5, .45, .13], .078, .055), .05); q = smin(q, cap(x, y, s, [-.5, .45, .13], [-.46, .14, .135], .052, .04), .04); q = smin(q, cap(x, y, s, [-.46, .13, .135], [-.41, .04, .135], .05, .06), .03); d = smin(d, smin(p, q, .02), .07);
    d = smin(d, cap(x, y, z, [-.64, 1.1, 0], [-.73, .98, 0], .07, .045), .05); d -= .006 * Math.sin(y * 46 + x * 17 + z * 9) * Math.sin(x * 38 - z * 21) * sstep(.45, .7, y) * sstep(.95, .75, x);
    return Math.max(d, -(y - .004));
  };
  const pinta = M => {const n = M.p.length / 3, c = new Float32Array(n * 4); for (let i = 0; i < n; i++) {const x = M.p[i * 3], y = M.p[i * 3 + 1], z = M.p[i * 3 + 2], claro = Math.max(gauss(Math.hypot((x - .62) * .9, y - 1.06), .2), gauss(y - .74, .07) * sstep(.45, .2, Math.abs(x + .05)), gauss(Math.hypot(x + .66, y - 1.0), .1), gauss(Math.hypot(x - 1.1, y - 1.4), .07) * .8, gauss(Math.hypot(x - .86, y - 1.53), .05) * .4), osc = Math.max(sstep(.42, .16, y) * .8, sstep(.085, .06, y), gauss(Math.hypot(x - .98, y - 1.52), .05) * .25); c.set([oclusion(f, x, y, z, M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], .13), claro, y < .075 ? 1 : osc, 0], i * 4)} return c};
  const extras = () => {
    const L = [], cu = (P, r0, r1, seg = 12) => L.push(tubo(P, u => {const r = r0 + (r1 - r0) * u; return [r, r * .88]}, {lados: 5, seg, arr: [1, 0, 0], color: u => [.62 + .38 * u, 0, 0, 192 / 255]})), bo = (x, y, z, r, al) => L.push(tubo([[x - r, y, z], [x, y, z], [x + r, y, z]], u => {const k = Math.sqrt(Math.max(.01, 1 - (u * 2 - 1) ** 2)) * r; return [k, k]}, {lados: 8, seg: 8, arr: [0, 1, 0], color: () => [1, 0, 0, al]}));
    for (const s of [-1, 1]) {
      // cuerna: rama principal hacia atrás y arriba, luz, contraluz y palma con puntas
      cu([[.73, 1.62, s * .06], [.64, 1.78, s * .15], [.55, 1.98, s * .28], [.6, 2.2, s * .38], [.78, 2.4, s * .4]], .034, .016, 20); cu([[.71, 1.68, s * .09], [.84, 1.76, s * .14], [.96, 1.86, s * .13], [1.0, 1.97, s * .1]], .024, .011); cu([[.9, 1.8, s * .14], [1.0, 1.82, s * .18], [1.06, 1.9, s * .2]], .016, .009, 7); cu([[.6, 1.86, s * .2], [.7, 1.95, s * .3], [.82, 2.06, s * .34], [.88, 2.16, s * .32]], .022, .01); cu([[.56, 2.06, s * .31], [.46, 2.16, s * .36], [.4, 2.3, s * .36]], .02, .009, 8); cu([[.62, 2.22, s * .385], [.56, 2.36, s * .44], [.58, 2.48, s * .45]], .018, .008, 8); cu([[.7, 2.32, s * .4], [.72, 2.46, s * .46], [.78, 2.56, s * .46]], .017, .008, 8); cu([[.78, 2.4, s * .4], [.88, 2.46, s * .38], [.95, 2.56, s * .34]], .016, .007, 7);
      bo(.885, 1.535, s * .088, .026, 128 / 255);
    }
    bo(1.145, 1.435, 0, .042, 128 / 255); return L;
  };
  return {reno: {f, caja: [[-.82, 1.22], [-.02, 1.74], [-.34, .34]], paso: .014, tris: 4000, pinta, extras}};
}
