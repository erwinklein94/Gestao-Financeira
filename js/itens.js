/** Agrupa descrições iguais, preservando unidades diferentes em linhas separadas. */
export function agruparItens(itens, tipo = null) {
  const grupos = new Map();
  const limpar = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
  const normalizar = (v) => limpar(v).normalize('NFC').toLocaleLowerCase('pt-BR');
  for (const item of itens) {
    if (tipo && (item.classificacao || 'Sem classificação') !== tipo) continue;
    const descricao = limpar(item.descricao) || limpar(item.codigo_servico) || 'Item sem descrição';
    const unidade = limpar(item.unidade);
    const chave = JSON.stringify([normalizar(descricao), normalizar(unidade)]);
    if (!grupos.has(chave)) grupos.set(chave, { descricao, unidade, quantidade: 0, valor: 0 });
    const grupo = grupos.get(chave);
    grupo.quantidade += Number(item.quantidade) || 0;
    grupo.valor += Number(item.valor) || 0;
  }
  return [...grupos.values()].sort((a, b) => b.valor - a.valor || a.descricao.localeCompare(b.descricao, 'pt-BR'));
}
