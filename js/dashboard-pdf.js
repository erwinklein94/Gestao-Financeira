import { fmtBRL, fmtPct, fmtData, soma, MESES } from './utils.js';
import { paleta } from './charts.js';

const AZUL = [0, 56, 101];
const CINZA = [75, 96, 113];
const RESPONSAVEL = 'Raquel - Coordenadora de Manutenção de Infraestrutura';
let bibliotecas;

function carregarScript(arquivo) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(`./vendor/${arquivo}`, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('Não foi possível carregar a exportação PDF. Tente novamente.')); };
    document.head.appendChild(script);
  });
}

async function carregarBibliotecas() {
  if (!bibliotecas) bibliotecas = (async () => {
    if (!window.jspdf?.jsPDF) await carregarScript('jspdf.umd.min.js');
    if (!window.jspdf.jsPDF.API.autoTable) await carregarScript('jspdf.plugin.autotable.min.js');
    return window.jspdf.jsPDF;
  })().catch((e) => { bibliotecas = null; throw e; });
  return bibliotecas;
}

const texto = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() || '';

function tabelaDOM(tabela, titulo) {
  if (!tabela) return null;
  const celulas = (linha) => [...linha.cells].map((celula) => ({ content: texto(celula), colSpan: celula.colSpan, styles: { halign: celula.classList.contains('num') ? 'center' : 'left' } }));
  return { titulo, colunas: [...tabela.querySelectorAll('thead tr:last-child th')].map(texto),
    linhas: [...tabela.querySelectorAll('tbody tr')].map(celulas),
    rodape: [...tabela.querySelectorAll('tfoot tr')].map(celulas) };
}

/** Snapshot síncrono: os filtros locais não omitem linhas nem alteram os totais do relatório. */
export function coletarDashboardPDF(raiz, { empresa, ano, tipo, R, rc, pend, porStatus, servicosMensais, curvas }) {
  const indicadores = [...raiz.querySelectorAll('.hero-num')].map((el) => [texto(el.querySelector('small')), texto(el.querySelector('strong')), '']);
  raiz.querySelectorAll('.kpi').forEach((el) => indicadores.push([texto(el.querySelector('.kpi-rotulo')), texto(el.querySelector('.kpi-valor')), texto(el.querySelector('.kpi-detalhe'))]));
  const resumo = { titulo: 'Indicadores do dashboard', colunas: ['Indicador', 'Valor', 'Detalhes'], linhas: indicadores };
  const classificacao = texto(raiz.querySelector('#classificacao .legenda-nota'));
  const avisos = [...raiz.querySelectorAll('.aviso')].map(texto);
  const graficos = [...raiz.querySelectorAll('.grafico')].map((el) => {
    const card = el.closest('.card');
    const instancia = window.echarts?.getInstanceByDom(el);
    return { id: el.id, titulo: texto(card?.querySelector('h3')), sub: texto(card?.querySelector('.sub')),
      nota: texto(card?.querySelector('.legenda-nota')), opcao: instancia?.getOption(),
      vazio: instancia ? '' : texto(el), tabela: tabelaDOM(document.getElementById(`${el.id}-tab`)?.querySelector('table'), texto(card?.querySelector('h3'))) };
  });
  const tabelaCurva = { titulo: 'Curva acumulada - dados', colunas: ['Mês', 'Orçado acumulado', 'Realizado acumulado', 'Projeção acumulada'], linhas: MESES.map((mes, i) => [mes, ...curvas.map((serie) => fmtBRL(serie[i]))]) };
  const detalhesExtras = {
    eCurva: tabelaCurva,
    eAder: { titulo: 'Aderência ao forecast - dados', colunas: ['Mês', 'Previsto', 'Realizado', 'Aderência'], linhas: MESES.map((mes, i) => [mes, fmtBRL(R.prev[i]), fmtBRL(R.real[i]), fmtPct(R.aderencia[i])]) },
    eStatus: { titulo: 'Medições por status - dados', colunas: ['Status', 'Medições', 'Valor', '% do total'], linhas: porStatus.map((s) => [s.s, String(s.n), fmtBRL(s.v), fmtPct(soma(porStatus.map((x) => x.v)) ? s.v / soma(porStatus.map((x) => x.v)) : null)]) },
  };
  for (const g of graficos) if (!g.tabela) g.tabela = detalhesExtras[g.id];
  const itens = tabelaDOM(raiz.querySelector('#resumo-itens table'), 'Resumo por item') || { titulo: 'Resumo por item', colunas: ['Item', 'Unidade', 'Quantidade total', 'Total em reais'], linhas: [] };
  if (itens.rodape?.length) itens.rodape[0].at(-1).content = fmtBRL(soma([...raiz.querySelectorAll('[data-item-valor]')].map((el) => el.dataset.itemValor)));
  const codigos = tabelaDOM(raiz.querySelector('#servicos-codigo table'), 'Por código de serviço');
  const mensal = tabelaDOM([...raiz.querySelectorAll('.pagina > section')].find((el) => texto(el.querySelector('h3')).startsWith('Detalhamento mensal'))?.querySelector('table'), 'Detalhamento mensal');
  const contratos = rc.map(({ ct, r }) => ({ titulo: `Contrato - ${ct.titulo}`, colunas: ['Informação', 'Valor'], linhas: [
    ['SAP / Ariba', `${ct.contrato_sap || '-'} / ${ct.contrato_ariba || '-'}`], ['Natureza / Status', `${ct.tipo || '-'} / ${ct.status || '-'}`],
    ['Valor contratado', fmtBRL(r.valor)], ['Medido acumulado (todos os anos)', fmtBRL(r.medido)], ['Consumo', fmtPct(r.pct)],
    ['Saldo contratual', fmtBRL(r.saldo)], [`Saldo SAP (${fmtData(ct.saldo_sap_data)})`, fmtBRL(ct.saldo_sap)],
    ['Ritmo (média de 3 meses)', fmtBRL(r.ritmo)], ['Cobertura do saldo', r.cobertura == null ? '-' : r.cobertura < 0 ? 'Esgotado' : `${r.cobertura.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses`],
    ['PEP', ct.pep || '-'], ['Previsto a realizar', fmtBRL(r.previstoFuturo)], ['Início da vigência', fmtData(ct.data_inicio)], ['Fim da vigência', fmtData(ct.data_fim)],
  ] }));
  const pendencias = { titulo: 'Pendências em aberto', colunas: ['Pendência', 'Responsável', 'Prazo', 'Prioridade', 'Status', 'Valor', 'Descrição'], linhas: pend.map((p) => [p.titulo, p.responsavel || '-', fmtData(p.prazo), p.prioridade || '-', p.status || '-', fmtBRL(p.valor), p.descricao || '-']) };
  const custosMensais = { titulo: 'Serviços por mês - valores e participação', colunas: ['Mês', 'Código', 'Serviço', 'Valor', '% do mês'], linhas: [] };
  MESES.forEach((mes, i) => {
    const total = soma(servicosMensais.map((s) => s.valores[i]));
    const custos = servicosMensais.filter((s) => s.valores[i] !== 0).sort((a, b) => b.valores[i] - a.valores[i]);
    custos.forEach((s) => custosMensais.linhas.push([mes, s.codigo, s.descricao, fmtBRL(s.valores[i]), fmtPct(total ? s.valores[i] / total : null)]));
    custosMensais.linhas.push([mes, '', 'Total do mês', fmtBRL(total), fmtPct(total ? 1 : null)]);
  });
  return { empresa: { nome: empresa.nome, slug: empresa.slug, descricao: empresa.descricao || empresa.razao_social || '' }, ano, tipo, geradoEm: new Date(), cores: paleta(), resumo, classificacao, avisos, graficos,
    tabelas: [itens, codigos, ...(contratos.length ? contratos : [{ titulo: 'Contratos', colunas: ['Contrato'], linhas: [] }]), pendencias, mensal, custosMensais].filter(Boolean) };
}

/** Mantém funções de formatação e converte as cores de texto do tema escuro para papel branco. */
function opcaoParaPapel(valor, cores, chave = '') {
  if (Array.isArray(valor)) return valor.map((v) => opcaoParaPapel(v, cores, chave));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, opcaoParaPapel(v, cores, k)]));
  if (typeof valor === 'string' && /color|fill|stroke/i.test(chave)) {
    if (/background|border/i.test(chave) && valor === cores.superficie) return '#FFFFFF';
    if (valor === cores.titulo) return '#003865';
    if (valor === cores.texto) return '#304D63';
    if (valor === cores.suave) return '#526B7D';
    if (valor === cores.grade || valor === cores.borda) return '#DCE4E9';
    if (cores.d && valor === cores.realizado) return '#1E9F7F';
    if (valor === cores.superficie) return '#FFFFFF';
  }
  return valor;
}

async function imagemGrafico(grafico, cores) {
  if (!grafico.opcao) return null;
  if (!window.echarts) throw new Error('A biblioteca de gráficos não está disponível. Recarregue a página e tente novamente.');
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:500px;';
  document.body.appendChild(el);
  let instancia;
  try {
    instancia = window.echarts.init(el, null, { renderer: 'canvas', width: 1000, height: 500 });
    const opcao = opcaoParaPapel(grafico.opcao, cores);
    opcao.animation = false;
    opcao.backgroundColor = '#FFFFFF';
    opcao.textStyle = { ...opcao.textStyle, fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#304D63' };
    opcao.tooltip = { show: false };
    opcao.legend = (opcao.legend || []).map((l) => ({ ...l, type: 'plain', selected: {}, textStyle: { ...l.textStyle, color: '#304D63', fontSize: 14 },
      ...(l.data?.length > 8 ? { formatter: (nom) => String(nom).split(' · ')[0], top: 0, bottom: 'auto', itemGap: 14 } : {}) }));
    const nomes = opcao.legend[0]?.data || [];
    if (nomes.length > 8) opcao.grid = (opcao.grid || []).map((grid) => ({ ...grid, top: 28 + Math.ceil(nomes.length / 8) * 24 }));
    // Todas as séries são exportadas, mesmo quando ocultadas pela legenda da tela.
    instancia.setOption(opcao, { notMerge: true });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return instancia.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#FFFFFF' });
  } finally { instancia?.dispose(); el.remove(); }
}

function textoPDF(valor) {
  return String(valor ?? '-').replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/×/g, 'x').replace(/÷/g, '/');
}

function celulaPDF(celula) {
  if (celula && typeof celula === 'object') return { ...celula, content: textoPDF(celula.content) };
  return textoPDF(celula);
}

function desenharTabela(doc, tabela) {
  const larga = tabela.colunas.length >= 7;
  const dividirColunas = tabela.colunas.length > 8;
  doc.addPage('a4', larga ? 'landscape' : 'portrait');
  const largura = doc.internal.pageSize.getWidth();
  const numerica = (i) => /valor|total|%|quantidade|orçado|realizado|previsto|projeção|aderência|medido|saldo|medições|consumo/i.test(tabela.colunas[i]) || MESES.includes(tabela.colunas[i]);
  const estilos = Object.fromEntries(tabela.colunas.map((_, i) => [i, { halign: numerica(i) ? 'center' : 'left', ...(dividirColunas ? { cellWidth: i === 1 ? 60 : i === 0 ? 22 : 26 } : numerica(i) ? { minCellWidth: 24 } : {}) }]));
  const vazio = Array(tabela.colunas.length).fill('');
  vazio[0] = 'Nenhum registro.';
  doc.autoTable({
    startY: 36, margin: { top: 36, bottom: 23, left: 12, right: 12 },
    head: [tabela.colunas.map(textoPDF)], body: (tabela.linhas.length ? tabela.linhas : [vazio]).map((l) => l.map(celulaPDF)), foot: (tabela.rodape || []).map((l) => l.map(celulaPDF)),
    showHead: 'everyPage', showFoot: 'lastPage', rowPageBreak: 'avoid', theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.4, overflow: 'linebreak', textColor: CINZA, lineColor: [220, 228, 233], valign: 'middle' },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [232, 241, 247], textColor: AZUL }, alternateRowStyles: { fillColor: [246, 249, 251] }, columnStyles: estilos,
    horizontalPageBreak: dividirColunas, horizontalPageBreakRepeat: dividirColunas ? [0, 1] : undefined,
    didParseCell: ({ cell, column }) => { if (numerica(column.index)) cell.styles.halign = 'center'; },
    willDrawPage: () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL); doc.text(doc.splitTextToSize(textoPDF(tabela.titulo), largura - 24), 12, 29); },
  });
}

/** Cria o relatório sem depender do tema, do scroll ou das dimensões da tela. */
export async function gerarDashboardPDF(relatorio) {
  const JsPDF = await carregarBibliotecas();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title: `Dashboard - ${relatorio.empresa.nome} - ${relatorio.ano}`, subject: 'Relatório completo do dashboard da empresa', author: RESPONSAVEL, creator: 'Gestão Financeira' });
  // A primeira página contém a identificação e as notas do relatório.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(...AZUL);
  doc.text('Dashboard da empresa', 12, 46);
  doc.setFontSize(20);
  const nome = doc.splitTextToSize(textoPDF(relatorio.empresa.nome), 184);
  doc.text(nome, 12, 59);
  let y = 65 + nome.length * 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...CINZA);
  const notas = [RESPONSAVEL, relatorio.empresa.descricao, `Ano de referência: ${relatorio.ano}. Natureza selecionada: ${relatorio.tipo || 'Total'}.`,
    'Relatório completo: inclui os indicadores, todos os gráficos, tabelas e detalhes mensais disponíveis no dashboard.',
    'Os filtros de busca e unidade das listas não limitam a exportação. Os gráficos e cálculos mantêm o ano e a natureza selecionados no dashboard.',
    'Contratos: valores acumulados de todos os anos. Nos gráficos de serviços, as legendas extensas são identificadas pelo código; as descrições completas estão nas tabelas.',
    relatorio.classificacao, ...relatorio.avisos].filter(Boolean);
  for (const nota of notas) {
    const linhas = doc.splitTextToSize(textoPDF(nota), 184);
    if (y + linhas.length * 5 > 268) { doc.addPage(); y = 35; }
    doc.text(linhas, 12, y); y += linhas.length * 5 + 6;
  }
  desenharTabela(doc, relatorio.resumo);
  // Quebra explícita a cada dois gráficos: nunca compartilham páginas com tabelas longas.
  for (let i = 0; i < relatorio.graficos.length; i += 2) {
    doc.addPage('a4', 'portrait');
    for (let j = 0; j < 2 && i + j < relatorio.graficos.length; j++) {
      const g = relatorio.graficos[i + j];
      const topo = 29 + j * 121;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL);
      doc.text(textoPDF(g.titulo), 12, topo);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
      doc.text(doc.splitTextToSize(textoPDF(g.sub), 184).slice(0, 2), 12, topo + 5);
      const imagem = await imagemGrafico(g, relatorio.cores);
      if (imagem) doc.addImage(imagem, 'PNG', 12, topo + 15, 186, 93);
      else doc.text(doc.splitTextToSize(textoPDF(g.vazio || 'Sem dados para este gráfico.'), 180), 14, topo + 34);
    }
  }
  for (const g of relatorio.graficos) {
    if (g.tabela) desenharTabela(doc, { ...g.tabela, titulo: `${g.titulo} - dados detalhados` });
    if (g.nota) desenharTabela(doc, { titulo: `${g.titulo} - observações`, colunas: ['Observação'], linhas: [[g.nota]] });
  }
  for (const tabela of relatorio.tabelas) desenharTabela(doc, tabela);
  const paginas = doc.getNumberOfPages();
  const data = relatorio.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...AZUL);
    doc.text(textoPDF(`${relatorio.empresa.nome} | Dashboard ${relatorio.ano}`), 12, 12, { maxWidth: w - 24 });
    doc.setDrawColor(...AZUL); doc.setLineWidth(0.5); doc.line(12, 17, w - 12, 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(RESPONSAVEL, 12, h - 14);
    doc.text(`Gerado em ${data} (Brasília)`, 12, h - 8);
    doc.text(`${i} / ${paginas}`, w - 12, h - 8, { align: 'right' });
  }
  return doc;
}

export async function exportarDashboardPDF(relatorio) {
  const doc = await gerarDashboardPDF(relatorio);
  const slug = String(relatorio.empresa.slug || relatorio.empresa.nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '-');
  doc.save(`dashboard-${slug}-${relatorio.ano}.pdf`);
}
