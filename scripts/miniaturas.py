"""Hace m/esc/dias.webp (una foto pequeña de cada circuito con su tren, para el calendario) y m/esc/vitrinas.webp (cada escaparate de
frente, para las tiendas lejanas de la calle mientras no se ha montado su maqueta).

Todas van en una sola imagen de 6 × 4 huecos. Vuelve a lanzarlo si cambia una maqueta o un tren. Necesita Playwright (como las pruebas) y Pillow.

Uso:
  python scripts/miniaturas.py
"""
import asyncio, base64, io, pathlib, sys
from PIL import Image, ImageEnhance
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
from harness import serve, chromium_args  # noqa: E402

W, H, COL, FIL = 256, 192, 6, 4
VW, VH = 320, 190
CSS = 'body>*:not(canvas){display:none!important}body::after{display:none!important}'
# el tren pasa por delante y la cámara lo mira en tres cuartos, con la máquina cerca
POSE = """() => {const v = __esc.vista, m = __esc.mundo(__esc.n), T = m.T; v.setCine(false); __esc.step(1);
  let b = -1e9, q = 0; for (let i = 0; i < T.N; i++) if (Math.abs(T.x[i]) < 8 && T.z[i] > b) {b = T.z[i]; q = i}
  const dir = Math.sign(T.x[(q + 2) % T.N] - T.x[q]) || 1, s = (q * T.ds + 4) % T.L; m.tren.s = s; __esc.step(.05);
  v.home(false); const c = v.cam; c.tgt.set(T.x[q] - 5.5 * dir, T.y[q] + 7.5, T.z[q] - 5); c.d = 40; c.el = .13; c.az = Math.PI / 2 - .42 * dir; __esc.step(2); m.tren.s = s; __esc.step(.04)}"""


async def main():
    srv = serve(8841, ROOT); out = Image.new('RGB', (W * COL, H * FIL)); vit = Image.new('RGB', (VW * COL, VH * FIL))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=chromium_args(True)); pg = await (await b.new_context(viewport={'width': 720, 'height': 540})).new_page()
        await pg.goto('http://127.0.0.1:8841/escaparates.html?todos', wait_until='commit'); await pg.wait_for_function('window.__esc&&__esc.listo', timeout=120000)
        await pg.evaluate('__esc.empezar();__esc.hold(true)'); await pg.add_style_tag(content=CSS)
        for n in range(COL * FIL):
            u = await pg.evaluate(f'__esc.fotoPx({n}, {VW}, {VH})'); vit.paste(Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB'), (n % COL * VW, n // COL * VH))
            await pg.evaluate(f'__esc.entrar({n})'); await pg.wait_for_timeout(900); await pg.evaluate(POSE); await pg.wait_for_timeout(200)
            im = Image.open(io.BytesIO(await pg.screenshot(type='png'))).convert('RGB').resize((W, H), Image.LANCZOS); im = ImageEnhance.Color(ImageEnhance.Brightness(im).enhance(1.12)).enhance(1.14); out.paste(im, (n % COL * W, n // COL * H)); print(n + 1, end=' ', flush=True)
        await b.close()
    fv = ROOT / 'm' / 'esc' / 'vitrinas.webp'; vit.save(fv, quality=72, method=6); print(f'\n{fv.name}: {vit.size}, {fv.stat().st_size / 1024:.0f} kB')
    srv.shutdown(); f = ROOT / 'm' / 'esc' / 'dias.webp'; f.parent.mkdir(exist_ok=True); out.save(f, quality=70, method=6); print(f'\n{f.name}: {out.size}, {f.stat().st_size / 1024:.0f} kB')

asyncio.run(main())
