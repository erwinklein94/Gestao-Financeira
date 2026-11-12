import { ehEditor } from './state.js';
import { descartarGraficos } from './charts.js';
import { marcarAtivo } from './ui/shell.js';
import { esc } from './utils.js';
import * as painel from './pages/painel.js';
import * as empresaDashboard from './pages/empresa-dashboard.js';
import * as empresaRegistros from './pages/empresa-registros.js';
import * as perfil from './pages/perfil.js';
import * as auditoria from './pages/auditoria.js';
import { registrarAtividade } from './atividade.js';
import * as catalogo from './pages/catalogo.js';

const ROTAS = [
  { re: /^#\/auditoria$/, pagina: auditoria },
  { re: /^#\/painel$/, pagina: painel },
  { re: /^#\/empresa\/([\w-]+)$/, redirecionar: (m) => `#/empresa/${m[1]}/dashboard` },
  { re: /^#\/empresa\/([\w-]+)\/dashboard$/, pagina: empresaDashboard, params: (m) => ({ slug: m[1] }) },
  { re: /^#\/empresa\/([\w-]+)\/registros(?:\/([\w-]+))?$/, pagina: empresaRegistros, params: (m) => ({ slug: m[1], aba: m[2] || 'medicoes' }) },
  { re: /^#\/perfil$/, pagina: perfil },
  { re: /^#\/catalogo$/, pagina: catalogo },
];

let ultimaPagina = '';
function lerQuery(q) {
  const o = {};
  new URLSearchParams(q || '').forEach((v, k) => { o[k] = v; });
  return o;
}

export function renderRota({ manterScroll = false } = {}) {
  const conteudo = document.getElementById('conteudo');
  if (!conteudo) return;
  const hash = location.hash || '#/painel';
  const [caminho, query] = hash.split('?');
  if (ehEditor() && !['#/auditoria', '#/perfil'].includes(caminho)) { location.replace('#/auditoria'); return; }
  const y = window.scrollY;
  for (const r of ROTAS) {
    const m = caminho.match(r.re);
    if (!m) continue;
    if (r.redirecionar) { location.replace(r.redirecionar(m)); return; }
    descartarGraficos();
    conteudo.innerHTML = '';
    try {
      r.pagina.render(conteudo, { ...(r.params ? r.params(m) : {}), ...lerQuery(query) });
    } catch (e) {
      console.error(e);
      conteudo.innerHTML = `<div class="card card-corpo"><h2>Algo deu errado ao abrir esta página</h2><p class="muted" style="margin-top:8px">${esc(e.message)}</p></div>`;
    }
    marcarAtivo(caminho);
    if (ultimaPagina !== hash) { ultimaPagina = hash; registrarAtividade('pagina', caminho); }
    if (manterScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    return;
  }
  location.replace('#/painel');
}

export function iniciarRouter() {
  window.addEventListener('hashchange', () => renderRota());
  window.addEventListener('gf:rerender', () => renderRota({ manterScroll: true }));
  renderRota();
}
