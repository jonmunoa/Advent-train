// Marcas de los escaparates. Se edita a mano: no hay servidor ni base de datos.
// Cuando alguien paga un sitio, se añade aquí una línea y se vuelve a subir la web.
// VENDER: false = no se ofrecen sitios («Tu marca aquí») y los vagones libres llevan un adorno. Cuando la web tenga visitas,
// ponlo en true. Para probarlo sin publicarlo: ?marcas en la dirección. Las MARCAS de la lista salen siempre, se ofrezcan o no.
export const VENDER = false;
export const CONTACTO = '';                     // correo al que llegan las peticiones; vacío = se copian los datos al portapapeles
export const PRECIO_ROTULO = 10, PRECIO_VAGON = 3;  // € por día: el rótulo de una tienda o un vagón de su tren

// escaparate: 1, 2 o 3. sitio: 'rotulo' (el letrero de la tienda) o el número de vagón (1 a 4).
// desde y hasta: fechas AAAA-MM-DD, las dos incluidas. img (opcional): un fichero de m/marcas/. fondo: color #rrggbb.
// Ejemplo: {escaparate: 2, sitio: 1, desde: '2026-12-05', hasta: '2026-12-07', texto: 'Panadería Ogi', sub: 'Roscón desde el 20', url: 'panaderiaogi.es', img: 'm/marcas/ogi.png', fondo: '#1d3a78'},
export const MARCAS = [
];
