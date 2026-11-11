import { sb } from './supabase.js';

const anoAtual = new Date().getFullYear();
let anoSalvo = anoAtual;
try { anoSalvo = Number(localStorage.getItem('gf-ano')) || anoAtual; } catch (e) { /* sem storage */ }

export const store = {
  sessao: null,
  perfil: null,
  ano: anoSalvo,
  empresas: [],
  contratos: [],
  orcamentos: [],
  previsoes: [],
  medicoes: [],
  pendencias: [],
  carregado: false,
};

// ---------- Eventos simples ----------
const ouvintes = {};
export function on(ev, fn) { (ouvintes[ev] ||= new Set()).add(fn); return () => ouvintes[ev].delete(fn); }
export function emit(ev, dado) { (ouvintes[ev] || []).forEach((fn) => fn(dado)); }

export function definirAno(ano) {
  store.ano = Number(ano);
  try { localStorage.setItem('gf-ano', String(store.ano)); } catch (e) { /* ignore */ }
  emit('ano', store.ano);
}

export const podeEditar = () => ['admin', 'editor'].includes(store.perfil?.papel);
export const ehAdmin = () => store.perfil?.papel === 'admin';

// ---------- Carga ----------
const TABELAS = {
  empresas: { tabela: 'gf_empresas', ordem: 'ordem' },
  contratos: { tabela: 'gf_contratos', ordem: 'created_at' },
  orcamentos: { tabela: 'gf_orcamentos', ordem: 'created_at' },
  previsoes: { tabela: 'gf_previsoes', ordem: 'created_at' },
  medicoes: { tabela: 'gf_medicoes', ordem: 'created_at' },
  pendencias: { tabela: 'gf_pendencias', ordem: 'created_at' },
};

async function buscarTodos(tabela, ordem) {
  const passo = 1000;
  let de = 0;
  let saida = [];
  for (;;) {
    const { data, error } = await sb.from(tabela).select('*').order(ordem, { ascending: true }).range(de, de + passo - 1);
    if (error) throw error;
    saida = saida.concat(data || []);
    if (!data || data.length < passo) break;
    de += passo;
  }
  return saida;
}

const NUMERICOS = ['valor', 'valor_pago', 'valor_contrato', 'saldo_sap'];
function normalizar(linhas) {
  for (const l of linhas) for (const k of NUMERICOS) if (k in l && l[k] !== null) l[k] = Number(l[k]);
  return linhas;
}

export async function carregarDados() {
  const chaves = Object.keys(TABELAS);
  const res = await Promise.all(chaves.map((k) => buscarTodos(TABELAS[k].tabela, TABELAS[k].ordem)));
  chaves.forEach((k, i) => { store[k] = normalizar(res[i]); });
  store.carregado = true;
  emit('dados');
}

export async function recarregar(...chaves) {
  const lista = chaves.length ? chaves : Object.keys(TABELAS);
  const res = await Promise.all(lista.map((k) => buscarTodos(TABELAS[k].tabela, TABELAS[k].ordem)));
  lista.forEach((k, i) => { store[k] = normalizar(res[i]); });
  emit('dados');
}

// ---------- Escrita ----------
const CHAVE_POR_TABELA = Object.fromEntries(Object.entries(TABELAS).map(([k, v]) => [v.tabela, k]));

export async function salvarRegistro(tabela, registro, { recarregarTambem = [] } = {}) {
  const { id, ...dados } = registro;
  let res;
  if (id) res = await sb.from(tabela).update(dados).eq('id', id).select().single();
  else res = await sb.from(tabela).insert(dados).select().single();
  if (res.error) throw res.error;
  const chave = CHAVE_POR_TABELA[tabela];
  if (chave) await recarregar(chave, ...recarregarTambem);
  return res.data;
}

export async function excluirRegistro(tabela, id) {
  const { error } = await sb.from(tabela).delete().eq('id', id);
  if (error) throw error;
  const chave = CHAVE_POR_TABELA[tabela];
  if (chave) await recarregar(chave);
}

export async function upsertLote(tabela, linhas, onConflict) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await sb.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict });
    if (error) throw error;
  }
}

export async function excluirIds(tabela, ids) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb.from(tabela).delete().in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }
}

// ---------- Consultas ----------
export const empresaPorSlug = (slug) => store.empresas.find((e) => e.slug === slug);
export const empresaPorId = (id) => store.empresas.find((e) => e.id === id);
export const contratoPorId = (id) => store.contratos.find((c) => c.id === id);
export const contratosDaEmpresa = (empresaId) => store.contratos.filter((c) => c.empresa_id === empresaId);
export const empresasAtivas = () => store.empresas.filter((e) => e.ativo);

export function anosDisponiveis() {
  const anos = new Set([anoAtual, anoAtual + 1, store.ano]);
  for (const k of ['orcamentos', 'previsoes', 'medicoes']) for (const r of store[k]) anos.add(r.ano);
  return [...anos].sort((a, b) => b - a);
}
