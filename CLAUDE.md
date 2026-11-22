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
- Prueba de humo: `python tests/e2e.py` (Playwright). Completa una carrera con un bot y falla si hay errores JS o recursos 404. `--shots` guarda capturas en `tests/out/`.
- Hook de pruebas en el navegador: `window.__adv` (`step(dt, acelerar)`, `settle()` para asentar la cámara, `G` estado de carrera, `MED`, `BELLS()`, `ST()`, `vsAhead(dist, v)`).
- En el selector del calendario hay un "Modo pruebas" que abre las 24 puertas (`localStorage advx-dev`).

## Estructura

```
index.html                 HTML de todas las pantallas + importmap
src/styles.css             estilos (estética papel/cartón/billete de tren)
src/main.js                todo el juego (módulo ES, ~840 líneas, secciones marcadas con /* ==== */)
m/models.json              modelos Kenney empaquetados en base64 (ver scripts/pack-models.py)
m/{holiday,train}/Textures/colormap.png   texturas que referencian esos modelos
m/env.json                 HDRI de interior (Poly Haven "apartment", EXR en base64)
m/snow_n.webp, m/wood_n.webp   normal maps CC0 (nieve, madera)
assets-src/kenney/         .glb originales (Kenney Holiday Kit + Train Kit, CC0)
scripts/pack-models.py     regenera m/models.json desde scripts/models.config.json
tests/e2e.py               prueba end-to-end
```

Los modelos van en base64 dentro de JSON porque el primer hosting (artifacts de Claude) no servía `.glb`. En un hosting normal se pueden servir los `.glb` directamente y cambiar `loadModels()` por `GLTFLoader.loadAsync`; si lo cambias, mantén `pack-models.py` o elimínalo a conciencia.

## Arquitectura de `src/main.js`

Secciones en orden: utilidades → datos (días, temas, productos, física) → portada (SVG ilustrado) → motor (renderer, EffectComposer: RenderPass + UnrealBloom + pase `grade` propio + OutputPass) → texturas procedurales (canvas) → materiales → modelos Kenney (`loadModels`, `toyMat`, `flat`, `inst`, `obj`) → tren (`carFrom`, `buildTrain`, fantasma) → salón fijo (`buildRoom`: suelo, paredes, ventana, chimenea, guirnaldas) → mundo por día (`buildWorld`: vía, manta de nieve, árbol gigante, estaciones decorativas, arcos, farolas, señales de curva, casas, decorado, regalos gigantes, campanas, `batchStatic`) → sonido (efectos + villancicos sintetizados con WebAudio) → clasificación (`Board`) → juego (`race`, `derail`, `startFinish`, combos, fantasma) → cámara → HUD → pantallas (calendario, billete, llegada) → controles → bucle (`fx`, resolución adaptativa `adapt`).

Convenciones:
- Unidades: metros y segundos. El tren va de 0 a `VMAX=30` m/s. Coordenadas del suelo en X/Z, Y arriba.
- Circuito: `buildTrack()` samplea una Catmull-Rom cerrada cada `STEP=0.5` m. `T.vs[i]` es la velocidad segura por curvatura (`ALAT`). `at(s)` da posición y rumbo a una distancia `s`.
- Coches: grupo "holder" con **+X hacia delante**; el modelo Kenney se rota dentro.
- Día 1 es un trazado a mano (`DAY1`); los demás son procedurales con semilla `d*7919+11` (`trackPts`). El mismo trazado alimenta el dibujo de la puerta del calendario.
- Medallas: `medals()` simula un maquinista perfecto y fija oro/plata/bronce (×1.08 / ×1.22 / ×1.40 del ideal).
- Tiempo final = tiempo + 3 s por descarrilamiento − bonus de campanas (combo creciente, `bellBonus`).
- Todo el texto de UI en español de España.
- `localStorage`: `advx-best-<día>`, `advx-medal-<día>`, `advx-gh-<día>` (fantasma), `advx-lb-<día>` (ranking local), `advx-name`, `advx-cam`, `advx-music`, `advx-sfx`, `advx-dev`.

## Pendientes conocidos

- `TAG='TU-TAG-21'` (ID de afiliado de Amazon) y `SITE_URL` son marcadores: hay que poner los reales.
- Los enlaces de Amazon son búsquedas genéricas, no productos concretos.
- La clasificación compartida usa la capacidad `db` de los artifacts de Claude (`window.claude.use('db')`); fuera de Claude cae a `localStorage`. Para producción hay que cambiar el adaptador `Board` por un backend real (propuesta: Supabase).
- No hay validación de tiempos en servidor (se puede trucar el ranking).
- No se ha medido el rendimiento en un móvil real; hay resolución dinámica y un modo de baja calidad automático.

## Dirección de arte

"Maqueta de juguete bajo el árbol": juguetes reales fotografiados de noche. Iluminación fría de luna desde la ventana + cálida de la chimenea, bloom, desenfoque de miniatura en vistas abiertas. Jon quiere más realismo: el siguiente paso es usar recursos fotográficos de **Poly Haven** (CC0: texturas de nieve/madera/tela/ladrillo, HDRIs de interior en mayor resolución y muebles escaneados para el salón: sofá, butaca, alfombra, lámpara, plantas). En el entorno cloud de Claude.ai estaba bloqueado; en un PC con internet normal se pueden descargar (API: `https://api.polyhaven.com/files/<slug>`).

## Licencias de recursos

Ver `LICENSES.md`. Todo lo incluido es CC0. Si se añaden modelos CC-BY (por ejemplo de Sketchfab), hay que añadir el crédito en `LICENSES.md` y en el pie de la portada.
