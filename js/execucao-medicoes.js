import { esc, fmtBRL, fmtNum2, fmtData, MESES, soma, modal } from './utils.js';

export function situacoesDocumentais(itens) {
  const grupos = new Map();
  for (const i of itens) {
    const s = i.status_planilha?.trim() || 'Não informado na origem';
    if (!grupos.has(s)) grupos.set(s, { s, v: 0, abas: new Set() });
    const g = grupos.get(s); g.v += Number(i.valor) || 0; g.abas.add(`${i.mes}|${i.arquivo}|${i.aba}`);
  }
  return [...grupos.values()].map(({ s, v, abas }) => ({ s, v, n: abas.size })).sort((a, b) => b.v - a.v);
}

export function agruparOS(itens, fontes) {
  const grupos = new Map();
  for (const i of itens) {
    // Uma OS pode reaparecer em meses/abas diferentes; nunca fundir apenas pelo número.
    const chave = JSON.stringify([i.mes, i.arquivo, i.aba, i.ordem_servico]);
    if (!grupos.has(chave)) {
      const fonte = fontes.find((f) => f.mes === i.mes && f.arquivo === i.arquivo);
      const execucao = fonte?.dados?.execucoes?.find((x) => x.aba.trim() === (i.aba || '').trim());
      grupos.set(chave, { mes: i.mes, arquivo: i.arquivo, aba: i.aba, os: i.ordem_servico || 'Não informada', atividade: i.atividade || execucao?.descricao || '', itens: [], execucao, valor: 0, status: new Set() });
    }
    const g = grupos.get(chave); g.itens.push(i); g.valor += Number(i.valor) || 0; g.status.add(i.status_planilha?.trim() || 'Não informado na origem');
  }
  return [...grupos.values()].sort((a, b) => b.valor - a.valor).map((g) => ({ ...g, status: [...g.status].join(' / ') }));
}

export function conferirMeses(itens, fontes) {
  return fontes.map((f) => {
    const importado = soma(itens.filter((i) => i.mes === f.mes).map((i) => i.valor));
    const origem = Number(f.dados.total_planilha);
    return { mes: f.mes, arquivo: f.arquivo, origem, importado, diferenca: Math.round((origem - importado) * 100) / 100 };
  }).sort((a, b) => a.mes - b.mes);
}

const tabela = (colunas, linhas, numeros = []) => `<div class="tabela-wrap"><table class="tabela tabela-compacta"><thead><tr>${colunas.map((c, i) => `<th class="${numeros.includes(i) ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map((r) => `<tr>${r.map((v, i) => `<td class="${numeros.includes(i) ? 'num' : ''}">${esc(v ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const card = (titulo, nota, corpo) => `<section class="card"><div class="card-cab"><div><h3>${esc(titulo)}</h3><p class="sub">${esc(nota)}</p></div></div>${corpo}</section>`;
const detalheDiario = (e) => [...(e?.diario || [])].sort((a,b)=>a[0].localeCompare(b[0])).map((d) => [fmtData(d[0]), d[1], d[2], fmtNum2(d[3]), d[4] || '—', d[5] || '—', d[6] || '—']);
export const contratuaisNaoImportados = (itens, fontes) => fontes.flatMap((f) => (f.dados.contratuais || []).filter((r) => !itens.some((i) => i.mes === f.mes && i.codigo_servico === r.codigo && (i.aba || '').trim() === r.aba.trim())).map((r) => [MESES[f.mes - 1], r.codigo, r.descricao, fmtBRL(r.valor), r.aba, f.arquivo]));

export function tabelasExecucaoPDF(itens, fontes, tipo) {
  const os = agruparOS(itens.filter((i) => !tipo || i.classificacao === tipo), fontes);
  const conf = conferirMeses(itens, fontes);
  const retro = fontes.flatMap((f) => (f.dados.retroativos || []).map((r) => [MESES[f.mes - 1], r.codigo, r.descricao, fmtBRL(r.valor), r.observacao, f.arquivo]));
  const lista = [
    { titulo: 'Itens contratuais sem lançamento correspondente — a conferir, fora do realizado', colunas: ['Mês', 'Código', 'Descrição na origem', 'Valor', 'Aba', 'Arquivo'], linhas: contratuaisNaoImportados(itens, fontes) },
    { titulo: 'Conferência da importação — todas as naturezas; diferença não é lançamento', colunas: ['Mês', 'Planilha', 'Importado', 'Diferença', 'Arquivo'], linhas: conf.map((x) => [MESES[x.mes - 1], fmtBRL(x.origem), fmtBRL(x.importado), fmtBRL(x.diferenca), x.arquivo]) },
    { titulo: 'OS e atividades — valores medidos, não comprovantes de pagamento', colunas: ['Mês', 'OS', 'Atividade', 'Situação na origem', 'Valor', 'Aba'], linhas: os.map((g) => [MESES[g.mes - 1], g.os, g.atividade, g.status, fmtBRL(g.valor), g.aba]) },
    { titulo: 'Retroativos — fora do realizado; competência pendente de validação', colunas: ['Mês do arquivo', 'Código', 'Serviço', 'Valor', 'Referência', 'Arquivo'], linhas: retro },
  ];
  // Detalhes são da aba inteira, sem ratear produção pela natureza contábil.
  for (const f of fontes) for (const e of f.dados.execucoes || []) if (e.diario?.length) lista.push({ titulo: `Execução registrada — ${MESES[f.mes - 1]} — ${e.aba} — todas as naturezas`, colunas: ['Data', 'Código', 'Unidade', 'Quantidade', 'SUB', 'OS', 'Comentário'], linhas: detalheDiario(e) });
  for (const f of fontes) if (f.dados.controle_os?.length) lista.push({ titulo: `Controle de OS da origem — ${MESES[f.mes - 1]} — campo vazio não indica pendência`, colunas: ['Tipo', 'SUB', 'Km inicial', 'Km final', 'Extensão original', 'OS', 'Utilização informada'], linhas: f.dados.controle_os.map((r) => [r.A, r.B, r.D, r.E, r.F, r.I || 'Não informada', r.J || 'Não informada']) });
  return lista;
}

export function secaoExecucao(itens, fontes, tipo) {
  if (!itens.length && !fontes.length) return '';
  const conf = conferirMeses(itens, fontes);
  const faltantes = contratuaisNaoImportados(itens, fontes);
  const retro = fontes.flatMap((f) => (f.dados.retroativos || []).map((r) => [MESES[f.mes - 1], r.codigo, r.descricao, fmtBRL(r.valor), r.observacao]));
  return `<div id="execucao-medicoes">
    ${faltantes.length ? card('Itens contratuais a conferir', 'Não encontramos lançamento com o mesmo mês, código e aba. Valores informativos, fora do realizado; descrição e competência precisam de validação antes da importação.', tabela(['Mês', 'Código', 'Descrição na origem', 'Valor', 'Aba', 'Arquivo'], faltantes, [3])) : ''}
    ${conf.length ? card('Conferência das medições', 'Todas as naturezas. Compara o TOTAL REV00 salvo no Excel com os itens importados. Diferenças precisam de conferência; não são somadas ao realizado.', tabela(['Mês', 'Total da planilha', 'Total importado', 'Diferença', 'Conferência'], conf.map((x) => [MESES[x.mes - 1], fmtBRL(x.origem), fmtBRL(x.importado), fmtBRL(x.diferenca), Math.abs(x.diferenca) <= .02 ? 'Conciliado até R$ 0,02' : 'A conferir']), [1, 2, 3])) : ''}
    ${card('OS e atividades medidas', 'Valores dos itens importados. Situação documental não comprova aprovação financeira ou pagamento. Clique em Detalhes para consultar a origem.', `<div class="card-corpo filtros"><label>Buscar OS, atividade, aba, km ou SUB <input class="input" id="exec-busca" type="search"></label><label>Mês <select class="input" id="exec-mes"><option value="">Todos</option>${[...new Set(itens.map((i) => i.mes))].sort((a,b)=>a-b).map((m) => `<option value="${m}">${MESES[m-1]}</option>`).join('')}</select></label><label>Situação <select class="input" id="exec-status"><option value="">Todas</option>${situacoesDocumentais(itens).map((s) => `<option>${esc(s.s)}</option>`).join('')}</select></label><button class="btn btn-secundario" id="exec-limpar">Limpar filtros</button><p id="exec-total" role="status"></p></div><div id="exec-lista"></div>`)}
    ${retro.length ? card('Retroativos para conferência', 'Valores informativos, fora do realizado. A referência original inclui períodos anteriores; não alocamos esses valores automaticamente ao mês do arquivo.', tabela(['Mês do arquivo', 'Código', 'Serviço', 'Valor', 'Referência original'], retro, [3])) : ''}
    ${fontes.filter((f)=>f.dados.controle_os?.length).map((f)=>card(`Controle de OS — ${MESES[f.mes-1]}`, 'Transcrição da aba OS OUT. Campo vazio significa informação não preenchida, não uma pendência confirmada.', tabela(['Tipo','SUB','Km inicial','Km final','Extensão original','OS','Utilização informada'],f.dados.controle_os.map((r)=>[r.A,r.B,r.D,r.E,r.F,r.I||'Não informada',r.J||'Não informada'])))).join('')}
  </div>`;
}

export function ligarExecucao(raiz, itens, fontes, tipo) {
  const secao = raiz.querySelector('#execucao-medicoes'); if (!secao) return;
  const grupos = agruparOS(itens.filter((i) => !tipo || i.classificacao === tipo), fontes);
  const busca = secao.querySelector('#exec-busca'), mes = secao.querySelector('#exec-mes'), status = secao.querySelector('#exec-status');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const atualizar = () => {
    const visiveis = grupos.filter((g) => (!mes.value || g.mes === Number(mes.value)) && (!status.value || g.status === status.value) && norm(`${g.os} ${g.atividade} ${g.aba} ${g.execucao?.km_inicial || ''} ${g.execucao?.km_final || ''} ${(g.execucao?.diario || []).map((d) => d[4] ? 'SUB '+d[4] : '').join(' ')}`).includes(norm(busca.value)));
    secao.querySelector('#exec-total').textContent = `${visiveis.length} registros · ${fmtBRL(soma(visiveis.map((g) => g.valor)))}`;
    secao.querySelector('#exec-lista').innerHTML = tabela(['Mês', 'OS', 'Atividade', 'Situação na origem', 'Valor', 'Detalhes'], visiveis.map((g) => [MESES[g.mes - 1], g.os, g.atividade, g.status, fmtBRL(g.valor), '']), [4]);
    secao.querySelectorAll('#exec-lista tbody tr').forEach((tr, i) => {
      const g = visiveis[i], b = document.createElement('button'); b.className = 'btn btn-secundario btn-sm'; b.textContent = 'Detalhes'; tr.lastElementChild.appendChild(b);
      b.addEventListener('click', () => {
        const e = g.execucao;
        modal({ titulo: `OS ${g.os} · ${MESES[g.mes - 1]}`, subtitulo: `${g.arquivo || 'Arquivo não informado'} · ${g.aba || ''}`, classe: 'modal-grafico', corpo:
          `<p>${esc(g.atividade)}</p><p class="sub">Situação: ${esc(g.status)}. Valores medidos não comprovam pagamento.</p>` +
          tabela(['Serviço', 'Unidade', 'Quantidade', 'Valor unitário', 'Valor'], [...g.itens].sort((a,b)=>Number(b.valor)-Number(a.valor)).map((i) => [`${i.codigo_servico} · ${i.descricao}`, i.unidade, fmtNum2(i.quantidade), fmtBRL(i.valor_unitario), fmtBRL(i.valor)]), [2,3,4]) +
          (e ? `<h3>Execução da aba — todas as naturezas</h3><p>${esc([e.supervisor && `Supervisor: ${e.supervisor}`, e.inicio && `Período: ${fmtData(e.inicio)} a ${fmtData(e.fim)}`, e.km_inicial && `Km ${e.km_inicial} a ${e.km_final}`].filter(Boolean).join(' · '))}</p><p class="sub">Quantidades transcritas dos quadros diários; não somar unidades diferentes nem interpretar como produtividade por hora trabalhada.</p>` + tabela(['Data', 'Código', 'Unidade', 'Quantidade', 'SUB', 'OS', 'Comentário'], detalheDiario(e), [3]) : '<p class="sub">Sem detalhamento de execução vinculado à origem.</p>') });
      });
    });
  };
  busca.addEventListener('input', atualizar); mes.addEventListener('change', atualizar); status.addEventListener('change', atualizar);
  secao.querySelector('#exec-limpar').addEventListener('click',()=>{busca.value='';mes.value='';status.value='';atualizar();}); atualizar();
}
