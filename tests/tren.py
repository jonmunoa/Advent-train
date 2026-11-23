#!/usr/bin/env python3
"""Prueba end-to-end del tren compartido (tren.html, prototipo) con Playwright.

Partida nueva: carbón (clic de verdad), bote común que compra un vagón, poner tu casa desde el formulario,
reparto y regalos para ti, objetivo del día que amplía la vía, subir una imagen y pujar por el vagón del día,
que un rival te supere, vagón con mensaje, vista previa en el tren, guardado y versión móvil.
Falla si hay errores de JavaScript, recursos 404 o alguna comprobación no se cumple.

Uso:
  python tests/tren.py            # SwiftShader (CPU)
  python tests/tren.py --gpu      # GPU real (más rápido)
  python tests/tren.py --shots    # además guarda capturas en tests/out/tren-*.png
"""
import asyncio, os, struct, sys, zlib
from playwright.async_api import async_playwright
from harness import ROOT, OUT, serve, chromium_args, route_local_three

sys.stdout.reconfigure(encoding='utf-8')
PORT = 8767
SHOTS = '--shots' in sys.argv
GPU = '--gpu' in sys.argv
checks = []


def check(name, cond, info=''):
    checks.append((name, bool(cond), info))
    print(('  ok   ' if cond else '  FALLO ') + name + (f'  {info}' if info else ''))


def png(w=240, h=160):
    """Logo de prueba: círculo verde con un abeto blanco, fondo transparente."""
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            dx, dy = x - w / 2, y - h / 2
            inside = dx * dx + dy * dy < (h * 0.45) ** 2
            tree = abs(dx) < (y - h * 0.18) * 0.45 and h * 0.18 < y < h * 0.78
            row += bytes((255, 255, 255, 255) if tree else (15, 122, 74, 255) if inside else (0, 0, 0, 0))
        rows.append(bytes(row))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')


READY = "window.__tren && window.__tren.ready && !window.__tren.busy"


async def main():
    srv = serve(PORT, ROOT)
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=chromium_args(GPU))
        ctx = await b.new_context(viewport={'width': 1200, 'height': 760})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
        await route_local_three(pg)
        await pg.goto(f'http://127.0.0.1:{PORT}/tren.html?reiniciar')
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        await pg.evaluate('window.__idleNoAdapt=true;__tren.look(0.35,0.6)')

        st = await pg.evaluate('({...__tren.st, w3: __tren.wagons(), h3: __tren.houses(), ads: __tren.ads(), a1: __tren.adImg(1)})')
        check('partida nueva: tren con vagones, casas de otros y los dos vagones de ejemplo con anuncio',
              st['w3'] == st['wagons'] == 3 and st['h3'] == st['houses'] == 5 and st['ads'] == [1, 2] and st['a1']['w'] == 1024 and st['mine'] == -1, str(st))

        # 1) carbón con clic de verdad: suma al bote y empuja el tren
        p0 = await pg.evaluate('__tren.st.pot')
        box = await pg.locator('#coal').bounding_box()
        for _ in range(5):
            await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            await pg.mouse.down(); await pg.mouse.up()
        r = await pg.evaluate('({c:__tren.st.myCoal,pot:__tren.st.pot,heat:__tren.heat(),lbl:document.getElementById("coalLbl").textContent})')
        check('echar carbón suma tus paladas al bote y empuja el tren', r['c'] >= 5 and r['heat'] > 0.2, str(r))

        # 2) el bote lleno compra la siguiente mejora sola (un vagón)
        r = await pg.evaluate("(()=>{const T=__tren,w0=T.wagons(),cost=T.st.n;const got=T.pot(1e3);return {w0,w:T.wagons(),got,n:T.st.n}})()")
        check('cuando el bote se llena, entre todos compran otro vagón', r['w'] == r['w0'] + 1 and 'vagon' in r['got'], str(r))

        # 3) poner tu casa desde el formulario
        await pg.click('#tHouse')
        await pg.fill('#hName', 'Jon')
        await pg.fill('#hProv', 'Bizkaia')
        await pg.click('#houseForm button[type=submit]')
        await pg.wait_for_function('__tren.focused && __tren.focused.house === __tren.st.mine', timeout=5000)
        r = await pg.evaluate('({mine:__tren.st.mine,h:__tren.st.houses,h3:__tren.houses(),name:__tren.st.myName,open:document.getElementById("houseSheet").classList.contains("on"),f:__tren.focused})')
        check('poner tu casa: hueco propio junto a la vía, con tu nombre', r['mine'] == 5 and r['h'] == 6 and r['h3'] == 6 and r['name'] == 'Jon' and not r['open'], str(r))
        check('al poner la casa, la cámara va a verla', r['f'] and r['f'].get('house') == 5, str(r['f']))

        # 4) el tren reparte y te deja regalos a ti
        r = await pg.evaluate('(()=>{const T=__tren;T.focus(null);T.step(90);return {d:T.delivered(),laps:T.laps(),me:T.st.myGifts,today:T.st.today}})()')
        check('el tren reparte en las casas y también en la tuya', r['d'] > 5 and r['laps'] >= 1 and r['me'] > 0, str(r))

        # 5) objetivo del día cumplido: tramo nuevo de vía y tu casa sigue
        r = await pg.evaluate("""(async()=>{const T=__tren,d0=T.st.day,s0=T.st.stage;T.finishDay();for(let i=0;i<100&&T.busy;i++)await new Promise(r=>setTimeout(r,100));
          return {d0,s0,day:T.st.day,stage:T.st.stage,h3:T.houses(),h:T.st.houses,mine:T.st.mine,today:T.st.today}})()""")
        check('al cumplir el objetivo del día la vía crece y las casas se recolocan', r['day'] == r['d0'] + 1 and r['stage'] == r['s0'] + 1 and r['h3'] == r['h'] and r['mine'] == 5 and r['today'] == 0, str(r))

        # 6) tu marca: subir imagen, escribir y pujar por el vagón del día
        await pg.click('#tAd')
        await pg.set_input_files('#adFile', files=[{'name': 'logo.png', 'mimeType': 'image/png', 'buffer': png()}])
        await pg.fill('#adText', 'Vivero Abeto Verde')
        await pg.fill('#adSub', 'Árboles de Navidad · Getxo')
        await pg.wait_for_function("document.getElementById('adFileLbl').textContent==='Cambiar imagen'", timeout=10000)
        top0 = await pg.evaluate('__tren.auc.top.amt')
        await pg.click('#bidGo')
        r = await pg.evaluate('({top:__tren.auc.top,bid:__tren.auc.bid&&{amt:__tren.auc.bid.amt,img:!!__tren.auc.bid.ad.img,text:__tren.auc.bid.ad.text}})')
        check('subir un logo y pujar te pone primero con la puja mínima', r['top']['me'] and r['top']['amt'] == top0 + 1 and r['bid']['img'] and r['bid']['text'] == 'Vivero Abeto Verde', str(r))
        if SHOTS:
            OUT.mkdir(exist_ok=True)
            await pg.locator('#adSheet .card').screenshot(path=str(OUT / 'tren-3-marca.png'), timeout=120000)
        r = await pg.evaluate('(()=>{__tren.rival();return {top:__tren.auc.top,hot:document.getElementById("tAd").classList.contains("hot")}})()')
        check('si un rival te supera, pierdes el primer puesto y te avisa', not r['top']['me'] and r['top']['amt'] > top0 + 1 and r['hot'], str(r))

        # 7) vista previa en el tren y vuelta
        await pg.click('#adSee')
        r = await pg.evaluate('({f:__tren.focused,a1:__tren.adImg(1),pill:document.getElementById("focusX").hidden})')
        check('«Ver cómo queda» pone tu diseño en el primer vagón y la cámara lo enfoca', r['f'] and r['f'].get('car') == 1 and r['a1']['img'] and r['a1']['text'] == 'Vivero Abeto Verde' and not r['pill'], str(r))
        if SHOTS:
            await pg.evaluate('__tren.camSettle()')
            await pg.wait_for_timeout(1500)
            await pg.evaluate('__tren.camSettle()')
            await pg.screenshot(path=str(OUT / 'tren-2-vagon.png'), timeout=120000)
        await pg.click('#focusX')
        r = await pg.evaluate('({f:__tren.focused,a1:__tren.adImg(1),open:document.getElementById("adSheet").classList.contains("on")})')
        check('al volver, el vagón del día recupera su anuncio y se reabre el editor', not r['f'] and r['a1']['text'] == 'Pastelería La Estrella' and r['open'], str(r))

        # 8) vagón con mensaje: va en el primer vagón libre
        await pg.click('#tabMsg')
        await pg.click('#msgGo')
        r = await pg.evaluate('({ads:__tren.ads(),mine:__tren.auc.mine&&__tren.auc.mine.wagon,w:__tren.wagons()})')
        check('comprar un vagón con mensaje lo pone en un vagón libre del tren', r['mine'] and r['mine'] >= 3 and r['mine'] in r['ads'], str(r))

        if SHOTS:
            await pg.evaluate('__tren.look(0.35,0.6)')
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=str(OUT / 'tren-1-maqueta.png'), timeout=120000)
            await pg.evaluate('(()=>{__tren.focus({house:__tren.st.mine});__tren.camSettle()})()')
            await pg.wait_for_timeout(1500)
            await pg.evaluate('__tren.camSettle()')
            await pg.screenshot(path=str(OUT / 'tren-4-casa.png'), timeout=120000)
            await pg.evaluate('__tren.focus(null)')

        # 9) se guarda y se recupera
        saved = await pg.evaluate('(()=>{window.dispatchEvent(new Event("pagehide"));return {...__tren.st,mineAd:__tren.auc.mine&&__tren.auc.mine.wagon}})()')
        await pg.reload()
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        r = await pg.evaluate('({...__tren.st,w3:__tren.wagons(),h3:__tren.houses(),ads:__tren.ads()})')
        same = all(r[k] == saved[k] for k in ('wagons', 'stage', 'mine', 'myName', 'day'))
        check('al recargar sigue el mismo tren, tu casa y tu vagón con mensaje', same and r['w3'] == saved['wagons'] and saved['mineAd'] in r['ads'], f"{r} / {saved}")

        # 10) móvil: todo cabe y se puede tocar
        mob = await b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
        mp = await mob.new_page()
        mp.on('pageerror', lambda e: errors.append(f'pageerror (móvil): {e}'))
        await route_local_three(mp)
        await mp.goto(f'http://127.0.0.1:{PORT}/tren.html?reiniciar')
        await mp.wait_for_function(READY, polling=500, timeout=420000)
        r = await mp.evaluate("""(()=>{const s=document.getElementById('shop').getBoundingClientRect(),its=[...document.querySelectorAll('.it')].map(e=>e.getBoundingClientRect()),
          c=document.getElementById('coal').getBoundingClientRect(),d=document.querySelector('.day').getBoundingClientRect();
          return {sw:document.documentElement.scrollWidth,w:innerWidth,shop:s.bottom<=innerHeight+1,minW:Math.min(...its.map(r=>r.width)),minH:Math.min(...its.map(r=>r.height)),coalAbove:c.bottom<=s.top,dayH:d.height}})()""")
        check('en el móvil caben la cabecera, el carbón y las tres fichas', r['sw'] <= r['w'] and r['shop'] and r['minW'] >= 90 and r['minH'] >= 60 and r['coalAbove'] and r['dayH'] < 24, str(r))
        await mp.tap('#tAd')
        r = await mp.evaluate("""(()=>{const c=document.querySelector('#adSheet .card').getBoundingClientRect(),p=document.getElementById('adPrev').getBoundingClientRect();
          return {l:c.left,r:c.right,t:c.top,b:c.bottom,w:innerWidth,h:innerHeight,pw:p.width,sw:document.documentElement.scrollWidth}})()""")
        check('en el móvil el editor de tu marca cabe en la pantalla', r['l'] >= 0 and r['r'] <= r['w'] and r['t'] >= 0 and r['b'] <= r['h'] and r['pw'] > 280 and r['sw'] <= r['w'], str(r))
        if SHOTS:
            await mp.wait_for_timeout(600)
            await mp.screenshot(path=str(OUT / 'tren-5-movil-marca.png'), timeout=120000)
            await mp.click('#adX')
            await mp.wait_for_timeout(2500)
            await mp.screenshot(path=str(OUT / 'tren-6-movil.png'), timeout=120000)
        await mob.close()

        # 11) rendimiento (informativo): vista de órbita a 1200×760 con 1× y 1,5× de resolución
        await pg.evaluate('__tren.look(0.35,0.6)')
        await pg.wait_for_timeout(2500)
        st = await pg.evaluate('__tren.st')
        print('rendimiento (' + ('GPU' if GPU else 'SwiftShader') + f"), vía {st['stage'] + 1}, {st['houses']} casas, {st['wagons']} vagones:")
        for pr in (1, 1.5):
            m = await pg.evaluate(f'__tren.perf(60,{pr})')
            print(f"  {pr}×: {m['ms']} ms, {m['calls']} draw calls, {m['tris'] // 1000}k triángulos")
        await b.close()
    srv.shutdown()

    check('sin errores de JavaScript ni recursos que fallen', not errors, '\n        '.join(errors[:8]))
    bad = [c for c in checks if not c[1]]
    print(f"\n{len(checks) - len(bad)}/{len(checks)} comprobaciones OK" + ('' if not bad else ' · FALLAN: ' + ', '.join(c[0] for c in bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
