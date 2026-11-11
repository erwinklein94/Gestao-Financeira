import { sb } from './supabase.js';
import { store } from './state.js';

// Eventos da interface são informativos. Alterações de dados são auditadas por triggers.
export async function registrarAtividade(acao, pagina = location.hash.split('?')[0] || '#/painel') {
  if (!store.perfil) return;
  try {
    const { error } = await sb.rpc('gf_registrar_atividade', { p_acao: acao, p_pagina: pagina });
    if (error) console.warn('Não foi possível registrar a atividade:', error.message);
  } catch (e) { console.warn('Falha no registro de atividade:', e.message); }
}
