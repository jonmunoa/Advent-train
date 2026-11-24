/* Lo que se vende en cada tienda: un producto por día, con enlace de afiliado de Amazon. Sin DOM ni red.
   Con «asin» (10 caracteres, los de amazon.es/dp/…) el enlace va a la ficha; sin él, a una búsqueda.
   El código de afiliado (TAG) está en config.js / variable ADVX_TAG. El 24 no se vende nada.
   No se ponen precios ni fotos: cambian, y las condiciones de Amazon no dejan copiarlos a mano. */
export const MARCADOR = 'TU-TAG-21';
const p = (titulo, texto, busqueda, asin = '') => ({titulo, texto, busqueda, asin});
export const TIENDA = [
  /*  1 La Estación   */ p('Tren eléctrico con vías', 'El de siempre: máquina de vapor, vagones y vía en óvalo.', 'tren electrico juguete vapor con vias'),
  /*  2 Confitería    */ p('Tren de Navidad de madera', 'Para la mesa o la estantería, al lado del turrón.', 'tren de navidad madera decoracion'),
  /*  3 Relojería     */ p('Despertador de tren', 'Despierta con el silbato de una locomotora.', 'reloj despertador tren infantil'),
  /*  4 La Cumbre     */ p('Tren de montaña', 'Circuito con puente, túnel y cuestas.', 'tren juguete circuito montaña puente tunel'),
  /*  5 Librería      */ p('Cuento de trenes', 'Con ventanas y desplegables, para leerlo juntos.', 'libro infantil trenes desplegable solapas'),
  /*  6 Mercería      */ p('Tren blandito', 'De tela o de madera suave, para los más pequeños.', 'tren de tela bebe primer tren'),
  /*  7 La Feria      */ p('Tiovivo de caja de música', 'Da vueltas y toca un villancico.', 'tiovivo caja de musica navidad'),
  /*  8 Polo Norte    */ p('Tren al Polo Norte', 'Con luces y sonido, para la noche de Nochebuena.', 'tren navidad polo norte luces sonido'),
  /*  9 Correos       */ p('Buzón para los Reyes', 'Para echar la carta en casa, a su altura.', 'buzon cartas reyes magos niños'),
  /* 10 La Ciudad     */ p('Tren para construir', 'Bloques, vías y una ciudad alrededor.', 'tren bloques construccion ciudad vias'),
  /* 11 Panadería     */ p('Tren que echa humo', 'Humo de mentira, luces y silbato de verdad.', 'tren de juguete con humo luces sonido'),
  /* 12 Fotografía    */ p('Cámara instantánea para niños', 'Para que la foto salga… como salga.', 'camara fotos instantanea niños'),
  /* 13 El Refugio    */ p('Bola de nieve con tren', 'Se agita y nieva sobre la vía.', 'bola de nieve navidad tren musical'),
  /* 14 Juguetería    */ p('Silbato de tren', 'De madera, con las notas de una locomotora.', 'silbato tren madera'),
  /* 15 Zapatería     */ p('Calcetines de Navidad con trenes', 'Para andar por casa el día 25.', 'calcetines navidad tren niño'),
  /* 16 Bombillas     */ p('Tren con luces para el árbol', 'Da vueltas debajo del árbol, encendido.', 'tren navidad alrededor del arbol luces'),
  /* 17 Planetario    */ p('Proyector de estrellas', 'El cielo entero en el techo del cuarto.', 'proyector estrellas infantil'),
  /* 18 Modelismo     */ p('Maqueta H0 para empezar', 'Locomotora, vagones, vía y mando: la primera maqueta.', 'set iniciacion tren electrico H0'),
  /* 19 Música        */ p('Caja de música de tren', 'Se le da cuerda y el tren anda.', 'caja de musica tren madera'),
  /* 20 Sastrería     */ p('Disfraz de maquinista', 'Con peto, pañuelo y gorra.', 'disfraz maquinista tren niño'),
  /* 21 Sombrerería   */ p('Gorra de maquinista', 'De rayas, como las de antes.', 'gorra maquinista tren niño'),
  /* 22 Viajes        */ p('Maleta de niño', 'Para sentarse encima a esperar el tren.', 'maleta infantil viaje niño'),
  /* 23 Bellas Artes  */ p('Tren para pintar', 'De madera, con pinturas: cada uno, el suyo.', 'tren madera para pintar manualidades niños'),
  /* 24 Feliz Navidad */ null,
];
export const tagOk = tag => typeof tag === 'string' && tag !== MARCADOR && /^[\w-]{2,40}-\d\d$/.test(tag);
/* sin un código válido, el enlace va sin él (no se le regala la comisión a nadie) */
export function enlaceTienda(q, tag) {
  if (!q) return '';
  const base = /^[A-Z0-9]{10}$/.test(q.asin) ? `https://www.amazon.es/dp/${q.asin}` : `https://www.amazon.es/s?k=${encodeURIComponent(q.busqueda)}`;
  return tagOk(tag) ? base + (base.includes('?') ? '&' : '?') + 'tag=' + encodeURIComponent(tag) : base;
}
export const AVISO = 'En calidad de Afiliado de Amazon, obtengo ingresos por las compras adscritas que cumplen los requisitos aplicables.';
