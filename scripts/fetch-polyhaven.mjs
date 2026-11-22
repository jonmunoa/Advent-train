// Descarga los recursos de scripts/polyhaven.json desde la API de Poly Haven (CC0),
// comprueba el md5 y genera las versiones ligeras:
//   texturas → m/ph/<slug>_<mapa>.webp (sharp)
//   HDRI     → m/env/<slug>_<res>.exr
//   modelos  → m/ph/<slug>.glb (gltf-transform: meshopt + webp + simplificación)
// Los originales quedan en assets-src/polyhaven/ (ignorado por git).
//   npm i && node scripts/fetch-polyhaven.mjs [slug…]
import {createHash} from 'node:crypto';
import {mkdirSync, existsSync, readFileSync, writeFileSync, statSync, copyFileSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'scripts/polyhaven.json'), 'utf8'));
const SRC = join(root, 'assets-src/polyhaven'), OUT = join(root, 'm/ph'), ENV = join(root, 'm/env');
const CLI = join(root, 'node_modules/@gltf-transform/cli/bin/cli.js');
const only = process.argv.slice(2);
const want = slug => !only.length || only.includes(slug);
const UA = {'User-Agent': 'adviento-express-assets/1.0'};
[SRC, OUT, ENV].forEach(d => mkdirSync(d, {recursive: true}));

async function api(slug) {const r = await fetch(`https://api.polyhaven.com/files/${slug}`, {headers: UA}); if (!r.ok) throw new Error(`${slug}: API ${r.status}`); return r.json()}
async function download({url, md5}, dest) {
  if (existsSync(dest) && createHash('md5').update(readFileSync(dest)).digest('hex') === md5) return dest;
  if (!url.startsWith('https://dl.polyhaven.org/')) throw new Error('URL inesperada: ' + url);
  const r = await fetch(url, {headers: UA}); if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer()), sum = createHash('md5').update(buf).digest('hex');
  if (md5 && sum !== md5) throw new Error(`${url}: md5 ${sum} ≠ ${md5}`);
  mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, buf); return dest;
}
const kb = f => (statSync(f).size / 1024).toFixed(0) + ' KB';
const sizeOf = (s, m) => typeof s === 'number' ? s : s[m];

for (const [slug, t] of Object.entries(cfg.textures)) {
  if (!want(slug)) continue;
  const files = await api(slug);
  for (const [map, key] of Object.entries(t.maps)) {
    const f = files[key]['1k'].jpg, src = await download(f, join(SRC, slug, `${slug}_${map}_1k.jpg`)), out = join(OUT, `${slug}_${map}.webp`), px = sizeOf(t.size, map);
    await sharp(src).resize(px, px, {fit: 'inside'}).webp({quality: map === 'nor' ? 90 : 82, effort: 6}).toFile(out);
    console.log('textura', `${slug}_${map}.webp`, px + ' px', kb(out));
  }
}
for (const [slug, res] of Object.entries(cfg.hdris)) {
  if (!want(slug)) continue;
  const f = (await api(slug)).hdri[res].exr, src = await download(f, join(SRC, slug, `${slug}_${res}.exr`)), out = join(ENV, `${slug}_${res}.exr`);
  copyFileSync(src, out); console.log('HDRI', `${slug}_${res}.exr`, kb(out));
}
for (const [slug, m] of Object.entries(cfg.models)) {
  if (!want(slug)) continue;
  const g = (await api(slug)).gltf['1k'].gltf, dir = join(SRC, slug), gltf = join(dir, `${slug}.gltf`);
  await download(g, gltf);
  for (const [rel, f] of Object.entries(g.include)) await download(f, join(dir, rel));
  const out = join(OUT, `${slug}.glb`), args = [CLI, 'optimize', gltf, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(m.size)];
  if (m.simplify) args.push('--simplify-ratio', String(m.simplify), '--simplify-error', '0.01');
  execFileSync(process.execPath, args, {stdio: 'pipe'});
  // normal, rugosidad y ARM a menos resolución: los muebles siempre se ven de lejos
  if (m.detail) for (const pat of ['*nor*', '*rough*', '*arm*', '*metal*']) execFileSync(process.execPath, [CLI, 'resize', out, out, '--width', String(m.detail), '--height', String(m.detail), '--pattern', pat], {stdio: 'pipe'});
  console.log('modelo', `${slug}.glb`, kb(out));
}
