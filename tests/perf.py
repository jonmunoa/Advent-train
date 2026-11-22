#!/usr/bin/env python3
"""Banco de rendimiento: coste por fotograma en poses fijas de cámara.

Para cada día y pose coloca el tren y la cámara con window.__adv.pose(), renderiza
3 tandas de N fotogramas síncronos (composer + readPixels de 1 px) con __adv.perf()
y se queda con la más rápida. Anota:
ms/fotograma, draw calls, triángulos, texturas y geometrías en memoria y una
estimación de la memoria de texturas (imágenes únicas × 4 bytes × mipmaps).

Uso:
  python tests/perf.py              # GPU real, compara con tests/perf-baseline.json
  python tests/perf.py --save       # guarda el resultado como nueva referencia
  python tests/perf.py --swiftshader

Los ms en escritorio no son los de un Android, pero sirven para comparar antes y después.
Draw calls, triángulos y texturas sí son comparables tal cual.
"""
import asyncio, json, sys
from playwright.async_api import async_playwright
from harness import ROOT, serve, chromium_args, route_local_three

sys.stdout.reconfigure(encoding="utf-8")
PORT = 8767
GPU = '--swiftshader' not in sys.argv
SAVE = '--save' in sys.argv
N = 40 if not GPU else 120
DAYS = [1, 7, 13, 14]
POSES = [('orbit', 0.0), ('tp', 0.25), ('fp', 0.25), ('tp', 0.6)]
BASE = ROOT / 'tests' / ('perf-baseline.json' if GPU else 'perf-baseline-swiftshader.json')


async def main():
    srv = serve(PORT)
    errors, res = [], {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=chromium_args(GPU))
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        await route_local_three(pg)
        await pg.add_init_script("try{localStorage.setItem('advx-dev','1')}catch(e){}window.__advNoAdapt=true")
        for d in DAYS:
            await pg.goto('about:blank')
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html#dia-{d}')
            await pg.wait_for_function("document.getElementById('pre').classList.contains('on')", polling=500, timeout=180000)
            await pg.wait_for_timeout(500)
            for kind, f in POSES:
                # mínimo de 3 tandas: el ruido de reloj/temperatura de la GPU solo suma tiempo
                runs = [await pg.evaluate(f"(()=>{{__adv.pose('{kind}',{f});return __adv.perf({N},1)}})()") for _ in range(3)]
                res[f'd{d}-{kind}-{f}'] = min(runs, key=lambda r: r['ms'])
        await b.close()
    srv.shutdown()
    base = json.loads(BASE.read_text()) if BASE.exists() else {}
    print(f"{'pose':<16}{'ms':>8}{'Δms':>8}{'calls':>7}{'Δ':>5}{'tris':>9}{'Δ':>8}{'tex':>5}{'Δ':>4}{'MB tex':>8}{'Δ':>6}")
    for k, r in res.items():
        o = base.get(k, {})
        dm = f"{r['ms'] - o['ms']:+.2f}" if o else ''
        dc = f"{r['calls'] - o['calls']:+d}" if o else ''
        dt = f"{(r['tris'] - o['tris']) / 1000:+.0f}k" if o else ''
        dx = f"{r['tex'] - o['tex']:+d}" if o else ''
        mb = r.get('texMB', 0); dmb = f"{mb - o.get('texMB', 0):+.1f}" if o and 'texMB' in o else ''
        print(f"{k:<16}{r['ms']:>8.2f}{dm:>8}{r['calls']:>7}{dc:>5}{r['tris'] / 1000:>8.0f}k{dt:>8}{r['tex']:>5}{dx:>4}{mb:>8.1f}{dmb:>6}")
    for e in errors:
        print('  error:', e)
    if SAVE:
        BASE.write_text(json.dumps(res, indent=1))
        print('referencia guardada en', BASE.relative_to(ROOT))
    sys.exit(1 if errors else 0)

asyncio.run(main())
