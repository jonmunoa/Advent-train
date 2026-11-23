// Marcas y mensajes que lleva el tren. Se edita a mano: no hay servidor ni base de datos.
// Cuando alguien paga un vagón, se añade aquí una línea y se vuelve a subir la web.
export const CONTACTO = '';                     // correo al que llegan las peticiones; vacío = se copian los datos al portapapeles
export const PRECIO_DIA = 5, PRECIO_VAGON = 3;  // € por el primer vagón (un día entero) y por cualquier otro (24 h)

// vagon: 1 es el primero (el del día). desde y hasta: fechas AAAA-MM-DD, las dos incluidas.
// img (opcional): un fichero de m/marcas/. fondo: color #rrggbb. url (opcional): web o red social.
// Ejemplo: {vagon: 1, desde: '2026-12-05', hasta: '2026-12-05', texto: 'Panadería Ogi', sub: 'Roscón desde el 20', url: 'panaderiaogi.es', img: 'm/marcas/ogi.png', fondo: '#1d3a78'},
export const MARCAS = [
];
