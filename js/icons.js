// Ícones em traço (SVG inline), geométricos e limpos — no espírito da iconografia com chanfro.
const P = {
  painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  empresa: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M2 21h20"/><path d="M8 7h4M8 11h4M8 15h4"/>',
  registros: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  dashboard: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-3"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  catalogo: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M8 7h8M8 11h6"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  apresentar: '<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21l4-5 4 5"/><path d="M10 7.5l4.5 2.5-4.5 2.5z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  esquerda: '<path d="M15 18l-6-6 6-6"/>',
  direita: '<path d="M9 18l6-6-6-6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  recolher: '<path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  lixo: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alerta: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  tendencia: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  carteira: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 9h-6a3 3 0 0 0 0 6h6z"/><path d="M15.5 12h.01"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pausa: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  tela: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  moedas: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>',
  camadas: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lista: '<path d="M11 6h10M11 12h10M11 18h10"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  cadeado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  olho: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  atualizar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  tabela: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
  contrato: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15l2 2 4-4"/>',
  trem: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14"/><path d="M8 20l-2 2M16 20l2 2M9 16v4M15 16v4"/>',
  pendencia: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  previsao: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6" stroke-dasharray="2 2.5"/>',
  orcamento: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
  medicao: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11"/><path d="M12.5 13h4M12.5 16.5h4"/>',
  copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  varinha: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4"/><path d="M3 21l9-9"/>',
};

export function icone(nome, classe = '') {
  return `<svg class="icon ${classe}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || P.info}</svg>`;
}

export const MARCA_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 3h25l9 9v25H3z" fill="#32A6E6"/><path d="M11 29v-6M17 29V16M23 29v-9M29 29V12" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>`;

// Grafismo de módulos com e sem chanfro (composição em linha) — usado no login e nos heros.
export function grafismo(classe = '') {
  return `<svg class="${classe}" viewBox="0 0 560 220" aria-hidden="true" preserveAspectRatio="xMaxYMax meet">
    <path d="M40 150h150l22 22v38H40z" fill="#32A6E6" opacity=".22"/>
    <path d="M222 150h120v60H222z" fill="#1E9F7F" opacity=".35"/>
    <path d="M352 150h130l26 26v34H352z" fill="#7FE06C" opacity=".32"/>
    <path d="M120 80h160l24 24v36H120z" fill="#fff" opacity=".07"/>
    <path d="M314 80h96v60h-96z" fill="#32A6E6" opacity=".28"/>
    <path d="M420 80h104l22 22v38H420z" fill="#fff" opacity=".09"/>
    <path d="M250 20h140l20 20v30H250z" fill="#7FE06C" opacity=".18"/>
    <path d="M420 20h80v50h-80z" fill="#32A6E6" opacity=".16"/>
  </svg>`;
}
