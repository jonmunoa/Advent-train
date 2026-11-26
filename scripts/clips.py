"""Graba las escenas de cada día como vídeos verticales (1080×1920, 30 fps) para TikTok, Reels o Shorts.

Fotograma a fotograma, sin depender de la velocidad del ordenador. Necesita Playwright (como las pruebas), numpy y ffmpeg.
La música es una caja de música con «Noche de paz» (dominio público).

Uso:
  python scripts/clips.py 1,6,18        # días 1–24
Deja los vídeos en clips/ (no se sube al repositorio).
"""
import asyncio, math, pathlib, subprocess, sys, tempfile, wave
import numpy as np
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
from harness import serve, chromium_args  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
FPS, SR, OUT = 30, 44100, ROOT / 'clips'
DIAS = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '1').split(',')]
CSS = """.hud,.saltar,.pv,#navHint,#toast,#card,.fin,.intro{display:none!important}#cine i{transition:none!important}
#texto{transition-duration:5s!important;font-size:150px!important}#flash.on{animation-duration:2.2s!important}#dip{transition-duration:.9s!important}
#rot{position:fixed;left:0;right:0;top:11.5vh;text-align:center;z-index:20;font:400 46px/1.1 Yesteryear,cursive;color:#fff6e0;text-shadow:0 3px 22px rgba(0,0,0,.8);opacity:0}
#cie{position:fixed;inset:0;z-index:21;display:grid;place-content:center;text-align:center;background:rgba(4,6,14,.78);opacity:0;color:#fff6e0}
#cie b{font:400 54px/1.05 'Alfa Slab One',Georgia,serif;color:#fbf3df}#cie i{display:block;font:400 58px/1 Yesteryear,cursive;color:#e0ad45}#cie span{display:block;margin-top:26px;font:600 22px/1.3 Rubik,sans-serif;color:#dfe5f5}"""


def caja(dur, viento=False):
    """pista de sonido: caja de música o viento"""
    n = int(dur * SR); a = np.zeros(n + SR * 3)
    if viento:
        r = np.random.default_rng(3).standard_normal(n + SR * 3); k = np.ones(220) / 220; w = np.convolve(r, k, 'same') - np.convolve(r, np.ones(1400) / 1400, 'same')
        t = np.arange(len(w)) / SR; a = w * (0.55 + 0.45 * np.sin(t * .7) * np.sin(t * .31 + 1)) * 2.4
    else:
        N = {'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71, 'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77}
        mel = [('G4', 1.5), ('A4', .5), ('G4', 1), ('E4', 3)] * 2 + [('D5', 2), ('D5', 1), ('B4', 3), ('C5', 2), ('C5', 1), ('G4', 3)] + [('A4', 2), ('A4', 1), ('C5', 1.5), ('B4', .5), ('A4', 1), ('G4', 1.5), ('A4', .5), ('G4', 1), ('E4', 3)] * 2 + [('D5', 2), ('D5', 1), ('F5', 1.5), ('D5', .5), ('B4', 1), ('C5', 3), ('E5', 3), ('C5', 1), ('G4', 1), ('E4', 1), ('G4', 1.5), ('F4', .5), ('D4', 1), ('C4', 6)]
        aco = {0: [48, 55, 64], 1: [43, 50, 59], 2: [41, 48, 57]}; bt, t0 = .46, .5

        def nota(m, t, v, d=2.6):
            i, L = int(t * SR), int(d * SR)
            if i + L > len(a): return
            x = np.arange(L) / SR; f = 440 * 2 ** ((m - 69) / 12); e = np.exp(-x * 2.4)
            a[i:i + L] += v * e * (np.sin(2 * math.pi * f * x) + .38 * np.sin(2 * math.pi * f * 3.01 * x) * np.exp(-x * 5) + .16 * np.sin(2 * math.pi * f * 5.4 * x) * np.exp(-x * 9))
        while t0 < dur:
            t = t0
            for k, (q, d) in enumerate(mel): nota(N[q] + 12, t, .16); t += d * bt
            c = 0; s = t0
            while s < t: ch = aco[[0, 0, 0, 0, 1, 1, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0][c % 24]]; [nota(m + 12, s + j * bt, .05) for j, m in enumerate(ch)]; s += 3 * bt; c += 1
            t0 = t + .6
        eco = np.zeros_like(a)
        for d, g in [(.11, .35), (.23, .25), (.37, .18), (.55, .12)]: i = int(d * SR); eco[i:] += a[:-i] * g
        a = a + eco
    a = a[:n]; f = int(1.2 * SR); a[-f:] *= np.linspace(1, 0, f); a = a / max(1e-6, np.abs(a).max()) * .72
    return (a * 32767).astype(np.int16)


async def main():
    OUT.mkdir(exist_ok=True); srv = serve(8840, ROOT)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=chromium_args(True)); ctx = await b.new_context(viewport={'width': 540, 'height': 960}, device_scale_factor=2); pg = await ctx.new_page()
        await pg.goto(f'http://127.0.0.1:8840/escaparates.html?dia={DIAS[0]}', wait_until='commit'); await pg.wait_for_function('window.__esc&&__esc.listo', timeout=120000)
        await pg.add_style_tag(content=CSS)
        await pg.evaluate("window.__noAdapt=true;document.body.insertAdjacentHTML('beforeend','<div id=rot></div><div id=cie><div><b>La calle</b><i>de los trenes</i><span></span></div></div>');__esc.empezar();__esc.hold(true)")
        for k, d in enumerate(DIAS):
            await pg.evaluate(f'__esc.ponDia({d})'); await pg.wait_for_timeout(1400)
            await pg.evaluate("(()=>{for(let i=0;i<600&&__esc.st==='paseo'&&Math.abs(__esc.E.x-__esc.n*340)>80;i++)__esc.step(1/30)})()")
            await pg.evaluate(f"document.getElementById('rot').textContent={f'{d} de diciembre'!r};document.querySelector('#cie span').textContent={'' if d == 24 else 'Mañana se enciende otro, a las 18:00'!r}")
            out = OUT / f'dia-{d:02d}.mp4'; tmp = pathlib.Path(tempfile.mkdtemp()); wav = tmp / 'a.wav'; vid = tmp / 'v.mp4'
            ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', str(vid)], stdin=subprocess.PIPE)
            n, fin, cola = 0, 0, int(2.6 * FPS)
            while n < FPS * 110:
                t = n / FPS; v = min(1, t / .6) * min(1, max(0, (3.4 - t) / .8)); u = 0 if not fin else min(1, (n - fin) / (FPS * .8))
                st = await pg.evaluate(f"(async()=>{{const e=__esc;{'' if fin and n - fin > FPS * .5 else 'e.step(1/30,1/30,true);'}document.getElementById('rot').style.opacity={v:.3f};document.getElementById('cie').style.opacity={u if d != 24 else 0:.3f};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return e.st}})()")
                ff.stdin.write(await pg.screenshot(type='jpeg', quality=93)); n += 1
                if not fin and st not in ('paseo', 'escena', 'llega'): fin = n
                if fin and n - fin > (cola if d != 24 else 4): break
            ff.stdin.close(); ff.wait(); dur = n / FPS
            with wave.open(str(wav), 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(caja(dur).tobytes())
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(vid), '-i', str(wav), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', str(out)], check=True)
            print(out.name, f'{dur:.1f} s', f'{out.stat().st_size / 1e6:.1f} MB', flush=True)
        await b.close()
    srv.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
