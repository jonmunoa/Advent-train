/* Junta las texturas de la calle en una tira (m/ph2/capas.webp, 512 px por capa) para el móvil: así toda la calle se dibuja con un
   solo material (src/esc-movil.js).   node scripts/ciudad/capas.mjs */
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {statSync} from 'node:fs';
import {CAPAS} from '../../src/esc-capas.js';

const D = join(fileURLToPath(new URL('../..', import.meta.url)), 'm/ph2'), P = 512, tira = Buffer.alloc(P * P * 4 * CAPAS.length);
for (const [i, [f, prop]] of CAPAS.entries()) {let im = sharp(join(D, f + '.webp')).resize(P, P, {fit: 'fill'}).ensureAlpha(); if (!prop) im = im.flip(); const b = await im.raw().toBuffer(); b.copy(tira, i * P * P * 4)}
await sharp(tira, {raw: {width: P, height: P * CAPAS.length, channels: 4}}).webp({quality: 80, alphaQuality: 88, effort: 6}).toFile(join(D, 'capas.webp')); console.log('capas', CAPAS.length, (statSync(join(D, 'capas.webp')).size / 1024 | 0) + ' kB');
