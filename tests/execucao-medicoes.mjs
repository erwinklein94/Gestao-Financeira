import assert from 'node:assert/strict';
import { agruparOS, conferirMeses, situacoesDocumentais, secaoExecucao, tabelasExecucaoPDF, contratuaisNaoImportados } from '../js/execucao-medicoes.js';
const itens = [
  { mes: 1, arquivo: 'a.xlsx', aba: 'A', ordem_servico: '123', valor: 100, status_planilha: 'Em Auditoria', classificacao: 'CAPEX' },
  { mes: 1, arquivo: 'a.xlsx', aba: 'A', ordem_servico: '123', valor: 25, status_planilha: 'Em Auditoria', classificacao: 'OPEX' },
  { mes: 2, arquivo: 'b.xlsx', aba: 'B', ordem_servico: '123', valor: 50, status_planilha: null },
];
const fontes = [{ mes: 1, arquivo: 'a.xlsx', dados: { total_planilha: 150, execucoes: [{ aba: 'A', diario: [['2026-01-01', '3004005', 'KM', .2, '70', '123', '<img src=x>']] }], retroativos: [{ codigo: '9', valor: 999, descricao: '<script>', observacao: '2025/2026' }], contratuais: [{ codigo: '8', aba: 'C', valor: 10 }] } }];
assert.equal(agruparOS(itens, fontes).length, 2, 'Mesma OS em outro mês não deve se fundir');
assert.equal(agruparOS(itens, fontes)[0].valor, 125);
assert.deepEqual(situacoesDocumentais(itens), [{ s: 'Em Auditoria', v: 125, n: 1 }, { s: 'Não informado na origem', v: 50, n: 1 }]);
assert.equal(conferirMeses(itens, fontes)[0].diferenca, 25, 'Retroativos não entram no realizado');
assert.equal(contratuaisNaoImportados(itens, fontes).length, 1);
const html = secaoExecucao(itens, fontes);
assert.ok(!html.includes('<script>'));
assert.ok(html.includes('&lt;script&gt;'));
const pdf = tabelasExecucaoPDF(itens, fontes, 'OPEX');
assert.equal(pdf.find((t) => t.titulo.startsWith('OS e')).linhas.length, 1);
assert.equal(pdf.find((t) => t.titulo.startsWith('Execução')).linhas.length, 1);
assert.equal(pdf.find((t) => t.titulo.startsWith('Conferência')).linhas[0][3], 'R$ 25,00');
console.log('PASS: OS sem duplicação, status documental, reconciliação, retroativos separados, escape HTML e PDF.');
