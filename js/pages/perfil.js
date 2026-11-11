// =====================================================================
// Meu perfil + gestão de acessos (editor)
// =====================================================================
import { registrarAtividade } from '../atividade.js';
import { sb } from '../supabase.js';
import { store, podeGerenciarAcessos } from '../state.js';
import { definirTitulo } from '../ui/shell.js';
import { icone } from '../icons.js';
import { esc, iniciais, fmtDataHora, fmtData, formulario, confirmar, toast, erroAmigavel, lerCampos } from '../utils.js';

const PAPEIS = [
  { valor: 'admin', rotulo: 'Coordenador — gestão operacional, sem auditoria ou gestão de acessos' },
  { valor: 'editor', rotulo: 'Editor — registros, auditoria e novos acessos' },
  { valor: 'leitor', rotulo: 'Leitor — somente visualização' },
];
const nomePapel = (p) => ({ admin: 'Coordenador', editor: 'Editor', leitor: 'Leitor' }[p] || p);

export function render(c, params = {}) {
  definirTitulo('Meu perfil', [{ rotulo: 'Conta' }, { rotulo: 'Meu perfil' }]);
  const p = store.perfil || {};
  const email = p.email || store.sessao?.user?.email || '';
  const campos = [
    { nome: 'nome', rotulo: 'Nome completo', obrigatorio: true },
    { nome: 'cargo', rotulo: 'Cargo' },
    { nome: 'area', rotulo: 'Área / gerência' },
    { nome: 'telefone', rotulo: 'Telefone' },
    { nome: 'localidade', rotulo: 'Localidade', largura: 2 },
  ];

  c.innerHTML = `<div class="pagina">
    <section class="card">
      <div class="perfil-cab">
        <span class="avatar avatar-xl">${esc(iniciais(p.nome || email))}</span>
        <div style="flex:1;min-width:220px">
          <div class="hero-kicker" style="color:var(--marca-verde)">Perfil cadastrado</div>
          <h1 style="margin-top:4px">${esc(p.nome || 'Sem nome')}</h1>
          <p class="muted" style="margin-top:4px">${esc(p.cargo || 'Cargo não informado')}${p.area ? ` · ${esc(p.area)}` : ''}</p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><span class="badge b-info">${icone('escudo')}${esc(nomePapel(p.papel))}</span><span class="badge b-ok">${icone('check')}Acesso ativo</span></div>
        </div>
      </div>
      <div class="card-corpo" style="padding-top:0">
        <div class="perfil-dados">
          <div class="perfil-dado"><small>E-mail</small><strong>${esc(email)}</strong></div>
          <div class="perfil-dado"><small>Telefone</small><strong>${esc(p.telefone || '—')}</strong></div>
          <div class="perfil-dado"><small>Localidade</small><strong>${esc(p.localidade || '—')}</strong></div>
          <div class="perfil-dado"><small>Membro desde</small><strong>${fmtData(p.created_at)}</strong></div>
          <div class="perfil-dado"><small>Último acesso</small><strong>${fmtDataHora(p.ultimo_acesso)}</strong></div>
          <div class="perfil-dado"><small>Permissão</small><strong>${esc(nomePapel(p.papel))}</strong></div>
        </div>
      </div>
    </section>

    <div class="grade g-2">
      <section class="card">
        <div class="card-cab"><div><h3>Editar informações</h3><div class="sub">Atualize seus dados de contato</div></div></div>
        <div class="card-corpo"><form id="fPerfil" class="form-grade" novalidate>${campos.map((f) => `<label class="campo ${f.largura === 2 ? 'col-2' : ''}"><span class="campo-rotulo">${f.rotulo}${f.obrigatorio ? ' *' : ''}</span><input name="${f.nome}" value="${esc(p[f.nome] || '')}"></label>`).join('')}</form>
          <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primario" id="btnPerfil">${icone('check', 'icon-sm')}Salvar perfil</button></div></div>
      </section>
      <section class="card">
        <div class="card-cab"><div><h3>Segurança</h3><div class="sub">Troque sua senha de acesso</div></div></div>
        <div class="card-corpo"><form id="fSenha" class="form-grade" novalidate>
            <label class="campo col-2"><span class="campo-rotulo">Nova senha</span><input type="password" name="senha" autocomplete="new-password" minlength="8" placeholder="mínimo 8 caracteres"></label>
            <label class="campo col-2"><span class="campo-rotulo">Confirmar nova senha</span><input type="password" name="senha2" autocomplete="new-password" minlength="8"></label>
          </form>
          <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-secundario" id="btnSenha">${icone('cadeado', 'icon-sm')}Alterar senha</button></div></div>
      </section>
    </div>

    ${podeGerenciarAcessos() ? `<section class="card" id="secAcessos">
      <div class="card-cab"><div><h3>Acessos autorizados</h3><div class="sub">Somente e-mails desta lista conseguem entrar. A pessoa liberada usa "Primeiro acesso" na tela de login e cria a própria senha.</div></div>
        <div class="card-acoes"><button class="btn btn-primario btn-sm" id="btnNovoAcesso">${icone('mais', 'icon-sm')}Liberar acesso</button></div></div>
      <div class="card-corpo sem-padding tabela-wrap" id="acessos"><p class="muted small" style="padding:16px">Carregando…</p></div>
    </section>` : ''}
  </div>`;

  c.querySelector('#btnPerfil').addEventListener('click', async (ev) => {
    const f = c.querySelector('#fPerfil');
    const v = lerCampos(f, campos);
    if (!v.nome) { toast('Informe seu nome.', 'erro'); return; }
    ev.currentTarget.disabled = true;
    const { data, error } = await sb.from('gf_perfis').update(v).eq('id', p.id).select().single();
    ev.currentTarget.disabled = false;
    if (error) { toast(erroAmigavel(error), 'erro'); return; }
    store.perfil = { ...store.perfil, ...data };
    toast('Perfil atualizado.');
    location.reload();
  });

  c.querySelector('#btnSenha').addEventListener('click', async () => {
    const f = c.querySelector('#fSenha');
    if (f.senha.value.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.', 'erro'); return; }
    if (f.senha.value !== f.senha2.value) { toast('As senhas não conferem.', 'erro'); return; }
    const { error } = await sb.auth.updateUser({ password: f.senha.value });
    if (error) { toast(erroAmigavel(error), 'erro'); return; }
    f.reset();
    registrarAtividade('senha');
    toast('Senha alterada com sucesso.');
  });


  if (podeGerenciarAcessos()) {
    carregarAcessos(c.querySelector('#acessos'));
    c.querySelector('#btnNovoAcesso').addEventListener('click', () => formAcesso(c));
    if (params.aba === 'acessos') setTimeout(() => c.querySelector('#secAcessos')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}

async function carregarAcessos(alvo) {
  const [acessos, perfis] = await Promise.all([
    sb.from('gf_acessos').select('*').order('created_at'),
    sb.from('gf_perfis').select('id,email,nome,ultimo_acesso,created_at'),
  ]);
  if (!alvo.isConnected) return;
  if (perfis.error) { alvo.textContent = erroAmigavel(perfis.error); return; }
  if (acessos.error) { alvo.innerHTML = `<p class="muted small" style="padding:16px">${esc(erroAmigavel(acessos.error))}</p>`; return; }
  const porEmail = new Map((perfis.data || []).map((x) => [x.email, x]));
  const meuEmail = store.perfil?.email;
  alvo.innerHTML = `<table class="tabela"><thead><tr><th>Pessoa</th><th>Permissão</th><th>Situação</th><th>Último acesso</th><th></th></tr></thead><tbody>
    ${acessos.data.map((a) => {
      const pf = porEmail.get(a.email);
      const situacao = !a.ativo ? '<span class="badge b-neutro">Bloqueado</span>' : pf ? '<span class="badge b-ok">Conta criada</span>' : '<span class="badge b-alerta">Aguardando primeiro acesso</span>';
      const eu = a.email === meuEmail;
      return `<tr><td><span class="forte">${esc(a.nome || pf?.nome || '—')}</span><div class="sub-linha">${esc(a.email)}${a.cargo ? ` · ${esc(a.cargo)}` : ''}</div></td>
        <td>${esc(nomePapel(a.papel))}</td><td>${situacao}</td><td class="small">${pf?.ultimo_acesso ? fmtDataHora(pf.ultimo_acesso) : '—'}</td>
        <td class="acoes">${eu ? '<span class="muted small">você</span>' : `<button class="btn btn-fantasma btn-sm btn-icone" data-editar-acesso="${esc(a.email)}" title="Editar">${icone('editar', 'icon-sm')}</button><button class="btn btn-fantasma btn-sm btn-icone" data-remover-acesso="${esc(a.email)}" title="Remover acesso">${icone('lixo', 'icon-sm')}</button>`}</td></tr>`;
    }).join('')}</tbody></table>`;
  alvo.querySelectorAll('[data-editar-acesso]').forEach((b) => b.addEventListener('click', () => formAcesso(alvo.closest('.pagina'), acessos.data.find((x) => x.email === b.dataset.editarAcesso))));
  alvo.querySelectorAll('[data-remover-acesso]').forEach((b) => b.addEventListener('click', async () => {
    const email = b.dataset.removerAcesso;
    if (!(await confirmar(`Remover o acesso de ${email}? A pessoa não conseguirá mais entrar no sistema.`, { titulo: 'Remover acesso', rotulo: 'Remover', perigo: true }))) return;
    const { error } = await sb.from('gf_acessos').delete().eq('email', email);
    if (error) { toast(erroAmigavel(error), 'erro'); return; }
    toast('Acesso removido.');
    carregarAcessos(alvo);
  }));
}

function formAcesso(pagina, atual = null) {
  formulario({
    titulo: atual ? 'Editar acesso' : 'Liberar novo acesso',
    subtitulo: atual ? atual.email : 'A pessoa receberá acesso ao entrar em "Primeiro acesso" com este e-mail.',
    valores: atual || { papel: 'leitor', ativo: 'true' },
    campos: [
      ...(atual ? [] : [{ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, largura: 2 }]),
      { nome: 'nome', rotulo: 'Nome' },
      { nome: 'cargo', rotulo: 'Cargo' },
      { nome: 'papel', rotulo: 'Permissão', tipo: 'select', opcoes: PAPEIS, largura: 2 },
      ...(atual ? [{ nome: 'ativo', rotulo: 'Situação', tipo: 'select', opcoes: [{ valor: 'true', rotulo: 'Ativo' }, { valor: 'false', rotulo: 'Bloqueado' }] }] : []),
    ],
    onSalvar: async (v) => {
      if (atual) {
        const { error } = await sb.from('gf_acessos').update({ nome: v.nome, cargo: v.cargo, papel: v.papel, ativo: v.ativo === 'true' }).eq('email', atual.email);
        if (error) throw error;
        toast('Acesso atualizado.');
      } else {
        const email = String(v.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.');
        const { error } = await sb.from('gf_acessos').insert({ email, nome: v.nome, cargo: v.cargo, papel: v.papel, criado_por: store.perfil.id });
        if (error) throw error;
        toast('Acesso liberado. Avise a pessoa para usar "Primeiro acesso".');
      }
      const alvo = pagina.querySelector('#acessos');
      if (alvo) carregarAcessos(alvo);
    },
  });
}
