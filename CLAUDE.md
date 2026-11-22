# Adviento Express — contexto para Claude Code

Juego web de tren de Navidad en 3D con formato **calendario de Adviento**: 24 puertas (1–24 de diciembre), cada una abre un circuito distinto. El jugador conduce un tren de juguete por una maqueta nevada bajo un árbol de Navidad gigante, en un salón de noche. Monetización: **afiliación de Amazon** (cada circuito enlaza a un tipo de tren de Navidad real). Objetivo: que se comparta mucho en diciembre (tiempos, medallas, retos entre amigos).

Autor: Jon (desarrollador .NET/Angular, trabaja con IA). Habla en español y quiere respuestas concisas y prácticas. Tiene el listón visual alto: pide realismo y rendimiento en Android.

## Cómo ejecutar

Es una web estática sin build:

```bash
npx serve -l 5173 .        # o: python -m http.server 5173
# abrir http://localhost:5173
```

- three.js **0.170.0** se carga desde jsDelivr con un `importmap` en `index.html` (incluye addons: postprocesado, GLTFLoader, EXRLoader, BufferGeometryUtils).
- Prueba de humo: `python tests/e2e.py` (Playwright). Completa carreras con un bot y comprueba las mecánicas (regalos, compartir, fantasma y reto); falla si hay errores JS, recursos 404 o alguna comprobación no se cumple. `--shots` guarda capturas en `tests/out/`, `--gpu` usa la GPU real.
- Rendimiento: `python tests/perf.py` mide ms/fotograma, draw calls, triángulos y texturas en poses fijas y compara con `tests/perf-baseline.json` (`--save` la actualiza). En el móvil, `?debug` en la URL muestra fps, pixel ratio y draw calls.
- Hook de pruebas en el navegador: `window.__adv` (`step(dt, acelerar)`, `settle()` para asentar la cámara, `G` estado de carrera, `MED`, `BELLS()`, `ST()`, `vsAhead(dist)`, `newRun()`, `giftsOn()`, `shareText()`, `code` (reto actual), `GH`, `sim()` (importa `sim.js`), `pose(tipo, f)` y `perf(n)`).
- En el selector del calendario hay un "Modo pruebas" que abre las 24 puertas (`localStorage advx-dev`).

## Estructura

```
index.html                 HTML de todas las pantallas + importmap
src/styles.css             estilos (estética papel/cartón/billete de tren)
src/main.js                todo el juego (módulo ES, ~900 líneas, secciones marcadas con /* ==== */)
src/sim.js                 física, circuitos, campanas, medallas, codec del fantasma y validateRun (sin DOM; lo comparte la Edge Function)
config.js                  configuración pública: TAG de Amazon, SITE_URL, SUPABASE_URL/KEY
src/products.js            producto de Amazon de cada día (titulo, asin, busqueda)
scripts/build.mjs, vercel.json   despliegue: copia a dist/ y genera dist/config.js desde ADVX_TAG, ADVX_SITE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
og.jpg, favicon.svg        imagen para compartir (1200×630) e icono
supabase/                  migración SQL (tabla runs + RLS) y Edge Function submit-run (handler.js + _shared/sim.js copiado)
scripts/sync-shared.mjs    copia src/sim.js a supabase/functions/_shared (el e2e falla si difieren)
m/{holiday,train}/*.glb    modelos Kenney usados (27), servidos tal cual; textura en m/<kit>/Textures/colormap.png
m/ph/                      Poly Haven: texturas webp (parqué, nieve, ladrillo, tejidos) y muebles .glb (meshopt + webp)
m/env/fireplace_1k.exr     HDRI de interior nocturno (Poly Haven "fireplace")
assets-src/kenney/         .glb originales (Kenney Holiday Kit + Train Kit, CC0); los usados están copiados en m/
scripts/fetch-polyhaven.mjs   descarga y aligera los recursos de Poly Haven (lista en scripts/polyhaven.json)
tests/e2e.py, perf.py      prueba end-to-end (con Supabase simulado) y banco de rendimiento (harness.py: servidor y Chromium)
tests/edge.test.mjs        validación antitrampas y submit-run con Node (npm i para tener three)
```

Los modelos Kenney se cargan con `GLTFLoader.loadAsync` desde el mapa `MODELS` de `main.js`. Los muebles de Poly Haven usan `loadGLB` (con `MeshoptDecoder`) y se cargan sin bloquear la carga del día (`buildFurniture`, `__adv.roomReady()`). Para añadir un modelo Kenney, cópialo de `assets-src/kenney/` a `m/<kit>/` y añádelo a `MODELS`.

## Arquitectura de `src/main.js`

Secciones en orden: utilidades → datos (días, temas, productos, física) → portada (SVG ilustrado) → motor (renderer, EffectComposer: RenderPass + UnrealBloom + pase `grade` propio + OutputPass) → texturas procedurales (canvas) → materiales → modelos Kenney (`loadModels`, `toyMat`, `flat`, `inst`, `obj`) → tren (`carFrom`, `buildTrain`, fantasma) → salón fijo (`buildRoom`: suelo, paredes, ventana, chimenea, guirnaldas) → mundo por día (`buildWorld`: vía, manta de nieve, árbol gigante, estaciones decorativas, arcos, farolas, señales de curva, casas, decorado, regalos gigantes, campanas, `batchStatic`) → sonido (efectos + villancicos sintetizados con WebAudio) → clasificación (`Board`: PostgREST + `submit-run`, o `localStorage`; ligas) → estrellas, reto del día, cochera y racha (`RETOS`, `LOOKS`, `applyLook`) → juego (`race`, `setRoute`, `loseGift`/`reloadGift`, `deliver`, `startFinish`, combos, rebufo, fantasma y reto) → compartir (`shareText`, `renderShare`) → cámara → HUD → pantallas (calendario, billete, llegada) → controles → bucle (`fx`, resolución adaptativa `adapt`).

Convenciones:
- Unidades: metros y segundos. El tren va de 0 a `VMAX=30` m/s. Coordenadas del suelo en X/Z, Y arriba.
- Circuito (`sim.js`): `buildTrack()` samplea una Catmull-Rom cerrada cada `STEP=0.5` m. `T.vs[i]` es la velocidad segura por curvatura (`ALAT`); `T.ve[i]` la envolvente (morro y cola bajo `vs` y distancia para frenar soltando), que es lo que enseña el dial y usa `vsAhead()`. `at(s)` da posición y rumbo a una distancia `s`.
- Coches: grupo "holder" con **+X hacia delante**; el modelo Kenney se rota dentro.
- Día 1 es un trazado a mano (`DAY1`); los demás son procedurales con semilla `d*7919+11` (`trackPts`). El mismo trazado alimenta el dibujo de la puerta del calendario.
- Rutas (`sim.js`, `routesFor(d)`): la principal y, en los días con agujas (`SHORTCUT_DAYS`), la del atajo, con sus campanas y paradas. Las posiciones de la principal pasan a la del atajo con `sc.mapS` (antes de la aguja, igual; en el tramo saltado, `null`; después, `+delta`). En carrera, `T` es la ruta actual, `TM` la principal y `SC` el atajo; las campanas, paradas y estaciones guardan `rs=[s principal, s atajo]` y `setRoute(ri)` rehace las listas `G.BL`/`G.DL`/`G.CK`.
- Medallas: `medalsFor(d)` simula un maquinista perfecto (salida perfecta, siempre a la envolvente, turbo cuando renta) en cada ruta y con cada subconjunto de paradas de reparto, y se queda con el mejor. Oro, plata y bronce son ×1.08 / ×1.22 / ×1.40 del ideal.
- Castigo por no frenar: el `stress` sube si morro o cola van más de un 3 % por encima de `vs`; al llegar a 1 se cae el regalo del primer vagón (+`PEN_GIFT`=2 s, patinazo a 0,75× `vs` y 0,7 s sin tracción). Cada estación recarga uno. No hay descarrilamiento.
- Tiempo final = tiempo + 2 s por regalo perdido − bonus de campanas (combo creciente, `bellBonus`) − 2 s por reparto.
- Reparto: 3 paradas por vuelta (`dropsFor`), en tramos rápidos; pasar por la zona de ±3 m a ≤ 40 km/h lanza un regalo a la chimenea. La envolvente con paradas (`envelope(T, drops)`, `ENVD`) es la que usa el bot (`vsDrop`).
- Agujas: el atajo es una Bézier con la tangente de la vía en los empalmes; se salta la estación del medio y tiene campanas propias. Se elige con A o el botón AGUJA y se bloquea 4 m antes de la bifurcación.
- Modificadores (`MODS`): hielo (3, 19; zonas con `vs`×0,8), ventisca (11, 17; más arrastre y niebla), túnel de estrellas (14; el salón se apaga dentro), noche (23, 24) y viento de cola (12, 22; el turbo se carga antes). La física va en `T.phys` (`physOf`).
- Rebufo: entre 3 y 16 m detrás del fantasma, el turbo se carga (`DRAFT_RATE`).
- Estrellas: oro, todas las campanas y el reto del día (`retoOf`). Desbloquean en la cochera libreas (shader de tono en `trainMat`), cargas y humos (`LOOKS`). La racha cuenta las puertas jugadas el mismo día que se abren.
- Ligas: código de 6 caracteres en `?liga=…&n=…`; `submit-run` apunta el dispositivo en `league_members` y la vista `league_board` da la clasificación.
- Turbo: la barra se carga apurando curvas (`turboCharging`: en curva y entre 0,88× y 1,03× de `vs`, 3 s de curva para llenarla). Al activarlo (E, Mayús o botón TURBO): +4 m/s, +9 m/s² con el vapor pisado durante 2,5 s y tope de 35 m/s (`VTURBO`); soltando no empuja. Perder un regalo vacía la barra. `vs` llega hasta `VS_CAP=40` en recta; la conducción normal topa en `VMAX`. `medals()` usa el turbo con `turboGood()` (margen en la envolvente en los próximos 20 m). Al experto le da un 1–4 % por vuelta.
- Fantasma (codec v2 en `sim.js`, lee también v1): velocidad media cada 0,1 s cuantizada a 0,15 m/s, deltas zigzag, deflate-raw y base64url (~270 caracteres por carrera); lleva repartos y flags (rebufo, atajo). Se guarda en `advx-gh-<día>` y viaja en los enlaces `#reto-<código>`, que llevan día y nombre. El fantasma de un amigo es dorado con su nombre.
- Todo el texto de UI en español de España.
- `localStorage`: `advx-best-<día>`, `advx-medal-<día>`, `advx-gh-<día>` (fantasma codificado), `advx-lb-<día>` (ranking local), `advx-name`, `advx-device` (UUID para el ranking), `advx-run-<día>` (id de mi fila en el ranking), `advx-stars-<día>` (máscara de estrellas), `advx-racha` (días jugados en su día), `advx-look` (cochera), `advx-ligas` y `advx-liga` (ligas y la activa), `advx-cam`, `advx-music`, `advx-sfx`, `advx-dev`.

## Pendientes conocidos

- Faltan los valores reales en Vercel: `ADVX_TAG` (en local, `config.js` usa el marcador `TU-TAG-21` y se ve el aviso de enlace de ejemplo) y `ADVX_SITE_URL`.
- Faltan los ASIN de `src/products.js`: sin ellos los enlaces son búsquedas de Amazon.
- Despliegue preparado (Vercel), pero aún no hecho.
- La clasificación global está preparada (Supabase: `supabase/`), pero falta crear el proyecto y poner `SUPABASE_URL`/`SUPABASE_KEY` (README → «Clasificación global»). Sin ellos, `Board` guarda en `localStorage`.
- La validación antitrampas (`validateRun` en `sim.js`) acota la física, pero no puede impedir un bot que conduzca de verdad.
- Las campanas son 4 mallas cada una (sin instanciar): en órbita, el día 13 llega a ~290 draw calls. Si en Android cuesta, instanciarlas es lo primero.
- No se ha medido el rendimiento en un móvil real; hay resolución dinámica, un modo de baja calidad automático y `?debug`.

## Dirección de arte

"Maqueta de juguete bajo el árbol": juguetes reales fotografiados de noche. Iluminación fría de luna desde la ventana + cálida de la chimenea, bloom, desenfoque de miniatura en vistas abiertas. Jon quiere más realismo: el siguiente paso es usar recursos fotográficos de **Poly Haven** (CC0: texturas de nieve/madera/tela/ladrillo, HDRIs de interior en mayor resolución y muebles escaneados para el salón: sofá, butaca, alfombra, lámpara, plantas). En el entorno cloud de Claude.ai estaba bloqueado; en un PC con internet normal se pueden descargar (API: `https://api.polyhaven.com/files/<slug>`).

## Licencias de recursos

Ver `LICENSES.md`. Todo lo incluido es CC0. Si se añaden modelos CC-BY (por ejemplo de Sketchfab), hay que añadir el crédito en `LICENSES.md` y en el pie de la portada.
