/* ============================================================
   parsePdf.js — leitura de PDFs de extrato e fatura no navegador
   ============================================================
   Usa pdf.js só para extrair o texto com posição (x,y) de cada
   página e reconstrói as linhas da tabela agrupando itens pela
   mesma altura (y) e ordenando por x — assim a ordem das colunas
   do PDF original é preservada mesmo que o pdf.js devolva os
   textos em fragmentos soltos.
   ============================================================ */

const RE_MOEDA = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const RE_DATA = /^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;

const TOLERANCIA_Y = 3; // px de diferença entre itens que ainda contam como a mesma linha da tabela

async function extrairLinhasPdf(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const itens = content.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ x: i.transform[4], y: i.transform[5], str: i.str }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    let grupoAtual = [];
    let yReferencia = null;
    const fecharGrupo = () => {
      if (!grupoAtual.length) return;
      grupoAtual.sort((a, b) => a.x - b.x);
      const texto = grupoAtual.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (texto) linhas.push(texto);
      grupoAtual = [];
    };
    for (const item of itens) {
      if (yReferencia === null || Math.abs(item.y - yReferencia) <= TOLERANCIA_Y) {
        grupoAtual.push(item);
        yReferencia = grupoAtual.reduce((s, i) => s + i.y, 0) / grupoAtual.length;
      } else {
        fecharGrupo();
        grupoAtual.push(item);
        yReferencia = item.y;
      }
    }
    fecharGrupo();
  }
  return linhas;
}

function dataBrParaIso(dataBr) {
  const [d, m, a] = dataBr.split('/');
  return `${a}-${m}-${d}`;
}

function numeroBr(txt) {
  return txt ? parseFloat(txt.replace(/\./g, '').replace(',', '.')) : null;
}

function extrairTitular(linhas) {
  for (const linha of linhas) {
    const m = /Titular:\s*([A-ZÀ-Ü][A-ZÀ-Ü\s]+?)(?:\s{1,}(?:Cart[ãa]o final|Ag[êe]ncia|CPF)|\s*$)/.exec(linha);
    if (m) return m[1].trim();
  }
  return null;
}

/* ---------- Cabeçalho e resumo da fatura ---------- */

function extrairResumoFatura(linhas) {
  const texto = linhas.join(' ');
  const pega = re => { const m = re.exec(texto); return m ? m[1].trim() : null; };
  return {
    titular: extrairTitular(linhas),
    cartaoFinal: pega(/Cart[ãa]o final:\s*(\d+)/i),
    vencimento: pega(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i),
    fechamento: pega(/Fechamento:\s*(\d{2}\/\d{2}\/\d{4})/i),
    periodo: pega(/Per[íi]odo:\s*(\d{2}\/\d{2}\/\d{4}\s*a\s*\d{2}\/\d{2}\/\d{4})/i),
    totalFatura: numeroBr(pega(/TOTAL DESTA FATURA\s+([\d.,]+,\d{2})/i)),
    limiteTotal: numeroBr(pega(/Limite total\s+([\d.,]+,\d{2})/i)),
    limiteUtilizado: numeroBr(pega(/Limite utilizado\s+([\d.,]+,\d{2})/i)),
    limiteDisponivel: numeroBr(pega(/Limite dispon[íi]vel\s+([\d.,]+,\d{2})/i)),
    pagamentoMinimo: numeroBr(pega(/Pagamento m[íi]nimo\s*(?:\([^)]*\))?\s*([\d.,]+,\d{2})/i))
  };
}

/* ---------- Extrato bancário ---------- */

const TIPOS_LANCAMENTO_EXTRATO = [
  'SALDO ANTERIOR', 'PIX ENVIADO', 'PIX RECEBIDO', 'DEB AUTOMATICO', 'DÉB AUTOMÁTICO',
  'DEB AUTOMATICO', 'COMPRA DEBITO', 'COMPRA DÉBITO', 'COMPRA CREDITO', 'COMPRA CRÉDITO',
  'CREDITO TED', 'CRÉDITO TED', 'PAGTO FATURA', 'RENDIMENTO', 'TARIFA', 'SAQUE'
].sort((a, b) => b.length - a.length);

const TIPO_RECEITA = ['PIX RECEBIDO', 'CREDITO TED', 'CRÉDITO TED', 'RENDIMENTO'];
const TIPO_TRANSFERENCIA = ['PAGTO FATURA'];

function detectarTipoLancamento(texto) {
  for (const t of TIPOS_LANCAMENTO_EXTRATO) {
    const idx = texto.toUpperCase().lastIndexOf(t);
    if (idx !== -1) return { tipo: t, idx, fim: idx + t.length };
  }
  return null;
}

function parseExtratoBancario(linhas) {
  const lancamentos = [];
  const avisos = [];
  let saldoInicial = null;

  for (const linhaOriginal of linhas) {
    const m = RE_DATA.exec(linhaOriginal);
    if (!m) continue;
    const [, dataBr, resto] = m;
    const det = detectarTipoLancamento(resto);
    if (!det) { avisos.push(`Linha não reconhecida: "${linhaOriginal}"`); continue; }

    const descricao = resto.slice(0, det.idx).trim();
    const cauda = resto.slice(det.fim).trim();
    const valores = cauda.match(RE_MOEDA) || [];

    if (det.tipo === 'SALDO ANTERIOR') {
      if (valores.length) saldoInicial = parseFloat(valores[0].replace(/\./g, '').replace(',', '.'));
      continue;
    }
    if (valores.length < 1) { avisos.push(`Sem valor identificado: "${linhaOriginal}"`); continue; }

    const valorTexto = valores.length >= 2 ? valores[valores.length - 2] : valores[0];
    const primeiraOcorrencia = cauda.indexOf(valorTexto);
    const identificador = cauda.slice(0, primeiraOcorrencia).trim();
    const valorNum = parseFloat(valorTexto.replace(/\./g, '').replace(',', '.'));

    let tipo;
    const tipoNorm = det.tipo.toUpperCase();
    if (TIPO_TRANSFERENCIA.includes(tipoNorm)) tipo = 'Transferência';
    else if (TIPO_RECEITA.includes(tipoNorm)) tipo = 'Receita';
    else tipo = valorNum < 0 ? 'Despesa' : 'Receita';

    lancamentos.push({
      data: dataBrParaIso(dataBr),
      descricao,
      origem: 'Conta corrente',
      tipoLancamento: det.tipo,
      identificador: identificador || null,
      categoria: null,
      tipo,
      valor: Math.abs(valorNum),
      origemImportacao: 'pdf-extrato'
    });
  }
  return { lancamentos, avisos, saldoInicial };
}

/* ---------- Fatura de cartão ---------- */

function parseTabelaMccRamo(linhas) {
  const dict = {};
  const re = /^(\d{4})\s+(.+?)\s+\d+\s+[\d.,]+,\d{2}\s+[\d.,]+%$/;
  for (const linha of linhas) {
    const m = re.exec(linha);
    if (m) dict[m[1]] = m[2].trim();
  }
  return dict;
}

function parseFaturaCartao(linhas) {
  const ramoPorMcc = parseTabelaMccRamo(linhas);
  const lancamentos = [];
  const avisos = [];

  for (const linhaOriginal of linhas) {
    const m = RE_DATA.exec(linhaOriginal);
    if (!m) continue;
    const [, dataBr, resto] = m;
    const valores = resto.match(RE_MOEDA) || [];
    if (!valores.length) continue;
    const valorTexto = valores[valores.length - 1];
    const antesDoValor = resto.slice(0, resto.lastIndexOf(valorTexto)).trim();

    const mccMatch = /\b(\d{4})\b/.exec(antesDoValor);
    if (!mccMatch) { avisos.push(`MCC não encontrado: "${linhaOriginal}"`); continue; }
    const mcc = mccMatch[1];
    const estabelecimento = antesDoValor.slice(0, mccMatch.index).trim();
    let restoAposMcc = antesDoValor.slice(mccMatch.index + 4).trim();

    let ramo = ramoPorMcc[mcc] || '';
    let cidade = restoAposMcc;
    if (ramo && restoAposMcc.toUpperCase().startsWith(ramo.toUpperCase())) {
      cidade = restoAposMcc.slice(ramo.length).trim();
    }

    const valorNum = parseFloat(valorTexto.replace(/\./g, '').replace(',', '.'));
    if (!estabelecimento) { avisos.push(`Estabelecimento vazio: "${linhaOriginal}"`); continue; }

    lancamentos.push({
      data: dataBrParaIso(dataBr),
      descricao: estabelecimento,
      origem: 'Cartão de crédito',
      tipoLancamento: 'COMPRA CREDITO',
      identificador: mcc,
      ramoAtividade: ramo || null,
      categoria: null,
      tipo: valorNum < 0 ? 'Receita' : 'Despesa', // valor negativo = estorno
      valor: Math.abs(valorNum),
      origemImportacao: 'pdf-fatura',
      cidade: cidade || null
    });
  }
  return { lancamentos, avisos, resumoFatura: extrairResumoFatura(linhas) };
}

/* ---------- Roteador: tenta identificar o tipo de documento ---------- */

async function analisarPdf(file) {
  const buf = await file.arrayBuffer();
  const linhas = await extrairLinhasPdf(buf);
  const textoCompleto = linhas.join(' ').toUpperCase();

  if (textoCompleto.includes('EXTRATO DE CONTA') || textoCompleto.includes('SALDO ANTERIOR') || textoCompleto.includes('SALDO (R$)')) {
    const r = parseExtratoBancario(linhas);
    return { tipoDocumento: 'extrato', titular: extrairTitular(linhas), ...r, linhas };
  }
  if (textoCompleto.includes('FATURA') && (textoCompleto.includes('CARTÃO') || textoCompleto.includes('CARTAO'))) {
    const r = parseFaturaCartao(linhas);
    return { tipoDocumento: 'fatura', titular: r.resumoFatura.titular, ...r, linhas };
  }
  // fallback: tenta os dois e fica com quem achou mais lançamentos
  const rFatura = parseFaturaCartao(linhas);
  const rExtrato = parseExtratoBancario(linhas);
  if (rFatura.lancamentos.length >= rExtrato.lancamentos.length) {
    return { tipoDocumento: 'fatura (detecção automática)', titular: rFatura.resumoFatura.titular, ...rFatura, linhas };
  }
  return { tipoDocumento: 'extrato (detecção automática)', titular: extrairTitular(linhas), ...rExtrato, linhas };
}
