/* ============================================================
   state.js — modelo de dados e persistência (localStorage)
   ============================================================
   Um "lançamento" segue o mesmo modelo da planilha de referência:
   { id, data (YYYY-MM-DD), descricao, origem, tipoLancamento,
     chave, identificador, ramoAtividade, categoria, tipo,
     valor (sempre positivo), origemImportacao, semCategoria }

   Tudo fica organizado por mês (chave "YYYY-MM"), cada mês com sua
   própria lista de lançamentos — módulos independentes, mas o
   dashboard permite comparar meses entre si.
   ============================================================ */

const STORAGE_KEY = 'imenseria.financas.v1';

const TIPOS = ['Receita', 'Despesa', 'Transferência'];
const ORIGENS = ['Conta corrente', 'Cartão de crédito', 'Dinheiro'];

const CATEGORIAS_PADRAO = [
  'Alimentação', 'Assinaturas', 'Compras', 'Educação', 'Investimento',
  'Lazer', 'Mercado', 'Moradia', 'Pets', 'Presentes', 'Receita',
  'Saúde', 'Serviços', 'Transferência', 'Transporte'
];

function uid() {
  return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return {
    meses: {},        // { "2026-07": { lancamentos: [...], orcamento: {categoria: valor}, saldoInicial, saldoFinalInformado } }
    depara: seedDepara(),
    categorias: CATEGORIAS_PADRAO.slice(),
    mesAtual: null
  };
}

function seedDepara() {
  // Regras de partida (mesmas do material de referência) — o usuário edita/expande.
  return {
    chaveCategoria: {
      'IMOB SANTA CLARA': 'Moradia', 'CONDOMINIO AURORA': 'Moradia', 'ENEL': 'Moradia',
      'VIVO': 'Serviços', 'SALARIO': 'Receita', 'SUPERMERCADO DIA': 'Mercado',
      'FATURA CARTAO': 'Transferência', 'SMARTFIT': 'Saúde', 'SAQUE 24H': 'Outros',
      'CURSO INGLES': 'Educação', 'POSTO IPIRANGA': 'Transporte', 'UNIMED': 'Saúde',
      'FREELANCE': 'Receita', 'DROGASIL': 'Saúde', 'DIARISTA': 'Serviços',
      'PORTO SEGURO': 'Transporte', 'PET SHOP': 'Pets', 'PRESENTE': 'Presentes',
      'TARIFA BANCARIA': 'Serviços', 'CDB': 'Receita', 'RESERVA': 'Investimento',
      'IFOOD': 'Alimentação', 'NETFLIX': 'Assinaturas', 'DROGARIA SP': 'Saúde',
      'PAO DE ACUCAR': 'Mercado', 'SPOTIFY': 'Assinaturas', 'UBER': 'Transporte',
      'OUTBACK': 'Alimentação', 'LIVRARIA': 'Educação', 'MAGAZINE LUIZA': 'Compras',
      'PADARIA': 'Alimentação', 'POSTO SHELL': 'Transporte', 'CINEMARK': 'Lazer',
      'EXTRA': 'Mercado', 'PAGUE MENOS': 'Saúde', 'APPLE': 'Assinaturas',
      'DECATHLON': 'Compras'
    },
    mccCategoria: {
      '5812': 'Alimentação', '5541': 'Transporte', '4899': 'Assinaturas',
      '5912': 'Saúde', '5411': 'Mercado', '5735': 'Assinaturas', '4121': 'Transporte',
      '5722': 'Compras', '5942': 'Educação', '7832': 'Lazer', '5462': 'Alimentação',
      '5655': 'Compras', '5999': 'Compras'
    },
    mccRamo: {}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return Object.assign(emptyState(), parsed);
  } catch (e) {
    console.error('Falha ao ler estado salvo, iniciando do zero.', e);
    return emptyState();
  }
}

let STATE = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
}

function ensureMes(mes) {
  if (!STATE.meses[mes]) {
    STATE.meses[mes] = { lancamentos: [], orcamento: {}, saldoInicial: 0, saldoFinalInformado: null };
  }
  return STATE.meses[mes];
}

function listarMeses() {
  return Object.keys(STATE.meses).sort();
}

function mesAtual() {
  if (!STATE.mesAtual || !STATE.meses[STATE.mesAtual]) {
    const meses = listarMeses();
    STATE.mesAtual = meses.length ? meses[meses.length - 1] : mesISOAtual();
    ensureMes(STATE.mesAtual);
  }
  return STATE.mesAtual;
}

function mesISOAtual() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function setMesAtual(mes) {
  ensureMes(mes);
  STATE.mesAtual = mes;
  saveState();
}

function dataParaMes(dataISO) {
  return dataISO.slice(0, 7);
}

function chaveDuplicata(l) {
  return [l.data, l.origem, l.descricao.trim().toUpperCase(), l.valor.toFixed(2)].join('|');
}

function jaExiste(l) {
  const mes = ensureMes(dataParaMes(l.data));
  const chave = chaveDuplicata(l);
  return mes.lancamentos.some(x => chaveDuplicata(x) === chave);
}

function adicionarLancamento(l, opts = {}) {
  l.id = l.id || uid();
  l.valor = Math.abs(Number(l.valor) || 0);
  l.semCategoria = !l.categoria;
  const mes = ensureMes(dataParaMes(l.data));
  if (!opts.permitirDuplicata && jaExiste(l)) {
    return { ok: false, motivo: 'duplicata' };
  }
  mes.lancamentos.push(l);
  saveState();
  return { ok: true, lancamento: l };
}

function importarLote(lancamentos, opts = {}) {
  const resultado = { importados: 0, duplicados: 0, itens: [] };
  for (const l of lancamentos) {
    const r = adicionarLancamento(l, opts);
    if (r.ok) { resultado.importados++; resultado.itens.push(r.lancamento); }
    else resultado.duplicados++;
  }
  return resultado;
}

function atualizarLancamento(mes, id, patch) {
  const m = ensureMes(mes);
  const idx = m.lancamentos.findIndex(x => x.id === id);
  if (idx === -1) return false;
  Object.assign(m.lancamentos[idx], patch);
  if ('categoria' in patch) m.lancamentos[idx].semCategoria = !patch.categoria;
  saveState();
  return true;
}

function removerLancamento(mes, id) {
  const m = ensureMes(mes);
  m.lancamentos = m.lancamentos.filter(x => x.id !== id);
  saveState();
}

function lancamentosDoMes(mes) {
  return ensureMes(mes).lancamentos;
}

function setOrcamento(mes, categoria, valor) {
  const m = ensureMes(mes);
  m.orcamento[categoria] = Number(valor) || 0;
  saveState();
}

function setSaldoInicial(mes, valor) {
  const m = ensureMes(mes);
  m.saldoInicial = Number(valor) || 0;
  saveState();
}

function setSaldoFinalInformado(mes, valor) {
  const m = ensureMes(mes);
  m.saldoFinalInformado = valor === '' || valor === null ? null : Number(valor);
  saveState();
}

function addCategoria(nome) {
  if (nome && !STATE.categorias.includes(nome)) {
    STATE.categorias.push(nome);
    saveState();
  }
}

function addRegraDepara(chave, categoria) {
  if (!chave) return;
  STATE.depara.chaveCategoria[chave.toUpperCase()] = categoria;
  saveState();
}
