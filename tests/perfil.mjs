import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = (await fs.readFile('js/pages/perfil.js', 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace('export function render', 'function render');

for (const papel of ['editor', 'admin', 'leitor']) {
  for (const resultado of ['sucesso', 'erro-api', 'erro-rede']) {
    const nodes = new Map();
    const c = { innerHTML: '', querySelector(s) {
      if (!nodes.has(s)) nodes.set(s, { disabled: false, isConnected: false, addEventListener(ev, fn) { this[ev] = fn; } });
      return nodes.get(s);
    } };
    const perfil = { id: `id-${papel}`, papel, nome: 'Nome anterior', email: `${papel}@example.test` };
    const store = { perfil: { ...perfil } };
    const avisos = [];
    let concluir, recargas = 0, gravacoes = 0;
    const consulta = {
      update(v) { gravacoes++; assert.equal(v.nome, 'Nome atualizado'); return this; },
      eq(k,v) { assert.equal(k,'id'); assert.equal(v,perfil.id); return this; },
      select() { return this; }, order() { return Promise.resolve({data:[]}); },
      single() { return new Promise((resolve,reject) => { concluir = () => {
        if (resultado === 'erro-rede') reject(new Error('Sem conexão'));
        else resolve(resultado === 'erro-api' ? {error:new Error('Falha ao salvar')} : {data:{nome:'Nome atualizado'}});
      }; }); },
    };
    const sandbox = {
      store, sb:{from:()=>consulta}, podeGerenciarAcessos:()=>papel==='editor',
      definirTitulo(){}, icone:()=>'', esc:v=>String(v??''), iniciais:()=>'', fmtDataHora:()=>'', fmtData:()=>'',
      lerCampos:()=>({nome:'Nome atualizado'}), toast:(...v)=>avisos.push(v), erroAmigavel:e=>e.message,
      location:{reload(){recargas++;}},
    };
    vm.createContext(sandbox); vm.runInContext(source,sandbox); sandbox.render(c);
    const botao = nodes.get('#btnPerfil');
    const ev = {currentTarget:botao};
    const tarefa = botao.click(ev);
    assert.equal(botao.disabled,true);
    await botao.click({currentTarget:botao});
    assert.equal(gravacoes,1,'Bloqueia envio duplicado');
    // O navegador limpa currentTarget assim que termina o despacho síncrono do evento.
    ev.currentTarget = null;
    concluir(); await tarefa;
    assert.equal(botao.disabled,false,'Botão liberado após sucesso ou falha');
    assert.equal(recargas,resultado==='sucesso'?1:0);
    assert.equal(store.perfil.nome,resultado==='sucesso'?'Nome atualizado':'Nome anterior');
    assert.equal(store.perfil.papel,papel);
    assert.equal(avisos[0][1],resultado==='sucesso'?undefined:'erro');
  }
}
console.log('PASS: salvar perfil nos três papéis, currentTarget nulo após await, falhas de API/rede e envio duplicado.');
