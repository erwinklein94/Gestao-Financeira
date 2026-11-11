import { sb } from '../supabase.js';
import { icone, MARCA_SVG, grafismo } from '../icons.js';
import { esc, erroAmigavel } from '../utils.js';
import { atualizarBotaoTema, alternarTema } from '../ui/shell.js';
import { APP_NOME } from '../config.js';

const urlRetorno = () => location.origin + location.pathname;

function moldura(conteudoCard) {
  return `
  <div class="login">
    <section class="login-marca">
      <div class="sb-marca" style="padding:0">${MARCA_SVG}<div class="sb-marca-texto"><strong>${esc(APP_NOME)}</strong><span>Contratos &amp; Orçamento</span></div></div>
      <div>
        <h1>Orçamento sob controle, <em>contratos em movimento.</em></h1>
        <p>Planeje o orçamento anual, acompanhe medições e previsões de cada empresa contratada e saiba, mês a mês, quanto ainda pode gastar em CAPEX e OPEX.</p>
        <div class="login-pontos">
          <div>${icone('alvo')}<span>Orçado × previsto × realizado por empresa</span></div>
          <div>${icone('tendencia')}<span>Projeção até dezembro e margem mensal segura</span></div>
          <div>${icone('apresentar')}<span>Modo apresentação para reuniões gerenciais</span></div>
        </div>
      </div>
      ${grafismo('login-grafismo')}
      <p class="small" style="color:rgba(255,255,255,.55)">Ferrovia · Gestão de contratos de serviços</p>
    </section>
    <section class="login-form-lado">
      <button class="btn btn-topo login-tema" data-tema-btn></button>
      <div class="card login-card">${conteudoCard}</div>
    </section>
  </div>`;
}

function ligarTema(raiz) {
  raiz.querySelectorAll('[data-tema-btn]').forEach((b) => { atualizarBotaoTema(b); b.addEventListener('click', () => { alternarTema(); raiz.querySelectorAll('[data-tema-btn]').forEach(atualizarBotaoTema); }); });
}

export function renderLogin(raiz, { modo = 'entrar', mensagem = '' } = {}) {
  const abas = `<div class="segmentado" style="width:100%;margin-bottom:20px">
      <button type="button" data-modo="entrar" class="${modo === 'entrar' ? 'ativo' : ''}" style="flex:1">Entrar</button>
      <button type="button" data-modo="primeiro" class="${modo === 'primeiro' ? 'ativo' : ''}" style="flex:1">Primeiro acesso</button>
    </div>`;
  let card = '';
  if (modo === 'entrar') {
    card = `${abas}<h2>Bem-vinda de volta</h2><p class="sub">Acesse com seu e-mail corporativo e senha.</p>
      <form id="fLogin" novalidate>
        ${mensagem ? `<div class="login-ok">${esc(mensagem)}</div>` : ''}
        <div class="login-erro" id="lErro" hidden></div>
        <label class="campo"><span class="campo-rotulo">E-mail</span><input type="email" name="email" autocomplete="username" required placeholder="nome@empresa.com"></label>
        <label class="campo"><span class="campo-rotulo">Senha</span><input type="password" name="senha" autocomplete="current-password" required placeholder="••••••••"></label>
        <button class="btn btn-primario" type="submit">${icone('cadeado')}Entrar</button>
        <button class="link-btn" type="button" id="lEsqueci" style="align-self:center">Esqueci minha senha</button>
      </form>`;
  } else if (modo === 'primeiro') {
    card = `${abas}<h2>Primeiro acesso</h2><p class="sub">Use o e-mail liberado pela coordenação e crie sua senha.</p>
      <form id="fPrimeiro" novalidate>
        <div class="login-erro" id="lErro" hidden></div>
        <label class="campo"><span class="campo-rotulo">Nome completo</span><input type="text" name="nome" autocomplete="name" required></label>
        <label class="campo"><span class="campo-rotulo">E-mail autorizado</span><input type="email" name="email" autocomplete="username" required placeholder="nome@empresa.com"></label>
        <label class="campo"><span class="campo-rotulo">Crie uma senha</span><input type="password" name="senha" autocomplete="new-password" required minlength="8" placeholder="mínimo 8 caracteres"></label>
        <label class="campo"><span class="campo-rotulo">Confirme a senha</span><input type="password" name="senha2" autocomplete="new-password" required minlength="8"></label>
        <button class="btn btn-primario" type="submit">${icone('check')}Criar meu acesso</button>
      </form>`;
  } else if (modo === 'esqueci') {
    card = `<h2>Recuperar senha</h2><p class="sub">Enviaremos um link para redefinir sua senha.</p>
      <form id="fEsqueci" novalidate>
        <div class="login-erro" id="lErro" hidden></div>
        <div class="login-ok" id="lOk" hidden></div>
        <label class="campo"><span class="campo-rotulo">E-mail</span><input type="email" name="email" autocomplete="username" required></label>
        <button class="btn btn-primario" type="submit">${icone('email')}Enviar link</button>
        <button class="link-btn" type="button" data-modo="entrar" style="align-self:center">Voltar para o login</button>
      </form>`;
  }
  card += `<div class="login-rodape">${icone('escudo', 'icon-sm')}Acesso restrito a usuários autorizados.</div>`;
  raiz.innerHTML = moldura(card);
  ligarTema(raiz);
  document.title = `Entrar · ${APP_NOME}`;

  raiz.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => renderLogin(raiz, { modo: b.dataset.modo })));
  const erro = (msg) => { const e = raiz.querySelector('#lErro'); e.textContent = msg; e.hidden = !msg; };
  const ocupado = (form, sim, txt) => { const b = form.querySelector('button[type=submit]'); b.disabled = sim; if (sim) { b.dataset.t = b.innerHTML; b.textContent = txt; } else if (b.dataset.t) b.innerHTML = b.dataset.t; };

  raiz.querySelector('#fLogin')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const email = f.email.value.trim().toLowerCase();
    const senha = f.senha.value;
    if (!email || !senha) { erro('Informe e-mail e senha.'); return; }
    erro(''); ocupado(f, true, 'Entrando…');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) { ocupado(f, false); erro(erroAmigavel(error)); return; }
    window.dispatchEvent(new CustomEvent('gf:entrou', { detail: data.session }));
  });
  raiz.querySelector('#lEsqueci')?.addEventListener('click', () => renderLogin(raiz, { modo: 'esqueci' }));

  raiz.querySelector('#fPrimeiro')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const nome = f.nome.value.trim();
    const email = f.email.value.trim().toLowerCase();
    const senha = f.senha.value;
    if (!nome || !email || !senha) { erro('Preencha todos os campos.'); return; }
    if (senha.length < 8) { erro('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== f.senha2.value) { erro('As senhas não conferem.'); return; }
    erro(''); ocupado(f, true, 'Verificando…');
    const { data: ok, error: e1 } = await sb.rpc('gf_email_autorizado', { p_email: email });
    if (e1) { ocupado(f, false); erro(erroAmigavel(e1)); return; }
    if (!ok) { ocupado(f, false); erro('Este e-mail não está autorizado. Peça a liberação à coordenação.'); return; }
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: urlRetorno() } });
    if (error) {
      ocupado(f, false);
      if (/already registered|already been registered/i.test(error.message)) { erro('Este e-mail já tem cadastro. Use a aba "Entrar" (ou "Esqueci minha senha").'); return; }
      erro(erroAmigavel(error)); return;
    }
    if (data.session) { window.dispatchEvent(new CustomEvent('gf:entrou', { detail: data.session })); return; }
    renderLogin(raiz, { modo: 'entrar', mensagem: 'Cadastro criado! Confirme pelo link enviado ao seu e-mail e depois entre com sua senha.' });
  });

  raiz.querySelector('#fEsqueci')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const email = f.email.value.trim().toLowerCase();
    if (!email) { erro('Informe o e-mail.'); return; }
    erro(''); ocupado(f, true, 'Enviando…');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: urlRetorno() });
    ocupado(f, false);
    if (error) { erro(erroAmigavel(error)); return; }
    const ok = raiz.querySelector('#lOk'); ok.textContent = 'Se o e-mail estiver cadastrado, você receberá o link em instantes.'; ok.hidden = false;
  });
}

export function renderNovaSenha(raiz, aoConcluir) {
  raiz.innerHTML = moldura(`<h2>Definir nova senha</h2><p class="sub">Escolha uma nova senha para sua conta.</p>
    <form id="fNova" novalidate>
      <div class="login-erro" id="lErro" hidden></div>
      <label class="campo"><span class="campo-rotulo">Nova senha</span><input type="password" name="senha" autocomplete="new-password" minlength="8" required></label>
      <label class="campo"><span class="campo-rotulo">Confirme a nova senha</span><input type="password" name="senha2" autocomplete="new-password" minlength="8" required></label>
      <button class="btn btn-primario" type="submit">${icone('check')}Salvar nova senha</button>
    </form>`);
  ligarTema(raiz);
  raiz.querySelector('#fNova').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target; const e = raiz.querySelector('#lErro');
    if (f.senha.value.length < 8) { e.textContent = 'Mínimo de 8 caracteres.'; e.hidden = false; return; }
    if (f.senha.value !== f.senha2.value) { e.textContent = 'As senhas não conferem.'; e.hidden = false; return; }
    const { error } = await sb.auth.updateUser({ password: f.senha.value });
    if (error) { e.textContent = erroAmigavel(error); e.hidden = false; return; }
    aoConcluir();
  });
}

export function renderSemAcesso(raiz, email, sair) {
  raiz.innerHTML = moldura(`<div style="text-align:center">
      <div class="lista-icone erro" style="width:56px;height:56px;margin:0 auto 14px">${icone('cadeado', 'icon-lg')}</div>
      <h2>Acesso não autorizado</h2>
      <p class="sub">A conta <b>${esc(email)}</b> não tem permissão para usar o ${esc(APP_NOME)}. Solicite a liberação à coordenação.</p>
      <button class="btn btn-secundario" id="btnSair" style="width:100%">${icone('sair')}Sair e usar outra conta</button>
    </div>`);
  ligarTema(raiz);
  raiz.querySelector('#btnSair').addEventListener('click', sair);
}

export function renderErroConfig(raiz) {
  raiz.innerHTML = moldura(`<h2>Configuração pendente</h2><p class="sub">A chave pública do Supabase ainda não foi definida em <code>js/config.js</code>.</p>`);
  ligarTema(raiz);
}
