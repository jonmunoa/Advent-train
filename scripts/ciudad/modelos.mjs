/* Piezas de calle escaneadas (Poly Haven, CC0) para mezclar en el bloque horneado: se bajan, se simplifican y quedan en assets-src/ciudad/*.glb */
import {createHash} from 'node:crypto';
import {mkdirSync, existsSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), SRC = join(root, 'assets-src/polyhaven'), OUT = join(root, 'assets-src/ciudad'), CLI = join(root, 'node_modules/@gltf-transform/cli/bin/cli.js'), UA = {'User-Agent': 'adviento-assets/1.0'};
mkdirSync(OUT, {recursive: true});
const M = {street_lamp_01: .09, street_lamp_02: .3, covered_car: .35, wine_barrel_01: .4, wooden_crate_01: .5, wicker_basket_01: .25, standing_chalkboard_01: 1, painted_wooden_bench: .6, planter_box_01: .5, metal_trash_can: .4, water_manhole_cover: .3};
async function baja({url, md5}, dest) {if (existsSync(dest) && createHash('md5').update(readFileSync(dest)).digest('hex') === md5) return dest; if (!url.startsWith('https://dl.polyhaven.org/')) throw new Error(url); const r = await fetch(url, {headers: UA}); if (!r.ok) throw new Error(url + ' ' + r.status); const b = Buffer.from(await r.arrayBuffer()); mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, b); return dest}
for (const [s, k] of Object.entries(M)) {if (process.argv[2] && !process.argv.slice(2).includes(s)) continue; const g = (await (await fetch('https://api.polyhaven.com/files/' + s, {headers: UA})).json()).gltf['1k'].gltf, dir = join(SRC, s), f = join(dir, s + '.gltf'); await baja(g, f); for (const [rel, q] of Object.entries(g.include)) await baja(q, join(dir, rel)); const o = join(OUT, s + '.glb'); execFileSync(process.execPath, [CLI, 'optimize', f, o, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '512', '--simplify-ratio', String(k), '--simplify-error', '0.004', '--palette', 'false'], {stdio: 'pipe'}); console.log(s, (statSync(o).size / 1024).toFixed(0) + ' kB')}
