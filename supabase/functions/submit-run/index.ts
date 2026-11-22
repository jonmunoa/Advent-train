// Edge Function de Supabase: valida y guarda un tiempo de Adviento Express.
// Despliegue: supabase functions deploy submit-run --no-verify-jwt
// La lógica está en handler.js (se prueba con Node en tests/edge.test.mjs).
import {makeHandler} from './handler.js';

Deno.serve(makeHandler({env: Deno.env.toObject()}));
