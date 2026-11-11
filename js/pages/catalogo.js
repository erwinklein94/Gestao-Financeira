// =====================================================================
// Catálogo de serviços — classificação contábil CAPEX / OPEX
// =====================================================================
import { sb } from '../supabase.js';
import { ehAdmin } from '../state.js';
import { definirTitulo } from '../ui/shell.js';
import { icone } from '../icons.js';
import { esc, fmtData, debounce, toast, erroAmigavel, vazioHTML, modal } from '../utils.js';

const estado = { busca: '', classe: '' };
const CLASSES = [['', 'Todos'], ['CAPEX', 'CAPEX'], ['OPEX', 'OPEX'], ['Sem Class.', 'Sem classificação']];

export function render(c) {
  definirTitulo('Catálogo CAPEX/OPEX', [{ rotulo: 'Ferramentas' }, { rotulo: 'Catálogo CAPEX/OPEX' }]);
  c.innerHTML = `<div class="pagina">
    <section class="card">
      <div class="card-cab" style="flex-wrap:wrap">
        <div><h3>Catálogo de serviços</h3><div class="sub">Consulte a classificação contábil (CAPEX ou OPEX) de cada código de serviço antes de lançar uma medição.</div></div>
        <div class="card-acoes">${ehAdmin() ? `<button class="btn btn-secundario btn-sm so-edicao" id="btnImportar">${icone('upload', 'icon-sm')}Importar planilha</button><input type="file" id="arqCatalogo" accept=".xlsx,.xls,.csv" hidden>` : ''}</div>
      </div>
      <div class="card-corpo">
        <div class="kpis" id="contagens" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:16px"></div>
        <div class="filtros" style="margin-bottom:14px">
          <label class="busca" style="flex:1;min-width:240px"><span class="sr-only">Buscar</span>${icone('busca', 'icon-sm')}<input class="input" id="bCat" style="width:100%" placeholder="Buscar por código ou descrição (ex.: limpeza, 3000112)" value="${esc(estado.busca)}"></label>
          <div class="segmentado">${CLASSES.map(([v, t]) => `<button data-classe="${esc(v)}" class="${estado.classe === v ? 'ativo' : ''}">${t}</button>`).join('')}</div>
        </div>
        <div class="tabela-wrap" id="resCat"><p class="muted small">Carregando…</p></div>
      </div>
    </section>
  </div>`;

  const inp = c.querySelector('#bCat');
  inp.addEventListener('input', debounce(() => { estado.busca = inp.value; buscar(c); }, 300));
  c.querySelectorAll('[data-classe]').forEach((b) => b.addEventListener('click', () => {
    estado.classe = b.dataset.classe;
    c.querySelectorAll('[data-classe]').forEach((x) => x.classList.toggle('ativo', x === b));
    buscar(c);
  }));
  const arq = c.querySelector('#arqCatalogo');
  c.querySelector('#btnImportar')?.addEventListener('click', () => arq.click());
  arq?.addEventListener('change', () => { if (arq.files[0]) importar(arq.files[0], c); arq.value = ''; });

  contagens(c);
  buscar(c);
}

async function contagens(c) {
  const q = (cl) => { let x = sb.from('gf_servicos').select('codigo', { count: 'exact', head: true }); if (cl) x = x.eq('classificacao', cl); return x; };
  const [t, ca, op, sc] = await Promise.all([q(null), q('CAPEX'), q('OPEX'), q('Sem Class.')]);
  const alvo = c.querySelector('#contagens');
  if (!alvo) return;
  const n = (r) => (r.count ?? 0).toLocaleString('pt-BR');
  alvo.innerHTML = `
    <div class="perfil-dado"><small>Serviços no catálogo</small><strong>${n(t)}</strong></div>
    <div class="perfil-dado"><small>CAPEX</small><strong>${n(ca)}</strong></div>
    <div class="perfil-dado"><small>OPEX</small><strong>${n(op)}</strong></div>
    <div class="perfil-dado"><small>Sem classificação</small><strong>${n(sc)}</strong></div>`;
  if (!t.count) {
    c.querySelector('#resCat').innerHTML = vazioHTML(ehAdmin()
      ? 'O catálogo ainda está vazio. Clique em <b>Importar planilha</b> e selecione o arquivo <b>capex-opex-base.xlsx</b>.'
      : 'O catálogo ainda não foi importado pela administradora.', 'catalogo');
  }
}

async function buscar(c) {
  const alvo = c.querySelector('#resCat');
  let q = sb.from('gf_servicos').select('*', { count: 'exact' }).order('codigo').limit(100);
  const termo = estado.busca.trim().replace(/[,()%*\\]/g, ' ').trim();
  if (termo) q = q.or(`codigo.ilike.${termo}%,denominacao.ilike.%${termo}%`);
  if (estado.classe) q = q.eq('classificacao', estado.classe);
  const { data, error, count } = await q;
  if (!alvo.isConnected) return;
  if (error) { alvo.innerHTML = `<p class="muted small">${esc(erroAmigavel(error))}</p>`; return; }
  if (!data.length) { if (count === 0 && !termo && !estado.classe) return; alvo.innerHTML = vazioHTML('Nenhum serviço encontrado.', 'busca'); return; }
  const badge = (cl) => (cl === 'CAPEX' ? '<span class="badge b-capex">CAPEX</span>' : cl === 'OPEX' ? '<span class="badge b-opex">OPEX</span>' : `<span class="badge b-neutro">${esc(cl || 'Sem class.')}</span>`);
  alvo.innerHTML = `<table class="tabela tabela-compacta"><thead><tr><th>Código</th><th>Denominação</th><th>UM</th><th>Grupo merc.</th><th>Setor</th><th>LC 116</th><th>Classificação</th><th>Modificado em</th></tr></thead>
    <tbody>${data.map((s) => `<tr><td class="forte nowrap">${esc(s.codigo)}</td><td>${esc(s.denominacao)}</td><td>${esc(s.um || '')}</td><td>${esc(s.grupo_mercadorias || '')}</td><td>${esc(s.setor_atividade || '')}</td><td>${esc(s.lc116 || '')}</td><td>${badge(s.classificacao)}</td><td class="small nowrap">${fmtData(s.modificado_em)}</td></tr>`).join('')}</tbody></table>
    <p class="muted small" style="margin-top:10px">Mostrando ${data.length.toLocaleString('pt-BR')} de ${(count ?? data.length).toLocaleString('pt-BR')} resultado(s)${count > 100 ? ' — refine a busca para ver outros' : ''}.</p>`;
}

// ---------- Importação (somente administradora) ----------
function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => ok(window.XLSX);
    s.onerror = () => falha(new Error('Não foi possível carregar o leitor de planilhas.'));
    document.head.appendChild(s);
  });
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const MAPA = {
  codigo: ['nodeservico', 'ndeservico', 'servico', 'codigo', 'codigodoservico'],
  denominacao: ['denominacao', 'descricao'],
  um: ['umbasica', 'um', 'unidade'],
  dt_criacao: ['dtcriacao', 'datacriacao'],
  modificado_em: ['modificadoem'],
  grupo_mercadorias: ['grpmercads', 'grupomercadorias', 'grupodemercadorias'],
  setor_atividade: ['setoratividade'],
  lc116: ['lc116'],
  classificacao: ['classificacaocontabil', 'classificacao'],
};
function dataExcel(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null;
}

async function importar(arquivo, c) {
  const corpo = document.createElement('div');
  corpo.innerHTML = '<p id="impMsg">Lendo a planilha…</p><div class="progresso" style="margin-top:12px"><span id="impBarra" style="width:0%"></span></div>';
  const m = modal({ titulo: 'Importar catálogo de serviços', subtitulo: arquivo.name, corpo, classe: 'estreito' });
  const msg = corpo.querySelector('#impMsg');
  const barra = corpo.querySelector('#impBarra');
  try {
    const XLSX = await carregarSheetJS();
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    if (!linhas.length) throw new Error('A planilha está vazia.');
    const cabecalhos = Object.keys(linhas[0]);
    const col = {};
    for (const [campo, nomes] of Object.entries(MAPA)) col[campo] = cabecalhos.find((h) => nomes.includes(norm(h)));
    if (!col.codigo || !col.denominacao) throw new Error('Não encontrei as colunas "Nº de serviço" e "Denominação" na primeira aba.');
    const porCodigo = new Map();
    for (const l of linhas) {
      const codigo = l[col.codigo] === null ? '' : String(l[col.codigo]).trim();
      if (!codigo) continue;
      const txt = (k) => (col[k] && l[col[k]] !== null ? String(l[col[k]]).trim() || null : null);
      porCodigo.set(codigo, {
        codigo, denominacao: txt('denominacao') || '', um: txt('um'), grupo_mercadorias: txt('grupo_mercadorias'),
        setor_atividade: txt('setor_atividade'), lc116: txt('lc116'), classificacao: txt('classificacao'),
        dt_criacao: col.dt_criacao ? dataExcel(l[col.dt_criacao]) : null, modificado_em: col.modificado_em ? dataExcel(l[col.modificado_em]) : null,
      });
    }
    const registros = [...porCodigo.values()];
    let feitos = 0;
    for (let i = 0; i < registros.length; i += 500) {
      const { error } = await sb.from('gf_servicos').upsert(registros.slice(i, i + 500), { onConflict: 'codigo' });
      if (error) throw error;
      feitos = Math.min(registros.length, i + 500);
      msg.textContent = `Enviando… ${feitos.toLocaleString('pt-BR')} de ${registros.length.toLocaleString('pt-BR')} serviços`;
      barra.style.width = `${(feitos / registros.length) * 100}%`;
    }
    msg.innerHTML = `<b>${registros.length.toLocaleString('pt-BR')}</b> serviços importados/atualizados com sucesso.`;
    toast('Catálogo importado.');
    contagens(c);
    buscar(c);
  } catch (e) {
    msg.innerHTML = `<span style="color:var(--c-erro)">${esc(erroAmigavel(e))}</span>`;
  }
  void m;
}
