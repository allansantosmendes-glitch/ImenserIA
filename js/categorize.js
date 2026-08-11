/* ============================================================
   categorize.js — motor de categorização (regras "De-Para")
   ============================================================
   Mesma lógica do material de referência: primeiro tenta achar uma
   "Chave" conhecida dentro da descrição (regra mais confiável e
   editável pelo usuário); se não achar e for lançamento de cartão
   com MCC, usa o MCC como categoria sugerida; senão fica "sem
   categoria" para revisão manual — é assim que se descobre o que
   falta cadastrar.
   ============================================================ */

const PALAVRAS_RUIDO = new Set([
  'COM', 'BR', 'LTDA', 'ME', 'EIRELI', 'SA', 'FL', 'AG', 'FILIAL', 'LOJA',
  'PARC', 'PARCELA', 'DE', 'DA', 'DO', 'E', 'MENSAL', 'ASSINATURA'
]);

function normalizar(txt) {
  return (txt || '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[*./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sugerirChave(descricao) {
  const limpo = normalizar(descricao).replace(/\b\d{3,}\b/g, '').trim();
  const palavras = limpo.split(' ').filter(w => w && !PALAVRAS_RUIDO.has(w) && w.length > 1);
  if (!palavras.length) return normalizar(descricao).split(' ')[0] || '';
  // usa as 1-2 primeiras palavras significativas como chave sugerida
  return palavras.slice(0, 2).join(' ');
}

function encontrarChaveConhecida(descricao) {
  const desc = normalizar(descricao);
  let melhor = null;
  for (const chave of Object.keys(STATE.depara.chaveCategoria)) {
    if (desc.includes(normalizar(chave))) {
      if (!melhor || chave.length > melhor.length) melhor = chave;
    }
  }
  return melhor;
}

function categorizar(lancamento) {
  if (lancamento.tipo === 'Transferência' && !lancamento.categoria) {
    return { categoria: 'Transferência', chave: lancamento.chave || sugerirChave(lancamento.descricao), origemRegra: 'tipo=Transferência' };
  }
  const chaveConhecida = encontrarChaveConhecida(lancamento.descricao);
  if (chaveConhecida) {
    return { categoria: STATE.depara.chaveCategoria[chaveConhecida], chave: chaveConhecida, origemRegra: 'chave' };
  }
  if (lancamento.identificador && /^\d{4}$/.test(lancamento.identificador) && STATE.depara.mccCategoria[lancamento.identificador]) {
    return {
      categoria: STATE.depara.mccCategoria[lancamento.identificador],
      chave: sugerirChave(lancamento.descricao),
      origemRegra: 'mcc'
    };
  }
  return { categoria: null, chave: sugerirChave(lancamento.descricao), origemRegra: null };
}

// Categorias que representam movimentação entre contas do próprio titular
// (ex.: PIX para a própria reserva/investimento) — não são despesa nem receita.
const CATEGORIAS_TRANSFERENCIA = new Set(['Investimento', 'Transferência']);

function aplicarCategorizacao(lancamento) {
  const r = categorizar(lancamento);
  lancamento.chave = lancamento.chave || r.chave;
  if (!lancamento.categoria && r.categoria) lancamento.categoria = r.categoria;
  if (lancamento.categoria && CATEGORIAS_TRANSFERENCIA.has(lancamento.categoria) && lancamento.tipo !== 'Receita') {
    lancamento.tipo = 'Transferência';
  }
  lancamento.semCategoria = !lancamento.categoria;
  return lancamento;
}
