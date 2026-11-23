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

## Prototipo: el tren de todos (`tren.html`)

`http://localhost:5173/tren.html` prueba otro enfoque, comunitario: **un solo tren para todo el mundo** (el nombre es provisional).

El tren recorre despacio una **maqueta alpina**: pueblo con plaza, colina con túnel, lago helado con patinadores, montaña del túnel grande, puentes de piedra y una estación de esquí con telesilla. Papá Noel saluda desde el taller y su trineo vuela por encima.

- **Busca los duendes**: cada día se esconden 5 por la maqueta (en un tejado, en el lago, junto a un túnel, en el telesilla, subido en un vagón…). Tócalos para encontrarlos: cada uno suma al **objetivo común del día**. La ficha te da una pista y te lleva a la zona.
- **Objetivo del día**: cuando entre todos se cumple, la vía crece (4 tramos), llega otro vagón o se encienden más luces, y se esconden 5 duendes nuevos (en la demo, un día dura unos 3 minutos).
- **Pon tu casa** junto a la vía: el tren te deja regalos en cada vuelta y todos ven tu nombre y tu provincia.
- **Tu marca en el tren**: el primer vagón se **subasta** cada día (cierra a las 21:00 y sale todo el día siguiente) y el resto se venden como **vagones con mensaje** (3 €, 24 h). Se puede subir una imagen o logo, escribir dos líneas, poner un **enlace** a tu web o a tus redes, elegir color y ver cómo queda en el tren. Quien toca el vagón ve su ficha con el botón «Visitar».
- **Cámara**: la rueda o el pellizco acercan hacia donde apuntas; tocar un vagón lo sigue de cerca (y puedes girar y acercarte más); dos dedos, el botón derecho o Mayús desplazan.

En la demo los demás jugadores, las pujas rivales y las noticias están simulados, y no se cobra nada. `?reiniciar` empieza de cero y `?debug` muestra fps y draw calls.

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
python tests/tren.py --shots   # tren de todos en Chromium: zoom, vagones, duendes, tu casa, día, subasta, enlaces y móvil
node tests/tren.test.mjs       # maqueta (túneles, puentes, terreno), duendes, subasta, enlaces y guardado, sin navegador
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
