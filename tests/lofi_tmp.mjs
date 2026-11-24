import {TEMAS, LISTA, ESTILOS, compases, acordes, partitura, P} from '../src/lofi-temas.js';
let mal = 0, tot = 0;
for (const t of TEMAS) {const M = compases(t), A = acordes(t); if (M.length !== A.length) {console.log('COMPASES', t.id, M.length, A.length); mal++}
  M.forEach((b, i) => {const s = b.reduce((a, x) => a + x.d, 0); if (Math.abs(s - t.bpb) > 1e-6) {console.log('SUMA', t.id, i, s); mal++} if (b.some(x => x.n === null || Number.isNaN(x.n))) console.log('NOTA', t.id, i)});
  // notas de los tiempos fuertes dentro del acorde
  const N = {M: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10]}; let ok = 0, n = 0; const ko = [];
  M.forEach((b, i) => {if (!A[i]) return; let p = 0; for (const x of b) {if (x.n && x.d >= 1 && (p === 0 || (t.bpb === 4 && p === 2))) {const c = A[i][Math.floor(p / (t.bpb / A[i].length))] || A[i][0], it = ((x.n - c.r) % 12 + 12) % 12; n++; if ([...N[c.q], 9, 2, c.q === 'm' ? 10 : 99].includes(it)) ok++; else ko.push(i + ':' + it + c.q)} p += x.d}});
  if (ok / n < .9) console.log('ARMONÍA', t.id, ok, n, ko.join(' '))}
for (const x of LISTA) {const p = partitura(x); tot += p.dur; if (p.dur < 95 || p.dur > 260) console.log('dur', x.id, x.v, p.dur.toFixed(0)); const bad = p.ev.filter(e => e.n && (e.n < 24 || e.n > 102)); if (bad.length) console.log('rango', x.id, bad.length, bad[0])}
console.log('P', P.toFixed(4), 'bpm', (30 / P).toFixed(1), 'temas', TEMAS.length, 'pistas', LISTA.length, 'total', (tot / 3600).toFixed(2), 'h', 'mal', mal);
