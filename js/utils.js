import { icone } from './icons.js';

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const TIPOS = ['CAPEX', 'OPEX'];
/** Naturezas do gasto realizado: o catálogo pode não classificar o código (Sem classificação). */
export const SEM_CLASS = 'Sem classificação';
export const NATUREZAS = ['CAPEX', 'OPEX', SEM_CLASS];
export const STATUS_MEDICAO = ['Em elaboração', 'Em aprovação', 'Aprovada', 'Paga', 'Glosada', 'Cancelada'];
export const STATUS_CONTRATO = ['Ativo', 'Em mobilização', 'Suspenso', 'Encerrado'];
export const STATUS_PENDENCIA = ['Aberta', 'Em andamento', 'Concluída'];
export const PRIORIDADES = ['Baixa', 'Média', 'Alta'];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const vazio = (v) => v === null || v === undefined || v === '' || Number.isNaN(v);
export const fmtBRL = (v) => (vazio(v) ? '—' : brl.format(Number(v)));
export const fmtBRL0 = (v) => (vazio(v) ? '—' : brl0.format(Number(v)));
export const fmtNum2 = (v) => (vazio(v) ? '' : num2.format(Number(v)));

export function fmtCompacto(v) {
  if (vazio(v)) return '—';
  const n = Number(v); const a = Math.abs(n); const s = n < 0 ? '−' : '';
  const f = (x, d) => x.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  if (a >= 1e9) return `${s}R$ ${f(a / 1e9, 2)} bi`;
  if (a >= 1e6) return `${s}R$ ${f(a / 1e6, 2)} mi`;
  if (a >= 1e3) return `${s}R$ ${f(a / 1e3, 1)} mil`;
  return `${s}${brl0.format(a)}`;
}
export function fmtEixo(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `${v}`;
}
export function fmtPct(v, d = 1) {
  if (vazio(v) || !Number.isFinite(Number(v))) return '—';
  return `${(Number(v) * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}
export function fmtData(d) {
  if (!d) return '—';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}
export function fmtDataHora(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function tempoRelativo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return fmtData(new Date(ts).toISOString());
}
export const competencia = (ano, mes) => `${MESES[mes - 1]}/${ano}`;

/** Converte "1.234.567,89", "1234567.89" ou "R$ 1.234,5" em número. */
export function parseValor(str) {
  if (typeof str === 'number') return str;
  if (vazio(str)) return null;
  let s = String(str).replace(/[R$\s]/g, '').trim();
  if (!s) return null;
  const neg = s.startsWith('-') || s.startsWith('−');
  s = s.replace(/^[-−]/, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

export const soma = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
export const acumular = (arr) => { let t = 0; return arr.map((v) => (v === null ? null : (t += Number(v) || 0))); };

export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function iniciais(nome = '') {
  const p = String(nome).trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
export function debounce(fn, ms = 250) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Toasts ----------
export function toast(msg, tipo = 'ok', ms = 3600) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const ic = { ok: 'check', erro: 'alerta', alerta: 'alerta', info: 'info' }[tipo] || 'info';
  const t = el(`<div class="toast ${tipo}" role="status">${icone(ic)}<span>${esc(msg)}</span></div>`);
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, ms);
}
export function erroAmigavel(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/row-level security|permission denied|not authorized/i.test(m)) return 'Você não tem permissão para esta ação.';
  if (/duplicate key|unique/i.test(m)) return 'Já existe um registro com esses dados (duplicado).';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Falha de conexão. Verifique a internet e tente novamente.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  return m;
}

// ---------- Modal ----------
export function modal({ titulo, subtitulo = '', corpo = '', acoes = [], classe = '' }) {
  const fundo = el(`<div class="modal-fundo" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="modal ${classe}">
      <div class="modal-cab"><div><div class="faixa"></div><h2>${esc(titulo)}</h2>${subtitulo ? `<p class="muted small" style="margin-top:4px">${esc(subtitulo)}</p>` : ''}</div>
        <button class="btn btn-fantasma btn-icone btn-sm" data-fechar aria-label="Fechar">${icone('x')}</button></div>
      <div class="modal-corpo"></div>
      <div class="modal-rodape"></div>
    </div></div>`);
  const corpoEl = fundo.querySelector('.modal-corpo');
  if (typeof corpo === 'string') corpoEl.innerHTML = corpo; else corpoEl.appendChild(corpo);
  const rod = fundo.querySelector('.modal-rodape');
  if (!acoes.length) rod.remove();
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') fechar(); };
  acoes.forEach((a) => {
    const b = el(`<button type="button" class="btn ${a.classe || 'btn-secundario'}">${a.icone ? icone(a.icone) : ''}${esc(a.rotulo)}</button>`);
    b.addEventListener('click', () => a.onClick ? a.onClick({ fechar, botao: b, fundo }) : fechar());
    rod.appendChild(b);
  });
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  fundo.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fechar));
  document.addEventListener('keydown', onKey);
  document.body.appendChild(fundo);
  setTimeout(() => fundo.querySelector('input, select, textarea, .modal-rodape .btn')?.focus(), 30);
  return { fundo, fechar, corpo: corpoEl };
}

export function confirmar(msg, { titulo = 'Confirmar', rotulo = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const m = modal({
      titulo, classe: 'estreito', corpo: `<p>${esc(msg)}</p>`,
      acoes: [
        { rotulo: 'Cancelar', onClick: ({ fechar }) => fechar() },
        { rotulo, classe: perigo ? 'btn-perigo' : 'btn-primario', onClick: ({ fechar }) => { ok = true; fechar(); } },
      ],
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.fundo)) { obs.disconnect(); resolve(ok); } });
    obs.observe(document.body, { childList: true });
  });
}

// ---------- Formulários ----------
function campoHTML(c, v) {
  const id = `f_${c.nome}`;
  const req = c.obrigatorio ? 'required' : '';
  const cls = c.largura === 2 ? 'col-2' : '';
  const val = v === null || v === undefined ? '' : v;
  let input = '';
  switch (c.tipo) {
    case 'select': {
      const ops = (c.opcoes || []).map((o) => {
        const valor = typeof o === 'object' ? o.valor : o;
        const rot = typeof o === 'object' ? o.rotulo : o;
        return `<option value="${esc(valor)}" ${String(valor) === String(val) ? 'selected' : ''}>${esc(rot)}</option>`;
      }).join('');
      input = `<select id="${id}" name="${c.nome}" ${req}>${c.vazio ? `<option value="">${esc(c.vazio)}</option>` : ''}${ops}</select>`;
      break;
    }
    case 'textarea':
      input = `<textarea id="${id}" name="${c.nome}" ${req} placeholder="${esc(c.placeholder || '')}">${esc(val)}</textarea>`;
      break;
    case 'money':
      input = `<div class="input-money"><span>R$</span><input id="${id}" name="${c.nome}" type="text" inputmode="decimal" data-money value="${val === '' ? '' : esc(fmtNum2(val))}" ${req} placeholder="0,00" autocomplete="off"></div>`;
      break;
    case 'date':
      input = `<input id="${id}" name="${c.nome}" type="date" value="${esc(String(val).slice(0, 10))}" ${req}>`;
      break;
    case 'number':
      input = `<input id="${id}" name="${c.nome}" type="number" value="${esc(val)}" ${req} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.max !== undefined ? `max="${c.max}"` : ''} step="${c.passo || 1}">`;
      break;
    case 'color':
      input = `<input id="${id}" name="${c.nome}" type="color" value="${esc(val || '#003865')}" style="padding:4px;height:40px">`;
      break;
    case 'autocomplete':
      input = `<div class="autocompletar"><input id="${id}" name="${c.nome}" type="text" value="${esc(val)}" autocomplete="off" placeholder="${esc(c.placeholder || '')}"><div class="ac-lista" hidden></div></div>`;
      break;
    default:
      input = `<input id="${id}" name="${c.nome}" type="${c.tipo || 'text'}" value="${esc(val)}" ${req} placeholder="${esc(c.placeholder || '')}" ${c.maxlength ? `maxlength="${c.maxlength}"` : ''}>`;
  }
  return `<label class="campo ${cls}" for="${id}"><span class="campo-rotulo">${esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</span>${input}${c.ajuda ? `<small data-ajuda="${c.nome}">${c.ajuda}</small>` : ''}</label>`;
}

export function lerCampos(form, campos) {
  const out = {};
  for (const c of campos) {
    const e = form.querySelector(`[name="${c.nome}"]`);
    if (!e) continue;
    let v = e.value;
    if (c.tipo === 'money') v = parseValor(v);
    else if (c.tipo === 'number') v = v === '' ? null : Number(v);
    else if (typeof v === 'string') { v = v.trim(); if (v === '') v = null; }
    out[c.nome] = v;
  }
  return out;
}

export function ligarMascaraMoeda(raiz) {
  raiz.querySelectorAll('input[data-money]').forEach((i) => {
    i.addEventListener('blur', () => {
      const n = parseValor(i.value);
      if (n === null) { i.value = ''; return; }
      if (Number.isNaN(n)) { i.setCustomValidity('Valor inválido'); i.reportValidity(); return; }
      i.setCustomValidity('');
      i.value = fmtNum2(n);
    });
    i.addEventListener('focus', () => i.select());
  });
}

/**
 * Abre um formulário em modal.
 * campos: [{nome, rotulo, tipo, opcoes, obrigatorio, largura, ajuda}]
 * onSalvar(valores) deve retornar Promise; se lançar erro, o modal permanece aberto.
 */
export function formulario({ titulo, subtitulo, campos, valores = {}, onSalvar, rotuloSalvar = 'Salvar', aoAbrir, extraHTML = '' }) {
  const form = el(`<form class="form-grade" novalidate>${campos.map((c) => campoHTML(c, valores[c.nome])).join('')}${extraHTML}<button type="submit" hidden></button></form>`);
  ligarMascaraMoeda(form);
  let m;
  const salvar = async (botao) => {
    for (const c of campos) {
      const e = form.querySelector(`[name="${c.nome}"]`);
      if (!e) continue;
      e.setCustomValidity('');
      if (c.obrigatorio && !String(e.value).trim()) { e.setCustomValidity('Campo obrigatório'); e.reportValidity(); return; }
      if (c.tipo === 'money' && e.value && Number.isNaN(parseValor(e.value))) { e.setCustomValidity('Valor inválido'); e.reportValidity(); return; }
    }
    const v = lerCampos(form, campos);
    if (botao) { botao.disabled = true; botao.dataset.txt = botao.innerHTML; botao.innerHTML = 'Salvando…'; }
    try {
      await onSalvar(v, form);
      m.fechar();
    } catch (e) {
      toast(erroAmigavel(e), 'erro', 6000);
    } finally {
      if (botao && document.body.contains(botao)) { botao.disabled = false; botao.innerHTML = botao.dataset.txt; }
    }
  };
  m = modal({
    titulo, subtitulo, corpo: form,
    acoes: [
      { rotulo: 'Cancelar', onClick: ({ fechar }) => fechar() },
      { rotulo: rotuloSalvar, classe: 'btn-primario', icone: 'check', onClick: ({ botao }) => salvar(botao) },
    ],
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); salvar(m.fundo.querySelector('.modal-rodape .btn-primario')); });
  if (aoAbrir) aoAbrir(form, m);
  return m;
}

// ---------- CSV ----------
export function baixarCSV(nomeArquivo, colunas, linhas) {
  const sepEsc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [colunas.map((c) => sepEsc(c.rotulo)).join(';'), ...linhas.map((l) => colunas.map((c) => sepEsc(typeof c.valor === 'function' ? c.valor(l) : l[c.valor])).join(';'))].join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  window.dispatchEvent(new CustomEvent('gf:exportacao'));
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Badges ----------
export function badgeTipo(t) {
  const classe = t === 'CAPEX' ? 'b-capex' : t === 'OPEX' ? 'b-opex' : 'b-semclass';
  return `<span class="badge ${classe}">${esc(t || SEM_CLASS)}</span>`;
}
export function badgeStatusMedicao(s) {
  const map = { 'Paga': 'b-ok', 'Aprovada': 'b-info', 'Em aprovação': 'b-alerta', 'Em elaboração': 'b-neutro', 'Glosada': 'b-erro', 'Cancelada': 'b-neutro' };
  return `<span class="badge ${map[s] || 'b-neutro'}">${esc(s)}</span>`;
}
export function badgeStatusContrato(s) {
  const map = { 'Ativo': 'b-ok', 'Em mobilização': 'b-info', 'Suspenso': 'b-alerta', 'Encerrado': 'b-neutro' };
  return `<span class="badge ${map[s] || 'b-neutro'}">${esc(s)}</span>`;
}
export function badgeSituacao(sit, curto = false) {
  const map = {
    ok: ['b-ok', 'check', 'Dentro do orçamento', 'OK'],
    atencao: ['b-alerta', 'alerta', 'Atenção', 'Atenção'],
    estouro: ['b-erro', 'alerta', 'Estouro previsto', 'Estouro'],
    'sem-orcamento': ['b-neutro', 'info', 'Sem orçamento', 'Sem orç.'],
  };
  const [c, i, t, tc] = map[sit] || map['sem-orcamento'];
  return `<span class="badge ${c}" title="${t}">${icone(i)}${curto ? tc : t}</span>`;
}
export function badgePrioridade(p) {
  const map = { 'Alta': 'b-erro', 'Média': 'b-alerta', 'Baixa': 'b-neutro' };
  return `<span class="badge ${map[p] || 'b-neutro'}">${esc(p)}</span>`;
}
export function badgePendencia(s) {
  const map = { 'Aberta': 'b-alerta', 'Em andamento': 'b-info', 'Concluída': 'b-ok' };
  return `<span class="badge ${map[s] || 'b-neutro'}">${esc(s)}</span>`;
}

export function vazioHTML(texto, ic = 'info', acao = '') {
  return `<div class="vazio">${icone(ic)}<p>${texto}</p>${acao}</div>`;
}
