/* ============================================================
   xlsxIO.js — importar/exportar planilhas de controle financeiro
   ============================================================
   Compatível com o modelo de planilha de referência: aba
   "Lancamentos" (ou "Lançamentos") com as colunas Data, Descrição,
   Origem, Tipo de lançamento, Chave, CNPJ/MCC, Ramo de atividade,
   Categoria, Tipo, Valor, Mês — e aba "DePara" com Chave/Categoria.
   ============================================================ */

function normalizarCabecalho(s) {
  return String(s || '')
    .toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
}

function acharAba(workbook, candidatos) {
  const nomes = workbook.SheetNames;
  for (const cand of candidatos) {
    const alvo = normalizarCabecalho(cand);
    const achado = nomes.find(n => normalizarCabecalho(n) === alvo);
    if (achado) return achado;
  }
  return null;
}

// A planilha de referência tem um título e um texto de ajuda antes da
// linha de cabeçalho de verdade — procura a linha que começa com "Data".
function linhasComoObjetos(sheet) {
  const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  const idxCabecalho = matriz.findIndex(linha => linha[0] && normalizarCabecalho(linha[0]) === 'DATA');
  if (idxCabecalho === -1) return [];
  const cabecalho = matriz[idxCabecalho];
  const linhasDados = matriz.slice(idxCabecalho + 1);
  const objetos = [];
  for (const linha of linhasDados) {
    if (!linha[0]) continue; // fim da tabela / linhas de rodapé sem data
    const obj = {};
    cabecalho.forEach((titulo, i) => { if (titulo) obj[titulo] = linha[i] ?? null; });
    objetos.push(obj);
  }
  return objetos;
}

function excelDataParaIso(valor) {
  if (valor instanceof Date) {
    return valor.getFullYear() + '-' + String(valor.getMonth() + 1).padStart(2, '0') + '-' + String(valor.getDate()).padStart(2, '0');
  }
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(valor || '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

// Aceita tanto "2.300,00" (pt-BR) quanto "2,300.00" (en-US, formato que o
// SheetJS às vezes usa ao formatar números) — o último separador é o decimal.
function parseValorTexto(s) {
  const limpo = String(s).replace(/[^\d,.-]/g, '');
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  if (ultimaVirgula > ultimoPonto) return parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  if (ultimoPonto > ultimaVirgula) return parseFloat(limpo.replace(/,/g, ''));
  return parseFloat(limpo);
}

async function importarXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const abaLanc = acharAba(wb, ['Lancamentos', 'Lançamentos']);
  const resultado = { lancamentos: [], regrasDepara: 0, avisos: [] };
  if (!abaLanc) {
    resultado.avisos.push('Não encontrei uma aba "Lançamentos" nesta planilha.');
    return resultado;
  }
  const linhas = linhasComoObjetos(wb.Sheets[abaLanc]);
  for (const linha of linhas) {
    const chaves = {};
    for (const k of Object.keys(linha)) chaves[normalizarCabecalho(k)] = linha[k];
    const data = chaves['DATA'];
    const chaveValor = Object.keys(chaves).find(k => k.startsWith('VALOR'));
    const valorBruto = chaveValor ? chaves[chaveValor] : null;
    const valor = typeof valorBruto === 'string' ? parseValorTexto(valorBruto) : valorBruto;
    if (!data || valor === null || valor === undefined || valor === '') continue;
    resultado.lancamentos.push({
      data: excelDataParaIso(data),
      descricao: chaves['DESCRICAONODOCUMENTO'] || chaves['DESCRICAO'] || '',
      origem: chaves['ORIGEM'] || 'Conta corrente',
      tipoLancamento: chaves['TIPODELANCAMENTO'] || null,
      chave: chaves['CHAVE'] || null,
      identificador: chaves['CNPJMCC'] || null,
      ramoAtividade: chaves['RAMODEATIVIDADE'] || null,
      categoria: chaves['CATEGORIA'] || null,
      tipo: chaves['TIPO'] || (Number(valor) >= 0 ? 'Receita' : 'Despesa'),
      valor: Math.abs(Number(valor) || 0),
      origemImportacao: 'xlsx'
    });
  }

  const abaDepara = acharAba(wb, ['DePara', 'De-Para', 'De Para']);
  if (abaDepara) {
    const matriz = XLSX.utils.sheet_to_json(wb.Sheets[abaDepara], { header: 1, defval: null, blankrows: false });
    const idxCab = matriz.findIndex(l => l[0] && normalizarCabecalho(l[0]) === 'CHAVE');
    if (idxCab !== -1) {
      for (const linha of matriz.slice(idxCab + 1)) {
        const chave = linha[0];
        const categoria = linha[1];
        if (chave && categoria && String(chave).trim() !== 'Sem regra cadastrada:') {
          STATE.depara.chaveCategoria[String(chave).toUpperCase()] = String(categoria);
          resultado.regrasDepara++;
        }
      }
      saveState();
    }
  }
  return resultado;
}

function exportarXlsx(mes) {
  const lancamentos = lancamentosDoMes(mes).slice().sort((a, b) => a.data.localeCompare(b.data));
  const wb = XLSX.utils.book_new();

  const linhasLanc = lancamentos.map(l => ({
    'Data': l.data,
    'Descrição no documento': l.descricao,
    'Origem': l.origem,
    'Tipo de lançamento': l.tipoLancamento || '',
    'Chave': l.chave || '',
    'CNPJ / MCC': l.identificador || '',
    'Ramo de atividade': l.ramoAtividade || '',
    'Categoria': l.categoria || '',
    'Tipo': l.tipo,
    'Valor (R$)': l.valor,
    'Mês': mes.slice(5, 7) + '/' + mes.slice(0, 4) // MM/AAAA
  }));
  const wsLanc = XLSX.utils.json_to_sheet(linhasLanc);
  XLSX.utils.book_append_sheet(wb, wsLanc, 'Lancamentos');

  const linhasDp = Object.entries(STATE.depara.chaveCategoria).map(([chave, categoria]) => ({ Chave: chave, Categoria: categoria }));
  const wsDp = XLSX.utils.json_to_sheet(linhasDp);
  XLSX.utils.book_append_sheet(wb, wsDp, 'DePara');

  const resumo = calcularResumo(mes);
  const linhasResumo = [
    { Item: 'Receitas', Valor: resumo.receitas },
    { Item: 'Despesas', Valor: resumo.despesas },
    { Item: 'Sobra do mês', Valor: resumo.sobra },
    { Item: 'Transferências (não entram no resultado)', Valor: resumo.transferencias },
    { Item: 'Despesas na conta corrente', Valor: resumo.despesasContaCorrente },
    { Item: 'Despesas no cartão de crédito', Valor: resumo.despesasCartao },
    {},
    { Item: 'Categoria', Valor: '% do total' },
    ...Object.entries(resumo.porCategoria).map(([cat, v]) => ({ Item: cat, Valor: v }))
  ];
  const wsResumo = XLSX.utils.json_to_sheet(linhasResumo, { skipHeader: true });
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  const orcamento = ensureMes(mes).orcamento;
  const linhasOrc = Object.keys(resumo.porCategoria).map(cat => {
    const orcado = orcamento[cat] || 0;
    const realizado = resumo.porCategoria[cat] || 0;
    return { Categoria: cat, 'Orçado (R$)': orcado, 'Realizado (R$)': realizado, 'Diferença (R$)': orcado - realizado };
  });
  const wsOrc = XLSX.utils.json_to_sheet(linhasOrc);
  XLSX.utils.book_append_sheet(wb, wsOrc, 'Orcamento');

  XLSX.writeFile(wb, `controle-financeiro-${mes}.xlsx`);
}
