/* ============================================================
   calc.js — cálculos derivados (resumo do mês, categorias, etc.)
   ============================================================ */

function calcularResumo(mes) {
  const lancamentos = lancamentosDoMes(mes);
  const resumo = {
    receitas: 0, despesas: 0, transferencias: 0,
    despesasContaCorrente: 0, despesasCartao: 0,
    porCategoria: {}, semCategoria: 0, qtdSemCategoria: 0
  };
  for (const l of lancamentos) {
    if (l.tipo === 'Receita') resumo.receitas += l.valor;
    else if (l.tipo === 'Transferência') resumo.transferencias += l.valor;
    else if (l.tipo === 'Despesa') {
      resumo.despesas += l.valor;
      if (l.origem === 'Cartão de crédito') resumo.despesasCartao += l.valor;
      else resumo.despesasContaCorrente += l.valor;
      if (l.categoria) {
        resumo.porCategoria[l.categoria] = (resumo.porCategoria[l.categoria] || 0) + l.valor;
      } else {
        resumo.semCategoria += l.valor;
        resumo.qtdSemCategoria++;
      }
    }
  }
  resumo.sobra = resumo.receitas - resumo.despesas;
  return resumo;
}

function calcularSaldoConta(mes) {
  const m = ensureMes(mes);
  const movConta = m.lancamentos.filter(l => l.origem !== 'Cartão de crédito');
  let saldo = m.saldoInicial || 0;
  for (const l of movConta.slice().sort((a, b) => a.data.localeCompare(b.data))) {
    if (l.tipo === 'Receita') saldo += l.valor;
    else saldo -= l.valor; // Despesa e Transferência saem da conta do mesmo jeito
  }
  return saldo;
}

function compararMeses() {
  return listarMeses().map(mes => {
    const r = calcularResumo(mes);
    return { mes, receitas: r.receitas, despesas: r.despesas, sobra: r.sobra };
  });
}
