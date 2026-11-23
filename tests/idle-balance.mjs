/* Simula a un jugador que compra con cabeza (la mejora con más ganancia por moneda) y enseña
   cuándo llega a cada hito. Sirve para equilibrar src/idle-eco.js: node tests/idle-balance.mjs */
import {newState, ITEMS, canBuy, buy, maxed, rateOf, slotsOf, trackOf, STAGES, lapOf, servedOf, capOf} from '../src/idle-eco.js';

const fmtT = s => s < 60 ? `${s.toFixed(0)} s` : s < 3600 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${(s / 3600).toFixed(1)} h`;
const gainOf = (st, k) => {const c = structuredClone(st); c.coins = 1e300; buy(c, k); return rateOf(c) - rateOf(st)};

export function simulate(limit = 3 * 3600, log = false) {
  const st = newState(0), ms = [], dt = 0.5;
  let t = 0, buys = 0;
  const mark = txt => {ms.push([t, txt]); if (log) console.log(fmtT(t).padStart(12), '·', txt)};
  for (const k in STAGES) slotsOf(+k);
  while (t < limit && !(maxed(st, 'via') && maxed(st, 'casa'))) {
    // elige la compra con más ganancia de ritmo por moneda (la vía cuenta por los huecos y el valor nuevo)
    // si las casas ya no caben en los vagones, la casa nueva cuenta junto con el vagón que necesita
    let best = null, bv = -1;
    for (const k of Object.keys(ITEMS)) {
      if (maxed(st, k)) continue;
      let g = gainOf(st, k), c = ITEMS[k].cost(st), first = k;
      if (k === 'casa' && st.houses >= capOf(st) && !maxed(st, 'vagon')) {const w = structuredClone(st); w.coins = 1e300; buy(w, 'vagon'); buy(w, 'casa'); g = rateOf(w) - rateOf(st); c += ITEMS.vagon.cost(st); first = 'vagon'}
      if (k === 'via' && maxed(st, 'casa')) g += rateOf(st);
      if (g / c > bv) {bv = g / c; best = first}
    }
    if (best && canBuy(st, best)) {
      const lv = ITEMS[best].lvl(st); buy(st, best); buys++;
      if (best === 'via') mark(`vía ${st.stage + 1} (${slotsOf(st.stage).length} huecos)`);
      else if (best === 'casa' && st.houses === slotsOf(st.stage).length) mark(`vía ${st.stage + 1} llena: ${st.houses} casas`);
      continue;
    }
    const r = rateOf(st); st.coins += r * dt; st.total += r * dt; t += dt;
  }
  return {t, st, ms, buys};
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('idle-balance.mjs')) {
  for (const k in STAGES) console.log(`vía ${+k + 1}: ${trackOf(+k).L.toFixed(0)} m, ${slotsOf(+k).length} huecos`);
  const {t, st, buys} = simulate(4 * 3600, true);
  console.log(`\nfinal ${fmtT(t)}: ${buys} compras, ${st.houses} casas, ${st.wagons} vagones, loco ${st.loco}, luces ${st.lights}, vuelta ${lapOf(st).toFixed(1)} s, reparte ${servedOf(st)}/${st.houses}, ${rateOf(st).toFixed(0)}/s`);
}
