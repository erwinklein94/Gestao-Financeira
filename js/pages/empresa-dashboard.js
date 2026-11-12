// =====================================================================
// Dashboard da empresa
// =====================================================================
import { agruparItens } from '../itens.js';
import { store, empresaPorSlug, contratosDaEmpresa } from '../state.js';
import { resumo, resumoContrato, alertas, medicaoConta, classificacaoGastos } from '../calc.js';
import { grafico, cartaoGrafico, ligarAlternancias, paleta, corEmpresa, eixoMeses, eixoValor, tooltipEixo, tooltipItem, pontaBarra } from '../charts.js';
import { definirTitulo } from '../ui/shell.js';
import { icone, grafismo } from '../icons.js';
import { fmtBRL, fmtPct, fmtNum2, MESES, MESES_LONGOS, esc, soma, badgeSituacao, badgeTipo, badgeStatusContrato, badgePrioridade, vazioHTML, fmtData, STATUS_MEDICAO, NATUREZAS, SEM_CLASS, baixarCSV } from '../utils.js';
import { kpi, classeBarra, opcaoCurvaAcumulada, opcaoMensal } from './painel.js';

const CLASSE_CSS = { CAPEX: 'capex', OPEX: 'opex', [SEM_CLASS]: 'semclass' };
const ROTULO_CURTO = { CAPEX: 'CAPEX', OPEX: 'OPEX', [SEM_CLASS]: 'Sem class.' };

/** Barra 100% empilhada CAPEX/OPEX/sem classificação. */
export function barraClassificacao(valores) {
  const total = soma(NATUREZAS.map((n) => valores[n] || 0));
  if (total <= 0) return '<div class="barra-class" aria-hidden="true"></div>';
  const titulo = NATUREZAS.map((n) => `${n}: ${fmtPct((valores[n] || 0) / total)}`).join(' · ');
  return `<div class="barra-class" role="img" aria-label="${esc(titulo)}" title="${esc(titulo)}">${NATUREZAS.map((n) => (valores[n] > 0 ? `<span class="${CLASSE_CSS[n]}" style="width:${(valores[n] / total) * 100}%"></span>` : '')).join('')}</div>`;
}
export const legendaClassificacao = () => `<div class="class-legenda">${NATUREZAS.map((n) => `<span><i class="${CLASSE_CSS[n]}"></i>${esc(n)}</span>`).join('')}</div>`;

/** Gráfico de barras empilhadas por mês e natureza. */
export function opcaoClassMensal(porMes) {
  const p = paleta();
  const cor = { CAPEX: p.capex, OPEX: p.opex, [SEM_CLASS]: p.semclass };
  const ultima = NATUREZAS.filter((n) => porMes[n].some((v) => v > 0)).pop();
  return {
    legend: { data: NATUREZAS },
    tooltip: tooltipEixo(fmtBRL),
    xAxis: eixoMeses(),
    yAxis: eixoValor(),
    series: NATUREZAS.map((n) => ({
      name: n, type: 'bar', stack: 'nat', barMaxWidth: 26,
      data: porMes[n].map((v) => (v ? Math.round(v * 100) / 100 : null)),
      itemStyle: { color: cor[n], borderColor: p.superficie, borderWidth: 1, ...(n === ultima ? pontaBarra() : {}) },
    })),
  };
}

/** Rosca CAPEX × OPEX × sem classificação. */
export function opcaoClassRosca(tot) {
  const p = paleta();
  const cor = { CAPEX: p.capex, OPEX: p.opex, [SEM_CLASS]: p.semclass };
  const total = soma(NATUREZAS.map((n) => tot[n]));
  return {
    tooltip: tooltipItem(),
    legend: { bottom: 0, top: 'auto', left: 'center' },
    series: [{
      name: 'Realizado', type: 'pie', radius: ['63%', '86%'], center: ['50%', '45%'], padAngle: 1, minAngle: 3,
      itemStyle: { borderColor: p.superficie, borderWidth: 2, borderRadius: 4 },
      label: { show: true, position: 'center', formatter: () => `{a|${fmtBRL(total)}}\n{b|realizado}`, rich: { a: { fontSize: 12.5, fontWeight: 700, color: p.titulo }, b: { fontSize: 11, color: p.suave, padding: [4, 0, 0, 0] } } },
      data: NATUREZAS.map((n) => ({ name: n, value: Math.round(tot[n] * 100) / 100, itemStyle: { color: cor[n] } })),
    }],
  };
}

function cartaoNatureza(n, C) {
  const qtdCod = C.porCodigo.filter((x) => x.classificacao === n).length;
  const icones = { CAPEX: ['camadas', ''], OPEX: ['relogio', 'azul-claro'], [SEM_CLASS]: ['alerta', 'amarelo'] };
  const [ic, cor] = icones[n];
  return kpi({
    rotulo: n, valor: fmtBRL(C.tot[n]), icone: ic, cor, barra: C.pct[n] ?? 0, barraClasse: CLASSE_CSS[n],
    detalhe: `<b>${fmtPct(C.pct[n])}</b> do realizado${C.itens.length ? ` · ${qtdCod} ${qtdCod === 1 ? 'código' : 'códigos'} de serviço` : ''}`,
  });
}

function secaoClassificacao(e, C, ano) {
  if (C.total <= 0) return '';
  const temItens = C.itens.length > 0;
  const nAbas = new Set(C.itens.map((i) => `${i.mes}|${i.aba}`)).size;
  const meses = [...new Set(C.itens.map((i) => i.mes))].sort((a, b) => a - b).map((m) => MESES[m - 1]);
  const tabCod = C.porCodigo.length ? `<table class="tabela tabela-compacta">
      <thead><tr><th>Código</th><th>Serviço</th><th>Natureza</th><th class="num">Quantidade</th><th class="num">Valor</th><th class="num">%</th></tr></thead>
      <tbody>${C.porCodigo.map((x) => `<tr><td class="forte nowrap">${esc(x.codigo)}</td><td>${esc(x.descricao || '')}${x.noCatalogo ? '' : '<div class="sub-linha">código não encontrado no catálogo</div>'}</td><td>${badgeTipo(x.classificacao)}</td><td class="num nowrap">${fmtNum2(x.quantidade)} ${esc(x.unidade || '')}</td><td class="num forte">${fmtBRL(x.valor)}</td><td class="num">${fmtPct(C.totalItens ? x.valor / C.totalItens : null)}</td></tr>`).join('')}</tbody>
    </table>` : vazioHTML('Sem itens por código de serviço.', 'catalogo');

  return `<section class="card" id="classificacao">
      <div class="card-cab" style="flex-wrap:wrap">
        <div><h3>Classificação contábil dos gastos</h3><div class="sub">Quanto do realizado em ${ano} é CAPEX, OPEX ou está sem classificação no catálogo</div></div>
        <div class="card-acoes">${temItens ? `<button class="btn btn-secundario btn-sm" id="clsCsv">${icone('download', 'icon-sm')}Exportar itens (CSV)</button>` : ''}</div>
      </div>
      <div class="card-corpo">
        <div class="class-kpis">${NATUREZAS.map((n) => cartaoNatureza(n, C)).join('')}</div>
        <div style="margin-top:16px;display:grid;gap:8px">${barraClassificacao(C.tot)}${legendaClassificacao()}</div>
        ${temItens ? `<div class="legenda-nota">${icone('info', 'icon-sm')}<span>Fonte: ${C.itens.length.toLocaleString('pt-BR')} itens (código × valor) de ${nAbas} abas de encarregados das planilhas de medição (${meses.join(', ')}). A natureza de cada código vem do <a href="#/catalogo">Catálogo CAPEX/OPEX</a>; códigos que o catálogo não classifica como CAPEX nem OPEX aparecem como "Sem classificação".</span></div>` : ''}
      </div>
    </section>
    <div class="grade g-2-1">
      ${cartaoGrafico({ id: 'eClassMes', titulo: 'Natureza do gasto mês a mês', sub: `Realizado ${ano} por classificação contábil`, tabela: { colunas: [{ rotulo: 'Mês' }, ...NATUREZAS.map((n) => ({ rotulo: ROTULO_CURTO[n], num: true })), { rotulo: 'Total', num: true }], linhas: MESES.map((m, i) => [m, ...NATUREZAS.map((n) => fmtBRL(C.porMes[n][i] || null)), fmtBRL(soma(NATUREZAS.map((n) => C.porMes[n][i])) || null)]) } })}
      ${cartaoGrafico({ id: 'eTipo', titulo: 'CAPEX × OPEX × sem classificação', sub: `Participação no realizado ${ano}`, alturaClasse: 'grafico-sm', tabela: { colunas: [{ rotulo: 'Natureza' }, { rotulo: 'Realizado', num: true }, { rotulo: '%', num: true }], linhas: NATUREZAS.map((n) => [n, fmtBRL(C.tot[n]), fmtPct(C.pct[n])]) } })}
    </div>
    ${temItens ? `<section class="card"><div class="card-cab"><div><h3>Por código de serviço</h3><div class="sub">${C.porCodigo.length} códigos cruzados com o catálogo</div></div></div><div class="card-corpo sem-padding tabela-wrap">${tabCod}</div></section>` : ''}`;
}

function secaoItens(itens, ano, tipo) {
  const grupos = agruparItens(itens, tipo);
  return `<section class="card" id="resumo-itens">
    <div class="card-cab"><div><h3>Resumo por item</h3><div class="sub">${ano}${tipo ? ' · ' + esc(tipo) : ''} · Quantidades e valores somados por descrição e unidade</div></div></div>
    <div class="card-corpo sem-padding tabela-wrap">
      ${grupos.length ? `<table class="tabela tabela-compacta">
        <thead><tr><th>Item</th><th>Unidade</th><th class="num">Quantidade total</th><th class="num">Total em reais</th></tr></thead>
        <tbody>${grupos.map((g) => `<tr><td class="forte">${esc(g.descricao)}</td><td>${esc(g.unidade || '—')}</td><td class="num">${fmtNum2(g.quantidade)}</td><td class="num forte">${fmtBRL(g.valor)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total dos itens</td><td class="num">${fmtBRL(soma(grupos.map((g) => g.valor)))}</td></tr></tfoot>
      </table>` : vazioHTML('Nenhum item detalhado encontrado para a empresa no ano e filtro selecionados.', 'catalogo')}
    </div>
  </section>`;
}

let filtroTipo = null;

export function cabecalhoEmpresa(e, ativa, extraDireita = '') {
  return `<section class="hero chanfro">
    ${grafismo('hero-grafismo')}
    <div style="display:flex;gap:18px;align-items:center">
      <span class="hero-empresa-marca chanfro" style="background:${corEmpresa(e)};${corEmpresa(e) === '#7FE06C' || corEmpresa(e) === '#BDCCD4' ? 'color:#001E36' : ''}">${esc(e.nome.slice(0, 3).toUpperCase())}</span>
      <div>
        <div class="hero-kicker">Empresa contratada · ${store.ano}</div>
        <h1>${esc(e.nome)}</h1>
        <p>${esc(e.descricao || e.razao_social || '')}</p>
        <div class="segmentado" style="margin-top:14px">
          <button onclick="location.hash='#/empresa/${e.slug}/dashboard'" class="${ativa === 'dashboard' ? 'ativo' : ''}">${icone('dashboard', 'icon-sm')} Dashboard</button>
          <button onclick="location.hash='#/empresa/${e.slug}/registros'" class="${ativa === 'registros' ? 'ativo' : ''}">${icone('registros', 'icon-sm')} Registros</button>
        </div>
      </div>
    </div>
    ${extraDireita}
  </section>`;
}

export function render(c, { slug }) {
  const e = empresaPorSlug(slug);
  if (!e) { c.innerHTML = vazioHTML('Empresa não encontrada.', 'empresa'); return; }
  const ano = store.ano;
  definirTitulo(`${e.nome} · Dashboard`, [{ rotulo: 'Empresas' }, { rotulo: e.nome, href: `#/empresa/${e.slug}/dashboard` }, { rotulo: 'Dashboard' }]);
  const p = paleta();
  const R = resumo({ ano, empresaId: e.id, tipo: filtroTipo });
  const Rc = resumo({ ano, empresaId: e.id, tipo: 'CAPEX' });
  const Ro = resumo({ ano, empresaId: e.id, tipo: 'OPEX' });
  const C = classificacaoGastos({ ano, empresaId: e.id });
  const contratos = contratosDaEmpresa(e.id).filter((x) => !filtroTipo || x.tipo === filtroTipo
    || store.medicoes.some((m) => m.contrato_id === x.id && m.ano === ano && m.tipo === filtroTipo));
  const rc = contratos.map((ct) => ({ ct, r: resumoContrato(ct, ano) }));
  const valorContratado = soma(rc.filter((x) => x.ct.status !== 'Encerrado').map((x) => x.r.valor));
  const medidoTotal = soma(rc.map((x) => x.r.medido));
  const saldoContratual = soma(rc.filter((x) => x.ct.status !== 'Encerrado').map((x) => x.r.saldo));
  const pend = store.pendencias.filter((x) => x.empresa_id === e.id && x.status !== 'Concluída');
  const meds = store.medicoes.filter((m) => m.empresa_id === e.id && m.ano === ano && (!filtroTipo || m.tipo === filtroTipo));
  const listaAlertas = alertas(ano, e.id);
  const temPrev = R.prev.some((v) => v > 0);
  const rotTipo = filtroTipo ? ` ${filtroTipo}` : '';

  const direita = `<div class="hero-lado">
    <div class="hero-num"><small>Valor contratado</small><strong>${fmtBRL(valorContratado)}</strong></div>
    <div class="hero-num"><small>Medido acumulado</small><strong>${fmtBRL(medidoTotal)}</strong></div>
    <div class="hero-num"><small>Saldo contratual</small><strong style="${saldoContratual < 0 ? 'color:#FFB3B3' : ''}">${fmtBRL(saldoContratual)}</strong></div>
    <div class="segmentado" role="group" aria-label="Filtrar CAPEX/OPEX">${[[null, 'Total'], ['CAPEX', 'CAPEX'], ['OPEX', 'OPEX'], [SEM_CLASS, 'Sem class.']].map(([v, t]) => `<button data-tipo="${v || ''}" class="${filtroTipo === v ? 'ativo' : ''}">${t}</button>`).join('')}</div>
  </div>`;

  c.innerHTML = `<div class="pagina">
    ${cabecalhoEmpresa(e, 'dashboard', direita)}

    ${listaAlertas.filter((a) => a.nivel === 'erro').slice(0, 2).map((a) => `<a class="aviso alerta" href="${a.link}" style="text-decoration:none">${icone(a.icone)}<div><strong>${esc(a.titulo)}</strong><br>${esc(a.detalhe)}</div></a>`).join('')}

    <div class="kpis">
      ${kpi({ rotulo: `Orçamento ${ano}${rotTipo}`, valor: R.orcAnual > 0 ? fmtBRL(R.orcAnual) : '—', icone: 'orcamento', detalhe: filtroTipo ? 'orçamento programado' : `CAPEX ${fmtBRL(Rc.orcAnual)} · OPEX ${fmtBRL(Ro.orcAnual)}` })}
      ${kpi({ rotulo: `Realizado ${ano}`, valor: fmtBRL(R.realAno), icone: 'medicao', cor: 'verde', barra: R.pctConsumido, barraClasse: classeBarra(R.pctConsumido), detalhe: R.pctConsumido === null ? `${meds.filter(medicaoConta).length} medições no ano` : `${fmtPct(R.pctConsumido)} do orçamento` })}
      ${kpi({ rotulo: 'Previsto (forecast)', valor: fmtBRL(R.prevAnual), icone: 'previsao', cor: 'azul-claro', detalhe: `${fmtBRL(soma(R.prev.slice(R.fechados)))} nos meses abertos` })}
      ${kpi({ rotulo: 'Saldo do orçamento', valor: R.orcAnual > 0 ? fmtBRL(R.saldo) : '—', icone: 'carteira', detalhe: R.orcAnual > 0 ? `${R.restantes} ${R.restantes === 1 ? 'mês restante' : 'meses restantes'}` : 'cadastre em Registros → Orçamento' })}
      ${kpi({ rotulo: 'Pode gastar por mês', valor: R.orcAnual > 0 && R.restantes > 0 ? fmtBRL(R.margemMensal) : '—', icone: 'alvo', cor: 'verde-claro', detalhe: filtroTipo ? `margem ${filtroTipo}` : `CAPEX ${Rc.orcAnual > 0 ? fmtBRL(Rc.margemMensal) : '—'} · OPEX ${Ro.orcAnual > 0 ? fmtBRL(Ro.margemMensal) : '—'}` })}
      ${kpi({ rotulo: 'Projeção até dezembro', valor: fmtBRL(R.projAnual), icone: 'tendencia', cor: R.situacao === 'estouro' ? 'laranja' : '', detalhe: `${badgeSituacao(R.situacao)}` })}
    </div>

    ${secaoItens(C.itens, ano, filtroTipo)}

    ${secaoClassificacao(e, C, ano)}

    <div class="grade g-2">
      ${cartaoGrafico({ id: 'eMensal', titulo: 'Gastos mensais: previstos × reais', sub: `${ano}${rotTipo} · barras hachuradas = projeção`, tabela: tabelaDetalhe(R) })}
      ${cartaoGrafico({ id: 'eAder', titulo: 'Aderência ao forecast', sub: 'Realizado ÷ previsto em cada mês (100% = no alvo)', nota: 'Acima de 100%: gastou mais que o previsto; abaixo: gastou menos.' })}
    </div>

    ${cartaoGrafico({ id: 'eCurva', titulo: 'Curva acumulada', sub: 'Orçado × realizado × projeção' })}

    <section class="card">
      <div class="card-cab"><div><h3>Contratos</h3><div class="sub">${contratos.length} contrato(s) · consumo do valor contratado (todos os anos)</div></div>
        <div class="card-acoes so-edicao"><a class="btn btn-secundario btn-sm" href="#/empresa/${e.slug}/registros/contratos">${icone('editar', 'icon-sm')}Gerenciar</a></div></div>
      <div class="card-corpo"><div class="contratos-grid">${rc.length ? rc.map(cartaoContrato).join('') : vazioHTML('Nenhum contrato cadastrado.', 'contrato')}</div></div>
    </section>

    <div class="grade g-2">
      ${cartaoGrafico({ id: 'eStatus', titulo: 'Medições por status', sub: `${ano}${rotTipo} — valor por situação`, alturaClasse: 'grafico-sm' })}
      <section class="card">
        <div class="card-cab"><div><h3>Pendências em aberto</h3><div class="sub">${pend.length} item(ns)</div></div>
          <div class="card-acoes so-edicao"><a class="btn btn-secundario btn-sm" href="#/empresa/${e.slug}/registros/pendencias">${icone('lista', 'icon-sm')}Ver todas</a></div></div>
        <div class="card-corpo"><div class="lista rolavel" style="max-height:260px">${pend.length ? pend.map((x) => `<div class="lista-item"><span class="lista-icone ${x.prioridade === 'Alta' ? 'erro' : x.prioridade === 'Média' ? 'alerta' : 'info'}">${icone('pendencia', 'icon-sm')}</span><div class="lista-texto"><strong>${esc(x.titulo)}</strong><span>${esc([x.responsavel, x.prazo ? `prazo ${fmtData(x.prazo)}` : null, x.descricao].filter(Boolean).join(' · '))}</span></div><div style="text-align:right">${x.valor ? `<b class="num" style="display:block">${fmtBRL(x.valor)}</b>` : ''}${badgePrioridade(x.prioridade)}</div></div>`).join('') : vazioHTML('Sem pendências em aberto.', 'check')}</div></div>
      </section>
    </div>

    <section class="card">
      <div class="card-cab"><div><h3>Detalhamento mensal ${ano}${rotTipo}</h3><div class="sub">Orçado, previsto, realizado, desvio e aderência</div></div></div>
      <div class="card-corpo sem-padding tabela-wrap">${tabelaMensalHTML(R)}</div>
    </section>
  </div>`;

  c.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { filtroTipo = b.dataset.tipo || null; window.dispatchEvent(new Event('gf:rerender')); }));
  ligarAlternancias(c);

  grafico('eMensal', opcaoMensal(R));
  if (temPrev) {
    const ader = R.aderencia.map((v) => (v === null ? null : Math.round(v * 1000) / 10));
    grafico('eAder', {
      tooltip: { trigger: 'axis', formatter: (ps) => { const x = ps[0]; const i = x.dataIndex; return x.value === null || x.value === undefined ? '' : `<div class="tt-titulo">${MESES_LONGOS[i]}</div><div class="tt-linha">${x.marker}<span>Aderência</span><b>${x.value.toLocaleString('pt-BR')}%</b></div><div class="tt-linha"><span>Previsto</span><b>${fmtBRL(R.prev[i])}</b></div><div class="tt-linha"><span>Realizado</span><b>${fmtBRL(R.real[i])}</b></div>`; } },
      legend: { show: false },
      xAxis: eixoMeses(),
      yAxis: eixoValor({ axisLabel: { formatter: (v) => `${v}%` } }),
      series: [{
        name: 'Aderência', type: 'bar', barMaxWidth: 26,
        data: ader.map((v) => (v === null ? null : { value: v, itemStyle: { color: v > 110 ? p.projecao : v < 90 ? p.previsto : p.realizado, ...pontaBarra() } })),
        label: { show: true, position: 'top', color: p.texto, fontSize: 11, formatter: (q) => (q.value === null || q.value === undefined ? '' : `${Math.round(q.value)}%`) },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: p.suave, type: 'dashed' }, label: { formatter: 'alvo 100%', color: p.suave, position: 'insideEndTop' }, data: [{ yAxis: 100 }] },
      }],
    });
  } else {
    document.getElementById('eAder').innerHTML = vazioHTML('Cadastre previsões (forecast) em Registros → Previsões para medir a aderência.', 'previsao');
  }
  grafico('eCurva', opcaoCurvaAcumulada(R));
  if (C.total > 0) {
    grafico('eClassMes', opcaoClassMensal(C.porMes));
    grafico('eTipo', opcaoClassRosca(C.tot));
  }
  c.querySelector('#clsCsv')?.addEventListener('click', () => baixarCSV(`itens-classificacao-${e.slug}-${ano}.csv`, [
    { rotulo: 'Empresa', valor: () => e.nome }, { rotulo: 'Ano', valor: 'ano' }, { rotulo: 'Mês', valor: 'mes' },
    { rotulo: 'Encarregado', valor: 'encarregado' }, { rotulo: 'Aba', valor: 'aba' }, { rotulo: 'OS', valor: 'ordem_servico' }, { rotulo: 'Atividade', valor: 'atividade' },
    { rotulo: 'Código', valor: 'codigo_servico' }, { rotulo: 'Serviço', valor: 'descricao' }, { rotulo: 'Unidade', valor: 'unidade' },
    { rotulo: 'Quantidade', valor: 'quantidade' }, { rotulo: 'Valor unitário', valor: 'valor_unitario' }, { rotulo: 'Valor', valor: 'valor' },
    { rotulo: 'Classificação', valor: 'classificacao' }, { rotulo: 'Arquivo', valor: 'arquivo' },
  ], [...C.itens].sort((a, b) => a.mes - b.mes || String(a.encarregado).localeCompare(String(b.encarregado)))));

  const porStatus = STATUS_MEDICAO.map((s) => ({ s, v: soma(meds.filter((m) => m.status === s).map((m) => m.valor)), n: meds.filter((m) => m.status === s).length })).filter((x) => x.n > 0);
  if (porStatus.length) {
    const corStatus = { 'Paga': p.realizado, 'Aprovada': p.previsto, 'Em aprovação': p.alerta, 'Em elaboração': p.suave, 'Glosada': p.erro, 'Cancelada': p.trilho };
    grafico('eStatus', {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => { const x = porStatus[ps[0].dataIndex]; return `<div class="tt-titulo">${esc(x.s)}</div><div class="tt-linha"><span>Valor</span><b>${fmtBRL(x.v)}</b></div><div class="tt-linha"><span>Quantidade</span><b>${x.n}</b></div>`; } },
      legend: { show: false },
      grid: { left: 6, right: 170, top: 10, bottom: 4, containLabel: true },
      xAxis: eixoValor(),
      yAxis: { type: 'category', data: porStatus.map((x) => x.s), axisTick: { show: false }, axisLine: { lineStyle: { color: p.grade } }, axisLabel: { color: p.texto } },
      series: [{ name: 'Valor', type: 'bar', barMaxWidth: 18, data: porStatus.map((x) => ({ value: Math.round(x.v), itemStyle: { color: corStatus[x.s], ...pontaBarra(true) } })), label: { show: true, position: 'right', color: p.texto, fontSize: 11, formatter: (q) => `${porStatus[q.dataIndex].n} · ${fmtBRL(q.value)}` } }],
    });
  } else {
    document.getElementById('eStatus').innerHTML = vazioHTML('Nenhuma medição no ano.', 'medicao');
  }
}

function cartaoContrato({ ct, r }) {
  const pct = r.pct ?? 0;
  return `<article class="card contrato-card" style="box-shadow:none">
    <div class="contrato-cab"><div style="min-width:0"><h3>${esc(ct.titulo)}</h3><div class="muted small">SAP ${esc(ct.contrato_sap || '—')}${ct.contrato_ariba ? ` · Ariba ${esc(ct.contrato_ariba)}` : ''}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${badgeTipo(ct.tipo)}${badgeStatusContrato(ct.status)}</div></div>
    <div><div class="progresso"><span class="${r.nivel === 'erro' ? 'erro' : r.nivel === 'alerta' ? 'alerta' : ''}" style="width:${Math.min(100, pct * 100)}%"></span></div>
      <div class="progresso-legenda"><span>${fmtPct(r.pct)} medido</span><span>${fmtBRL(r.medido)} de ${fmtBRL(r.valor)}</span></div></div>
    <div class="contrato-meta">
      <div><span>Saldo contratual</span><b style="${r.saldo < 0 ? 'color:var(--c-erro)' : ''}">${fmtBRL(r.saldo)}</b></div>
      <div><span>Saldo SAP${ct.saldo_sap_data ? ` (${fmtData(ct.saldo_sap_data)})` : ''}</span><b>${fmtBRL(ct.saldo_sap)}</b></div>
      <div><span>Ritmo (média 3 meses)</span><b>${fmtBRL(r.ritmo)}</b></div>
      <div><span>Cobertura do saldo</span><b>${r.cobertura === null ? '—' : r.cobertura < 0 ? 'esgotado' : `${r.cobertura.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses`}</b></div>
      <div><span>PEP</span><b title="${esc(ct.pep || '')}">${esc(ct.pep || '—')}</b></div>
      <div><span>Previsto a realizar</span><b>${fmtBRL(r.previstoFuturo)}</b></div>
    </div>
  </article>`;
}

function tabelaDetalhe(R) {
  return {
    colunas: [{ rotulo: 'Mês' }, { rotulo: 'Orçado', num: true }, { rotulo: 'Previsto', num: true }, { rotulo: 'Realizado', num: true }, { rotulo: 'Projeção', num: true }],
    linhas: MESES.map((m, i) => [m, fmtBRL(R.orc[i]), fmtBRL(R.prev[i] || null), fmtBRL(R.real[i]), fmtBRL(R.proj[i])]),
  };
}

function tabelaMensalHTML(R) {
  const linhas = MESES_LONGOS.map((m, i) => {
    const desvio = R.orc[i] > 0 ? R.real[i] - R.orc[i] : null;
    const fechado = i < R.fechados;
    return `<tr><td class="forte">${m}${fechado ? '' : ' <span class="badge b-neutro">aberto</span>'}</td>
      <td class="num">${fmtBRL(R.orc[i] || null)}</td><td class="num">${fmtBRL(R.prev[i] || null)}</td><td class="num forte">${fmtBRL(R.real[i] || null)}</td>
      <td class="num" style="${desvio > 0 ? 'color:var(--c-erro)' : desvio < 0 ? 'color:var(--c-sucesso)' : ''}">${desvio === null ? '—' : fmtBRL(desvio)}</td>
      <td class="num">${R.aderencia[i] === null ? '—' : fmtPct(R.aderencia[i])}</td><td class="num muted">${fechado ? '—' : fmtBRL(R.proj[i])}</td></tr>`;
  }).join('');
  return `<table class="tabela"><thead><tr><th>Mês</th><th class="num">Orçado</th><th class="num">Previsto</th><th class="num">Realizado</th><th class="num">Desvio (real − orçado)</th><th class="num">Aderência</th><th class="num">Projeção</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td>Total ${R.ano}</td><td class="num">${fmtBRL(R.orcAnual)}</td><td class="num">${fmtBRL(R.prevAnual)}</td><td class="num">${fmtBRL(R.realAno)}</td><td class="num">${R.orcAnual ? fmtBRL(R.realAno - R.orcAnual) : '—'}</td><td class="num">—</td><td class="num">${fmtBRL(R.projAnual)}</td></tr></tfoot></table>`;
}
