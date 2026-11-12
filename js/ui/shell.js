// =====================================================================
// Estrutura da aplicação: menu lateral recolhível, barra superior,
// tema claro/escuro e modo apresentação.
// =====================================================================
import { store, empresasAtivas, anosDisponiveis, definirAno, ehEditor, podeGerenciarAcessos } from '../state.js';
import { icone, MARCA_SVG } from '../icons.js';
import { esc, iniciais, el } from '../utils.js';
import { corEmpresa } from '../charts.js';
import { APP_NOME, APP_SUBTITULO } from '../config.js';

let aoSair = () => {};
let aoMudarTema = () => {};

// ---------------- Tema ----------------
export function temaAtual() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
export function alternarTema() {
  const novo = temaAtual() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', novo);
  try { localStorage.setItem('gf-tema', novo); } catch (e) { /* ignore */ }
  document.querySelectorAll('[data-tema-btn]').forEach(atualizarBotaoTema);
  aoMudarTema(novo);
}
export function atualizarBotaoTema(b) {
  const d = temaAtual() === 'dark';
  b.innerHTML = icone(d ? 'sol' : 'lua');
  b.title = d ? 'Usar tema claro' : 'Usar tema escuro';
  b.setAttribute('aria-label', b.title);
}

// ---------------- Shell ----------------
export function montarShell(raiz, { onSair, onTema }) {
  aoSair = onSair; aoMudarTema = onTema;
  let recolhida = false;
  try { recolhida = localStorage.getItem('gf-sb-recolhida') === '1'; } catch (e) { /* ignore */ }

  raiz.innerHTML = `
  <div class="app ${recolhida ? 'sb-recolhida' : ''}" id="appRoot">
    <aside class="sidebar" id="sidebar" aria-label="Menu principal">
      <div class="sb-marca">${MARCA_SVG}<div class="sb-marca-texto"><strong>${esc(APP_NOME)}</strong><span>${esc(APP_SUBTITULO)}</span></div></div>
      <nav class="sb-nav" id="sbNav"></nav>
      <div class="sb-rodape">
        <button class="sb-link sb-recolher" id="sbRecolher" title="Recolher menu">${icone('recolher')}<span class="sb-rotulo">Recolher menu</span></button>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sbBackdrop"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn-topo btn tb-menu" id="tbMenu" aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menu">${icone('menu')}</button>
        <div class="tb-titulo"><div class="tb-trilha" id="tbTrilha"></div><div class="tb-nome" id="tbNome"></div></div>
        <div class="tb-acoes">
          <label class="tb-ano" title="Ano de referência">${icone('calendario', 'icon-sm')}<span class="sr-only">Ano</span><select id="tbAno"></select></label>
          <button class="btn btn-topo btn-apresentar" id="tbApresentar" title="Modo apresentação">${icone('apresentar')}<span class="rotulo">Apresentar</span></button>
          <button class="btn btn-topo" id="tbTema" data-tema-btn></button>
          <div style="position:relative">
            <button class="usuario-chip" id="tbUsuario" aria-haspopup="true" aria-expanded="false">
              <span class="avatar">${esc(iniciais(store.perfil?.nome || store.perfil?.email))}</span>
              <span class="nome">${esc(primeiroNome())}</span>${icone('baixo', 'icon-sm')}
            </button>
            <div class="menu-flutuante" id="tbMenuUsuario" hidden>
              <div style="padding:8px 10px 10px"><strong style="color:var(--c-titulo);display:block">${esc(store.perfil?.nome || '')}</strong><span class="muted small">${esc(store.perfil?.email || '')}</span></div>
              <div class="sep"></div>
              <a href="#/perfil">${icone('usuario')}Meu perfil</a>
              ${podeGerenciarAcessos() ? `<a href="#/perfil?aba=acessos">${icone('usuarios')}Gerenciar acessos</a>` : ''}
              <div class="sep"></div>
              <button id="tbSair">${icone('sair')}Sair</button>
            </div>
          </div>
        </div>
      </header>
      <main class="conteudo" id="conteudo" tabindex="-1"></main>
    </div>
  </div>
  <div class="ap-progresso" id="apProgresso" hidden></div>
  <div class="apresentacao-barra" id="apBarra" hidden role="toolbar" aria-label="Controles da apresentação">
    <button id="apAnt" title="Anterior (←)">${icone('esquerda')}</button>
    <div class="ap-info" id="apInfo"></div>
    <button id="apProx" title="Próximo (→)">${icone('direita')}</button>
    <span class="ap-sep"></span>
    <button id="apAuto" title="Avançar automaticamente a cada 20 s">${icone('play')}</button>
    <button id="apTela" title="Tela cheia">${icone('tela')}</button>
    <button id="apTemaBtn" data-tema-btn></button>
    <span class="ap-sep"></span>
    <button id="apSair" title="Sair da apresentação (Esc)">${icone('x')}</button>
  </div>`;

  renderNav();
  preencherAnos();

  const app = document.getElementById('appRoot');
  const menuBotao = document.getElementById('tbMenu');
  const recolherBotao = document.getElementById('sbRecolher');
  const telaMobile = window.matchMedia('(max-width: 1024px)');
  const atualizarMenu = () => {
    const aberto = telaMobile.matches ? app.classList.contains('sb-aberta-mobile') : !app.classList.contains('sb-recolhida');
    menuBotao.setAttribute('aria-expanded', String(aberto));
    menuBotao.setAttribute('aria-label', aberto ? 'Recolher menu' : 'Abrir menu');
    menuBotao.title = aberto ? 'Recolher menu' : 'Abrir menu';
    recolherBotao.title = aberto ? 'Recolher menu' : 'Expandir menu';
    recolherBotao.querySelector('.sb-rotulo').textContent = recolherBotao.title;
  };
  const fecharMobile = () => { app.classList.remove('sb-aberta-mobile'); atualizarMenu(); };
  const alternarMenu = () => {
    if (telaMobile.matches) app.classList.toggle('sb-aberta-mobile');
    else {
      app.classList.toggle('sb-recolhida');
      try { localStorage.setItem('gf-sb-recolhida', app.classList.contains('sb-recolhida') ? '1' : '0'); } catch (e) { /* ignore */ }
    }
    atualizarMenu();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
  };
  recolherBotao.addEventListener('click', alternarMenu);
  menuBotao.addEventListener('click', alternarMenu);
  document.getElementById('sbBackdrop').addEventListener('click', fecharMobile);
  document.getElementById('sbNav').addEventListener('click', (e) => { if (e.target.closest('a')) fecharMobile(); });
  app.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && app.classList.contains('sb-aberta-mobile')) { fecharMobile(); menuBotao.focus(); }
  });
  telaMobile.addEventListener('change', fecharMobile);
  atualizarMenu();

  document.querySelectorAll('[data-tema-btn]').forEach((b) => { atualizarBotaoTema(b); b.addEventListener('click', alternarTema); });

  const chip = document.getElementById('tbUsuario');
  const menu = document.getElementById('tbMenuUsuario');
  chip.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; chip.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; chip.setAttribute('aria-expanded', 'false'); } });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { menu.hidden = true; }));
  document.getElementById('tbSair').addEventListener('click', () => aoSair());

  document.getElementById('tbAno').addEventListener('change', (e) => definirAno(e.target.value));
  ligarApresentacao();
}

function primeiroNome() {
  const n = store.perfil?.nome || store.perfil?.email || '';
  return n.includes('@') ? n.split('@')[0] : n.split(' ')[0];
}

export function preencherAnos() {
  const s = document.getElementById('tbAno');
  if (!s) return;
  s.innerHTML = anosDisponiveis().map((a) => `<option value="${a}" ${a === store.ano ? 'selected' : ''}>${a}</option>`).join('');
}

export function renderNav() {
  const nav = document.getElementById('sbNav');
  if (!nav) return;
  let abertos = [];
  try { abertos = JSON.parse(localStorage.getItem('gf-sb-grupos') || '[]'); } catch (e) { /* ignore */ }
  const empresas = empresasAtivas();
  nav.innerHTML = `
    <div class="sb-secao">Visão geral</div><div class="sb-secao-sep"></div>
    <a class="sb-link" href="#/painel" data-rota="#/painel" title="Painel geral">${icone('painel')}<span class="sb-rotulo">Painel geral</span></a>
    ${ehEditor() ? `<a class="sb-link" href="#/auditoria" data-rota="#/auditoria" title="Auditoria">${icone('escudo')}<span class="sb-rotulo">Auditoria</span></a>` : ''}
    <div class="sb-secao">Empresas</div><div class="sb-secao-sep"></div>
    ${empresas.map((e) => `
      <div class="sb-grupo ${abertos.includes(e.slug) ? 'aberto' : ''}" data-grupo="${esc(e.slug)}">
        <button class="sb-grupo-btn" data-grupo-btn="${esc(e.slug)}" title="${esc(e.nome)}">
          <span class="sb-ponto" style="background:${corEmpresa(e)}"></span><span class="sb-rotulo">${esc(e.nome)}</span>${icone('baixo', 'icon-sm sb-seta')}
        </button>
        <div class="sb-sub">
          <a class="sb-link" href="#/empresa/${esc(e.slug)}/dashboard" data-rota="#/empresa/${esc(e.slug)}/dashboard">${icone('dashboard', 'icon-sm')}<span class="sb-rotulo">Dashboard</span></a>
          <a class="sb-link" href="#/empresa/${esc(e.slug)}/registros" data-rota="#/empresa/${esc(e.slug)}/registros">${icone('registros', 'icon-sm')}<span class="sb-rotulo">Registros</span></a>
        </div>
      </div>`).join('')}
    <div class="sb-secao">Ferramentas</div><div class="sb-secao-sep"></div>
    <a class="sb-link" href="#/catalogo" data-rota="#/catalogo" title="Catálogo CAPEX/OPEX">${icone('catalogo')}<span class="sb-rotulo">Catálogo CAPEX/OPEX</span></a>
    <div class="sb-secao">Conta</div><div class="sb-secao-sep"></div>
    <a class="sb-link" href="#/perfil" data-rota="#/perfil" title="Meu perfil">${icone('usuario')}<span class="sb-rotulo">Meu perfil</span></a>`;

  nav.querySelectorAll('[data-grupo-btn]').forEach((b) => {
    b.addEventListener('click', () => {
      const app = document.getElementById('appRoot');
      const slug = b.dataset.grupoBtn;
      if (app.classList.contains('sb-recolhida') && window.innerWidth > 1024) { location.hash = `#/empresa/${slug}/dashboard`; return; }
      const g = b.closest('.sb-grupo');
      g.classList.toggle('aberto');
      const lista = [...nav.querySelectorAll('.sb-grupo.aberto')].map((x) => x.dataset.grupo);
      try { localStorage.setItem('gf-sb-grupos', JSON.stringify(lista)); } catch (e) { /* ignore */ }
    });
  });
  nav.querySelectorAll('a.sb-link').forEach((a) => a.addEventListener('click', () => document.getElementById('appRoot')?.classList.remove('sb-aberta-mobile')));
  marcarAtivo(location.hash || '#/painel');
}

export function marcarAtivo(hash) {
  const nav = document.getElementById('sbNav');
  if (!nav) return;
  const limpo = hash.split('?')[0];
  nav.querySelectorAll('.sb-link').forEach((a) => {
    const r = a.dataset.rota;
    a.classList.toggle('ativo', !!r && (limpo === r || (r.endsWith('/registros') && limpo.startsWith(r))));
  });
  nav.querySelectorAll('.sb-grupo').forEach((g) => {
    const contem = limpo.startsWith(`#/empresa/${g.dataset.grupo}/`);
    g.classList.toggle('contem-ativo', contem);
    if (contem) g.classList.add('aberto');
  });
}

export function definirTitulo(nome, trilha = []) {
  const n = document.getElementById('tbNome');
  const t = document.getElementById('tbTrilha');
  if (n) n.textContent = nome;
  if (t) t.innerHTML = ['<a href="#/painel">Início</a>', ...trilha.map((x) => (x.href ? `<a href="${x.href}">${esc(x.rotulo)}</a>` : esc(x.rotulo)))].join(' / ');
  document.title = `${nome} · ${APP_NOME}`;
}

// ---------------- Modo apresentação ----------------
const ap = { ativo: false, slides: [], idx: 0, timer: null, inicio: 0, raf: null, ocioso: null };
const INTERVALO = 20000;

function slidesDisponiveis() {
  return [
    { hash: '#/painel', nome: 'Painel geral' },
    ...empresasAtivas().map((e) => ({ hash: `#/empresa/${e.slug}/dashboard`, nome: `${e.nome} — Dashboard` })),
  ];
}

export function emApresentacao() { return ap.ativo; }

let ouvintesDocumento = false;
function ligarApresentacao() {
  document.getElementById('tbApresentar').addEventListener('click', entrarApresentacao);
  document.getElementById('apSair').addEventListener('click', sairApresentacao);
  document.getElementById('apAnt').addEventListener('click', () => irSlide(ap.idx - 1));
  document.getElementById('apProx').addEventListener('click', () => irSlide(ap.idx + 1));
  document.getElementById('apAuto').addEventListener('click', alternarAuto);
  document.getElementById('apTela').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  if (ouvintesDocumento) return;
  ouvintesDocumento = true;
  ligarOuvintesDocumento();
}

function ligarOuvintesDocumento() {
  document.addEventListener('keydown', (e) => {
    if (!ap.ativo || e.target.closest('input, textarea, select')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); irSlide(ap.idx + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); irSlide(ap.idx - 1); }
    else if (e.key === 'Escape' && !document.fullscreenElement) sairApresentacao();
  });
  document.addEventListener('mousemove', () => {
    if (!ap.ativo) return;
    const barra = document.getElementById('apBarra');
    barra.classList.remove('ocioso');
    clearTimeout(ap.ocioso);
    ap.ocioso = setTimeout(() => barra.classList.add('ocioso'), 3500);
  });
  window.addEventListener('hashchange', () => { if (ap.ativo) sincronizarSlide(); });
}

export function entrarApresentacao() {
  ap.ativo = true;
  ap.slides = slidesDisponiveis();
  const i = ap.slides.findIndex((s) => s.hash === (location.hash || '#/painel'));
  ap.idx = i >= 0 ? i : 0;
  document.body.classList.add('apresentando');
  document.getElementById('apBarra').hidden = false;
  document.documentElement.requestFullscreen?.().catch(() => {});
  if (location.hash !== ap.slides[ap.idx].hash) location.hash = ap.slides[ap.idx].hash;
  else { window.dispatchEvent(new Event('gf:rerender')); window.scrollTo(0, 0); }
  atualizarInfo();
}

export function sairApresentacao() {
  ap.ativo = false;
  pararAuto();
  document.body.classList.remove('apresentando');
  document.getElementById('apBarra').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  window.dispatchEvent(new Event('gf:rerender'));
}

function irSlide(i) {
  const n = ap.slides.length;
  ap.idx = ((i % n) + n) % n;
  location.hash = ap.slides[ap.idx].hash;
  atualizarInfo();
  if (ap.timer) reiniciarAuto();
}

function sincronizarSlide() {
  const i = ap.slides.findIndex((s) => s.hash === location.hash);
  if (i >= 0) ap.idx = i;
  atualizarInfo();
}

function atualizarInfo() {
  const s = ap.slides[ap.idx];
  const info = document.getElementById('apInfo');
  if (info) info.innerHTML = s && location.hash === s.hash ? `<b>${ap.idx + 1}/${ap.slides.length}</b> · ${esc(s.nome)}` : 'Navegação livre';
}

function alternarAuto() { if (ap.timer) pararAuto(); else reiniciarAuto(); }
function reiniciarAuto() {
  pararAuto();
  const b = document.getElementById('apAuto');
  b.classList.add('ativo'); b.innerHTML = icone('pausa');
  const prog = document.getElementById('apProgresso');
  prog.hidden = false;
  ap.inicio = performance.now();
  const passo = (t) => {
    const p = Math.min(1, (t - ap.inicio) / INTERVALO);
    prog.style.width = `${p * 100}%`;
    ap.raf = requestAnimationFrame(passo);
  };
  ap.raf = requestAnimationFrame(passo);
  ap.timer = setTimeout(() => irSlide(ap.idx + 1), INTERVALO);
}
function pararAuto() {
  clearTimeout(ap.timer); ap.timer = null;
  cancelAnimationFrame(ap.raf);
  const b = document.getElementById('apAuto');
  if (b) { b.classList.remove('ativo'); b.innerHTML = icone('play'); }
  const prog = document.getElementById('apProgresso');
  if (prog) { prog.hidden = true; prog.style.width = '0'; }
}

export { el };
