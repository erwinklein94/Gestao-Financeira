// =====================================================================
// Gráficos (ECharts) com a paleta institucional
// Regras: um eixo de valor por gráfico, cores fixas por entidade,
// tooltip em todo gráfico, legenda quando há 2+ séries.
// =====================================================================
import { MESES, fmtBRL, fmtEixo, fmtPct, esc } from './utils.js';
import { icone } from './icons.js';

const ativos = new Set();

export const escuro = () => document.documentElement.getAttribute('data-theme') === 'dark';
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function paleta() {
  const d = escuro();
  return {
    d,
    texto: cssVar('--c-texto'),
    titulo: cssVar('--c-titulo'),
    suave: cssVar('--c-texto-suave'),
    grade: cssVar('--c-grade'),
    superficie: cssVar('--c-superficie'),
    borda: cssVar('--c-borda-forte'),
    // séries de orçamento (identidade fixa)
    orcado: d ? '#BDCCD4' : '#003865',
    previsto: '#32A6E6',
    realizado: d ? '#7FE06C' : '#1E9F7F',
    projecao: '#F78344',
    capex: d ? '#32A6E6' : '#003865',
    opex: d ? '#7FE06C' : '#32A6E6',
    ok: d ? '#7FE06C' : '#1E9F7F',
    alerta: '#FBD300',
    erro: '#D84545',
    trilho: d ? 'rgba(189,204,212,.14)' : '#E5EBEE',
    seq: d ? ['#0A2F4D', '#0F4C78', '#1B6FA8', '#32A6E6', '#8FD0F3'] : ['#EAF5FC', '#B9DFF5', '#6CBDEB', '#1B6FA8', '#003865'],
  };
}

/** Cor da empresa ajustada ao tema (o azul institucional some no fundo escuro). */
export function corEmpresa(e) {
  const c = (e?.cor || '#003865').toUpperCase();
  if (escuro() && (c === '#003865' || c === '#002B4D' || c === '#001E36')) return '#BDCCD4';
  return c;
}

function mesclar(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k]) && typeof b[k] === 'object' && !Array.isArray(b[k]))
      ? mesclar(a[k], b[k]) : b[k];
  }
  return out;
}

export function base() {
  const p = paleta();
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: '"Cera Pro", Verdana, Geneva, Tahoma, sans-serif', color: p.suave, fontSize: 11.5 },
    animationDuration: 650,
    animationEasing: 'cubicOut',
    grid: { left: 6, right: 14, top: 44, bottom: 6, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, itemGap: 16, textStyle: { color: p.texto, fontSize: 12 } },
    tooltip: {
      backgroundColor: p.superficie, borderColor: p.borda, borderWidth: 1, padding: [10, 12],
      textStyle: { color: p.texto, fontSize: 12 },
      extraCssText: 'box-shadow:0 10px 28px rgba(0,30,54,.22);border-radius:10px;',
      confine: true,
    },
  };
}

export const eixoMeses = (extra = {}) => {
  const p = paleta();
  return mesclar({ type: 'category', data: MESES, axisLine: { lineStyle: { color: p.grade } }, axisTick: { show: false }, axisLabel: { color: p.suave } }, extra);
};
export const eixoValor = (extra = {}) => {
  const p = paleta();
  return mesclar({ type: 'value', axisLabel: { color: p.suave, formatter: (v) => fmtEixo(v) }, splitLine: { lineStyle: { color: p.grade, type: 'dashed' } } }, extra);
};

/** Tooltip de eixo com valores em R$. */
export function tooltipEixo(fmt = fmtBRL, tipoPonteiro = 'shadow') {
  return {
    trigger: 'axis',
    axisPointer: { type: tipoPonteiro, shadowStyle: { color: 'rgba(50,166,230,.08)' }, lineStyle: { color: paleta().borda } },
    formatter: (params) => {
      const arr = (Array.isArray(params) ? params : [params]).filter((x) => x.value !== null && x.value !== undefined && x.value !== '-');
      if (!arr.length) return '';
      let s = `<div class="tt-titulo">${esc(arr[0].axisValueLabel ?? arr[0].name)}</div>`;
      for (const x of arr) {
        const v = Array.isArray(x.value) ? x.value[x.value.length - 1] : x.value;
        s += `<div class="tt-linha">${x.marker}<span>${esc(x.seriesName)}</span><b>${fmt(v)}</b></div>`;
      }
      return s;
    },
  };
}
export function tooltipItem(fmt = fmtBRL) {
  return {
    trigger: 'item',
    formatter: (x) => `<div class="tt-titulo">${esc(x.name)}</div><div class="tt-linha">${x.marker}<span>${esc(x.seriesName || '')}</span><b>${fmt(Array.isArray(x.value) ? x.value[x.value.length - 1] : x.value)}</b></div>${x.percent !== undefined ? `<div class="tt-linha"><span>Participação</span><b>${fmtPct(x.percent / 100)}</b></div>` : ''}`,
  };
}

export function grafico(elOuId, opcao) {
  const elemento = typeof elOuId === 'string' ? document.getElementById(elOuId) : elOuId;
  if (!elemento) return null;
  if (!window.echarts) { elemento.innerHTML = '<p class="muted small">Biblioteca de gráficos indisponível (verifique a conexão).</p>'; return null; }
  const c = window.echarts.init(elemento, null, { renderer: 'canvas' });
  c.setOption(mesclar(base(), opcao));
  const ro = new ResizeObserver(() => c.resize());
  ro.observe(elemento);
  c.__ro = ro;
  ativos.add(c);
  return c;
}

export function descartarGraficos() {
  for (const c of ativos) { try { c.__ro?.disconnect(); c.dispose(); } catch (e) { /* ignore */ } }
  ativos.clear();
}

// Barras com cantos arredondados só na ponta de dados
export const pontaBarra = (horizontal = false) => ({ borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] });

/**
 * Cartão de gráfico com alternância Gráfico/Tabela (acessibilidade).
 * tabela: { colunas: [{rotulo, num}], linhas: [[...]] } — valores já formatados.
 */
export function cartaoGrafico({ id, titulo, sub = '', classe = '', alturaClasse = '', tabela = null, acoes = '', nota = '' }) {
  const tid = `${id}-tab`;
  const tabelaHTML = tabela ? `<div class="tabela-wrap" id="${tid}" hidden><table class="tabela tabela-compacta"><thead><tr>${tabela.colunas.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.rotulo)}</th>`).join('')}</tr></thead><tbody>${tabela.linhas.map((l) => `<tr>${l.map((v, i) => `<td class="${tabela.colunas[i]?.num ? 'num' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  return `<section class="card ${classe}">
    <div class="card-cab"><div><h3>${esc(titulo)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      <div class="card-acoes">${acoes}${tabela ? `<button class="btn btn-fantasma btn-sm btn-icone" data-alternar="${id}" title="Alternar gráfico/tabela" aria-label="Alternar gráfico ou tabela">${icone('tabela', 'icon-sm')}</button>` : ''}</div></div>
    <div class="card-corpo"><div id="${id}" class="grafico ${alturaClasse}" role="img" aria-label="${esc(titulo)}"></div>${tabelaHTML}${nota ? `<div class="legenda-nota">${icone('info', 'icon-sm')}<span>${nota}</span></div>` : ''}</div>
  </section>`;
}

export function ligarAlternancias(raiz) {
  raiz.querySelectorAll('[data-alternar]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.alternar;
      const g = document.getElementById(id);
      const t = document.getElementById(`${id}-tab`);
      if (!g || !t) return;
      const mostrarTabela = t.hidden;
      t.hidden = !mostrarTabela;
      g.style.display = mostrarTabela ? 'none' : '';
      b.innerHTML = icone(mostrarTabela ? 'grafico' : 'tabela', 'icon-sm');
      if (!mostrarTabela) window.echarts?.getInstanceByDom(g)?.resize();
    });
  });
}

/** Sparkline minimalista (sem eixos) */
export function sparkline(elemento, valores, cor) {
  return grafico(elemento, {
    grid: { left: 2, right: 2, top: 4, bottom: 2, containLabel: false },
    legend: { show: false },
    tooltip: tooltipEixo(fmtBRL, 'line'),
    xAxis: { type: 'category', data: MESES, show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, min: 0 },
    series: [{ name: 'Realizado', type: 'line', data: valores, smooth: 0.3, symbol: 'none', lineStyle: { width: 2, color: cor }, areaStyle: { color: cor, opacity: 0.12 } }],
  });
}
