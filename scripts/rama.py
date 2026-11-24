"""Monta las ramas de abeto de los escaparates a partir de las ramitas fotografiadas de Poly Haven (fir_tree_01, CC0).

  node scripts/fetch-polyhaven.mjs fir_tree_01 && python scripts/rama.py

Deja m/ph/rama.webp (rama verde) y m/ph/rama_nieve.webp (la misma con nieve encima), 512×256 con transparencia:
el tallo va de izquierda a derecha.
"""
import pathlib, random
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'assets-src/polyhaven/fir_tree_01', ROOT / 'm/ph'
col = Image.open(SRC / 'fir_tree_01_diff_1k.png').convert('RGB'); alfa = Image.open(SRC / 'fir_tree_01_alpha_1k.png').convert('L')
# más frío y algo más claro que la foto: abeto de noche
a = np.asarray(col).astype(np.float32); g = a.mean(2, keepdims=True); a = g + (a - g) * .82; a = a * np.array([.86, 1.06, 1.0]) * 1.3; hoja = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); hoja.putalpha(alfa)
TROZOS = [hoja.crop(b) for b in ((300, 398, 666, 806), (640, 452, 990, 866), (664, 34, 968, 388), (194, 30, 442, 326))]
W, H = 1024, 512


def rama(nieve, semilla=7):
    r = random.Random(semilla); im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sn = Image.new('L', (W, H), 0)

    def pon(q, x, y, ang, esc, luz):
        t = TROZOS[q]; t = t.resize((max(8, int(t.width * esc)), max(8, int(t.height * esc))), Image.LANCZOS); p = Image.new('RGBA', (t.width * 2, t.height * 2), (0, 0, 0, 0)); p.paste(t, (t.width // 2, 0)); p = p.rotate(ang, Image.BICUBIC, center=(p.width / 2, t.height), expand=False)
        # la base del trozo (abajo, en el centro) cae en (x, y)
        n = np.asarray(p).astype(np.float32).copy(); n[..., :3] *= luz; p = Image.fromarray(np.clip(n, 0, 255).astype(np.uint8)); im.alpha_composite(p, (0, 0), (0, 0)) if False else im.paste(p, (int(x - p.width / 2), int(y - t.height)), p)
        if nieve and r.random() < .8:
            m = np.asarray(p.getchannel('A')).astype(np.float32) / 255; z = np.zeros_like(m); z[:-5] = m[5:]; b = np.clip(m - .0 * z, 0, 1); s = Image.fromarray((b * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)); k = Image.new('L', (W, H), 0); k.paste(s, (int(x - p.width / 2), int(y - t.height)) ); sn.paste(255, (0, 0), Image.fromarray(np.maximum(0, np.asarray(k).astype(np.int16) - 70).clip(0, 255).astype(np.uint8)))
    # de dentro afuera: ramitas a los dos lados, cada vez más cortas, y la punta
    for capa in range(2):
        n = 13
        for i in range(n):
            u = (i + .3 + r.random() * .5) / n; x = 10 + u * (W - 260); L = (1 - u * .52) * (1.0 if capa else .86)
            for s in (-1, 1):
                if r.random() < .06: continue
                pon(r.choice((0, 1, 1, 2)), x + r.uniform(-8, 8), H / 2 + r.uniform(-4, 4), -90 + s * r.uniform(34, 62) * (1 - u * .35), .62 * L * r.uniform(.85, 1.1), (.62 if not capa else .95) * r.uniform(.85, 1.12))
    for q, x, e in ((0, W - 300, .62), (2, W - 250, .66), (1, W - 230, .58)): pon(q, x, H / 2 + r.uniform(-5, 5), -90 + r.uniform(-9, 9), e, 1.05)
    A = np.asarray(im).astype(np.float32).copy(); A[:, :22, 3] = 0
    if nieve:
        rn = np.random.default_rng(semilla); ruido = np.asarray(Image.fromarray((rn.random((H // 8, W // 8)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255; fino = np.asarray(Image.fromarray((rn.random((H // 3, W // 3)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
        S = np.asarray(sn).astype(np.float32) / 255; k = np.clip((S * 1.5 + ruido * .9 + fino * .5 - 1.0) * 2.4, 0, 1); blanco = np.array([232, 240, 252], np.float32) * (.86 + .14 * fino[..., None]); A[..., :3] = A[..., :3] * (1 - k[..., None]) + blanco * k[..., None]; A[..., 3] = np.maximum(A[..., 3], k * 255 * np.clip(S * 1.6, 0, 1))
    # color bajo lo transparente, para que no salgan bordes negros
    q = Image.fromarray(A.clip(0, 255).astype(np.uint8), 'RGBA'); c, al = np.asarray(q)[..., :3].astype(np.float32), np.asarray(q)[..., 3:].astype(np.float32) / 255; num, den = c * al, al.copy()
    def caja(x, r):
        for e in (0, 1):
            p = np.cumsum(np.pad(x, [(r + 1, r) if k == e else (0, 0) for k in range(x.ndim)], mode='edge'), axis=e, dtype=np.float64); n = x.shape[e]; x = (np.take(p, np.arange(2 * r + 1, 2 * r + 1 + n), axis=e) - np.take(p, np.arange(n), axis=e)) / (2 * r + 1)
        return x
    hecho = al > .5
    for rad in (2, 6, 18, 60):
        b, d = caja(num, rad), caja(den, rad); nuevo = ~hecho & (d > .004); c = np.where(nuevo, b / np.maximum(d, 1e-4), c); hecho |= nuevo
    c = np.where(hecho, c, (c * al).sum((0, 1)) / al.sum())
    out = np.concatenate([c, al * 255], 2).clip(0, 255).astype(np.uint8); return Image.fromarray(out, 'RGBA').resize((512, 256), Image.LANCZOS)


verde, nevada = rama(False), rama(True)
for n, im in (('rama', verde), ('rama_nieve', nevada)):
    f = OUT / f'{n}.webp'; im.save(f, quality=86, method=6, exact=True); print(f.name, f.stat().st_size // 1024, 'KB')
# las dos juntas para los abetos de las maquetas: la nevada abajo (v de 0 a 0,5)
at = Image.new('RGBA', (512, 512)); at.paste(verde, (0, 0)); at.paste(nevada, (0, 256)); f = OUT / 'abeto.webp'; at.save(f, quality=86, method=6, exact=True); print(f.name, f.stat().st_size // 1024, 'KB')
