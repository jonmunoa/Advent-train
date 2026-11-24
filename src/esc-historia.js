/* El calendario: qué escaparate toca cada día y a qué hora se enciende. Sin DOM ni red.
   Todo sale del reloj del dispositivo: no hay servidor. */
export const N = 24, HORA = 18;
/* un escaparate por día: rótulo de la tienda, nombre de su momento y si va sin marca (el 24) */
export const DIAS = [
  ['La Estación', 'La nariz en el cristal'], ['Confitería', 'Sin quitar ojo'], ['Relojería', 'Que no me voy'], ['La Cumbre', '¡Bola va!'], ['Librería', 'Chu-chu'], ['Mercería', 'Manos calentitas'], ['La Feria', 'La noria'], ['Polo Norte', 'Dibujar en el vaho'],
  ['Correos', 'La carta'], ['La Ciudad', '¿Qué miran?'], ['Panadería', '¡Quema!'], ['Fotografía', 'La foto'], ['El Refugio', 'La gran nevada'], ['Juguetería', 'El silbato'], ['Zapatería', 'Las huellas'], ['Bombillas', 'Se hizo la luz'],
  ['Planetario', 'Pide un deseo'], ['Modelismo', 'La carrera'], ['Música', 'El baile'], ['Sastrería', 'El señor de rojo'], ['Sombrerería', 'La chistera'], ['Viajes', '¡Pasajeros al tren!'], ['Bellas Artes', 'Todos los trenes'], ['Feliz Navidad', 'Como entonces', 1],
].map(([rotulo, momento, sinMarca], i) => ({d: i + 1, rotulo, momento, sinMarca: !!sinMarca}));
const at = (y, m, d, h = HORA) => new Date(y, m, d, h, 0, 0, 0);
/* {abiertos: 0–24, proximo: cuándo se enciende el siguiente (o null), temporada}. Los encendidos no se apagan hasta el 10 de enero */
export function estado(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (m === 11) {const ab = Math.max(0, Math.min(N, d - (now < at(y, 11, d) ? 1 : 0))); return {abiertos: ab, proximo: ab < N ? at(y, 11, ab + 1) : null, temporada: true}}
  if (m === 0 && d <= 10) return {abiertos: N, proximo: null, temporada: true};
  return {abiertos: 0, proximo: at(y, 11, 1), temporada: false};
}
/* vista previa de un día (1–24) */
export function previa(d) {d = Math.max(1, Math.min(N, Math.round(d) || 1)); return {abiertos: d, proximo: null, temporada: true, previa: d}}
/* día pedido en la dirección: ?dia=7 o #dia-7 */
export function pedido(search, hash) {const a = /[?&]dia=(\d{1,2})\b/.exec(search || '') || /^#dia-(\d{1,2})$/.exec(hash || ''); return a && +a[1] >= 1 && +a[1] <= N ? +a[1] : 0}
/* «en 3 h 12 min», «mañana a las 18:00», «el 7 de diciembre» */
export function falta(hasta, now = new Date()) {
  const ms = hasta - now; if (!(ms > 0)) return 'ahora'; const min = Math.ceil(ms / 6e4), hoy = hasta.toDateString() === now.toDateString(), man = new Date(now.getTime() + 864e5).toDateString() === hasta.toDateString();
  if (min < 60) return `en ${min} min`; if (hoy) return `hoy a las ${hasta.getHours()}:00`; if (man) return `mañana a las ${hasta.getHours()}:00`; return `el ${hasta.getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][hasta.getMonth()]}`;
}
/* hasta qué escaparate se puede andar (el último es el de mañana, tapado) */
export const tope = ab => Math.min(N - 1, ab);
