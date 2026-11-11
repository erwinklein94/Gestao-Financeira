// =====================================================================
// Gestão Financeira — inicialização, autenticação e controle de acesso
// =====================================================================
import { registrarAtividade } from './atividade.js';
import { sb, configurado } from './supabase.js';
import { store, carregarDados, on } from './state.js';
import { montarShell, renderNav, preencherAnos } from './ui/shell.js';
import { iniciarRouter, renderRota } from './router.js';
import { renderLogin, renderSemAcesso, renderNovaSenha, renderErroConfig } from './pages/login.js';
import { toast, erroAmigavel, esc } from './utils.js';

const raiz = document.getElementById('app');
let iniciado = false;
let ouvintesLigados = false;
let emRecuperacao = /type=recovery/.test(location.hash);

async function sair() {
  await registrarAtividade('saida');
  await sb.auth.signOut();
  store.perfil = null; store.sessao = null; iniciado = false;
  location.hash = '';
  renderLogin(raiz);
}

async function entrarNoSistema(sessao) {
  store.sessao = sessao;
  const { data: perfil, error } = await sb.rpc('gf_garantir_perfil');
  if (error) {
    raiz.innerHTML = `<div class="boot"><p>Não foi possível validar seu acesso.</p><p class="small">${esc(erroAmigavel(error))}</p><button class="btn btn-secundario" id="btnSairErro">Sair</button></div>`;
    document.getElementById('btnSairErro').onclick = sair;
    return;
  }
  if (!perfil) { renderSemAcesso(raiz, sessao.user.email, sair); return; }
  store.perfil = perfil;
  await registrarAtividade('acesso');

  raiz.innerHTML = '<div class="boot"><p>Carregando dados…</p></div>';
  try {
    await carregarDados();
  } catch (e) {
    raiz.innerHTML = `<div class="boot"><p>Falha ao carregar os dados.</p><p class="small">${esc(erroAmigavel(e))}</p><button class="btn btn-primario" onclick="location.reload()">Tentar novamente</button></div>`;
    return;
  }
  montarShell(raiz, { onSair: sair, onTema: () => renderRota({ manterScroll: true }) });
  iniciado = true;
  if (!ouvintesLigados) {
    ouvintesLigados = true;
    on('dados', () => { if (iniciado) { renderNav(); preencherAnos(); } });
    on('ano', () => renderRota({ manterScroll: true }));
    iniciarRouter();
  } else {
    renderRota();
  }
}

async function iniciar() {
  if (!configurado) { renderErroConfig(raiz); return; }

  sb.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'PASSWORD_RECOVERY') {
      emRecuperacao = true;
      renderNovaSenha(raiz, async () => { emRecuperacao = false; history.replaceState(null, '', location.pathname); await entrarNoSistema(sessao); });
    } else if (evento === 'SIGNED_OUT') {
      iniciado = false;
      store.perfil = null; store.sessao = null;
      if (!document.querySelector('.login')) renderLogin(raiz);
    }
  });

  const { data: { session } } = await sb.auth.getSession();
  if (emRecuperacao) return; // tratado pelo evento PASSWORD_RECOVERY
  if (!session) { renderLogin(raiz); return; }
  await entrarNoSistema(session);
}

window.addEventListener('gf:entrou', (e) => entrarNoSistema(e.detail));
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  if (store.perfil) toast(erroAmigavel(e.reason), 'erro', 6000);
});

window.addEventListener('gf:exportacao', () => registrarAtividade('exportacao'));

iniciar();
