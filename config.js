// Configuración pública de Adviento Express (todo esto acaba en el navegador: nada secreto).
// En local se usa tal cual. En Vercel, scripts/build.mjs genera dist/config.js con las
// variables de entorno indicadas en cada línea.
export default {
  TAG: 'tgoffer-21',  // ID de afiliado de Amazon (el del canal de ofertas de Telegram); ADVX_TAG lo cambia al desplegar
  SITE_URL: '',      // URL pública para los enlaces de compartir; vacío = la actual (ADVX_SITE_URL)
  SUPABASE_URL: '',  // https://<proyecto>.supabase.co; vacío = clasificación solo en este dispositivo (SUPABASE_URL)
  SUPABASE_KEY: '',  // clave publishable (o anon) del proyecto (SUPABASE_PUBLISHABLE_KEY)
};
