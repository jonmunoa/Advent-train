# Adviento Express 🚂🎄

Calendario de Adviento jugable: cada día del 1 al 24 de diciembre se abre una puerta con un circuito nuevo de tren de juguete en 3D.

- **Conducir**: apura las curvas sin pasarte (si te pasas, se cae un regalo y suma 2 s), haz sonar las campanas a la velocidad que piden y frena en las casitas para **repartir regalos** (≤ 40 km/h, −2 s cada uno).
- **Turbo**: se carga apurando curvas o yendo **a rebufo** del fantasma.
- **Cada puerta es distinta**: hielo, ventisca, túnel de estrellas, noche cerrada, viento de cola y **agujas** con un atajo más corto pero más cerrado.
- **Tres estrellas por puerta** (oro, todas las campanas y el reto del día), **racha** y **cochera** con libreas, cargas y humos para desbloquear.
- **Retos y ligas**: comparte el resultado al estilo Wordle con un enlace para correr contra tu fantasma, y crea una liga para la familia o la oficina.

## Probar en local

```bash
npx serve -l 5173 .
# o
python -m http.server 5173
```

Abre `http://localhost:5173`. Antes del 1 de diciembre solo está abierta la puerta 1; marca "Modo pruebas" al final del calendario para abrir todas.

## Prototipo idle: Mi maqueta de Navidad

`http://localhost:5173/idle.html` es un prototipo de otro enfoque. El tren da vueltas solo bajo el árbol, carga regalos en el taller y los reparte a las casas; cada regalo da monedas de chocolate. Con ellas compras:

- **Casa**: más casas a las que repartir.
- **Vagón**: más regalos por vuelta.
- **Máquina**: más velocidad.
- **Luces**: cada regalo vale más, y además aparecen guirnaldas, farolas y arcos.
- **Más vía**: la vía crece, caben más casas y cada regalo vale el triple.

El **silbato** acelera el tren unos segundos. Si cierras la página, al volver recoges lo que ha repartido mientras no estabas (60 %, hasta 8 h).

- Arrastra para girar la maqueta y pellizca o usa la rueda para acercarte. Con el botón del ojo (o C) la cámara sigue al tren.
- Teclado: 1–5 compran y Espacio toca el silbato.
- `?reiniciar` empieza una partida nueva, `?rapido` multiplica por 10 las monedas (para probar) y `?debug` muestra fps y draw calls.

La partida se guarda en `localStorage` (`advx-idle`). La economía está en `src/idle-eco.js`, y `node tests/idle-balance.mjs` simula a un jugador para ver el ritmo.

## El tren del escaparate (`escaparates.html`)

`http://localhost:5173/escaparates.html` es el enfoque actual: un **calendario de Adviento** sin servidor ni base de datos (el nombre es provisional). Un niño pasea de la mano de su madre por una calle nevada de **24 escaparates, uno por día**, con un circuito de tren distinto en cada uno.

- **Cada día a las 18:00 se enciende uno.** Los que faltan están tapados con papel de embalar y su fecha; el de mañana tiene un agujero para asomarse. Los ya encendidos se quedan abiertos hasta Reyes.
- **Un momento cada día**: en cada escaparate, una escena sin palabras de 6–15 segundos que se entiende sola (la nariz en el cristal, una bola de nieve, la foto que sale mal…). El 24 se cierra con el niño ya mayor. El 31 hay campanadas, el 5 de enero cabalgata y el 6 Reyes. Están en `src/esc-escenas.js`.
- **Lo que vende cada tienda**: «Llévate uno a casa» enlaza a un producto de Amazon con enlace de afiliado. Se edita en `src/esc-tienda.js` (pon el `asin` para ir a una ficha en concreto) y el código va en `config.js` o en `ADVX_TAG`. Las marcas están guardadas tras `VENDER` en `src/esc-marcas.js`.
- **En la calle**: la cámara va detrás del niño y el paseo va solo. Arrastra para mirar alrededor, usa la rueda o un pellizco para acercarte y las flechas para ir al escaparate anterior o al siguiente.
- **Pincha un escaparate y entras en él**: se maneja como un mapa (arrastrar o un dedo mueve, la rueda o el pellizco acercan adonde apuntas, el botón derecho o girar dos dedos gira, subir o bajar dos dedos inclina). Tocar un vagón lo sigue, el ojo va con el tren y, mirando hacia el cristal, se ve al niño asomado. «Volver a la calle» o Escape salen. Teclado: flechas o WASD, +, −, Q, E, 0 y C.
- **Marcas** en el rótulo de cada tienda y en los cuatro vagones de su tren, salvo el 24 (apagadas por ahora). Se escriben a mano en `src/esc-marcas.js`; no se cobra ni se guarda nada desde la web.

Fuera de temporada es una **vista previa**: un botón cambia de día. `?dia=7` enseña un día (25 son las campanadas, 26 la cabalgata y 27 Reyes), `?movil` fuerza la versión ligera y `?debug` muestra fps y draw calls.

**Vídeos para TikTok y Reels**: `python scripts/clips.py 1,6,18` graba las escenas en vertical (1080×1920, con música de caja) en `clips/`. Necesita Playwright, numpy y ffmpeg.

## Prototipo: el tren de Navidad (`tren.html`)

`http://localhost:5173/tren.html` prueba otro enfoque, sin servidor ni base de datos: un tren que recorre despacio una maqueta y **crece cada día de diciembre** (el nombre es provisional).

La **maqueta alpina** tiene la vía en forma de **ocho**: se cruza a sí misma por un viaducto, sube y baja por lomas, atraviesa la colina y la montaña por túneles (por dentro, una gruta de hielo iluminada en la que la cámara entra con el tren) y cruza el río y los arroyos por puentes de piedra. Hay pueblo con plaza, lago helado con patinadores y estación de esquí con telesilla. Papá Noel saluda desde el taller y su trineo vuela por encima. En el móvil va en modo ligero (sin sombras ni posprocesado) para que vaya fluido; `?movil` lo fuerza en el ordenador.

- **Elige por dónde va**: en cada cruce hay dos caminos de verdad (túnel o bosque, orilla o puente sobre el lago, montaña o valle…). Se elige con un toque, en el panel o en los carteles de la maqueta. Si no eliges, el tren alterna. Cuenta los caminos que has recorrido.
- **Calendario de Adviento**: cada día llega algo (un vagón, luces, casas o un tramo de vía) y en Nochebuena hay fuegos artificiales. Es igual para todo el mundo porque sale de la fecha. Fuera de temporada se puede pasar de día con un botón; `?dia=15` enseña un día concreto.
- **Pon tu casa** junto a la vía: el tren te deja regalos cada vez que pasa y tu nombre va también en la locomotora. Se guarda solo en tu navegador.
- **Marcas en los vagones**: qué marca va en cada vagón y qué días se escribe a mano en `src/tren-marcas.js` (con su enlace y su imagen en `m/marcas/`). Quien quiere un vagón lo diseña en la web, ve cómo queda en el tren y manda la petición por correo; no se cobra ni se guarda nada desde la web. Quien toca el vagón ve su ficha con el botón «Visitar».
- **Cámara**: se maneja como un mapa. Arrastrar (o un dedo) mueve, la rueda o el pellizco acercan adonde apuntas, el botón derecho (o girar dos dedos) gira, subir o bajar dos dedos inclina y el doble clic acerca. Tocar un vagón lo sigue de cerca y «Volver a la maqueta» te deja donde estabas. También hay botones en pantalla y teclado (flechas, +, −, Q, E, 0; 1 y 2 eligen camino).

`?reiniciar` empieza de cero y `?debug` muestra fps y draw calls.

## Controles

| Acción | Teclado | Móvil |
|---|---|---|
| Dar vapor | Espacio / ↑ / W | Mantener pulsado el botón VAPOR o la pantalla |
| Frenar | Soltar (↓ / S frena más) | Soltar |
| Turbo (con la barra llena) | E / Mayús | Botón TURBO |
| Cambiar aguja (antes de la bifurcación) | A | Botón AGUJA |
| Cambiar cámara | C | Botón cámara |
| Repetir | R | Botón en la pausa o en la llegada |
| Pausa | P / Esc | Botón pausa |

## Pruebas

```bash
pip install playwright && python -m playwright install chromium
npm i                          # three para las pruebas de Node
python tests/e2e.py --shots    # juego completo en Chromium (capturas en tests/out/)
node tests/edge.test.mjs       # validación antitrampas y Edge Function, sin navegador
python tests/perf.py           # coste por fotograma frente a tests/perf-baseline.json
python tests/idle.py --shots   # prototipo idle en Chromium: reparto, tienda, vía, guardado y ausencia
node tests/idle.test.mjs       # economía y trazado del idle, sin navegador
python tests/tren.py --shots   # tren de Navidad en Chromium: navegación, vagones, túnel, cruces, tu casa, calendario, marcas, sin red y móvil
python tests/esc.py --shots    # escaparates en Chromium: calendario, las 27 escenas, paseo, navegación por dentro, marcas, sin red y móvil
node tests/esc.test.mjs        # los 24 circuitos, el calendario y las marcas, sin navegador
node tests/tren.test.mjs       # maqueta (agujas, túneles, puentes, terreno), calendario, marcas y guardado, sin navegador
```

## Clasificación global (Supabase)

Sin configurar, la clasificación se guarda solo en el dispositivo. Para tener ranking global:

1. Crea un proyecto en [supabase.com](https://supabase.com) (región en Europa).
2. Enlázalo desde la raíz del repo: `npx supabase login` y `npx supabase link --project-ref <ref>` (el `<ref>` son las 20 letras de la URL del proyecto, `https://<ref>.supabase.co`).
3. Crea las tablas (tiempos y ligas): `npx supabase db push --remote` (pide la contraseña de la base de datos), o pega los dos archivos de `supabase/migrations/` en el SQL Editor, por orden.
   Ojo: con el CLI v3, `db push` sin `--remote` va a la base **local** de Docker, que puede ser la de otro proyecto. Si te sugiere `migration repair` o `db pull`, no lo hagas: falta el `--remote`.
4. Secretos de la función:
   `npx supabase secrets set RUN_SALT=<32 caracteres aleatorios> ALLOWED_ORIGINS=https://tu-dominio,http://localhost:5173 SEASON=2026`
5. Despliega la función: `npx supabase functions deploy submit-run --no-verify-jwt` (añade `--use-api` si Docker no está arrancado).
6. En *Project Settings → API Keys*, copia la **Project URL** y la **publishable key** a las variables `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (en Vercel) o a `config.js` (en local).

Para probar antes de diciembre, añade `ALLOW_ANY_DAY=1` a los secretos y quítalo después.

Cómo funciona: el navegador lee `runs` directamente (solo columnas públicas) y envía cada tiempo con su fantasma a `submit-run`. La función repite la carrera a partir del fantasma (velocidades, aceleraciones, turbos, distancia, campanas y regalos perdidos), rechaza lo imposible y guarda **su propio** total. Solo guarda la mejor marca de cada dispositivo y acepta un envío cada 10 s. La lógica es `src/sim.js`, compartida con el juego. Tras cambiarla: `node scripts/sync-shared.mjs`.

## Desplegar (Vercel)

La web sigue siendo estática. `scripts/build.mjs` solo copia los archivos a `dist/` y genera `dist/config.js` con las variables de entorno. `vercel.json` ya lo configura todo: build, carpeta de salida y caché de `m/` una semana.

1. En [vercel.com](https://vercel.com), *Add New → Project* e importa `jonmunoa/Advent-train` (framework: *Other*; el resto lo lee de `vercel.json`).
2. *Settings → Environment Variables* (Production y Preview):
   - `ADVX_TAG`: tu ID de afiliado de Amazon (p. ej. `tunombre-21`).
   - `ADVX_SITE_URL`: la URL pública (p. ej. `https://adviento.vercel.app`); vacío = la de producción de Vercel.
   - `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`: los del paso 6 de Supabase.
3. Despliega: cada push a `main` publica en producción (y cada rama, una vista previa). Desde la terminal: `npx vercel --prod`.
4. Con la URL definitiva, añádela a `ALLOWED_ORIGINS` en Supabase: `npx supabase secrets set ALLOWED_ORIGINS=https://tu-dominio`.

Productos: rellena el `asin` de cada día en `src/products.js`. Sin ASIN, el enlace va a una búsqueda de Amazon con tu ID de afiliado.

Probar la build en local: `ADVX_TAG=prueba-21 node scripts/build.mjs && python tests/e2e.py --dist`.

## Recursos y créditos

Modelos 3D de [Kenney](https://kenney.nl) (CC0), HDRI de [Poly Haven](https://polyhaven.com) (CC0) y normal maps de [emmelleppi/normal-maps](https://github.com/emmelleppi/normal-maps) vía `@pmndrs/assets` (CC0). Villancicos de dominio público sintetizados en el navegador. Detalle en `LICENSES.md`.

En calidad de Afiliado de Amazon, se obtienen ingresos por las compras adscritas que cumplen los requisitos aplicables.
