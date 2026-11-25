# Plan gráfico: realismo a 60 fps (pedido por Jon el 24 de noviembre de 2026)

Encargo: «gráficos rollo GTA, muy realista, de locos, y los FPS a 60». Las iteraciones que hagan falta. Los escaparates (`escaparates.html`) son lo único que se toca.
Reglas: sin push; pruebas con `python tests/esc.py --gpu` (sin `--gpu` fallan las de tiempos); cada cambio con su medida; commits pequeños; publicar en el artifact al cerrar cada bloque.
Descargas autorizadas por Jon (CC0): MakeHuman system assets, skins01, skins02, faceunits01 y MPFB2 (en `assets-src/makehuman/zip`, fuera de git) y Poly Haven. npm de desarrollo: `three-mesh-bvh`.

## Punto de partida (v24, Radeon 860M integrada, a 1×, MSAA ×4)
| | 1600×900 | 1920×1080 | llamadas | triángulos |
|---|---|---|---|---|
| andando | 14,0 ms | 17,1 ms | 461 | 1,33 M |
| mirando | 13,4 ms | 16,0 ms | 240 | 1,25 M |
| dentro | 12,8 ms | 14,8 ms | 163 | 0,91 M |

## Qué delata que no es real (ordenado por lo que pesa)
1. Las personas son muñecos (cabezón, ojos enormes).
2. Luz plana: hemisférica sin oclusión, sin luz rebotada, casi sin sombras.
3. El suelo no refleja y la nieve es un plano morado.
4. Fachadas de cajas, cantos vivos, sin suciedad.
5. Color muy saturado; copos como discos blancos; halos planos.
6. Maquetas: montañas moradas, terreno liso, casas simples.

## Bloques
- [x] A. Motor: GTAO a media resolución, niebla con luz (dispersión analítica de farolas y escaparates), bloom sin umbral, AgX con revelado, exposición automática, escalado con nitidez, reflejos del entorno capturados de la propia calle.
- [x] B. Luz horneada de la calle (trazado de rayos sin conexión con `three-mesh-bvh`, por vértice, con dirección dominante); capas: cielo, luces, escaparates. Sondas para las personas.
- [x] C. Suelo: adoquín mojado, nieve pisada y charcos con reflejos en pantalla (SSR) en ordenador y reflejos estirados en el móvil.
- [x] D. Personas: MakeHuman (proporciones y piel reales) sobre el esqueleto de las escenas; abrigos con pliegues simulados.
- [x] E. Fachadas y atrezo con más detalle (molduras, cantos romos, nieve acumulada, suciedad).
- [x] F. Maquetas: oclusión, luz de farolas en el terreno, sierra y cielo fotográficos, materiales.
- [x] G. 60 fps: menos llamadas, escalado dinámico, móvil sin tope de 40.

## Bitácora

**v25 (24-11-2026).** Motor nuevo, calle horneada, personas de MakeHuman, cielo y montañas. 1600×900 a 1×: 16,4 / 15,1 / 13,2 ms.

**v26 (25-11-2026).**
- Personas: canesú sin arrugas falsas, cuello vuelto, bufandas con pliegues, melena metida en la bufanda, oclusión en piel y pelo, paño jaspeado, falda que sigue a la pierna, Papá Noel con ribete.
- Calle: portales con su puerta (el arco iba relleno por un hueco mal recortado), faroles con la llama dentro, nieve redonda, comercios de enfrente con estanterías, puesto de castañas nuevo, árbol del fondo con ramas, tres paseantes más, fotos de verdad en las tiendas lejanas.
- Maquetas: luz local horneada, faro, luz de cada día, niebla con farolas, ciudad con fachadas, bosque y montones delante del tablero, bombillas con filamento.
- 60 fps: montaje en trozos de 3–4 ms, subida por adelantado, envoltura premontada, sonido calculado en la portada.
- Medidas: PC 59–60 fps (1600×900); móvil CPU ×4 47/55/58/59/56 fps. 89/89 pruebas.

**v29 (25-11-2026).**
- Móvil: calle, personas y maquetas con sombreadores propios y mucho menos que dibujar; sombras del sol en las maquetas; mugre en el tren; ritmo parejo en 90–240 Hz. Había un fallo: mirando un escaparate faltaba la fachada en una de cada tres tiendas.
- Maquetas: valle horneado (bosques, río, caseríos con luz) en lugar del llano liso, nieve y sol menos teñidos, rocas talladas, laderas sin estirar, ventanillas con compartimentos y gente.
- Personas: rubor, volumen en la cara, boca y pestañas, bolsillos que salían negros.
- Tirones: montaje 589 → 355 ms por maqueta y solo con la cámara quieta; primera vez dibujada en la portada.
- Medidas: PC 59–60 fps sin tirones de más de 60 ms; móvil CPU ×4 58–60 fps (antes 46–58). 89/89 pruebas.

**v30 (25-11-2026).**
- Calle horneada de nuevo: los triángulos del borde de la acera se desplegaban con el faldón vertical y salían estirados (manchas y trozos brillantes); calzada con nieve a medias en lugar de rayas; bordillo nevado; bolardos con un capuchón.
- Papá Noel: barba y bigote de mechones, gorro con la punta caída, ribetes y guantes claros.
- Personas: las piernas de la madre y la cintura del pantalón no asoman; codos finos en móvil; nieve bien puesta sobre gorros y hombros.
- Móvil: formato HDR con alternativa para los que no puedan dibujar en R11F, más fino si sobra gráfica y pasos propios para bajar carga.
- Medidas: PC 59–60 fps; móvil CPU ×4 57–60 fps, ningún fotograma de más de 85 ms. 89/89 pruebas.

## Lo que falta para acercarse más
- Manos (siguen esculpidas) y poses: algún codo y la pierna al agacharse asoman.
- Interiores de «cuartos» vistos de cerca: son dibujos en perspectiva, no geometría.
- Probar en un Android de verdad.
