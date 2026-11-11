// =====================================================================
// Painel geral — visão gerencial consolidada de todas as empresas
// =====================================================================
import { store, empresasAtivas, contratosDaEmpresa, podeEditar } from '../state.js';
import { resumo, resumoContrato, alertas, saldoProjetadoMensal } from '../calc.js';
import { grafico, cartaoGrafico, ligarAlternancias, paleta, corEmpresa, eixoMeses, eixoValor, tooltipEixo, tooltipItem, pontaBarra, sparkline } from '../charts.js';
import { definirTitulo } from '../ui/shell.js';
import { icone, grafismo } from '../icons.js';
import { fmtBRL, fmtPct, MESES, MESES_LONGOS, esc, soma, acumular, badgeSituacao, badgeTipo, vazioHTML, fmtEixo } from '../utils.js';

let filtroTipo = null; // null = total | 'CAPEX' | 'OPEX'

const rotuloTipo = () => (filtroTipo ? ` ${filtroTipo}` : '');

export function kpi({ rotulo, valor, detalhe = '', icone: ic = 'moedas', cor = '', barra = null, barraClasse = '' }) {
  return `<div class="card kpi">
    <div class="kpi-topo"><span class="kpi-rotulo">${rotulo}</span><span class="kpi-icone chanfro ${cor}">${icone(ic, 'icon-sm')}</span></div>
    <div class="kpi-valor">${valor}</div>
    ${barra !== null ? `<div class="kpi-barra"><span class="${barraClasse}" style="width:${Math.max(0, Math.min(100, barra * 100))}%"></span></div>` : ''}
    <div class="kpi-detalhe">${detalhe}</div>
  </div>`;
}

export function classeBarra(pct) { return pct === null ? '' : pct > 1 ? 'erro' : pct > 0.9 ? 'alerta' : ''; }

/** Série acumulada de projeção a partir do último mês fechado. */
export function serieProjecaoAcumulada(R) {
  const out = Array(12).fill(null);
  let acum = R.realFechado;
  if (R.fechados > 0) out[R.fechados - 1] = acum;
  for (let i = R.fechados; i < 12; i++) { acum += R.proj[i] || 0; out[i] = acum; }
  return out;
}
export function serieRealAcumulada(R) {
  let ultimo = R.fechados - 1;
  R.real.forEach((v, i) => { if (v > 0 && i > ultimo) ultimo = i; });
  const ac = acumular(R.real);
  return ac.map((v, i) => (i <= ultimo ? v : null));
}

export function opcaoCurvaAcumulada(R) {
  const p = paleta();
  const temOrc = R.orcAnual > 0;
  return {
    legend: { data: [temOrc ? 'Orçado acumulado' : null, 'Realizado acumulado', 'Projeção'].filter(Boolean) },
    tooltip: tooltipEixo(fmtBRL, 'line'),
    xAxis: eixoMeses({ boundaryGap: false }),
    yAxis: eixoValor(),
    series: [
      temOrc ? { name: 'Orçado acumulado', type: 'line', data: acumular(R.orc), symbol: 'none', lineStyle: { width: 2, color: p.orcado, type: [6, 4] }, itemStyle: { color: p.orcado } } : null,
      { name: 'Realizado acumulado', type: 'line', data: serieRealAcumulada(R), symbol: 'circle', symbolSize: 8, lineStyle: { width: 2.5, color: p.realizado }, itemStyle: { color: p.realizado, borderColor: p.superficie, borderWidth: 2 }, areaStyle: { color: p.realizado, opacity: 0.12 } },
      { name: 'Projeção', type: 'line', data: serieProjecaoAcumulada(R), symbol: 'circle', symbolSize: 8, lineStyle: { width: 2, color: p.projecao, type: 'dashed' }, itemStyle: { color: p.projecao, borderColor: p.superficie, borderWidth: 2 } },
    ].filter(Boolean),
  };
}

export function opcaoMensal(R) {
  const p = paleta();
  const projBarras = R.proj.map((v, i) => (v === null ? null : Math.max(0, v - R.real[i])));
  return {
    legend: { data: ['Orçado', 'Realizado', 'Projeção', 'Previsto (forecast)'] },
    tooltip: tooltipEixo(fmtBRL),
    xAxis: eixoMeses(),
    yAxis: eixoValor(),
    series: [
      { name: 'Orçado', type: 'bar', data: R.orc, barGap: '12%', barMaxWidth: 22, itemStyle: { color: p.orcado, ...pontaBarra() } },
      { name: 'Realizado', type: 'bar', stack: 'gasto', data: R.real, barMaxWidth: 22, itemStyle: { color: p.realizado, ...pontaBarra() } },
      { name: 'Projeção', type: 'bar', stack: 'gasto', data: projBarras, barMaxWidth: 22, itemStyle: { color: p.projecao, opacity: 0.85, decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [3, 4], rotation: -Math.PI / 4, color: 'rgba(255,255,255,.45)' }, ...pontaBarra() } },
      { name: 'Previsto (forecast)', type: 'line', data: R.prev.map((v) => (v > 0 ? v : null)), symbol: 'diamond', symbolSize: 10, connectNulls: false, lineStyle: { width: 0 }, itemStyle: { color: p.previsto, borderColor: p.superficie, borderWidth: 2 } },
    ],
  };
}

export function opcaoGauge(R) {
  const p = paleta();
  const pct = R.pctConsumido === null ? 0 : R.pctConsumido * 100;
  const cor = pct > 100 ? p.erro : pct > 90 ? p.alerta : p.realizado;
  const series = [{
    type: 'gauge', startAngle: 215, endAngle: -35, min: 0, max: 100, radius: '92%', center: ['50%', '56%'],
    progress: { show: true, width: 16, roundCap: true, itemStyle: { color: cor } },
    axisLine: { roundCap: true, lineStyle: { width: 16, color: [[1, p.trilho]] } },
    pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, anchor: { show: false },
    title: { show: true, offsetCenter: [0, '26%'], color: p.suave, fontSize: 12 },
    detail: { valueAnimation: true, offsetCenter: [0, '-6%'], fontSize: 30, fontWeight: 700, color: p.titulo, formatter: () => (R.pctConsumido === null ? '—' : fmtPct(R.pctConsumido)) },
    data: [{ value: Math.min(100, pct), name: 'do orçamento consumido' }],
  }];
  if (R.pctEsperado !== null) {
    series.push({
      type: 'gauge', startAngle: 215, endAngle: -35, min: 0, max: 100, radius: '92%', center: ['50%', '56%'],
      axisLine: { show: false }, splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, detail: { show: false }, title: { show: false }, anchor: { show: false },
      pointer: { show: true, icon: 'rect', length: '16%', width: 4, offsetCenter: [0, '-80%'], itemStyle: { color: p.projecao } },
      data: [{ value: Math.min(100, R.pctEsperado * 100), name: 'Esperado até o mês' }],
      tooltip: { formatter: () => `Orçado até o último mês fechado: <b>${fmtPct(R.pctEsperado)}</b>` },
    });
  }
  return { tooltip: { trigger: 'item' }, series };
}

export function render(c) {
  const ano = store.ano;
  definirTitulo('Painel geral', [{ rotulo: `Ano ${ano}` }]);
  const empresas = empresasAtivas();
  const p = paleta();
  const R = resumo({ ano, tipo: filtroTipo });
  const Rcapex = resumo({ ano, tipo: 'CAPEX' });
  const Ropex = resumo({ ano, tipo: 'OPEX' });
  const linhas = empresas.map((e) => ({
    e,
    r: resumo({ ano, empresaId: e.id, tipo: filtroTipo }),
    capex: resumo({ ano, empresaId: e.id, tipo: 'CAPEX' }),
    opex: resumo({ ano, empresaId: e.id, tipo: 'OPEX' }),
  }));
  const contratosAtivos = store.contratos.filter((x) => x.status !== 'Encerrado' && empresas.some((e) => e.id === x.empresa_id));
  const listaAlertas = alertas(ano);
  const mesesRest = MESES.slice(R.fechados);
  const nomeMesAberto = R.fechados < 12 ? MESES_LONGOS[R.fechados] : null;
  const anel = R.pctConsumido === null ? 0 : Math.min(100, R.pctConsumido * 100);

  const segmento = `<div class="segmentado" role="group" aria-label="Filtrar CAPEX/OPEX">
      ${[[null, 'Total'], ['CAPEX', 'CAPEX'], ['OPEX', 'OPEX']].map(([v, t]) => `<button data-tipo="${v || ''}" class="${filtroTipo === v ? 'ativo' : ''}">${t}</button>`).join('')}
    </div>`;

  c.innerHTML = `<div class="pagina">
    <section class="hero chanfro">
      ${grafismo('hero-grafismo')}
      <div>
        <div class="hero-kicker">Painel geral · ${ano}</div>
        <h1>Orçamento de contratos${esc(rotuloTipo())}</h1>
        <p>${nomeMesAberto ? `Mês de referência: <b>${nomeMesAberto}</b> · ${R.restantes} ${R.restantes === 1 ? 'mês restante' : 'meses restantes'}` : 'Ano encerrado'} · ${empresas.length} empresas · ${contratosAtivos.length} contratos ativos</p>
        <div style="margin-top:16px">${segmento}</div>
      </div>
      <div class="hero-lado">
        <div class="hero-anel ${R.pctConsumido > 1 ? 'estouro' : ''}" style="--p:${anel}"><div><strong>${R.pctConsumido === null ? '—' : fmtPct(R.pctConsumido, 0)}</strong><span>consumido</span></div></div>
        <div class="hero-num"><small>Realizado ${ano}</small><strong>${fmtBRL(R.realAno)}</strong></div>
        <div class="hero-num"><small>Saldo do orçamento</small><strong>${R.orcAnual > 0 ? fmtBRL(R.saldo) : '—'}</strong></div>
        <div class="hero-num"><small>Pode gastar / mês</small><strong>${R.orcAnual > 0 && R.restantes > 0 ? fmtBRL(R.margemMensal) : '—'}</strong></div>
      </div>
    </section>

    ${R.orcAnual === 0 ? `<div class="aviso alerta">${icone('alerta')}<div><strong>O orçamento${esc(rotuloTipo())} de ${ano} ainda não foi cadastrado.</strong><br>Cadastre por empresa em <b>Registros → Orçamento</b> para liberar saldo, margem mensal e alertas de estouro. Os gráficos abaixo já mostram o realizado e o previsto.</div>
      <div class="filtros so-edicao" style="margin-left:auto">${podeEditar() ? empresas.map((e) => `<a class="btn btn-secundario btn-sm" href="#/empresa/${e.slug}/registros/orcamento">${esc(e.nome)}</a>`).join('') : ''}</div></div>` : ''}

    <div class="kpis">
      ${kpi({ rotulo: `Orçamento ${ano}`, valor: fmtBRL(R.orcAnual), icone: 'orcamento', detalhe: filtroTipo ? `${filtroTipo}` : `CAPEX ${fmtBRL(Rcapex.orcAnual)} · OPEX ${fmtBRL(Ropex.orcAnual)}` })}
      ${kpi({ rotulo: 'Realizado no ano', valor: fmtBRL(R.realAno), icone: 'medicao', cor: 'verde', barra: R.pctConsumido, barraClasse: classeBarra(R.pctConsumido), detalhe: R.pctConsumido === null ? 'sem orçamento para comparar' : `${fmtPct(R.pctConsumido)} do orçamento` })}
      ${kpi({ rotulo: 'Saldo disponível', valor: R.orcAnual > 0 ? fmtBRL(R.saldo) : '—', icone: 'carteira', cor: 'azul-claro', detalhe: R.orcAnual > 0 ? `para ${R.restantes} ${R.restantes === 1 ? 'mês' : 'meses'} (${mesesRest.join(', ') || '—'})` : 'cadastre o orçamento' })}
      ${kpi({ rotulo: 'Margem mensal segura', valor: R.orcAnual > 0 && R.restantes > 0 ? fmtBRL(R.margemMensal) : '—', icone: 'alvo', cor: 'verde-claro', detalhe: 'quanto pode gastar por mês sem estourar' })}
      ${kpi({ rotulo: 'Projeção até dezembro', valor: fmtBRL(R.projAnual), icone: 'tendencia', cor: R.situacao === 'estouro' ? 'laranja' : '', detalhe: `${badgeSituacao(R.situacao)}${R.pctProjetado !== null ? ` ${fmtPct(R.pctProjetado)} do orçamento` : ''}` })}
      ${kpi({ rotulo: 'Ritmo atual', valor: fmtBRL(R.ritmo), icone: 'relogio', detalhe: `média/mês dos últimos 3 meses · forecast ${fmtBRL(soma(R.prev.slice(R.fechados)))} a realizar` })}
    </div>

    <div class="grade g-2-1">
      ${cartaoGrafico({ id: 'gCurva', titulo: 'Curva acumulada do ano', sub: 'Orçado × realizado × projeção até dezembro', tabela: tabelaMensal(R, true), nota: 'Projeção = forecast cadastrado; sem forecast, usa o ritmo médio dos últimos 3 meses fechados.' })}
      <section class="card">
        <div class="card-cab"><div><h3>Consumo do orçamento</h3><div class="sub">Realizado ÷ orçamento anual${esc(rotuloTipo())}</div></div></div>
        <div class="card-corpo">
          ${R.orcAnual > 0 ? '<div id="gGauge" class="grafico grafico-sm"></div>' : vazioHTML('Cadastre o orçamento para ver o consumo.', 'orcamento')}
          <div class="lista" style="margin-top:6px">
            <div class="lista-item"><div class="lista-texto"><strong>Esperado até ${R.fechados ? MESES_LONGOS[R.fechados - 1] : '—'}</strong><span>parcela do orçamento já programada</span></div><b class="num">${fmtPct(R.pctEsperado)}</b></div>
            <div class="lista-item"><div class="lista-texto"><strong>Desvio até o mês</strong><span>realizado − orçado (meses fechados)</span></div><b class="num" style="color:${R.desvioAteMes > 0 ? 'var(--c-erro)' : 'var(--c-sucesso)'}">${R.orcAnual > 0 ? fmtBRL(R.desvioAteMes) : '—'}</b></div>
            <div class="lista-item"><div class="lista-texto"><strong>Estouro previsto</strong><span>projeção − orçamento</span></div><b class="num">${R.orcAnual > 0 ? (R.estouroPrevisto > 0 ? fmtBRL(R.estouroPrevisto) : 'Nenhum') : '—'}</b></div>
          </div>
        </div>
      </section>
    </div>

    ${cartaoGrafico({ id: 'gMensal', titulo: 'Orçado × realizado × previsto por mês', sub: `Barras hachuradas = projeção dos meses abertos · losangos = forecast cadastrado`, tabela: tabelaMensal(R) })}

    <section class="card">
      <div class="card-cab"><div><h3>Quanto ainda posso gastar por mês</h3><div class="sub">Saldo do orçamento ÷ ${R.restantes} ${R.restantes === 1 ? 'mês restante' : 'meses restantes'} (${mesesRest.join(', ') || 'ano encerrado'}), por empresa e natureza</div></div></div>
      <div class="card-corpo sem-padding tabela-wrap">${tabelaMargens(linhas)}</div>
    </section>

    ${cartaoGrafico({ id: 'gProjEmp', titulo: 'Projeção de gasto mês a mês até dezembro', sub: `Por empresa${esc(rotuloTipo())} · forecast ou ritmo atual`, tabela: tabelaProjEmpresas(linhas, R) })}
    <section class="card">
      <div class="card-cab"><div><h3>Saldo projetado mês a mês</h3><div class="sub">Se o ritmo/forecast se confirmar${esc(rotuloTipo())}</div></div></div>
      <div class="card-corpo sem-padding tabela-wrap">${tabelaSaldoProjetado(R)}</div>
    </section>

    <div class="grade g-3">
      ${cartaoGrafico({ id: 'gDonutEmp', titulo: 'Realizado por empresa', sub: `${ano}${esc(rotuloTipo())}`, alturaClasse: 'grafico-sm', tabela: { colunas: [{ rotulo: 'Empresa' }, { rotulo: 'Realizado', num: true }, { rotulo: '%', num: true }], linhas: linhas.map((l) => [esc(l.e.nome), fmtBRL(l.r.realAno), fmtPct(R.realAno ? l.r.realAno / R.realAno : null)]) } })}
      ${cartaoGrafico({ id: 'gDonutTipo', titulo: 'CAPEX × OPEX', sub: `Realizado em ${ano}`, alturaClasse: 'grafico-sm', tabela: { colunas: [{ rotulo: 'Natureza' }, { rotulo: 'Orçado', num: true }, { rotulo: 'Realizado', num: true }], linhas: [['CAPEX', fmtBRL(Rcapex.orcAnual), fmtBRL(Rcapex.realAno)], ['OPEX', fmtBRL(Ropex.orcAnual), fmtBRL(Ropex.realAno)]] } })}
      ${cartaoGrafico({ id: 'gBarEmp', titulo: 'Orçado × realizado por empresa', sub: `${ano}${esc(rotuloTipo())}`, alturaClasse: 'grafico-sm', tabela: { colunas: [{ rotulo: 'Empresa' }, { rotulo: 'Orçado', num: true }, { rotulo: 'Realizado', num: true }], linhas: linhas.map((l) => [esc(l.e.nome), fmtBRL(l.r.orcAnual), fmtBRL(l.r.realAno)]) } })}
    </div>

    ${cartaoGrafico({ id: 'gHeat', titulo: 'Mapa de calor do realizado', sub: 'Empresa × mês — quanto mais escuro, maior o gasto', alturaClasse: 'grafico-sm' })}

    <div class="grade g-2">
      ${cartaoGrafico({ id: 'gContratos', titulo: 'Saúde dos contratos', sub: 'Medido acumulado × saldo contratual (todos os anos)', alturaClasse: 'grafico-lg', tabela: tabelaContratos(contratosAtivos) })}
      <section class="card">
        <div class="card-cab"><div><h3>Alertas gerenciais</h3><div class="sub">${listaAlertas.length} ponto(s) de atenção</div></div></div>
        <div class="card-corpo"><div class="lista rolavel">${listaAlertas.length ? listaAlertas.map((a) => `<a class="lista-item" href="${a.link}" style="text-decoration:none"><span class="lista-icone ${a.nivel}">${icone(a.icone, 'icon-sm')}</span><span class="lista-texto"><strong>${esc(a.titulo)}</strong><span>${esc(a.detalhe)}</span></span>${icone('direita', 'icon-sm muted')}</a>`).join('') : vazioHTML('Nenhum alerta no momento. Tudo em movimento!', 'check')}</div></div>
      </section>
    </div>

    <section>
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px"><h2>Empresas contratadas</h2><span class="muted small">Clique para abrir o dashboard</span></div>
      <div class="empresas-grid">${linhas.map(cartaoEmpresa).join('')}</div>
    </section>
  </div>`;

  // ----- interações -----
  c.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { filtroTipo = b.dataset.tipo || null; window.dispatchEvent(new Event('gf:rerender')); }));
  ligarAlternancias(c);

  // ----- gráficos -----
  grafico('gCurva', opcaoCurvaAcumulada(R));
  if (R.orcAnual > 0) grafico('gGauge', opcaoGauge(R));
  grafico('gMensal', opcaoMensal(R));

  // projeção por empresa (meses restantes)
  const idxRest = Array.from({ length: R.restantes }, (_, i) => R.fechados + i);
  if (R.restantes > 0) {
    grafico('gProjEmp', {
      legend: { type: 'scroll', data: linhas.map((l) => l.e.nome) },
      tooltip: tooltipEixo(fmtBRL),
      xAxis: { ...eixoMeses(), data: idxRest.map((i) => MESES[i]) },
      yAxis: eixoValor(),
      series: linhas.map((l, k) => ({
        name: l.e.nome, type: 'bar', stack: 'proj', barMaxWidth: 48,
        data: idxRest.map((i) => Math.round(l.r.proj[i] || 0)),
        itemStyle: { color: corEmpresa(l.e), borderColor: p.superficie, borderWidth: 1, ...(k === linhas.length - 1 ? pontaBarra() : {}) },
      })),
    });
  } else {
    document.getElementById('gProjEmp').innerHTML = vazioHTML('Ano encerrado — não há meses a projetar.', 'calendario');
  }

  grafico('gDonutEmp', {
    tooltip: tooltipItem(),
    legend: { type: 'scroll', bottom: 0, top: 'auto', left: 'center' },
    series: [{
      name: 'Realizado', type: 'pie', radius: ['63%', '86%'], center: ['50%', '45%'], padAngle: 1,
      itemStyle: { borderColor: p.superficie, borderWidth: 2, borderRadius: 4 },
      label: { show: true, position: 'center', formatter: () => `{a|${fmtBRL(R.realAno)}}\n{b|realizado}`, rich: { a: { fontSize: 12.5, fontWeight: 700, color: p.titulo }, b: { fontSize: 11, color: p.suave, padding: [4, 0, 0, 0] } } },
      emphasis: { scale: true, scaleSize: 6 },
      data: linhas.filter((l) => l.r.realAno > 0).map((l) => ({ name: l.e.nome, value: Math.round(l.r.realAno), itemStyle: { color: corEmpresa(l.e) } })),
    }],
  });
  grafico('gDonutTipo', {
    tooltip: tooltipItem(),
    legend: { bottom: 0, top: 'auto', left: 'center' },
    series: [{
      name: 'Realizado', type: 'pie', radius: ['63%', '86%'], center: ['50%', '46%'], padAngle: 1,
      itemStyle: { borderColor: p.superficie, borderWidth: 2, borderRadius: 4 },
      label: { show: true, position: 'center', formatter: () => `{a|${fmtBRL(Rcapex.realAno + Ropex.realAno)}}\n{b|realizado}`, rich: { a: { fontSize: 12.5, fontWeight: 700, color: p.titulo }, b: { fontSize: 11, color: p.suave, padding: [4, 0, 0, 0] } } },
      data: [
        { name: 'CAPEX', value: Math.round(Rcapex.realAno), itemStyle: { color: p.capex } },
        { name: 'OPEX', value: Math.round(Ropex.realAno), itemStyle: { color: p.opex } },
      ],
    }],
  });
  const ordenadas = [...linhas].sort((a, b) => a.r.realAno - b.r.realAno);
  grafico('gBarEmp', {
    legend: { data: ['Orçado', 'Realizado'] },
    tooltip: tooltipEixo(fmtBRL),
    grid: { left: 6, right: 18, top: 36, bottom: 4, containLabel: true },
    xAxis: eixoValor({ splitNumber: 3 }),
    yAxis: { type: 'category', data: ordenadas.map((l) => l.e.nome), axisTick: { show: false }, axisLine: { lineStyle: { color: p.grade } }, axisLabel: { color: p.texto } },
    series: [
      { name: 'Orçado', type: 'bar', data: ordenadas.map((l) => Math.round(l.r.orcAnual)), barMaxWidth: 12, barGap: '20%', itemStyle: { color: p.orcado, ...pontaBarra(true) } },
      { name: 'Realizado', type: 'bar', data: ordenadas.map((l) => Math.round(l.r.realAno)), barMaxWidth: 12, itemStyle: { color: p.realizado, ...pontaBarra(true) } },
    ],
  });

  const heat = [];
  let maxHeat = 0;
  linhas.forEach((l, y) => l.r.real.forEach((v, x) => { heat.push([x, y, Math.round(v) || '-']); if (v > maxHeat) maxHeat = v; }));
  grafico('gHeat', {
    tooltip: { trigger: 'item', formatter: (x) => `<div class="tt-titulo">${esc(linhas[x.value[1]].e.nome)} · ${MESES_LONGOS[x.value[0]]}</div><div class="tt-linha"><span>Realizado</span><b>${x.value[2] === '-' ? '—' : fmtBRL(x.value[2])}</b></div>` },
    legend: { show: false },
    grid: { left: 6, right: 90, top: 8, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: MESES, splitArea: { show: false }, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: p.suave } },
    yAxis: { type: 'category', data: linhas.map((l) => l.e.nome), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: p.texto } },
    visualMap: { min: 0, max: Math.max(1, maxHeat), calculable: false, orient: 'vertical', right: 0, top: 'middle', itemHeight: 120, itemWidth: 12, inRange: { color: p.seq }, textStyle: { color: p.suave }, formatter: (v) => fmtEixo(v) },
    series: [{ name: 'Realizado', type: 'heatmap', data: heat, itemStyle: { borderColor: p.superficie, borderWidth: 3, borderRadius: 6 }, emphasis: { itemStyle: { borderColor: p.titulo, borderWidth: 2 } } }],
  });

  const cts = contratosAtivos.map((ct) => ({ ct, r: resumoContrato(ct, ano), e: empresas.find((e) => e.id === ct.empresa_id) }))
    .sort((a, b) => (a.r.pct ?? 0) - (b.r.pct ?? 0));
  grafico('gContratos', {
    legend: { data: ['Medido', 'Saldo'] },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => { const i = ps[0].dataIndex; const x = cts[i]; return `<div class="tt-titulo">${esc(x.e?.nome)} · ${esc(x.ct.titulo)}</div><div class="tt-linha"><span>Valor do contrato</span><b>${fmtBRL(x.r.valor)}</b></div><div class="tt-linha">${ps[0].marker}<span>Medido</span><b>${fmtBRL(x.r.medido)}</b></div><div class="tt-linha">${ps[1]?.marker || ''}<span>Saldo</span><b>${fmtBRL(x.r.saldo)}</b></div><div class="tt-linha"><span>Consumido</span><b>${fmtPct(x.r.pct)}</b></div>`; },
    },
    grid: { left: 206, right: 54, top: 36, bottom: 24, containLabel: false },
    xAxis: eixoValor({ splitNumber: 4 }),
    yAxis: { type: 'category', data: cts.map((x) => `${x.e?.nome} · ${x.ct.titulo}`), axisTick: { show: false }, axisLine: { lineStyle: { color: p.grade } }, axisLabel: { color: p.texto, fontSize: 11, width: 192, overflow: 'truncate', ellipsis: '…' } },
    series: [
      { name: 'Medido', type: 'bar', stack: 'c', barMaxWidth: 16, data: cts.map((x) => ({ value: Math.round(Math.min(x.r.medido, x.r.valor || x.r.medido)), itemStyle: { color: x.r.saldo < 0 ? p.erro : p.realizado } })), itemStyle: { borderColor: p.superficie, borderWidth: 1 } },
      { name: 'Saldo', type: 'bar', stack: 'c', barMaxWidth: 16, data: cts.map((x) => Math.round(Math.max(0, x.r.saldo))), itemStyle: { color: p.trilho, ...pontaBarra(true) },
        label: { show: true, position: 'right', color: p.texto, fontSize: 11, formatter: (q) => fmtPct(cts[q.dataIndex].r.pct, 0) } },
    ],
  });

  linhas.forEach((l) => {
    const elx = document.getElementById(`spark-${l.e.slug}`);
    if (elx) sparkline(elx, l.r.real.map((v, i) => (i < Math.max(l.r.fechados, 1) || v > 0 ? Math.round(v) : null)), corEmpresa(l.e));
  });
}

function tabelaMensal(R, acumulado = false) {
  const ac = { orc: acumular(R.orc), real: acumular(R.real) };
  return {
    colunas: [{ rotulo: 'Mês' }, { rotulo: 'Orçado', num: true }, { rotulo: 'Previsto', num: true }, { rotulo: 'Realizado', num: true }, { rotulo: 'Projeção', num: true }],
    linhas: MESES.map((m, i) => [m,
      fmtBRL(acumulado ? ac.orc[i] : R.orc[i]),
      fmtBRL(R.prev[i] || null),
      fmtBRL(acumulado ? (i < R.fechados ? ac.real[i] : null) : R.real[i]),
      fmtBRL(R.proj[i])]),
  };
}

function celulasMargem(r) {
  if (r.orcAnual === 0 && r.realAno === 0) return '<td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td>';
  const saldoCor = r.saldo < 0 ? 'color:var(--c-erro)' : '';
  return `<td class="num">${fmtBRL(r.orcAnual)}</td><td class="num">${fmtBRL(r.realAno)}</td><td class="num" style="${saldoCor}">${r.orcAnual > 0 ? fmtBRL(r.saldo) : '—'}</td><td class="num forte">${r.orcAnual > 0 && r.restantes > 0 ? fmtBRL(r.margemMensal) : '—'}</td><td>${badgeSituacao(r.situacao, true)}</td>`;
}

function tabelaMargens(linhas) {
  if (!linhas.length) return vazioHTML('Nenhuma empresa cadastrada.');
  const tot = { CAPEX: resumo({ ano: store.ano, tipo: 'CAPEX' }), OPEX: resumo({ ano: store.ano, tipo: 'OPEX' }) };
  const linhaEmpresa = (l) => ['CAPEX', 'OPEX'].map((t, i) => `<tr>
      ${i === 0 ? `<td rowspan="2" style="vertical-align:top"><a class="forte" href="#/empresa/${l.e.slug}/dashboard" style="display:flex;align-items:center;gap:8px"><span class="sb-ponto" style="background:${corEmpresa(l.e)};box-shadow:none"></span>${esc(l.e.nome)}</a></td>` : ''}
      <td>${badgeTipo(t)}</td>${celulasMargem(t === 'CAPEX' ? l.capex : l.opex)}</tr>`).join('');
  return `<table class="tabela tabela-compacta">
    <thead><tr><th>Empresa</th><th>Natureza</th><th class="num">Orçado no ano</th><th class="num">Realizado</th><th class="num">Saldo</th><th class="num">Pode gastar por mês</th><th>Situação</th></tr></thead>
    <tbody>${linhas.map(linhaEmpresa).join('')}</tbody>
    <tfoot>${['CAPEX', 'OPEX'].map((t, i) => `<tr>${i === 0 ? '<td rowspan="2" style="vertical-align:top">Total</td>' : ''}<td>${badgeTipo(t)}</td>${celulasMargem(tot[t])}</tr>`).join('')}</tfoot>
  </table>`;
}

function tabelaSaldoProjetado(R) {
  if (R.restantes === 0) return vazioHTML('Ano encerrado.', 'calendario');
  const saldos = saldoProjetadoMensal(R);
  let linhasHTML = '';
  for (let i = R.fechados; i < 12; i++) {
    const s = saldos[i];
    const margem = R.orcAnual > 0 ? Math.max(0, (R.orcAnual - R.realFechado - soma(R.proj.slice(R.fechados, i))) / (12 - i)) : null;
    linhasHTML += `<tr><td class="forte">${MESES_LONGOS[i]}</td><td class="num">${fmtBRL(R.orc[i] || null)}</td><td class="num">${fmtBRL(R.proj[i])}</td><td class="num" style="${s !== null && s < 0 ? 'color:var(--c-erro);font-weight:700' : ''}">${R.orcAnual > 0 ? fmtBRL(s) : '—'}</td><td class="num forte">${margem === null ? '—' : fmtBRL(margem)}</td></tr>`;
  }
  return `<table class="tabela tabela-compacta"><thead><tr><th>Mês</th><th class="num">Orçado</th><th class="num">Projeção</th><th class="num">Saldo no fim</th><th class="num">Pode gastar</th></tr></thead><tbody>${linhasHTML}</tbody></table>
  <div class="legenda-nota" style="padding:0 16px 16px">${icone('info', 'icon-sm')}<span>"Pode gastar no mês" redistribui o saldo restante pelos meses que faltam, considerando que a projeção dos meses anteriores se confirme.</span></div>`;
}

function tabelaProjEmpresas(linhas, R) {
  const idx = Array.from({ length: R.restantes }, (_, i) => R.fechados + i);
  return {
    colunas: [{ rotulo: 'Empresa' }, ...idx.map((i) => ({ rotulo: MESES[i], num: true })), { rotulo: 'Total', num: true }],
    linhas: linhas.map((l) => [esc(l.e.nome), ...idx.map((i) => fmtBRL(l.r.proj[i])), fmtBRL(soma(idx.map((i) => l.r.proj[i])))]),
  };
}

function tabelaContratos(contratos) {
  return {
    colunas: [{ rotulo: 'Contrato' }, { rotulo: 'Valor', num: true }, { rotulo: 'Medido', num: true }, { rotulo: 'Saldo', num: true }, { rotulo: '%', num: true }],
    linhas: contratos.map((ct) => { const r = resumoContrato(ct); return [esc(ct.titulo), fmtBRL(r.valor), fmtBRL(r.medido), fmtBRL(r.saldo), fmtPct(r.pct)]; }),
  };
}

function cartaoEmpresa(l) {
  const { e, r } = l;
  const nCont = contratosDaEmpresa(e.id).filter((x) => x.status !== 'Encerrado').length;
  return `<article class="card empresa-card" style="--cor:${corEmpresa(e)}">
    <div class="empresa-card-topo"><span class="empresa-sigla chanfro">${esc(e.nome.slice(0, 3).toUpperCase())}</span>
      <div style="min-width:0"><h3>${esc(e.nome)}</h3><div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.descricao || e.razao_social || '')}</div></div></div>
    <div class="empresa-metricas">
      <div><small>Realizado ${store.ano}</small><strong>${fmtBRL(r.realAno)}</strong></div>
      <div><small>Pode gastar/mês</small><strong>${r.orcAnual > 0 && r.restantes > 0 ? fmtBRL(r.margemMensal) : '—'}</strong></div>
      <div><small>Orçamento</small><strong>${r.orcAnual > 0 ? fmtBRL(r.orcAnual) : '—'}</strong></div>
      <div><small>Contratos ativos</small><strong>${nCont}</strong></div>
    </div>
    ${r.orcAnual > 0 ? `<div><div class="progresso"><span class="${classeBarra(r.pctConsumido)}" style="width:${Math.min(100, (r.pctConsumido || 0) * 100)}%"></span></div><div class="progresso-legenda"><span>${fmtPct(r.pctConsumido)} consumido</span><span>${badgeSituacao(r.situacao)}</span></div></div>` : ''}
    <div id="spark-${esc(e.slug)}" class="sparkline" role="img" aria-label="Realizado mensal de ${esc(e.nome)}"></div>
    <div class="empresa-links"><a class="btn btn-primario btn-sm" href="#/empresa/${e.slug}/dashboard">${icone('dashboard', 'icon-sm')}Dashboard</a><a class="btn btn-secundario btn-sm" href="#/empresa/${e.slug}/registros">${icone('registros', 'icon-sm')}Registros</a></div>
  </article>`;
}
