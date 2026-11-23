#!/usr/bin/env python3
"""Prueba end-to-end del tren de todos (tren.html, prototipo) con Playwright.

Partida nueva en la maqueta alpina: zoom con la rueda hacia donde apunta el ratón, tocar un vagón para
seguirlo (ficha con la marca y su enlace), la cámara dentro de los túneles, mandar un regalo a un amigo
(con su enlace) y recibirlo en otro navegador, poner tu casa, reparto, objetivo del día que amplía la vía,
subir un logo con enlace y pujar, enlace no válido, rival que te supera, vista previa en el tren, vagón con
mensaje, guardado y versión móvil. Falla si hay errores de JavaScript, recursos 404 o alguna comprobación no se cumple.

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
        await pg.goto(f'http://127.0.0.1:{PORT}/tren.html?reiniciar', wait_until='commit')
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        await pg.evaluate('window.__idleNoAdapt=true;__tren.look(Math.PI/2,0.62)')

        st = await pg.evaluate('({...__tren.st, w3: __tren.wagons(), h3: __tren.houses(), ads: __tren.ads(), a1: __tren.adImg(1), map: __tren.map()})')
        check('partida nueva: tren con 3 vagones, casas de otros, los dos vagones de ejemplo y la marca con enlace',
              st['w3'] == st['wagons'] == 3 and st['h3'] == st['houses'] == 3 and st['ads'] == [1, 2] and st['a1']['w'] == 1024 and st['a1']['url'] == 'https://www.example.com/' and st['mine'] == -1, str({k: st[k] for k in ('w3', 'h3', 'ads', 'a1', 'mine')}))
        check('la primera vía ya pasa por un túnel y por un puente (el ocho se cruza por encima)', any(r['k'] == 1 for r in st['map']['runs']) and any(r['k'] == 2 for r in st['map']['runs']), str(st['map']))

        # 1) zoom con la rueda hacia donde apunta el ratón (no hacia el centro)
        await pg.mouse.move(930, 470)
        a = await pg.evaluate('__tren.camInfo()')
        for _ in range(6):
            await pg.mouse.wheel(0, -240)
            await pg.wait_for_timeout(40)
        await pg.evaluate('__tren.camSettle()')
        z = await pg.evaluate('__tren.camInfo()')
        check('la rueda acerca la cámara hacia el punto que hay bajo el ratón', z['d'] < a['d'] * 0.45 and z['t'][0] > a['t'][0] + 25, f"{a} → {z}")

        # 2) tocar un vagón: la cámara se pega a él y sale su ficha; la rueda lo acerca más; el tren no cambia de ritmo
        await pg.evaluate('__tren.hold(true);__tren.look(Math.PI/2,0.45,80,-40,55)')   # tren quieto mientras se apunta
        c = await pg.evaluate('__tren.carScreen(3)')
        await pg.mouse.click(c['x'], c['y'])
        await pg.evaluate('__tren.hold(false)')
        await pg.evaluate('__tren.camSettle()')
        r = await pg.evaluate('({f:__tren.focused,card:__tren.card(),fd:__tren.camInfo().fd})')
        check('tocar un vagón lo sigue con la cámara y enseña su ficha', r['f'] and r['f'].get('car') == 3 and not r['card']['hidden'] and r['card']['name'], f'{r} {c}')
        await pg.mouse.move(600, 380)
        for _ in range(4):
            await pg.mouse.wheel(0, -200)
        await pg.evaluate('__tren.camSettle()')
        r2 = await pg.evaluate('(()=>{const d0=__tren.dist;__tren.step(2);return {fd:__tren.camInfo().fd,f:__tren.focused,v:(__tren.dist-d0)/2}})()')
        check('con un vagón enfocado, la rueda acerca la cámara al vagón y el tren sigue a su ritmo', r2['fd'] < r['fd'] - 2 and r2['f'] and r2['f'].get('car') == 3 and 5 < r2['v'] < 6, f"{r['fd']} → {r2}")
        await pg.evaluate('__tren.focus({car:2});__tren.camSettle()')
        r = await pg.evaluate("(()=>{const a=document.getElementById('caGo');return {card:__tren.card(),t:a.target,rel:a.rel,host:document.getElementById('caHost').textContent}})()")
        check('la ficha del vagón patrocinado enlaza a su web en otra pestaña', r['card']['href'] == 'https://www.example.com/' and r['t'] == '_blank' and 'noopener' in r['rel'] and 'sponsored' in r['rel'] and r['host'] == 'example.com', str(r))
        if SHOTS:
            OUT.mkdir(exist_ok=True)
            await pg.wait_for_timeout(1200)
            await pg.evaluate('__tren.camSettle()')
            await pg.screenshot(path=str(OUT / 'tren-2-vagon.png'), timeout=120000)
        await pg.click('#focusX')
        r = await pg.evaluate('({f:__tren.focused,card:__tren.card()})')
        check('«Volver a la maqueta» suelta el vagón y esconde la ficha', not r['f'] and r['card']['hidden'], str(r))

        # 3) túnel: la cámara entra con el vagón (y la marca se sigue viendo) y vuelve a salir
        r = await pg.evaluate("""(()=>{const T=__tren,u=T.map().runs.find(q=>q.k===1);T.hold(true);T.dist=u.s-40-T.offs(2);T.focus({car:2});T.camSettle();const a=T.inside();
          T.dist=u.s+u.len/2-T.offs(2);T.camSettle();const b=T.inside(),p=T.camInfo().p,g=T.ground(p[0],p[2]),c=T.carScreen(2);
          T.dist=u.s+u.len+30-T.offs(2);T.camSettle();return {a,b,under:p[1]<g-3,c,x:innerWidth,y:innerHeight,d:T.inside()}})()""")
        check('en un túnel la cámara entra en la gruta con el vagón centrado, y al salir vuelve fuera', not r['a'] and r['b'] and r['under'] and 0.25 * r['x'] < r['c']['x'] < 0.75 * r['x'] and 0.2 * r['y'] < r['c']['y'] < 0.8 * r['y'] and not r['d'], str(r))
        if SHOTS:
            await pg.evaluate("(()=>{const T=__tren,u=T.map().runs.find(q=>q.k===1);T.dist=u.s+u.len/2-T.offs(2);T.camSettle()})()")
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=str(OUT / 'tren-4-tunel.png'), timeout=120000)
        await pg.evaluate('__tren.hold(false);__tren.focus(null)')

        # 3b) mandar un regalo a un amigo: va en el vagón de regalos, suma al día y sale un enlace para compartir
        t0 = await pg.evaluate('__tren.st.today')
        await pg.click('#tGift')
        await pg.fill('#gTo', '')
        await pg.fill('#gFrom', 'Jon')
        await pg.evaluate("document.getElementById('giftForm').noValidate=true")
        await pg.click('#gGo')
        r = await pg.evaluate("({err:document.getElementById('gErr').textContent,sent:__tren.st.sent})")
        check('sin nombre no se manda el regalo', r['err'] and r['sent'] == 0, str(r))
        await pg.fill('#gTo', 'Iker')
        await pg.click('#gWrap button:nth-child(5)')
        await pg.fill('#gMsg', '¡Feliz Navidad, campeón!')
        await pg.click('#gGo')
        r = await pg.evaluate("({g:__tren.gift(),sent:__tren.st.sent,today:__tren.st.today,left:document.querySelector('#tGift .lv').textContent,open:document.getElementById('shareSheet').classList.contains('on'),link:document.getElementById('sLink').value,wa:document.getElementById('sWa').href})")
        dec = await pg.evaluate("l=>__tren.decode(l.split('#')[1])", r['link'])
        check('el regalo sube al vagón de regalos, gasta uno de los 3 del día y suma al objetivo', r['g'] and r['g']['p'] == 'Iker' and r['g']['onCar'] and r['sent'] == 1 and r['today'] >= t0 + 1 and r['left'] == '2/3 hoy', str(r['g']))
        check('sale un enlace con el regalo dentro y un botón de WhatsApp con ese enlace', r['open'] and dec == {'d': 'Jon', 'p': 'Iker', 'w': 4, 'm': '¡Feliz Navidad, campeón!'} and r['wa'].startswith('https://wa.me/?text=') and '%23regalo-' in r['wa'] and '?' not in r['link'], str(dec))
        if SHOTS:
            await pg.screenshot(path=str(OUT / 'tren-9-compartir.png'), timeout=120000)
        await pg.click('#sFollow')
        await pg.evaluate('__tren.camSettle()')
        r = await pg.evaluate('({f:__tren.focused,gc:__tren.giftCar()})')
        check('«Seguir mi regalo» pega la cámara al vagón de regalos', r['f'] and r['f']['car'] == r['gc'], str(r))
        await pg.evaluate('__tren.focus(null);for(let i=0;i<7;i++){__tren.st.today=0;__tren.step(14)}')
        check('a la vuelta, Papá Noel se lleva el regalo y el vagón queda libre', await pg.evaluate('__tren.gift()===null'))
        link = await pg.evaluate("document.getElementById('sLink').value")

        # 3c) el amigo abre el enlace en su navegador: ve llegar el tren, se abre la tarjeta y puede quedarse la casa
        fr = await (await b.new_context(viewport={'width': 1200, 'height': 760})).new_page()
        fr.on('pageerror', lambda e: errors.append(f'pageerror (amigo): {e}'))
        await route_local_three(fr)
        await fr.goto(link, wait_until='commit')
        await fr.wait_for_function(READY, polling=500, timeout=420000)
        r = await fr.evaluate("({on:document.getElementById('recvSheet').classList.contains('on'),t:document.getElementById('rLead').textContent})")
        check('al abrir el enlace sale el aviso con el nombre de quien lo manda', r['on'] and 'Jon' in r['t'], str(r))
        h0 = await fr.evaluate('__tren.houses()')
        await fr.click('#rGo')
        r = await fr.evaluate('({g:__tren.gift(),f:__tren.focused,gc:__tren.giftCar(),h:__tren.houses(),prov:__tren.prov()})')
        check('el regalo va en el tren hacia su casa (una provisional si no tiene) y la cámara lo sigue', r['g'] and r['g']['mode'] == 'rec' and r['f']['car'] == r['gc'] and r['h'] == h0 + 1 and r['prov'] == h0 and r['g']['house'] == h0, str(r))
        if SHOTS:
            await fr.wait_for_timeout(6000)
            await fr.screenshot(path=str(OUT / 'tren-10-regalo.png'), timeout=120000)
        await fr.wait_for_function("!document.getElementById('giftCard').hidden", timeout=120000)
        r = await fr.evaluate("({to:document.getElementById('gcTo').textContent,m:document.getElementById('gcMsg').textContent,d:document.getElementById('gcFrom').textContent,keep:!document.getElementById('gcHouse').hidden})")
        check('al pasar por su casa se abre la tarjeta con la dedicatoria', r == {'to': 'Para Iker', 'm': '¡Feliz Navidad, campeón!', 'd': 'De Jon', 'keep': True}, str(r))
        if SHOTS:
            await fr.wait_for_timeout(500)
            await fr.screenshot(path=str(OUT / 'tren-11-tarjeta.png'), timeout=120000)
        await fr.click('#gcHouse')
        await fr.click('#gcSend')
        r = await fr.evaluate("({mine:__tren.st.mine,name:__tren.st.myName,to:document.getElementById('gTo').value,d:document.getElementById('gFrom').value,on:document.getElementById('giftSheet').classList.contains('on')})")
        check('puede quedarse la casa y devolver un regalo a quien se lo mandó', r['mine'] == h0 and r['name'] == 'Iker' and r['on'] and r['to'] == 'Jon' and r['d'] == 'Iker', str(r))
        await fr.goto(link.split('#')[0] + '#regalo-esto0no1vale', wait_until='commit')
        await fr.wait_for_timeout(600)
        check('un enlace de regalo estropeado no abre nada', not await fr.evaluate("document.getElementById('recvSheet').classList.contains('on')"))
        await fr.context.close()

        # 4) poner tu casa desde el formulario; la cámara va a verla
        await pg.evaluate('__tren.look(Math.PI/2,0.62)')
        h0 = await pg.evaluate('__tren.st.houses')
        await pg.click('#tHouse')
        await pg.fill('#hName', 'Jon')
        await pg.fill('#hProv', 'Bizkaia')
        await pg.click('#houseForm button[type=submit]')
        await pg.wait_for_timeout(700)
        await pg.evaluate('__tren.camSettle()')
        r = await pg.evaluate('({mine:__tren.st.mine,h:__tren.st.houses,h3:__tren.houses(),name:__tren.st.myName,open:document.getElementById("houseSheet").classList.contains("on"),cam:__tren.camInfo()})')
        check('poner tu casa: hueco propio junto a la vía, con tu nombre, y la cámara se acerca', h0 <= r['mine'] < r['h'] and r['h3'] == r['h'] and r['name'] == 'Jon' and not r['open'] and r['cam']['d'] < 60, str(r))

        # 5) el tren reparte y te deja regalos a ti
        mine = r['mine']
        r = await pg.evaluate('(()=>{const T=__tren;for(let i=0;i<10;i++){T.st.today=0;T.step(15)}return {d:T.delivered(),laps:T.laps(),me:T.st.myGifts,total:T.st.total}})()')
        check('el tren reparte en las casas y también en la tuya', r['d'] > 5 and r['laps'] >= 1 and r['me'] > 0, str(r))

        # 6) objetivo del día cumplido: la vía crece y vuelven los regalos gratis
        r = await pg.evaluate("""(async()=>{const T=__tren,d0=T.st.day,s0=T.st.stage,L0=T.map().L;T.finishDay();for(let i=0;i<150&&T.busy;i++)await new Promise(r=>setTimeout(r,100));
          return {d0,s0,L0,day:T.st.day,stage:T.st.stage,L:T.map().L,runs:T.map().runs,h3:T.houses(),h:T.st.houses,mine:T.st.mine,today:T.st.today,left:document.querySelector('#tGift .lv').textContent}})()""")
        check('al cumplir el objetivo del día la vía crece (con puentes) y las casas se recolocan', r['day'] == r['d0'] + 1 and r['stage'] == r['s0'] + 1 and r['L'] > r['L0'] + 50 and any(x['k'] == 2 for x in r['runs']) and r['h3'] == r['h'] and r['mine'] == mine and r['today'] < 60, str({k: r[k] for k in ('day', 'stage', 'L0', 'L', 'runs', 'h3', 'h', 'mine', 'today')}))
        check('el día nuevo devuelve los 3 regalos gratis', r['left'] == '3/3 hoy', r['left'])

        # 7) tu marca: subir logo, texto y enlace; un enlace raro no vale; pujar por el vagón del día
        await pg.click('#tAd')
        await pg.set_input_files('#adFile', files=[{'name': 'logo.png', 'mimeType': 'image/png', 'buffer': png()}])
        await pg.fill('#adText', 'Vivero Abeto Verde')
        await pg.fill('#adSub', 'Árboles de Navidad · Getxo')
        await pg.wait_for_function("document.getElementById('adFileLbl').textContent==='Cambiar imagen'", timeout=10000)
        top0 = await pg.evaluate('__tren.auc.top.amt')
        await pg.fill('#adUrl', 'javascript:alert(1)')
        await pg.click('#bidGo')
        r = await pg.evaluate("({err:document.getElementById('adErr').textContent,top:__tren.auc.top})")
        check('un enlace que no es una web no se acepta', 'enlace' in r['err'] and not r['top']['me'], str(r))
        await pg.fill('#adUrl', 'vivero-abeto.es/navidad')
        await pg.click('#bidGo')
        r = await pg.evaluate('({top:__tren.auc.top,bid:__tren.auc.bid&&{amt:__tren.auc.bid.amt,img:!!__tren.auc.bid.ad.img,text:__tren.auc.bid.ad.text,url:__tren.auc.bid.ad.url}})')
        check('subir un logo con enlace y pujar te pone primero con la puja mínima', r['top']['me'] and r['top']['amt'] == top0 + 1 and r['bid']['img'] and r['bid']['text'] == 'Vivero Abeto Verde' and r['bid']['url'] == 'https://vivero-abeto.es/navidad', str(r))
        if SHOTS:
            await pg.locator('#adSheet .card').screenshot(path=str(OUT / 'tren-3-marca.png'), timeout=120000)
        r = await pg.evaluate('(()=>{__tren.rival();return {top:__tren.auc.top,hot:document.getElementById("tAd").classList.contains("hot")}})()')
        check('si un rival te supera, pierdes el primer puesto y te avisa', not r['top']['me'] and r['top']['amt'] > top0 + 1 and r['hot'], str(r))

        # 8) vista previa en el tren y vuelta
        await pg.click('#adSee')
        r = await pg.evaluate('({f:__tren.focused,a1:__tren.adImg(1),pill:document.getElementById("focusX").hidden,card:__tren.card()})')
        check('«Ver cómo queda» pone tu diseño en el primer vagón, con su enlace, y la cámara lo sigue', r['f'] and r['f'].get('car') == 2 and r['a1']['img'] and r['a1']['text'] == 'Vivero Abeto Verde' and r['a1']['url'].startswith('https://vivero-abeto.es') and not r['pill'], str(r))
        await pg.click('#focusX')
        r = await pg.evaluate('({f:__tren.focused,a1:__tren.adImg(1),open:document.getElementById("adSheet").classList.contains("on")})')
        check('al volver, el vagón del día recupera su anuncio y se reabre el editor', not r['f'] and r['a1']['text'] == 'Pastelería La Estrella' and r['open'], str(r))

        # 9) vagón con mensaje: va en el primer vagón libre y su ficha lleva el enlace
        await pg.click('#tabMsg')
        await pg.click('#msgGo')
        await pg.evaluate('__tren.camSettle()')
        r = await pg.evaluate('({ads:__tren.ads(),mine:__tren.auc.mine&&__tren.auc.mine.wagon,w:__tren.wagons(),f:__tren.focused,card:__tren.card()})')
        check('comprar un vagón con mensaje lo pone en un vagón libre, y su ficha enlaza a tu web', r['mine'] and r['mine'] >= 3 and r['mine'] in r['ads'] and r['f'] and r['f']['car'] == r['mine'] + 1 and r['card']['href'] == 'https://vivero-abeto.es/navidad', str(r))
        await pg.click('#focusX')

        if SHOTS:
            await pg.evaluate('__tren.look(Math.PI/2,0.62)')
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=str(OUT / 'tren-1-maqueta.png'), timeout=120000)
            await pg.evaluate('__tren.look(1.75,0.42,70,92,-62)')
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=str(OUT / 'tren-7-esqui.png'), timeout=120000)

        # 10) se guarda y se recupera
        saved = await pg.evaluate('(()=>{window.dispatchEvent(new Event("pagehide"));return {...__tren.st,mineAd:__tren.auc.mine&&__tren.auc.mine.wagon}})()')
        await pg.reload(wait_until='commit')
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        r = await pg.evaluate('({...__tren.st,w3:__tren.wagons(),h3:__tren.houses(),ads:__tren.ads()})')
        keys = ('wagons', 'stage', 'mine', 'myName', 'day', 'sent', 'sToday', 'sDay')
        same = all(r[k] == saved[k] for k in keys)
        check('al recargar sigue el mismo tren, tu casa, tus regalos y tu vagón con mensaje', same and r['w3'] == saved['wagons'] and saved['mineAd'] in r['ads'], f"{ {k: r[k] for k in keys} } / { {k: saved[k] for k in keys} }")

        # 11) móvil: todo cabe y se puede tocar
        mob = await b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
        mp = await mob.new_page()
        mp.on('pageerror', lambda e: errors.append(f'pageerror (móvil): {e}'))
        await route_local_three(mp)
        await mp.goto(f'http://127.0.0.1:{PORT}/tren.html?reiniciar', wait_until='commit')
        await mp.wait_for_function(READY, polling=500, timeout=420000)
        r = await mp.evaluate("""(()=>{const s=document.getElementById('shop').getBoundingClientRect(),its=[...document.querySelectorAll('.it')].map(e=>e.getBoundingClientRect()),
          d=document.querySelector('.day').getBoundingClientRect(),n=document.getElementById('tip').getBoundingClientRect();
          return {sw:document.documentElement.scrollWidth,w:innerWidth,shop:s.bottom<=innerHeight+1,minW:Math.min(...its.map(r=>r.width)),minH:Math.min(...its.map(r=>r.height)),dayH:d.height,gap:n.top-d.bottom}})()""")
        check('en el móvil caben la cabecera, las noticias y las tres fichas', r['sw'] <= r['w'] and r['shop'] and r['minW'] >= 90 and r['minH'] >= 44 and r['dayH'] < 24 and r['gap'] >= 0, str(r))
        await mp.evaluate('__tren.focus({car:2});__tren.camSettle()')
        r = await mp.evaluate("""(()=>{const c=document.getElementById('card').getBoundingClientRect(),s=document.getElementById('shop').getBoundingClientRect();return {l:c.left,r:c.right,b:c.bottom,top:s.top,w:innerWidth,vis:!document.getElementById('card').hidden}})()""")
        check('en el móvil la ficha del vagón cabe encima de las fichas de abajo', r['vis'] and r['l'] >= 0 and r['r'] <= r['w'] and r['b'] <= r['top'], str(r))
        if SHOTS:
            await mp.wait_for_timeout(900)
            await mp.evaluate('__tren.camSettle()')
            await mp.screenshot(path=str(OUT / 'tren-8-movil-vagon.png'), timeout=120000)
        await mp.evaluate('__tren.focus(null)')
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

        # 12) rendimiento (informativo): vista general a 1200×760 con 1× y 1,5× de resolución
        await pg.evaluate('__tren.look(Math.PI/2,0.62)')
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
