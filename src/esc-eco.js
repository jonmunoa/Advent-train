// Escaparates: qué marca va en cada sitio y la petición de un sitio. Sin DOM ni red.
import {cleanText, cleanUrl, isoDay} from './tren-eco.js';
export {cleanText, cleanUrl, isoDay};
export const ESC = 3, VAGONES = 4;
/* marcas de una fecha: {escaparate: {sitio: marca}}; se valida y se limpia todo (una línea mal escrita no rompe nada) */
export function marcasEsc(list, iso) {
  const out = {1: {}, 2: {}, 3: {}}, re = /^\d{4}-\d\d-\d\d$/;
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== 'object') continue;
    const e = Math.floor(+m.escaparate), s = m.sitio === 'rotulo' ? 'rotulo' : Math.floor(+m.sitio), fin = m.hasta || m.desde;
    if (!(e >= 1 && e <= ESC) || !(s === 'rotulo' || (s >= 1 && s <= VAGONES)) || !re.test(m.desde) || !re.test(fin) || iso < m.desde || iso > fin) continue;
    const ad = {text: cleanText(m.texto, 32), sub: cleanText(m.sub, 40), url: cleanUrl(m.url) || '', bg: /^#[0-9a-f]{6}$/i.test(m.fondo) ? m.fondo : '#7a1020', img: /^m\/marcas\/[\w.-]+\.(png|jpe?g|webp)$/i.test(m.img) ? m.img : '', tag: 'Patrocinado'};
    if (ad.text || ad.img) out[e][s] = ad;
  }
  return out;
}
export const pedirTexto = (ad, sitio, escaparate, precio) => [`Quiero ${sitio === 'rotulo' ? 'el rótulo' : 'un vagón'} del escaparate ${escaparate} (${precio} € al día).`, '', `Texto: ${ad.text || '(solo imagen)'}`, ...(ad.sub ? [`Segunda línea: ${ad.sub}`] : []), ...(ad.url ? [`Enlace: ${ad.url}`] : []), `Color: ${ad.bg}`, ad.img ? 'Imagen: la adjunto a este mensaje.' : 'Sin imagen.', 'Días que me gustarían: '].join('\n');
/* el paseo: la calle da la vuelta, así que el escaparate n (cualquier entero) es la tienda n módulo 3 */
export const tiendaDe = n => ((n % ESC) + ESC) % ESC;
/* dónde se coloca la tienda k para quien va por x: la copia más cercana */
export const sitioDe = (k, x, paso) => paso * (k + ESC * Math.round((x / paso - k) / ESC));
