/* El calendario: qué escaparate toca cada día, a qué hora se enciende y qué escenas especiales hay. Sin DOM ni red.
   Todo sale del reloj del dispositivo: no hay servidor. */
export const N = 24, HORA = 18;
/* un escaparate por día: rótulo de la tienda y si admite marca (en los días clave de la historia, no) */
export const DIAS = [
  ['La Estación'], ['Confitería'], ['Relojería'], ['La Cumbre'], ['Librería'], ['Mercería'], ['La Feria'], ['Polo Norte'], ['Correos'], ['La Ciudad'], ['Panadería'], ['Fotografía'],
  ['El Refugio'], ['Juguetería'], ['Zapatería'], ['Bombillas'], ['Planetario'], ['La Estación', 1], ['Música'], ['Ropa usada', 1], ['Sombrerería'], ['Viajes'], ['Bellas Artes'], ['Feliz Navidad', 1],
].map(([rotulo, sinMarca], i) => ({d: i + 1, rotulo, sinMarca: !!sinMarca}));
/* después del 24: campanadas, cabalgata y mañana de Reyes (días 25, 26 y 27 de la vista previa) */
export const EXTRAS = {25: 'campanadas', 26: 'cabalgata', 27: 'reyes'}, ULTIMO = 27;
const at = (y, m, d, h = HORA) => new Date(y, m, d, h, 0, 0, 0);
/* {abiertos: 0–24, proximo: cuándo se enciende el siguiente (o null), extra, temporada} */
export function estado(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (m === 11) {
    const ab = Math.min(N, d - (now < at(y, 11, d) ? 1 : 0)), extra = d === 31 && now >= at(y, 11, 31, 18) ? 'campanadas' : null;
    return {abiertos: Math.max(0, ab), proximo: ab < N ? at(y, 11, Math.max(1, ab + 1)) : null, extra, temporada: true};
  }
  if (m === 0 && d <= 10) return {abiertos: N, proximo: null, extra: d === 1 ? 'campanadas' : d === 5 && now >= at(y, 0, 5) ? 'cabalgata' : d >= 6 ? 'reyes' : null, temporada: true};
  return {abiertos: 0, proximo: at(m === 0 ? y : y, 11, 1), extra: null, temporada: false};
}
/* vista previa de un día (1–24) o de una escena especial (25–27) */
export function previa(d) {d = Math.max(1, Math.min(ULTIMO, Math.round(d) || 1)); return d > N ? {abiertos: N, proximo: null, extra: EXTRAS[d], temporada: true, previa: d} : {abiertos: d, proximo: null, extra: null, temporada: true, previa: d}}
/* día pedido en la dirección: ?dia=7 o #dia-7 */
export function pedido(search, hash) {const a = /[?&]dia=(\d{1,2})\b/.exec(search || '') || /^#dia-(\d{1,2})$/.exec(hash || ''); return a && +a[1] >= 1 && +a[1] <= ULTIMO ? +a[1] : 0}
/* «en 3 h 12 min», «mañana a las 18:00», «el 7 de diciembre» */
export function falta(hasta, now = new Date()) {
  const ms = hasta - now; if (!(ms > 0)) return 'ahora'; const min = Math.ceil(ms / 6e4), hoy = hasta.toDateString() === now.toDateString(), man = new Date(now.getTime() + 864e5).toDateString() === hasta.toDateString();
  if (min < 60) return `en ${min} min`; if (hoy) return `hoy a las ${hasta.getHours()}:00`; if (man) return `mañana a las ${hasta.getHours()}:00`; return `el ${hasta.getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][hasta.getMonth()]}`;
}
/* hasta qué escaparate se puede andar (el último es el de mañana, tapado) */
export const tope = ab => Math.min(N - 1, ab);
/* ropa de cada día: guantes hasta el 5, abrigo rojo hasta el 15; desde el 6 el niño lleva los guantes de ella, desde el 15 botas nuevas y desde el 17 ella lleva su bufanda */
export const ropaDe = d => ({guantes: d < 6, abrigo: d < 16, botas: d >= 15, manoplas: d >= 6, bufandaNino: d < 17, bufandaRoja: d >= 17});
