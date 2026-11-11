// =====================================================================
// Cálculos financeiros: orçado × previsto × realizado, projeções e margens
// =====================================================================
import { store, contratosDaEmpresa, empresaPorId, empresasAtivas } from './state.js';
import { soma, MESES_LONGOS, fmtBRL, fmtCompacto, fmtPct } from './utils.js';

export const medicaoConta = (m) => m.status !== 'Cancelada' && m.status !== 'Glosada';

/** Primeiro mês "aberto" do ano (1–12). 13 = ano encerrado; 1 = ano futuro. */
export function mesAberto(ano) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  if (ano < y) return 13;
  if (ano > y) return 1;
  return hoje.getMonth() + 1;
}
export const mesesFechados = (ano) => Math.min(12, mesAberto(ano) - 1);
export const mesesRestantes = (ano) => 12 - mesesFechados(ano);

function filtrar(linhas, { ano, empresaId, tipo, contratoId }) {
  return linhas.filter((r) =>
    (ano == null || r.ano === ano) &&
    (!empresaId || r.empresa_id === empresaId) &&
    (!tipo || r.tipo === tipo) &&
    (!contratoId || r.contrato_id === contratoId));
}

export function serie(linhas, filtro, campo = 'valor') {
  const s = Array(12).fill(0);
  for (const r of filtrar(linhas, filtro)) s[r.mes - 1] += Number(r[campo]) || 0;
  return s;
}

/**
 * Resumo financeiro para um recorte (ano + empresa opcional + tipo opcional).
 * Projeção dos meses abertos = forecast cadastrado; sem forecast, usa o ritmo
 * (média dos últimos 3 meses fechados). Se o mês aberto já tiver realizado
 * maior que a base, prevalece o realizado.
 */
export function resumo({ ano = store.ano, empresaId = null, tipo = null } = {}) {
  const f = { ano, empresaId, tipo };
  const orc = serie(store.orcamentos, f);
  const prev = serie(store.previsoes, f);
  const real = serie(store.medicoes.filter(medicaoConta), f);
  const fechados = mesesFechados(ano);
  const restantes = 12 - fechados;

  const orcAnual = soma(orc);
  const prevAnual = soma(prev);
  const realAno = soma(real);
  const realFechado = soma(real.slice(0, fechados));

  const janela = real.slice(Math.max(0, fechados - 3), fechados);
  const ritmo = janela.length ? soma(janela) / janela.length : 0;

  const proj = real.map((v, i) => (i < fechados ? null : Math.max(v, prev[i] > 0 ? prev[i] : ritmo)));
  const projRestante = soma(proj.filter((x) => x !== null));
  const projAnual = realFechado + projRestante;

  const saldo = orcAnual - realAno;
  const margemMensal = restantes > 0 ? Math.max(0, saldo) / restantes : 0;
  const orcAteMes = soma(orc.slice(0, fechados));
  const orcRestante = soma(orc.slice(fechados));

  const pctConsumido = orcAnual > 0 ? realAno / orcAnual : null;
  const pctProjetado = orcAnual > 0 ? projAnual / orcAnual : null;
  const pctEsperado = orcAnual > 0 ? orcAteMes / orcAnual : null;

  let situacao = 'sem-orcamento';
  if (orcAnual > 0) situacao = pctProjetado > 1 ? 'estouro' : pctProjetado > 0.95 ? 'atencao' : 'ok';

  const aderencia = prev.map((p, i) => (p > 0 && (i < fechados || real[i] > 0) ? real[i] / p : null));

  return {
    ano, empresaId, tipo, orc, prev, real, proj, fechados, restantes,
    orcAnual, prevAnual, realAno, realFechado, ritmo, projRestante, projAnual,
    saldo, margemMensal, orcAteMes, orcRestante, pctConsumido, pctProjetado, pctEsperado,
    situacao, aderencia,
    desvioAteMes: realFechado - orcAteMes,
    estouroPrevisto: orcAnual > 0 ? Math.max(0, projAnual - orcAnual) : 0,
  };
}

/** Saldo projetado mês a mês (orçamento anual − realizado − projeção acumulada). */
export function saldoProjetadoMensal(r) {
  let gasto = r.realFechado;
  return r.proj.map((p, i) => {
    if (i < r.fechados) return null;
    gasto += p || 0;
    return r.orcAnual - gasto;
  });
}

// ---------- Contratos ----------
export function resumoContrato(c, ano = store.ano) {
  const meds = store.medicoes.filter((m) => m.contrato_id === c.id && medicaoConta(m));
  const medido = soma(meds.map((m) => m.valor));
  const medidoAno = soma(meds.filter((m) => m.ano === ano).map((m) => m.valor));
  const pago = soma(meds.map((m) => m.valor_pago ?? 0));
  const valor = Number(c.valor_contrato) || 0;
  const saldo = valor - medido;
  const pct = valor > 0 ? medido / valor : null;

  // ritmo do contrato: média dos últimos 3 meses (calendário) com base no ano corrente
  const fechados = mesesFechados(ano);
  const porMes = serie(meds, { ano });
  const janela = porMes.slice(Math.max(0, fechados - 3), fechados);
  const ritmo = janela.length ? soma(janela) / janela.length : 0;
  const cobertura = ritmo > 0 ? saldo / ritmo : null;

  const futuras = store.previsoes.filter((p) => p.contrato_id === c.id && (p.ano > ano || (p.ano === ano && p.mes > fechados)));
  const previstoFuturo = soma(futuras.map((p) => p.valor));
  const proximaPrev = futuras.sort((a, b) => a.ano - b.ano || a.mes - b.mes)[0] || null;

  let nivel = 'ok';
  if (pct !== null && pct >= 1) nivel = 'erro';
  else if (pct !== null && pct >= 0.9) nivel = 'erro';
  else if (pct !== null && pct >= 0.75) nivel = 'alerta';

  return { medido, medidoAno, pago, valor, saldo, pct, ritmo, cobertura, previstoFuturo, proximaPrev, nivel, qtdMedicoes: meds.length };
}

// ---------- Alertas gerenciais ----------
export function alertas(ano = store.ano, empresaId = null) {
  const lista = [];
  const empresas = empresaId ? [empresaPorId(empresaId)].filter(Boolean) : empresasAtivas();
  const hojeISO = new Date().toISOString().slice(0, 10);

  for (const e of empresas) {
    for (const c of contratosDaEmpresa(e.id).filter((x) => x.status !== 'Encerrado')) {
      const r = resumoContrato(c, ano);
      const link = `#/empresa/${e.slug}/registros/contratos`;
      if (r.valor > 0 && r.saldo < 0) {
        lista.push({ nivel: 'erro', icone: 'alerta', titulo: `${e.nome}: medições acima do valor do contrato`, detalhe: `${c.titulo} — excedeu ${fmtBRL(-r.saldo)}`, link });
      } else if (r.pct !== null && r.pct >= 0.9) {
        lista.push({ nivel: 'erro', icone: 'alerta', titulo: `${e.nome}: contrato com saldo crítico`, detalhe: `${c.titulo} — ${fmtPct(r.pct)} consumido, saldo ${fmtCompacto(r.saldo)}`, link });
      } else if (r.cobertura !== null && r.cobertura < 2 && r.saldo > 0) {
        lista.push({ nivel: 'alerta', icone: 'relogio', titulo: `${e.nome}: saldo cobre menos de 2 meses`, detalhe: `${c.titulo} — cerca de ${r.cobertura.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês(es) no ritmo atual`, link });
      }
      if (c.saldo_sap !== null && c.saldo_sap !== undefined && r.proximaPrev && Number(c.saldo_sap) < Number(r.proximaPrev.valor)) {
        lista.push({ nivel: 'alerta', icone: 'carteira', titulo: `${e.nome}: saldo SAP insuficiente para a próxima medição`, detalhe: `${c.titulo} — saldo SAP ${fmtBRL(c.saldo_sap)} × previsto ${fmtBRL(r.proximaPrev.valor)} (${MESES_LONGOS[r.proximaPrev.mes - 1]})`, link });
      }
    }
    for (const tipo of ['CAPEX', 'OPEX']) {
      const r = resumo({ ano, empresaId: e.id, tipo });
      if (r.situacao === 'estouro') {
        lista.push({ nivel: 'erro', icone: 'tendencia', titulo: `${e.nome}: estouro previsto no ${tipo}`, detalhe: `Projeção ${fmtCompacto(r.projAnual)} para orçamento de ${fmtCompacto(r.orcAnual)} (+${fmtCompacto(r.estouroPrevisto)})`, link: `#/empresa/${e.slug}/dashboard` });
      } else if (r.orcAnual === 0 && r.realAno > 0) {
        lista.push({ nivel: 'info', icone: 'orcamento', titulo: `${e.nome}: ${tipo} sem orçamento cadastrado`, detalhe: `Já há ${fmtCompacto(r.realAno)} realizado em ${ano}.`, link: `#/empresa/${e.slug}/registros/orcamento` });
      }
    }
    const emAprov = store.medicoes.filter((m) => m.empresa_id === e.id && m.ano === ano && m.status === 'Em aprovação');
    if (emAprov.length) {
      lista.push({ nivel: 'info', icone: 'medicao', titulo: `${e.nome}: ${emAprov.length} medição(ões) em aprovação`, detalhe: `Total ${fmtBRL(soma(emAprov.map((m) => m.valor)))}`, link: `#/empresa/${e.slug}/registros/medicoes` });
    }
    const vencidas = store.pendencias.filter((p) => p.empresa_id === e.id && p.status !== 'Concluída' && p.prazo && p.prazo < hojeISO);
    if (vencidas.length) {
      lista.push({ nivel: 'alerta', icone: 'relogio', titulo: `${e.nome}: ${vencidas.length} pendência(s) vencida(s)`, detalhe: vencidas.map((p) => p.titulo).slice(0, 3).join(' · '), link: `#/empresa/${e.slug}/registros/pendencias` });
    }
  }
  const peso = { erro: 0, alerta: 1, info: 2 };
  return lista.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}
