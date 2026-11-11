// =====================================================================
// Registros da empresa: medições, previsões, orçamento, contratos,
// pendências e dados cadastrais.
// =====================================================================
import { sb } from '../supabase.js';
import { store, empresaPorSlug, contratosDaEmpresa, contratoPorId, podeEditar, ehAdmin, salvarRegistro, excluirRegistro, upsertLote, excluirIds, recarregar } from '../state.js';
import { resumo, resumoContrato, mesesFechados, medicaoConta } from '../calc.js';
import { definirTitulo } from '../ui/shell.js';
import { icone } from '../icons.js';
import {
  fmtBRL, fmtPct, fmtData, fmtNum2, parseValor, esc, soma, MESES, MESES_LONGOS, TIPOS, STATUS_MEDICAO, STATUS_CONTRATO,
  STATUS_PENDENCIA, PRIORIDADES, badgeTipo, badgeStatusMedicao, badgeStatusContrato, badgePrioridade, badgePendencia, vazioHTML,
  formulario, confirmar, toast, erroAmigavel, baixarCSV, debounce, competencia, modal, ligarMascaraMoeda, lerCampos,
} from '../utils.js';
import { cabecalhoEmpresa } from './empresa-dashboard.js';

const ABAS = [
  { id: 'medicoes', rotulo: 'Medições', icone: 'medicao' },
  { id: 'previsoes', rotulo: 'Previsões', icone: 'previsao' },
  { id: 'orcamento', rotulo: 'Orçamento', icone: 'orcamento' },
  { id: 'contratos', rotulo: 'Contratos', icone: 'contrato' },
  { id: 'pendencias', rotulo: 'Pendências', icone: 'pendencia' },
  { id: 'empresa', rotulo: 'Dados da empresa', icone: 'empresa' },
];

const filtros = { contrato: '', tipo: '', status: '', mes: '', busca: '', pendencias: 'abertas' };
const rerender = () => window.dispatchEvent(new Event('gf:rerender'));

export function render(c, { slug, aba }) {
  const e = empresaPorSlug(slug);
  if (!e) { c.innerHTML = vazioHTML('Empresa não encontrada.', 'empresa'); return; }
  if (!ABAS.some((a) => a.id === aba)) aba = 'medicoes';
  const abaInfo = ABAS.find((a) => a.id === aba);
  definirTitulo(`${e.nome} · Registros`, [{ rotulo: 'Empresas' }, { rotulo: e.nome, href: `#/empresa/${e.slug}/dashboard` }, { rotulo: 'Registros' }, { rotulo: abaInfo.rotulo }]);

  const contagem = {
    medicoes: store.medicoes.filter((m) => m.empresa_id === e.id && m.ano === store.ano).length,
    previsoes: store.previsoes.filter((m) => m.empresa_id === e.id && m.ano === store.ano).length,
    contratos: contratosDaEmpresa(e.id).length,
    pendencias: store.pendencias.filter((m) => m.empresa_id === e.id && m.status !== 'Concluída').length,
  };

  c.innerHTML = `<div class="pagina">
    ${cabecalhoEmpresa(e, 'registros')}
    ${!podeEditar() ? `<div class="aviso">${icone('olho')}<div>Seu perfil é <b>somente leitura</b>. Para lançar ou alterar dados, peça permissão de edição à administradora.</div></div>` : ''}
    <section class="card">
      <nav class="abas" style="padding:0 12px" aria-label="Seções de registros">
        ${ABAS.map((a) => `<a href="#/empresa/${e.slug}/registros/${a.id}" class="${a.id === aba ? 'ativo' : ''}">${icone(a.icone, 'icon-sm')}${a.rotulo}${contagem[a.id] !== undefined ? ` <span class="contador">${contagem[a.id]}</span>` : ''}</a>`).join('')}
      </nav>
      <div id="abaConteudo"></div>
    </section>
  </div>`;

  const alvo = c.querySelector('#abaConteudo');
  ({ medicoes: abaMedicoes, previsoes: abaPrevisoes, orcamento: abaOrcamento, contratos: abaContratos, pendencias: abaPendencias, empresa: abaEmpresa })[aba](alvo, e);
}

// =====================================================================
// MEDIÇÕES
// =====================================================================
function abaMedicoes(alvo, e) {
  const ano = store.ano;
  const contratos = contratosDaEmpresa(e.id);
  let lista = store.medicoes.filter((m) => m.empresa_id === e.id && m.ano === ano);
  if (filtros.contrato && !contratos.some((x) => x.id === filtros.contrato)) filtros.contrato = '';
  if (filtros.contrato) lista = lista.filter((m) => m.contrato_id === filtros.contrato);
  if (filtros.tipo) lista = lista.filter((m) => m.tipo === filtros.tipo);
  if (filtros.status) lista = lista.filter((m) => m.status === filtros.status);
  if (filtros.mes) lista = lista.filter((m) => String(m.mes) === filtros.mes);
  if (filtros.busca) {
    const q = filtros.busca.toLowerCase();
    lista = lista.filter((m) => [m.numero, m.nota_fiscal, m.ordem_servico, m.codigo_servico, m.evento, m.descricao, m.observacao, contratoPorId(m.contrato_id)?.titulo].some((x) => x && String(x).toLowerCase().includes(q)));
  }
  lista.sort((a, b) => b.mes - a.mes || String(b.created_at).localeCompare(String(a.created_at)));
  const validas = lista.filter(medicaoConta);
  const total = soma(validas.map((m) => m.valor));
  const totalPago = soma(validas.map((m) => m.valor_pago || 0));

  alvo.innerHTML = `
    <div class="card-cab" style="flex-wrap:wrap">
      <div class="filtros">
        <select class="input" data-f="contrato"><option value="">Todos os contratos</option>${contratos.map((x) => `<option value="${x.id}" ${filtros.contrato === x.id ? 'selected' : ''}>${esc(x.titulo)}</option>`).join('')}</select>
        <select class="input" data-f="mes"><option value="">Todos os meses</option>${MESES_LONGOS.map((m, i) => `<option value="${i + 1}" ${filtros.mes === String(i + 1) ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <select class="input" data-f="tipo"><option value="">CAPEX e OPEX</option>${TIPOS.map((t) => `<option ${filtros.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select class="input" data-f="status"><option value="">Todos os status</option>${STATUS_MEDICAO.map((t) => `<option ${filtros.status === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <label class="busca"><span class="sr-only">Buscar</span>${icone('busca', 'icon-sm')}<input class="input" data-f="busca" placeholder="Buscar nº, NF, OS, evento…" value="${esc(filtros.busca)}"></label>
      </div>
      <div class="card-acoes">
        <button class="btn btn-secundario btn-sm" id="mCsv">${icone('download', 'icon-sm')}Exportar CSV</button>
        ${podeEditar() ? `<button class="btn btn-primario btn-sm so-edicao" id="mNova">${icone('mais', 'icon-sm')}Nova medição</button>` : ''}
      </div>
    </div>
    <div class="card-corpo">
      <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px">
        <div class="perfil-dado"><small>Medido no filtro</small><strong>${fmtBRL(total)}</strong></div>
        <div class="perfil-dado"><small>Pago no filtro</small><strong>${fmtBRL(totalPago)}</strong></div>
        <div class="perfil-dado"><small>Medições</small><strong>${lista.length}</strong></div>
        <div class="perfil-dado"><small>Em aprovação</small><strong>${lista.filter((m) => m.status === 'Em aprovação').length}</strong></div>
      </div>
      <div class="tabela-wrap">${lista.length ? `<table class="tabela">
        <thead><tr><th>Competência</th><th style="min-width:210px">Contrato</th><th>Natureza</th><th>Nº / NF / OS</th><th class="num">Valor medido</th><th class="num">Valor pago</th><th>Status</th><th>Observações</th>${podeEditar() ? '<th class="so-edicao"></th>' : ''}</tr></thead>
        <tbody>${lista.map((m) => {
          const ct = contratoPorId(m.contrato_id);
          const ids = [m.numero && `Nº ${esc(m.numero)}`, m.nota_fiscal && `NF ${esc(m.nota_fiscal)}`, m.ordem_servico && `OS ${esc(m.ordem_servico)}`].filter(Boolean).join(' · ');
          const obs = [m.evento && `<span class="badge b-info">${esc(m.evento)}</span>`, m.descricao && esc(m.descricao), m.observacao && esc(m.observacao)].filter(Boolean).join('<br>');
          return `<tr>
            <td class="forte nowrap">${competencia(m.ano, m.mes)}${m.data_medicao ? `<div class="sub-linha">${fmtData(m.data_medicao)}</div>` : ''}</td>
            <td>${esc(ct?.titulo || '—')}<div class="sub-linha">${ct?.contrato_sap ? `SAP ${esc(ct.contrato_sap)}` : ''}${m.codigo_servico ? ` · Serv. ${esc(m.codigo_servico)}` : ''}</div></td>
            <td>${badgeTipo(m.tipo)}</td>
            <td class="small">${ids || '<span class="muted">—</span>'}</td>
            <td class="num forte" style="${medicaoConta(m) ? '' : 'text-decoration:line-through;opacity:.6'}">${fmtBRL(m.valor)}</td>
            <td class="num">${fmtBRL(m.valor_pago)}${m.data_pagamento ? `<div class="sub-linha">${fmtData(m.data_pagamento)}</div>` : ''}</td>
            <td>${badgeStatusMedicao(m.status)}</td>
            <td class="small" style="max-width:280px">${obs || '<span class="muted">—</span>'}</td>
            ${podeEditar() ? `<td class="acoes so-edicao"><button class="btn btn-fantasma btn-sm btn-icone" data-editar="${m.id}" title="Editar">${icone('editar', 'icon-sm')}</button><button class="btn btn-fantasma btn-sm btn-icone" data-copiar="${m.id}" title="Duplicar para o próximo mês">${icone('copiar', 'icon-sm')}</button><button class="btn btn-fantasma btn-sm btn-icone" data-excluir="${m.id}" title="Excluir">${icone('lixo', 'icon-sm')}</button></td>` : ''}
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td colspan="4">Total (exceto glosadas/canceladas)</td><td class="num">${fmtBRL(total)}</td><td class="num">${fmtBRL(totalPago)}</td><td colspan="${podeEditar() ? 3 : 2}"></td></tr></tfoot>
      </table>` : vazioHTML(`Nenhuma medição em ${ano} com esses filtros.`, 'medicao', podeEditar() ? `<button class="btn btn-primario btn-sm so-edicao" data-nova-vazia>${icone('mais', 'icon-sm')}Lançar medição</button>` : '')}</div>
    </div>`;

  alvo.querySelectorAll('[data-f]').forEach((i) => {
    const ev = i.tagName === 'INPUT' ? 'input' : 'change';
    const fn = () => { filtros[i.dataset.f] = i.value; rerender(); };
    i.addEventListener(ev, i.tagName === 'INPUT' ? debounce(fn, 350) : fn);
  });
  if (filtros.busca) { const b = alvo.querySelector('[data-f="busca"]'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  alvo.querySelector('#mNova')?.addEventListener('click', () => formMedicao(e));
  alvo.querySelector('[data-nova-vazia]')?.addEventListener('click', () => formMedicao(e));
  alvo.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => formMedicao(e, store.medicoes.find((m) => m.id === b.dataset.editar))));
  alvo.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => {
    const m = store.medicoes.find((x) => x.id === b.dataset.copiar);
    const prox = m.mes === 12 ? { mes: 1, ano: m.ano + 1 } : { mes: m.mes + 1, ano: m.ano };
    const { id, created_at, updated_at, created_by, numero, nota_fiscal, data_medicao, data_pagamento, valor_pago, ...resto } = m;
    formMedicao(e, { ...resto, ...prox, status: 'Em elaboração' }, true);
  }));
  alvo.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    const m = store.medicoes.find((x) => x.id === b.dataset.excluir);
    if (!(await confirmar(`Excluir a medição de ${competencia(m.ano, m.mes)} no valor de ${fmtBRL(m.valor)}?`, { titulo: 'Excluir medição', rotulo: 'Excluir', perigo: true }))) return;
    try { await excluirRegistro('gf_medicoes', m.id); toast('Medição excluída.'); rerender(); } catch (err) { toast(erroAmigavel(err), 'erro'); }
  }));
  alvo.querySelector('#mCsv').addEventListener('click', () => baixarCSV(`medicoes-${e.slug}-${ano}.csv`, [
    { rotulo: 'Empresa', valor: () => e.nome }, { rotulo: 'Ano', valor: 'ano' }, { rotulo: 'Mês', valor: 'mes' },
    { rotulo: 'Contrato', valor: (m) => contratoPorId(m.contrato_id)?.titulo || '' }, { rotulo: 'Contrato SAP', valor: (m) => contratoPorId(m.contrato_id)?.contrato_sap || '' },
    { rotulo: 'Natureza', valor: 'tipo' }, { rotulo: 'Valor medido', valor: 'valor' }, { rotulo: 'Valor pago', valor: 'valor_pago' }, { rotulo: 'Status', valor: 'status' },
    { rotulo: 'Nº medição', valor: 'numero' }, { rotulo: 'Data medição', valor: 'data_medicao' }, { rotulo: 'Nota fiscal', valor: 'nota_fiscal' }, { rotulo: 'Data pagamento', valor: 'data_pagamento' },
    { rotulo: 'OS', valor: 'ordem_servico' }, { rotulo: 'Código serviço', valor: 'codigo_servico' }, { rotulo: 'Evento', valor: 'evento' }, { rotulo: 'Descrição', valor: 'descricao' }, { rotulo: 'Observação', valor: 'observacao' },
  ], lista));
}

function formMedicao(e, reg = null, copia = false) {
  const contratos = contratosDaEmpresa(e.id);
  if (!contratos.length) { toast('Cadastre um contrato antes de lançar medições.', 'alerta'); location.hash = `#/empresa/${e.slug}/registros/contratos`; return; }
  const novo = !reg || copia;
  const padraoContrato = reg?.contrato_id || filtros.contrato || contratos.find((x) => x.status === 'Ativo')?.id || contratos[0].id;
  const fechados = mesesFechados(store.ano);
  const valores = {
    contrato_id: padraoContrato,
    ano: store.ano,
    mes: Math.max(1, Math.min(12, fechados || 1)),
    tipo: contratoPorId(padraoContrato)?.tipo || 'OPEX',
    status: 'Aprovada',
    ...(reg || {}),
  };
  const campos = [
    { nome: 'contrato_id', rotulo: 'Contrato', tipo: 'select', obrigatorio: true, largura: 2, opcoes: contratos.map((x) => ({ valor: x.id, rotulo: `${x.titulo}${x.contrato_sap ? ` — SAP ${x.contrato_sap}` : ''} (${x.tipo})` })) },
    { nome: 'mes', rotulo: 'Mês de competência', tipo: 'select', obrigatorio: true, opcoes: MESES_LONGOS.map((m, i) => ({ valor: i + 1, rotulo: m })) },
    { nome: 'ano', rotulo: 'Ano', tipo: 'number', obrigatorio: true, min: 2000, max: 2100 },
    { nome: 'valor', rotulo: 'Valor medido', tipo: 'money', obrigatorio: true },
    { nome: 'tipo', rotulo: 'Natureza', tipo: 'select', obrigatorio: true, opcoes: TIPOS, ajuda: 'Vem do contrato; ajuste se o serviço tiver outra classificação.' },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: STATUS_MEDICAO },
    { nome: 'valor_pago', rotulo: 'Valor pago', tipo: 'money' },
    { nome: 'numero', rotulo: 'Nº da medição / BM' },
    { nome: 'data_medicao', rotulo: 'Data da medição', tipo: 'date' },
    { nome: 'nota_fiscal', rotulo: 'Nota fiscal' },
    { nome: 'data_pagamento', rotulo: 'Data do pagamento', tipo: 'date' },
    { nome: 'ordem_servico', rotulo: 'Ordem de serviço (OS)' },
    { nome: 'codigo_servico', rotulo: 'Código de serviço (catálogo)', tipo: 'autocomplete', placeholder: 'Digite o código ou a descrição', ajuda: 'Busca no catálogo CAPEX/OPEX e sugere a natureza.' },
    { nome: 'evento', rotulo: 'Evento / frente', largura: 2, placeholder: 'ex.: Ponte Tatu — OIA' },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largura: 2 },
    { nome: 'observacao', rotulo: 'Observações', tipo: 'textarea', largura: 2 },
  ];
  formulario({
    titulo: novo ? 'Nova medição' : 'Editar medição',
    subtitulo: `${e.nome} · gasto realizado`,
    campos, valores,
    onSalvar: async (v) => {
      if (v.valor === null) throw new Error('Informe o valor medido.');
      await salvarRegistro('gf_medicoes', { ...v, empresa_id: e.id, ...(novo ? {} : { id: reg.id }) });
      toast(novo ? 'Medição lançada.' : 'Medição atualizada.');
      rerender();
    },
    aoAbrir: (form) => {
      const selC = form.querySelector('[name="contrato_id"]');
      const selT = form.querySelector('[name="tipo"]');
      selC.addEventListener('change', () => { const ct = contratoPorId(selC.value); if (ct) selT.value = ct.tipo; });
      ligarAutocompleteServico(form, selT);
    },
  });
}

function ligarAutocompleteServico(form, selTipo) {
  const inp = form.querySelector('[name="codigo_servico"]');
  if (!inp) return;
  const lista = inp.parentElement.querySelector('.ac-lista');
  const ajuda = form.querySelector('[data-ajuda="codigo_servico"]');
  let itens = [];
  let ativo = -1;
  const fechar = () => { lista.hidden = true; ativo = -1; };
  const escolher = (s) => {
    inp.value = s.codigo;
    if (ajuda) ajuda.innerHTML = `${esc(s.denominacao)} — <b>${esc(s.classificacao || 'Sem classificação')}</b>`;
    if (s.classificacao === 'CAPEX' || s.classificacao === 'OPEX') selTipo.value = s.classificacao;
    fechar();
  };
  const buscar = debounce(async () => {
    const q = inp.value.trim().replace(/[,()%*\\]/g, ' ').trim();
    if (q.length < 2) { fechar(); return; }
    const { data, error } = await sb.from('gf_servicos').select('codigo,denominacao,classificacao').or(`codigo.ilike.${q}%,denominacao.ilike.%${q}%`).order('codigo').limit(10);
    if (error) { fechar(); return; }
    itens = data || [];
    if (!itens.length) { lista.innerHTML = '<div class="ac-item muted">Nenhum serviço encontrado (o catálogo foi importado?).</div>'; lista.hidden = false; return; }
    lista.innerHTML = itens.map((s, i) => `<div class="ac-item" data-i="${i}"><code>${esc(s.codigo)}</code><span class="desc">${esc(s.denominacao)}</span>${s.classificacao === 'CAPEX' || s.classificacao === 'OPEX' ? `<span class="badge ${s.classificacao === 'CAPEX' ? 'b-capex' : 'b-opex'}">${s.classificacao}</span>` : '<span class="badge b-neutro">s/ class.</span>'}</div>`).join('');
    lista.hidden = false;
    lista.querySelectorAll('[data-i]').forEach((d) => d.addEventListener('mousedown', (ev) => { ev.preventDefault(); escolher(itens[Number(d.dataset.i)]); }));
  }, 250);
  inp.addEventListener('input', buscar);
  inp.addEventListener('blur', () => setTimeout(fechar, 150));
  inp.addEventListener('keydown', (ev) => {
    if (lista.hidden || !itens.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      ativo = (ativo + (ev.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
      lista.querySelectorAll('[data-i]').forEach((d, i) => d.classList.toggle('ativo', i === ativo));
    } else if (ev.key === 'Enter' && ativo >= 0) { ev.preventDefault(); escolher(itens[ativo]); } else if (ev.key === 'Escape') fechar();
  });
}

// =====================================================================
// GRADE EDITÁVEL (compartilhada por previsões e orçamento)
// =====================================================================
function ligarGrade(alvo, aoAlterar) {
  ligarMascaraMoeda(alvo);
  alvo.querySelectorAll('input[data-cel]').forEach((i) => {
    i.addEventListener('input', () => { i.classList.toggle('alterado', i.value.trim() !== i.dataset.orig); aoAlterar(); });
    i.addEventListener('blur', () => { i.classList.toggle('alterado', i.value.trim() !== i.dataset.orig); aoAlterar(); });
    i.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const todos = [...alvo.querySelectorAll('input[data-cel]')];
      todos[todos.indexOf(i) + 1]?.focus();
    });
  });
}

function totaisGrade(alvo) {
  const linhas = {};
  const colunas = Array(12).fill(0);
  alvo.querySelectorAll('input[data-cel]').forEach((i) => {
    const v = parseValor(i.value) || 0;
    const [lin, mes] = i.dataset.cel.split('|');
    linhas[lin] = (linhas[lin] || 0) + v;
    colunas[Number(mes) - 1] += v;
  });
  Object.entries(linhas).forEach(([lin, v]) => { const td = alvo.querySelector(`[data-total-linha="${CSS.escape(lin)}"]`); if (td) td.textContent = fmtBRL(v); });
  colunas.forEach((v, i) => { const td = alvo.querySelector(`[data-total-col="${i + 1}"]`); if (td) td.textContent = fmtBRL(v); });
  const tg = alvo.querySelector('[data-total-geral]');
  if (tg) tg.textContent = fmtBRL(soma(colunas));
  const alterados = alvo.querySelectorAll('input.alterado').length;
  const b = alvo.querySelector('[data-salvar-grade]');
  if (b) { b.disabled = alterados === 0; b.innerHTML = `${icone('check', 'icon-sm')}Salvar${alterados ? ` (${alterados})` : ''}`; }
  return { linhas, colunas };
}

// =====================================================================
// PREVISÕES (forecast por contrato × mês)
// =====================================================================
function abaPrevisoes(alvo, e) {
  const ano = store.ano;
  const fechados = mesesFechados(ano);
  const prevAno = store.previsoes.filter((p) => p.empresa_id === e.id && p.ano === ano);
  const contratos = contratosDaEmpresa(e.id).filter((x) => x.status !== 'Encerrado' || prevAno.some((p) => p.contrato_id === x.id));
  const mapa = new Map(prevAno.map((p) => [`${p.contrato_id}|${p.mes}`, p]));
  const realPor = (ctId, mes) => soma(store.medicoes.filter((m) => m.contrato_id === ctId && m.ano === ano && m.mes === mes && medicaoConta(m)).map((m) => m.valor));
  const editavel = podeEditar();

  alvo.innerHTML = `
    <div class="card-cab"><div><h3>Previsões de gasto (forecast) — ${ano}</h3><div class="sub">Quanto cada contrato deve medir por mês. Alimenta a projeção e a aderência. Abaixo de cada célula: valor realizado.</div></div>
      <div class="card-acoes">${editavel ? `<button class="btn btn-secundario btn-sm so-edicao" id="pRitmo" title="Preenche meses abertos vazios com a média dos últimos 3 meses de cada contrato">${icone('varinha', 'icon-sm')}Preencher pelo ritmo</button><button class="btn btn-primario btn-sm so-edicao" data-salvar-grade disabled>${icone('check', 'icon-sm')}Salvar</button>` : ''}</div></div>
    <div class="card-corpo">
      ${contratos.length ? `<div class="tabela-wrap"><table class="tabela grade-edit">
        <thead><tr><th>Contrato</th>${MESES.map((m, i) => `<th class="${i < fechados ? 'mes-fechado' : ''}">${m}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>${contratos.map((ct) => `<tr><td><span class="forte">${esc(ct.titulo)}</span><div class="sub-linha">${badgeTipo(ct.tipo)} ${ct.contrato_sap ? `SAP ${esc(ct.contrato_sap)}` : ''}</div></td>
          ${MESES.map((_, i) => {
            const p = mapa.get(`${ct.id}|${i + 1}`);
            const v = p ? fmtNum2(p.valor) : '';
            const r = realPor(ct.id, i + 1);
            return `<td class="${i < fechados ? 'mes-fechado' : ''}"><input data-cel="${ct.id}|${i + 1}" data-orig="${v}" value="${v}" inputmode="decimal" ${editavel ? '' : 'disabled'} aria-label="${esc(ct.titulo)} ${MESES_LONGOS[i]}" title="${p?.observacao ? esc(p.observacao) : ''}"><span class="ref">${r ? `real ${fmtBRL(r)}` : '&nbsp;'}</span></td>`;
          }).join('')}<td class="total" data-total-linha="${ct.id}"></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total do mês</td>${MESES.map((_, i) => `<td class="num" data-total-col="${i + 1}"></td>`).join('')}<td class="total" data-total-geral></td></tr></tfoot>
      </table></div>
      <div class="legenda-nota">${icone('info', 'icon-sm')}<span>Meses em cinza já estão fechados. Deixe a célula vazia para remover a previsão. Use Enter para ir à próxima célula.</span></div>` : vazioHTML('Cadastre contratos para registrar previsões.', 'contrato')}
    </div>`;

  if (!contratos.length) return;
  ligarGrade(alvo, () => totaisGrade(alvo));
  totaisGrade(alvo);

  alvo.querySelector('#pRitmo')?.addEventListener('click', () => {
    let n = 0;
    for (const ct of contratos) {
      const r = resumoContrato(ct, ano);
      if (!r.ritmo) continue;
      for (let m = fechados + 1; m <= 12; m++) {
        const i = alvo.querySelector(`input[data-cel="${ct.id}|${m}"]`);
        if (i && !i.value.trim()) { i.value = fmtNum2(Math.round(r.ritmo * 100) / 100); i.classList.add('alterado'); n++; }
      }
    }
    totaisGrade(alvo);
    toast(n ? `${n} célula(s) preenchidas — revise e salve.` : 'Nada a preencher (sem ritmo ou meses já preenchidos).', n ? 'info' : 'alerta');
  });

  alvo.querySelector('[data-salvar-grade]')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    const inserir = []; const atualizar = []; const remover = [];
    for (const i of alvo.querySelectorAll('input.alterado')) {
      const v = parseValor(i.value);
      if (Number.isNaN(v)) { toast('Há valores inválidos na grade.', 'erro'); i.focus(); return; }
      const [ctId, mes] = i.dataset.cel.split('|');
      const ct = contratoPorId(ctId);
      const ex = mapa.get(`${ctId}|${mes}`);
      if (v === null || v === 0) { if (ex) remover.push(ex.id); }
      else if (ex) atualizar.push({ id: ex.id, valor: v, tipo: ct.tipo });
      else inserir.push({ empresa_id: e.id, contrato_id: ctId, ano, mes: Number(mes), tipo: ct.tipo, valor: v });
    }
    b.disabled = true; b.textContent = 'Salvando…';
    try {
      if (inserir.length) await upsertLote('gf_previsoes', inserir, 'contrato_id,ano,mes,tipo');
      for (const u of atualizar) { const { error } = await sb.from('gf_previsoes').update({ valor: u.valor, tipo: u.tipo }).eq('id', u.id); if (error) throw error; }
      if (remover.length) await excluirIds('gf_previsoes', remover);
      await recarregar('previsoes');
      toast('Previsões salvas.');
      rerender();
    } catch (err) { toast(erroAmigavel(err), 'erro', 6000); b.disabled = false; totaisGrade(alvo); }
  });
}

// =====================================================================
// ORÇAMENTO (programado por mês × CAPEX/OPEX)
// =====================================================================
function abaOrcamento(alvo, e) {
  const ano = store.ano;
  const fechados = mesesFechados(ano);
  const orcAno = store.orcamentos.filter((o) => o.empresa_id === e.id && o.ano === ano);
  const mapa = new Map(orcAno.map((o) => [`${o.tipo}|${o.mes}`, o]));
  const editavel = podeEditar();
  const R = { CAPEX: resumo({ ano, empresaId: e.id, tipo: 'CAPEX' }), OPEX: resumo({ ano, empresaId: e.id, tipo: 'OPEX' }) };

  alvo.innerHTML = `
    <div class="card-cab"><div><h3>Orçamento programado — ${ano}</h3><div class="sub">Valor disponível por mês para ${esc(e.nome)}, separado em CAPEX e OPEX. Abaixo de cada célula: realizado do mês.</div></div>
      <div class="card-acoes">${editavel ? `
        <button class="btn btn-secundario btn-sm so-edicao" id="oDistribuir">${icone('camadas', 'icon-sm')}Distribuir valor anual</button>
        <button class="btn btn-secundario btn-sm so-edicao" id="oSugerir" title="Meses fechados = realizado; meses abertos = forecast ou ritmo">${icone('varinha', 'icon-sm')}Sugerir pelo realizado</button>
        <button class="btn btn-secundario btn-sm so-edicao" id="oCopiar">${icone('copiar', 'icon-sm')}Copiar de ${ano - 1}</button>
        <button class="btn btn-primario btn-sm so-edicao" data-salvar-grade disabled>${icone('check', 'icon-sm')}Salvar</button>` : ''}</div></div>
    <div class="card-corpo">
      <div class="tabela-wrap"><table class="tabela grade-edit">
        <thead><tr><th>Natureza</th>${MESES.map((m, i) => `<th class="${i < fechados ? 'mes-fechado' : ''}">${m}</th>`).join('')}<th>Total anual</th></tr></thead>
        <tbody>${TIPOS.map((t) => `<tr><td>${badgeTipo(t)}</td>${MESES.map((_, i) => {
          const o = mapa.get(`${t}|${i + 1}`);
          const v = o && Number(o.valor) ? fmtNum2(o.valor) : '';
          const r = R[t].real[i];
          return `<td class="${i < fechados ? 'mes-fechado' : ''}"><input data-cel="${t}|${i + 1}" data-orig="${v}" value="${v}" inputmode="decimal" ${editavel ? '' : 'disabled'} aria-label="${t} ${MESES_LONGOS[i]}"><span class="ref">${r ? `real ${fmtBRL(r)}` : '&nbsp;'}</span></td>`;
        }).join('')}<td class="total" data-total-linha="${t}"></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total do mês</td>${MESES.map((_, i) => `<td class="num" data-total-col="${i + 1}"></td>`).join('')}<td class="total" data-total-geral></td></tr></tfoot>
      </table></div>
      <div class="grade g-2" style="margin-top:18px">${TIPOS.map((t) => { const r = R[t]; return `<div class="perfil-dado" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div><small>${t} orçado</small><strong>${fmtBRL(r.orcAnual)}</strong></div>
        <div><small>Realizado</small><strong>${fmtBRL(r.realAno)}</strong></div>
        <div><small>Saldo</small><strong style="${r.saldo < 0 ? 'color:var(--c-erro)' : ''}">${r.orcAnual ? fmtBRL(r.saldo) : '—'}</strong></div>
        <div><small>Pode gastar/mês</small><strong>${r.orcAnual && r.restantes ? fmtBRL(r.margemMensal) : '—'}</strong></div></div>`; }).join('')}</div>
    </div>`;

  ligarGrade(alvo, () => totaisGrade(alvo));
  totaisGrade(alvo);

  const preencher = (fn) => {
    alvo.querySelectorAll('input[data-cel]').forEach((i) => {
      const [t, mes] = i.dataset.cel.split('|');
      const v = fn(t, Number(mes));
      if (v === undefined) return;
      i.value = v ? fmtNum2(Math.round(v * 100) / 100) : '';
      i.classList.toggle('alterado', i.value.trim() !== i.dataset.orig);
    });
    totaisGrade(alvo);
  };

  alvo.querySelector('#oSugerir')?.addEventListener('click', () => {
    preencher((t, mes) => { const r = R[t]; const i = mes - 1; return i < r.fechados ? r.real[i] : (r.prev[i] > 0 ? r.prev[i] : r.ritmo); });
    toast('Sugestão aplicada — revise os valores e clique em Salvar.', 'info');
  });
  alvo.querySelector('#oCopiar')?.addEventListener('click', () => {
    const ant = store.orcamentos.filter((o) => o.empresa_id === e.id && o.ano === ano - 1);
    if (!ant.length) { toast(`Não há orçamento cadastrado em ${ano - 1}.`, 'alerta'); return; }
    const m = new Map(ant.map((o) => [`${o.tipo}|${o.mes}`, Number(o.valor)]));
    preencher((t, mes) => m.get(`${t}|${mes}`) || 0);
    toast(`Valores de ${ano - 1} copiados — revise e salve.`, 'info');
  });
  alvo.querySelector('#oDistribuir')?.addEventListener('click', () => {
    const corpo = document.createElement('form');
    corpo.className = 'form-grade';
    corpo.innerHTML = `
      <label class="campo"><span class="campo-rotulo">Valor anual CAPEX</span><div class="input-money"><span>R$</span><input name="capex" data-money inputmode="decimal" placeholder="manter atual"></div></label>
      <label class="campo"><span class="campo-rotulo">Valor anual OPEX</span><div class="input-money"><span>R$</span><input name="opex" data-money inputmode="decimal" placeholder="manter atual"></div></label>
      <label class="campo col-2"><span class="campo-rotulo">Como distribuir</span><select name="modo">
        <option value="12">Igualmente nos 12 meses</option>
        <option value="rest">Saldo (anual − realizado) igualmente nos meses abertos; meses fechados = realizado</option>
      </select></label>`;
    ligarMascaraMoeda(corpo);
    modal({
      titulo: 'Distribuir valor anual', subtitulo: 'Preenche a grade; nada é salvo até você clicar em Salvar.', corpo,
      acoes: [{ rotulo: 'Cancelar' }, { rotulo: 'Aplicar', classe: 'btn-primario', icone: 'check', onClick: ({ fechar }) => {
        const v = { CAPEX: parseValor(corpo.capex.value), OPEX: parseValor(corpo.opex.value) };
        const modo = corpo.modo.value;
        preencher((t, mes) => {
          const anual = v[t];
          if (anual === null || Number.isNaN(anual)) return undefined;
          if (modo === '12') return anual / 12;
          const r = R[t]; const i = mes - 1;
          if (i < r.fechados) return r.real[i];
          return Math.max(0, anual - r.realFechado) / Math.max(1, 12 - r.fechados);
        });
        fechar();
      } }],
    });
  });

  alvo.querySelector('[data-salvar-grade]')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    const linhas = [];
    for (const i of alvo.querySelectorAll('input.alterado')) {
      const v = parseValor(i.value);
      if (Number.isNaN(v)) { toast('Há valores inválidos na grade.', 'erro'); i.focus(); return; }
      const [t, mes] = i.dataset.cel.split('|');
      linhas.push({ empresa_id: e.id, ano, mes: Number(mes), tipo: t, valor: v || 0 });
    }
    b.disabled = true; b.textContent = 'Salvando…';
    try {
      await upsertLote('gf_orcamentos', linhas, 'empresa_id,ano,mes,tipo');
      await recarregar('orcamentos');
      toast('Orçamento salvo.');
      rerender();
    } catch (err) { toast(erroAmigavel(err), 'erro', 6000); b.disabled = false; totaisGrade(alvo); }
  });
}

// =====================================================================
// CONTRATOS
// =====================================================================
function abaContratos(alvo, e) {
  const contratos = contratosDaEmpresa(e.id);
  alvo.innerHTML = `
    <div class="card-cab"><div><h3>Contratos de ${esc(e.nome)}</h3><div class="sub">Valor, saldo SAP, PEP e vigência. A natureza (CAPEX/OPEX) do contrato é usada como padrão nas medições e previsões.</div></div>
      <div class="card-acoes">${podeEditar() ? `<button class="btn btn-primario btn-sm so-edicao" id="cNovo">${icone('mais', 'icon-sm')}Novo contrato</button>` : ''}</div></div>
    <div class="card-corpo">${contratos.length ? `<div class="contratos-grid">${contratos.map((ct) => {
      const r = resumoContrato(ct);
      return `<article class="card contrato-card" style="box-shadow:none">
        <div class="contrato-cab"><div style="min-width:0"><h3>${esc(ct.titulo)}</h3><div class="muted small">SAP ${esc(ct.contrato_sap || '—')}${ct.contrato_ariba ? ` · Ariba ${esc(ct.contrato_ariba)}` : ''}</div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${badgeTipo(ct.tipo)}${badgeStatusContrato(ct.status)}</div></div>
        <div><div class="progresso"><span class="${r.nivel === 'erro' ? 'erro' : r.nivel === 'alerta' ? 'alerta' : ''}" style="width:${Math.min(100, (r.pct || 0) * 100)}%"></span></div>
          <div class="progresso-legenda"><span>${fmtPct(r.pct)} medido</span><span>${fmtBRL(r.medido)} de ${fmtBRL(r.valor)}</span></div></div>
        <div class="contrato-meta">
          <div><span>Saldo contratual</span><b style="${r.saldo < 0 ? 'color:var(--c-erro)' : ''}">${fmtBRL(r.saldo)}</b></div>
          <div><span>Saldo SAP${ct.saldo_sap_data ? ` (${fmtData(ct.saldo_sap_data)})` : ''}</span><b>${fmtBRL(ct.saldo_sap)}</b></div>
          <div><span>PEP</span><b title="${esc(ct.pep || '')}">${esc(ct.pep || '—')}</b></div>
          <div><span>Centro de custo</span><b>${esc(ct.centro_custo || '—')}</b></div>
          <div><span>Vigência</span><b>${ct.data_inicio || ct.data_fim ? `${fmtData(ct.data_inicio)} a ${fmtData(ct.data_fim)}` : '—'}</b></div>
          <div><span>Responsável</span><b>${esc(ct.responsavel || '—')}</b></div>
        </div>
        ${ct.observacoes ? `<p class="small muted">${esc(ct.observacoes)}</p>` : ''}
        ${podeEditar() ? `<div class="so-edicao" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secundario btn-sm" data-editar="${ct.id}">${icone('editar', 'icon-sm')}Editar</button><button class="btn btn-fantasma btn-sm" data-excluir="${ct.id}">${icone('lixo', 'icon-sm')}Excluir</button></div>` : ''}
      </article>`;
    }).join('')}</div>` : vazioHTML('Nenhum contrato cadastrado.', 'contrato', podeEditar() ? `<button class="btn btn-primario btn-sm" id="cNovo2">${icone('mais', 'icon-sm')}Cadastrar contrato</button>` : '')}</div>`;

  const abrir = (ct = null) => {
    formulario({
      titulo: ct ? 'Editar contrato' : 'Novo contrato', subtitulo: e.nome,
      valores: ct || { tipo: 'OPEX', status: 'Ativo' },
      campos: [
        { nome: 'titulo', rotulo: 'Escopo / título', obrigatorio: true, largura: 2, placeholder: 'ex.: Manutenção de Infra T2' },
        { nome: 'tipo', rotulo: 'Natureza', tipo: 'select', opcoes: TIPOS, obrigatorio: true },
        { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: STATUS_CONTRATO },
        { nome: 'contrato_sap', rotulo: 'Contrato SAP' },
        { nome: 'contrato_ariba', rotulo: 'Contrato Ariba' },
        { nome: 'pep', rotulo: 'PEP' },
        { nome: 'centro_custo', rotulo: 'Centro de custo' },
        { nome: 'valor_contrato', rotulo: 'Valor do contrato', tipo: 'money', obrigatorio: true },
        { nome: 'responsavel', rotulo: 'Responsável / fiscal' },
        { nome: 'saldo_sap', rotulo: 'Saldo SAP', tipo: 'money' },
        { nome: 'saldo_sap_data', rotulo: 'Saldo SAP em', tipo: 'date' },
        { nome: 'data_inicio', rotulo: 'Início da vigência', tipo: 'date' },
        { nome: 'data_fim', rotulo: 'Fim da vigência', tipo: 'date' },
        { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', largura: 2 },
      ],
      onSalvar: async (v) => {
        await salvarRegistro('gf_contratos', { ...v, empresa_id: e.id, ...(ct ? { id: ct.id } : {}) });
        toast(ct ? 'Contrato atualizado.' : 'Contrato cadastrado.');
        rerender();
      },
    });
  };
  alvo.querySelector('#cNovo')?.addEventListener('click', () => abrir());
  alvo.querySelector('#cNovo2')?.addEventListener('click', () => abrir());
  alvo.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrir(contratoPorId(b.dataset.editar))));
  alvo.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    const ct = contratoPorId(b.dataset.excluir);
    const nMed = store.medicoes.filter((m) => m.contrato_id === ct.id).length;
    const ok = await confirmar(`Excluir o contrato "${ct.titulo}"? As previsões dele serão apagadas${nMed ? ` e ${nMed} medição(ões) ficarão sem contrato vinculado` : ''}. Considere marcar como "Encerrado" em vez de excluir.`, { titulo: 'Excluir contrato', rotulo: 'Excluir', perigo: true });
    if (!ok) return;
    try { await excluirRegistro('gf_contratos', ct.id); await recarregar('previsoes', 'medicoes', 'pendencias'); toast('Contrato excluído.'); rerender(); } catch (err) { toast(erroAmigavel(err), 'erro'); }
  }));
}

// =====================================================================
// PENDÊNCIAS
// =====================================================================
function abaPendencias(alvo, e) {
  const hoje = new Date().toISOString().slice(0, 10);
  const todas = store.pendencias.filter((p) => p.empresa_id === e.id);
  const lista = (filtros.pendencias === 'abertas' ? todas.filter((p) => p.status !== 'Concluída') : todas)
    .sort((a, b) => (a.status === 'Concluída') - (b.status === 'Concluída') || PRIORIDADES.indexOf(b.prioridade) - PRIORIDADES.indexOf(a.prioridade) || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
  const contratos = contratosDaEmpresa(e.id);

  alvo.innerHTML = `
    <div class="card-cab"><div><h3>Pendências e acompanhamento</h3><div class="sub">OS pendentes, confirmações de medição, aditivos e outros pontos de atenção.</div></div>
      <div class="card-acoes">
        <div class="segmentado"><button data-pf="abertas" class="${filtros.pendencias === 'abertas' ? 'ativo' : ''}">Em aberto (${todas.filter((p) => p.status !== 'Concluída').length})</button><button data-pf="todas" class="${filtros.pendencias === 'todas' ? 'ativo' : ''}">Todas (${todas.length})</button></div>
        ${podeEditar() ? `<button class="btn btn-primario btn-sm so-edicao" id="pNova">${icone('mais', 'icon-sm')}Nova pendência</button>` : ''}
      </div></div>
    <div class="card-corpo"><div class="tabela-wrap">${lista.length ? `<table class="tabela">
      <thead><tr>${podeEditar() ? '<th class="so-edicao" style="width:1%"></th>' : ''}<th>Pendência</th><th>Contrato</th><th class="num">Valor</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th>${podeEditar() ? '<th class="so-edicao"></th>' : ''}</tr></thead>
      <tbody>${lista.map((p) => {
        const vencida = p.prazo && p.prazo < hoje && p.status !== 'Concluída';
        return `<tr style="${p.status === 'Concluída' ? 'opacity:.6' : ''}">
          ${podeEditar() ? `<td class="so-edicao"><button class="btn btn-sm btn-icone ${p.status === 'Concluída' ? 'btn-sucesso' : 'btn-secundario'}" data-concluir="${p.id}" title="${p.status === 'Concluída' ? 'Reabrir' : 'Marcar como concluída'}">${icone('check', 'icon-sm')}</button></td>` : ''}
          <td><span class="forte">${esc(p.titulo)}</span>${p.descricao ? `<div class="sub-linha">${esc(p.descricao)}</div>` : ''}</td>
          <td class="small">${esc(contratoPorId(p.contrato_id)?.titulo || '—')}</td>
          <td class="num">${fmtBRL(p.valor)}</td>
          <td>${esc(p.responsavel || '—')}</td>
          <td class="nowrap">${p.prazo ? `${fmtData(p.prazo)}${vencida ? ' <span class="badge b-erro">vencida</span>' : ''}` : '—'}</td>
          <td>${badgePrioridade(p.prioridade)}</td>
          <td>${badgePendencia(p.status)}${p.concluida_em ? `<div class="sub-linha">${fmtData(p.concluida_em)}</div>` : ''}</td>
          ${podeEditar() ? `<td class="acoes so-edicao"><button class="btn btn-fantasma btn-sm btn-icone" data-editar="${p.id}" title="Editar">${icone('editar', 'icon-sm')}</button><button class="btn btn-fantasma btn-sm btn-icone" data-excluir="${p.id}" title="Excluir">${icone('lixo', 'icon-sm')}</button></td>` : ''}
        </tr>`;
      }).join('')}</tbody></table>` : vazioHTML('Nenhuma pendência por aqui.', 'check')}</div></div>`;

  alvo.querySelectorAll('[data-pf]').forEach((b) => b.addEventListener('click', () => { filtros.pendencias = b.dataset.pf; rerender(); }));
  const abrir = (p = null) => formulario({
    titulo: p ? 'Editar pendência' : 'Nova pendência', subtitulo: e.nome,
    valores: p || { prioridade: 'Média', status: 'Aberta' },
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true, largura: 2 },
      { nome: 'contrato_id', rotulo: 'Contrato', tipo: 'select', vazio: 'Sem contrato específico', opcoes: contratos.map((x) => ({ valor: x.id, rotulo: x.titulo })) },
      { nome: 'valor', rotulo: 'Valor envolvido', tipo: 'money' },
      { nome: 'responsavel', rotulo: 'Responsável' },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'date' },
      { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: PRIORIDADES },
      { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: STATUS_PENDENCIA },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largura: 2 },
    ],
    onSalvar: async (v) => {
      const concluida_em = v.status === 'Concluída' ? (p?.concluida_em || new Date().toISOString()) : null;
      await salvarRegistro('gf_pendencias', { ...v, concluida_em, empresa_id: e.id, ...(p ? { id: p.id } : {}) });
      toast(p ? 'Pendência atualizada.' : 'Pendência registrada.');
      rerender();
    },
  });
  alvo.querySelector('#pNova')?.addEventListener('click', () => abrir());
  alvo.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrir(store.pendencias.find((x) => x.id === b.dataset.editar))));
  alvo.querySelectorAll('[data-concluir]').forEach((b) => b.addEventListener('click', async () => {
    const p = store.pendencias.find((x) => x.id === b.dataset.concluir);
    const concluir = p.status !== 'Concluída';
    try {
      await salvarRegistro('gf_pendencias', { id: p.id, status: concluir ? 'Concluída' : 'Aberta', concluida_em: concluir ? new Date().toISOString() : null });
      toast(concluir ? 'Pendência concluída.' : 'Pendência reaberta.');
      rerender();
    } catch (err) { toast(erroAmigavel(err), 'erro'); }
  }));
  alvo.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    const p = store.pendencias.find((x) => x.id === b.dataset.excluir);
    if (!(await confirmar(`Excluir a pendência "${p.titulo}"?`, { titulo: 'Excluir pendência', rotulo: 'Excluir', perigo: true }))) return;
    try { await excluirRegistro('gf_pendencias', p.id); toast('Pendência excluída.'); rerender(); } catch (err) { toast(erroAmigavel(err), 'erro'); }
  }));
}

// =====================================================================
// DADOS DA EMPRESA
// =====================================================================
function abaEmpresa(alvo, e) {
  const editavel = podeEditar();
  const campos = [
    { nome: 'nome', rotulo: 'Nome curto (menu)', obrigatorio: true },
    { nome: 'razao_social', rotulo: 'Razão social' },
    { nome: 'cnpj', rotulo: 'CNPJ' },
    { nome: 'cor', rotulo: 'Cor nos gráficos', tipo: 'color', ajuda: 'Use preferencialmente as cores da paleta institucional.' },
    { nome: 'descricao', rotulo: 'Escopo / descrição', largura: 2 },
    { nome: 'contato_nome', rotulo: 'Contato (preposto)' },
    { nome: 'contato_email', rotulo: 'E-mail do contato', tipo: 'email' },
    { nome: 'contato_telefone', rotulo: 'Telefone do contato' },
    { nome: 'ordem', rotulo: 'Ordem no menu', tipo: 'number', min: 0 },
  ];
  alvo.innerHTML = `
    <div class="card-cab"><div><h3>Dados cadastrais</h3><div class="sub">Informações da empresa contratada e do contato responsável.</div></div>
      <div class="card-acoes">${ehAdmin() ? `<button class="btn btn-secundario btn-sm so-edicao" id="eNova">${icone('mais', 'icon-sm')}Cadastrar outra empresa</button>` : ''}</div></div>
    <div class="card-corpo"><form id="fEmpresa" class="form-grade" novalidate></form>
      ${editavel ? `<div class="so-edicao" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">${ehAdmin() ? `<button class="btn btn-fantasma btn-sm" id="eAtivo">${e.ativo ? 'Desativar empresa' : 'Reativar empresa'}</button>` : ''}<button class="btn btn-primario" id="eSalvar">${icone('check', 'icon-sm')}Salvar dados</button></div>` : ''}
    </div>`;
  const form = alvo.querySelector('#fEmpresa');
  formularioInline(form, campos, e, !editavel);

  alvo.querySelector('#eSalvar')?.addEventListener('click', async (ev) => {
    const v = lerCampos(form, campos);
    if (!v.nome) { toast('Informe o nome.', 'erro'); return; }
    ev.currentTarget.disabled = true;
    try { await salvarRegistro('gf_empresas', { id: e.id, ...v }); toast('Dados da empresa salvos.'); rerender(); } catch (err) { toast(erroAmigavel(err), 'erro'); ev.currentTarget.disabled = false; }
  });
  alvo.querySelector('#eAtivo')?.addEventListener('click', async () => {
    if (e.ativo && !(await confirmar(`Desativar ${e.nome}? Ela sairá do menu e dos painéis (os dados são mantidos).`, { titulo: 'Desativar empresa', rotulo: 'Desativar', perigo: true }))) return;
    try { await salvarRegistro('gf_empresas', { id: e.id, ativo: !e.ativo }); toast(e.ativo ? 'Empresa desativada.' : 'Empresa reativada.'); location.hash = '#/painel'; } catch (err) { toast(erroAmigavel(err), 'erro'); }
  });
  alvo.querySelector('#eNova')?.addEventListener('click', () => formulario({
    titulo: 'Cadastrar empresa', valores: { cor: '#32A6E6', ordem: store.empresas.length + 1 },
    campos: [{ nome: 'slug', rotulo: 'Identificador na URL', obrigatorio: true, ajuda: 'Somente letras minúsculas, números e hífen (ex.: nova-empresa).' }, ...campos],
    onSalvar: async (v) => {
      if (!/^[a-z0-9-]+$/.test(v.slug || '')) throw new Error('Identificador inválido: use letras minúsculas, números e hífen.');
      await salvarRegistro('gf_empresas', { ...v, ativo: true });
      toast('Empresa cadastrada.');
      location.hash = `#/empresa/${v.slug}/registros/contratos`;
    },
  }));
}

function formularioInline(form, campos, valores, somenteLeitura) {
  form.innerHTML = campos.map((c) => {
    const v = valores[c.nome] ?? '';
    const dis = somenteLeitura ? 'disabled' : '';
    const input = c.tipo === 'color'
      ? `<input name="${c.nome}" type="color" value="${esc(v || '#003865')}" ${dis} style="padding:4px">`
      : `<input name="${c.nome}" type="${c.tipo === 'number' ? 'number' : c.tipo === 'email' ? 'email' : 'text'}" value="${esc(v)}" ${dis}>`;
    return `<label class="campo ${c.largura === 2 ? 'col-2' : ''}"><span class="campo-rotulo">${esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</span>${input}${c.ajuda ? `<small>${c.ajuda}</small>` : ''}</label>`;
  }).join('');
}
