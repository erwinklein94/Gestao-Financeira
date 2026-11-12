import { GRUPOS_SERVICOS } from './grupos-servicos.js';
import { MESES, MESES_LONGOS, NATUREZAS, SEM_CLASS, fmtBRL, esc, soma } from './utils.js';

export const GRUPO_A_DEFINIR = 'Grupo a definir';
export const GRUPO_NAO_ENCONTRADO = 'Sem grupo na planilha';
const porCodigo = new Map();
for (const [grupo, codigos] of Object.entries(GRUPOS_SERVICOS)) {
  for (const codigo of codigos) {
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, new Set());
    porCodigo.get(codigo).add(grupo);
  }
}

export function grupoDoServico(codigo) {
  const grupos = porCodigo.get(String(codigo ?? '').trim().replace(/\.0+$/, ''));
  return !grupos ? GRUPO_NAO_ENCONTRADO : grupos.size > 1 ? GRUPO_A_DEFINIR : [...grupos][0];
}

/** Cada item pertence a um único grupo; meses e naturezas são filtrados antes da soma. */
export function resumirGastos(itens, { natureza = '', meses = null } = {}) {
  const dados = new Map(Object.keys(GRUPOS_SERVICOS).map((grupo) => [grupo, Array(12).fill(0)]));
  const presentes = new Set();
  let ambiguos = 0, semGrupo = 0;
  for (const item of itens) {
    const mes = Number(item.mes);
    const tipo = NATUREZAS.includes(item.classificacao) ? item.classificacao : SEM_CLASS;
    const valor = Number(item.valor);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isFinite(valor) || valor === 0) continue;
    if (natureza && tipo !== natureza) continue;
    if (meses && !meses.includes(mes)) continue;
    const grupo = grupoDoServico(item.codigo_servico);
    if (!dados.has(grupo)) dados.set(grupo, Array(12).fill(0));
    dados.get(grupo)[mes - 1] += valor;
    presentes.add(mes);
    if (grupo === GRUPO_A_DEFINIR) ambiguos++;
    if (grupo === GRUPO_NAO_ENCONTRADO) semGrupo++;
  }
  const colunas = [...presentes].sort((a, b) => a - b);
  const linhas = [...dados].map(([grupo, valores]) => ({ grupo, valores, total: soma(colunas.map((mes) => valores[mes - 1])) }));
  const totais = colunas.map((mes) => soma(linhas.map((linha) => linha.valores[mes - 1])));
  return { meses: colunas, linhas, totais, total: soma(totais), ambiguos, semGrupo };
}

export function tabelaResumoGastosPDF(itens, natureza = '') {
  const dados = resumirGastos(itens, { natureza });
  return { titulo: `Resumo de Gastos - ${natureza || 'todas as naturezas'} - todos os meses`,
    colunas: ['Grupo', ...dados.meses.map((mes) => MESES[mes - 1]), 'Total'],
    linhas: dados.meses.length ? dados.linhas.map((linha) => [linha.grupo, ...dados.meses.map((mes) => fmtBRL(linha.valores[mes - 1])), fmtBRL(linha.total)]) : [],
    rodape: dados.meses.length ? [['Total', ...dados.totais.map(fmtBRL), fmtBRL(dados.total)]] : [] };
}

export function secaoResumoGastos(itens, ano, naturezaInicial = '') {
  const meses = resumirGastos(itens).meses;
  return `<section class="card" id="resumo-gastos">
    <div class="card-cab"><div><h3>Resumo de Gastos</h3><div class="sub">${ano} · gastos por grupo de serviço e mês</div></div></div>
    <div class="card-corpo">
      <div class="filtros">
        <label>Natureza <select class="input" id="gastos-natureza"><option value="">Todas as naturezas</option>${NATUREZAS.map((n) => `<option value="${esc(n)}" ${n === naturezaInicial ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <button class="btn btn-secundario btn-sm" id="gastos-limpar">Limpar filtros</button>
      </div>
      <fieldset class="gastos-meses"><legend>Meses</legend>${meses.length ? meses.map((mes) => `<label><input type="checkbox" data-gastos-mes value="${mes}" checked> ${MESES_LONGOS[mes - 1]}</label>`).join('') : '<span class="muted">Nenhum mês com gastos.</span>'}</fieldset>
      <p class="sub" id="gastos-resultado" role="status"></p>
      <p class="sub" style="margin-top:8px">Grupos da planilha Apoio OS. Códigos presentes em mais de um grupo aparecem em “Grupo a definir”; códigos não listados aparecem em “Sem grupo na planilha”.</p>
    </div>
    <div class="card-corpo sem-padding tabela-wrap" id="gastos-tabela"></div>
  </section>`;
}

export function ligarResumoGastos(raiz, itens) {
  const secao = raiz.querySelector('#resumo-gastos');
  if (!secao) return;
  const natureza = secao.querySelector('#gastos-natureza');
  const meses = [...secao.querySelectorAll('[data-gastos-mes]')];
  const atualizar = () => {
    const dados = resumirGastos(itens, { natureza: natureza.value, meses: meses.filter((m) => m.checked).map((m) => Number(m.value)) });
    secao.querySelector('#gastos-resultado').textContent = `${dados.meses.length} meses · Total: ${fmtBRL(dados.total)}${dados.ambiguos ? ` · ${dados.ambiguos} lançamentos com grupo a definir` : ''}${dados.semGrupo ? ` · ${dados.semGrupo} lançamentos sem grupo na planilha` : ''}`;
    secao.querySelector('#gastos-tabela').innerHTML = dados.meses.length ? `<table class="tabela tabela-compacta tabela-resumo-gastos"><thead><tr><th scope="col">Grupo</th>${dados.meses.map((mes) => `<th scope="col" class="num">${MESES[mes - 1]}</th>`).join('')}<th scope="col" class="num">Total</th></tr></thead>
      <tbody>${dados.linhas.map((linha) => `<tr><th scope="row">${esc(linha.grupo)}</th>${dados.meses.map((mes) => `<td class="num">${fmtBRL(linha.valores[mes - 1])}</td>`).join('')}<td class="num forte">${fmtBRL(linha.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td>${dados.totais.map((valor) => `<td class="num">${fmtBRL(valor)}</td>`).join('')}<td class="num">${fmtBRL(dados.total)}</td></tr></tfoot></table>` : '<div class="vazio">Nenhum gasto para os meses e a natureza selecionados.</div>';
  };
  natureza.addEventListener('change', atualizar);
  meses.forEach((mes) => mes.addEventListener('change', atualizar));
  secao.querySelector('#gastos-limpar').addEventListener('click', () => { natureza.value = ''; meses.forEach((mes) => { mes.checked = true; }); atualizar(); });
  atualizar();
}
