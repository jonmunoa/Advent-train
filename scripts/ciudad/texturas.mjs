/* Texturas de la calle y de la ropa (Poly Haven, CC0): color (con la altura en el canal alfa si hace falta) y un segundo mapa con
   la normal en RG y la rugosidad en B. Originales en assets-src/polyhaven (no se suben); salida en m/ph2/.
   node scripts/ciudad/texturas.mjs [nombre…] */
import {createHash} from 'node:crypto';
import {mkdirSync, existsSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), SRC = join(root, 'assets-src/polyhaven'), OUT = join(root, 'm/ph2'), UA = {'User-Agent': 'adviento-assets/1.0'};
mkdirSync(OUT, {recursive: true});
/* slug: {px, res, alt: guarda la altura, mod: retoque de color} */
export const TEX = {
  brick_wall_006: {px: 1024, mod: {saturation: .72, brightness: .86}}, white_sandstone_blocks_02: {px: 1024, mod: {saturation: .6}}, sandstone_blocks_08: {px: 1024, mod: {saturation: .42}}, painted_plaster_wall: {px: 1024, mod: {saturation: .7}}, stone_block_wall: {px: 512, mod: {brightness: 1.5, saturation: .6}}, roof_slates_03: {px: 512},
  cobblestone_square: {px: 1024, alt: 1, mod: {saturation: .28, brightness: .9}}, pavement_03: {px: 1024, alt: 1, mod: {saturation: .14, brightness: .95}}, snow_02: {px: 1024}, snow_03: {px: 512}, black_painted_planks: {px: 512}, green_metal_rust: {px: 512},
};
const API = {}, api = async s => API[s] ||= await (await fetch(`https://api.polyhaven.com/files/${s}`, {headers: UA})).json();
async function baja({url, md5}, dest) {if (existsSync(dest) && createHash('md5').update(readFileSync(dest)).digest('hex') === md5) return dest; if (!url.startsWith('https://dl.polyhaven.org/')) throw new Error('URL inesperada: ' + url); const r = await fetch(url, {headers: UA}); if (!r.ok) throw new Error(url + ' ' + r.status); const b = Buffer.from(await r.arrayBuffer()); if (md5 && createHash('md5').update(b).digest('hex') !== md5) throw new Error('md5 ' + url); mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, b); return dest}
const kb = f => (statSync(f).size / 1024).toFixed(0) + ' kB';
export async function trae(slug, {px = 1024, res = '1k', alt = 0, mod = null, out = OUT} = {}) {
  const f = await api(slug), g = (...ks) => {for (const k of ks) if (f[k]) return f[k][res].jpg || f[k][res].png}, d = await baja(g('Diffuse', 'diffuse', 'col_1', 'col1', 'Color', 'coll1'), join(SRC, slug, `${slug}_diff_${res}.jpg`)), n = await baja(g('nor_gl'), join(SRC, slug, `${slug}_nor_${res}.jpg`)), rg = g('Rough', 'rough'), arm = g('arm');
  const ro = rg ? await baja(rg, join(SRC, slug, `${slug}_rough_${res}.jpg`)) : arm ? await baja(arm, join(SRC, slug, `${slug}_arm_${res}.jpg`)) : null;
  let im = sharp(d).resize(px, px); if (mod) im = im.modulate(mod); im = im.removeAlpha();
  const fd = join(out, slug + '_d.webp'), fn = join(out, slug + '_n.webp');
  if (alt) {const h = await baja(g('Displacement', 'disp'), join(SRC, slug, `${slug}_disp_${res}.jpg`)), raw = await sharp(h).resize(px, px).greyscale().normalise().extractChannel(0).raw().toBuffer(); const rgb = await im.raw().toBuffer(); await sharp(rgb, {raw: {width: px, height: px, channels: 3}}).joinChannel(raw, {raw: {width: px, height: px, channels: 1}}).webp({quality: 76, alphaQuality: 55, effort: 6}).toFile(fd)} else await im.webp({quality: 80, effort: 6}).toFile(fd);
  const nr = await sharp(n).resize(px, px).removeAlpha().raw().toBuffer(), rr = ro ? await sharp(ro).resize(px, px).extractChannel(rg ? 0 : 1).raw().toBuffer() : Buffer.alloc(px * px, 200); for (let i = 0; i < px * px; i++) nr[i * 3 + 2] = rr[i]; await sharp(nr, {raw: {width: px, height: px, channels: 3}}).webp({quality: 86, effort: 6, smartSubsample: true}).toFile(fn);
  console.log(slug, kb(fd), kb(fn));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {const q = process.argv.slice(2); for (const [s, o] of Object.entries(TEX)) if (!q.length || q.includes(s)) await trae(s, o)}
