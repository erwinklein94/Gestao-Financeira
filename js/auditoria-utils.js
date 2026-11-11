export const TAMANHO_PAGINA = 200;
export function intervaloPagina(pagina) {
  const inicio = (Math.max(1, Math.trunc(Number(pagina)) || 1) - 1) * TAMANHO_PAGINA;
  return [inicio, inicio + TAMANHO_PAGINA - 1];
}

export function camposAlterados(registro) {
  const antes = registro.dados_anteriores || {};
  const depois = registro.acao === 'delete' ? {} : (registro.dados || {});
  const origem = registro.acao === 'delete' ? (registro.dados_anteriores || registro.dados || {}) : antes;
  return [...new Set([...Object.keys(origem), ...Object.keys(depois)])]
    .filter((campo) => JSON.stringify(origem[campo]) !== JSON.stringify(depois[campo]))
    .map((campo) => ({ campo, antes: origem[campo], depois: depois[campo] }));
}
