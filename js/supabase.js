import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const configurado = !SUPABASE_KEY.startsWith('__');

export const sb = createClient(SUPABASE_URL, configurado ? SUPABASE_KEY : 'chave-ausente', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // chave própria para não misturar sessão com outros sites do mesmo domínio
    storageKey: 'gf-gestao-financeira-auth',
  },
});
