import { sb } from '../supabase.js';
import { ehEditor } from '../state.js';
import { definirTitulo } from '../ui/shell.js';
import { esc, erroAmigavel, vazioHTML } from '../utils.js';
import { camposAlterados, intervaloPagina, TAMANHO_PAGINA } from '../auditoria-utils.js';

const acoes = { insert: 'Criou', update: 'Alterou', delete: 'Excluiu', acesso: 'Acessou o site', pagina: 'Abriu página', saida: 'Saiu do site', exportacao: 'Exportou CSV', senha: 'Alterou a senha' };
const tabelas = { gf_empresas: 'Empresas', gf_contratos: 'Contratos', gf_medicoes: 'Medições', gf_medicao_itens: 'Itens de medição', gf_previsoes: 'Previsões', gf_orcamentos: 'Orçamentos', gf_pendencias: 'Pendências', gf_servicos: 'Catálogo', gf_perfis: 'Perfis', gf_acessos: 'Acessos', site: 'Site' };
const hora = (v) => v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }) : 'Nunca acessou';
const valor = (v) => v === undefined ? '—' : v === null ? 'Vazio' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const papel = (p) => ({ admin: 'Coordenador', editor: 'Editor', leitor: 'Leitor' }[p] || p);

function detalhes(a) {
  if (!['insert', 'update', 'delete'].includes(a.acao)) return esc(a.dados?.pagina || '—');
  const campos = camposAlterados(a);
  if (!campos.length) return 'Sem mudança de valores';
  return `<details><summary>${campos.length} campo(s) · ver alterações</summary><div class="tabela-wrap"><table class="tabela tabela-compacta"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>${campos.map((x) => `<tr><td>${esc(x.campo)}</td><td style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(valor(x.antes))}</td><td style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(valor(x.depois))}</td></tr>`).join('')}</tbody></table></div>${a.acao === 'update' && !a.dados_anteriores ? '<p class="small">Registro antigo sem valores anteriores disponíveis.</p>' : ''}</details>`;
}

export function render(c) {
  if (!ehEditor()) { c.innerHTML = vazioHTML('Acesso exclusivo ao perfil Editor.', 'escudo'); return; }
  definirTitulo('Auditoria', [{ rotulo: 'Conta' }, { rotulo: 'Auditoria' }]);
  c.innerHTML = `<div class="pagina"><section class="card"><div class="card-cab"><div><h3>Auditoria de atividade</h3><div class="sub">Atividades dos outros perfis · ${TAMANHO_PAGINA} registros por página · horário de Brasília</div></div><button class="btn btn-secundario" id="auditAtualizar">Atualizar</button></div><div class="card-corpo"><p class="small muted">Alterações são registradas pelo banco com os valores antes e depois. Navegação e exportações são informadas pelo site. O histórico começa quando o registro de cada evento foi habilitado.</p><div class="form-grade" style="margin-top:16px"><label class="campo"><span>Pessoa</span><select id="auditPessoa"><option value="">Todas</option></select></label><label class="campo"><span>Ação</span><select id="auditAcao"><option value="">Todas</option>${Object.entries(acoes).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label></div></div><div id="auditLista" class="card-corpo tabela-wrap"></div><div class="card-corpo" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><button class="btn btn-secundario" id="auditAnterior">Anterior</button><span id="auditContagem" aria-live="polite"></span><button class="btn btn-secundario" id="auditProxima">Próxima</button></div></section><section class="card"><div class="card-cab"><div><h3>Último acesso por pessoa</h3><div class="sub">Perfis que não são editores · horário de Brasília</div></div></div><div id="auditPessoas" class="card-corpo tabela-wrap"></div></section></div>`;
  const raiz = c.firstElementChild;
  let pagina = 1;
  let versao = 0;
  const anterior = c.querySelector('#auditAnterior');
  const proxima = c.querySelector('#auditProxima');
  const pessoa = c.querySelector('#auditPessoa');
  const acao = c.querySelector('#auditAcao');
  async function carregar() {
    const atual = ++versao;
    anterior.disabled = proxima.disabled = true;
    const alvo = c.querySelector('#auditLista');
    alvo.textContent = 'Carregando…';
    try {
      let q = sb.from('gf_auditoria').select('*', { count: 'exact' }).or('usuario_papel.neq.editor,usuario_papel.is.null').order('created_at', { ascending: false }).order('id', { ascending: false });
      if (pessoa.value) q = q.eq('usuario_id', pessoa.value);
      if (acao.value) q = q.eq('acao', acao.value);
      const { data, count, error } = await q.range(...intervaloPagina(pagina));
      if (!raiz.isConnected || atual !== versao) return;
      if (error) throw error;
      const paginas = Math.max(1, Math.ceil(count / TAMANHO_PAGINA));
      if (pagina > paginas) { pagina = paginas; return carregar(); }
      alvo.innerHTML = data.length ? `<table class="tabela"><thead><tr><th>Data e hora</th><th>Pessoa / perfil</th><th>Ação</th><th>Local / registro</th><th>O que alterou</th></tr></thead><tbody>${data.map((a) => `<tr><td class="nowrap">${esc(hora(a.created_at))}</td><td>${esc(a.usuario_email || a.usuario_id || 'Sistema')}<div class="sub-linha">${esc(papel(a.usuario_papel) || 'Perfil histórico não registrado')}</div></td><td>${esc(acoes[a.acao] || a.acao)}</td><td>${esc(tabelas[a.tabela] || a.tabela)}<div class="sub-linha">${esc(a.registro_id || '')}</div></td><td>${detalhes(a)}</td></tr>`).join('')}</tbody></table>` : vazioHTML('Nenhum registro encontrado.', 'relogio');
      c.querySelector('#auditContagem').textContent = `Página ${pagina} de ${paginas} · ${count} registros`;
      anterior.disabled = pagina <= 1;
      proxima.disabled = pagina >= paginas;
    } catch (e) { if (raiz.isConnected && atual === versao) { alvo.textContent = erroAmigavel(e); c.querySelector('#auditContagem').textContent = 'Não foi possível carregar. Use Atualizar para tentar novamente.'; } }
  }
  async function carregarPessoas() {
    const alvo = c.querySelector('#auditPessoas');
    alvo.textContent = 'Carregando…';
    try {
      const { data, error } = await sb.rpc('gf_auditoria_pessoas');
      if (!raiz.isConnected) return;
      if (error) throw error;
      const selecionada = pessoa.value;
      pessoa.innerHTML = '<option value="">Todas</option>' + data.filter((p) => p.id).map((p) => `<option value="${esc(p.id)}">${esc(p.nome || p.email)}</option>`).join('');
      pessoa.value = selecionada;
      alvo.innerHTML = data.length ? `<table class="tabela"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Situação</th><th>Último acesso</th></tr></thead><tbody>${data.map((p) => `<tr><td>${esc(p.nome || '—')}<div class="sub-linha">${esc(p.email)}</div></td><td>${esc(papel(p.papel))}</td><td>${p.ativo ? 'Ativo' : 'Bloqueado'}</td><td>${esc(hora(p.ultimo_acesso))}</td></tr>`).join('')}</tbody></table>` : vazioHTML('Nenhum outro perfil cadastrado.', 'usuarios');
    } catch (e) { if (raiz.isConnected) alvo.textContent = erroAmigavel(e); }
  }
  anterior.onclick = () => { pagina--; carregar(); };
  proxima.onclick = () => { pagina++; carregar(); };
  pessoa.onchange = acao.onchange = () => { pagina = 1; carregar(); };
  c.querySelector('#auditAtualizar').onclick = () => { carregar(); carregarPessoas(); };
  carregar(); carregarPessoas();
}
