/* ============================================================
   ui.js — renderização do dashboard e interações da tela
   ============================================================ */

const CORES_GRAFICO = ['#7c6cf0','#4f8cff','#f5a623','#ff6b9d','#34d399','#38bdf8','#fb923c','#a78bfa','#f87171','#2dd4bf','#facc15','#94a3b8','#c084fc','#60a5fa'];

let chartCategorias, chartOrcamento, chartEvolucao;
let itensImportacaoPendente = [];
let saldosIniciaisPendentes = [];
let resumosCartaoPendentes = [];

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataBr(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/* ---------------- seletor de mês / cabeçalho ---------------- */

function popularSeletorMes() {
  const sel = document.getElementById('seletorMes');
  const meses = listarMeses();
  sel.innerHTML = meses.map(m => `<option value="${m}">${rotuloMes(m)}</option>`).join('');
  sel.value = mesAtual();
}

function rotuloMes(m) {
  const [ano, mes] = m.split('-');
  const nomes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${nomes[Number(mes) - 1]} de ${ano}`;
}

function renderSubtitulo(mes) {
  const el = document.getElementById('subtituloTitular');
  const nomeMes = rotuloMes(mes);
  el.textContent = (STATE.titular ? STATE.titular + ' · ' : '') + nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
}

/* ---------------- categorias (selects) ---------------- */

function popularSelectCategoria(el, valorAtual) {
  el.innerHTML = '<option value="">Sem categoria</option>' +
    STATE.categorias.map(c => `<option value="${c}" ${c === valorAtual ? 'selected' : ''}>${c}</option>`).join('');
}

/* ---------------- render geral ---------------- */

function renderTudo() {
  const mes = mesAtual();
  popularSeletorMes();
  renderSubtitulo(mes);
  renderCards(mes);
  renderAlertaSemCategoria(mes);
  renderGastosPorCategoria(mes);
  renderEntradasSaidas(mes);
  renderGraficoEvolucao();
  renderTabelaLancamentos(mes, document.getElementById('filtroLancamentos').value);
  renderResumoCartao(mes);
  renderTabelaCartao(mes);
  renderGraficoOrcamento(mes);
  renderTabelaOrcamento(mes);
  popularSelectCategoria(document.getElementById('selectCategoriaManual'));
}

function renderCards(mes) {
  const r = calcularResumo(mes);
  const saldoConta = calcularSaldoConta(mes);
  const cartao = ensureMes(mes).cartao;
  const cards = [
    { rotulo: 'Receitas do mês', valor: r.receitas, classe: 'receita', rodape: 'entradas na conta' },
    { rotulo: 'Despesas do mês', valor: r.despesas, classe: 'despesa', rodape: 'saídas no total' },
    { rotulo: 'Resultado', valor: r.sobra, classe: 'sobra', positivo: r.sobra >= 0, rodape: r.sobra >= 0 ? 'sobrou 🎉' : 'faltou' },
    { rotulo: 'Saldo em conta', valor: saldoConta, classe: 'sobra', positivo: saldoConta >= 0, rodape: 'após lançamentos', editavel: true },
    { rotulo: 'Fatura do cartão', valor: r.despesasCartao, classe: 'despesa', rodape: cartao && cartao.vencimento ? `vence ${cartao.vencimento}` : '—' }
  ];
  document.getElementById('cardsResumo').innerHTML = cards.map(c => `
    <div class="card ${c.classe}">
      <div class="rotulo">${c.rotulo}${c.editavel ? ' <button type="button" class="link btn-editar-saldo" title="Ajustar saldo inicial do mês">✎</button>' : ''}</div>
      <div class="valor ${c.positivo === undefined ? '' : (c.positivo ? 'positivo' : 'negativo')}">${formatarMoeda(c.valor)}</div>
      <div class="rodape">${c.rodape}</div>
    </div>
  `).join('');
  const btnEditar = document.querySelector('.btn-editar-saldo');
  if (btnEditar) btnEditar.addEventListener('click', () => {
    const atual = ensureMes(mes).saldoInicial || 0;
    const valor = prompt('Saldo em conta no início do mês (antes do primeiro lançamento):', atual);
    if (valor === null) return;
    setSaldoInicial(mes, valor.replace(',', '.'));
    renderTudo();
  });
}

function renderAlertaSemCategoria(mes) {
  const el = document.getElementById('alertaSemCategoria');
  const r = calcularResumo(mes);
  if (!r.qtdSemCategoria) { el.classList.add('oculto'); el.innerHTML = ''; return; }
  el.classList.remove('oculto');
  el.innerHTML = `<strong>⚠ ${r.qtdSemCategoria} lançamento(s) sem categoria — ${formatarMoeda(r.semCategoria)}</strong>
    Ajuste a categoria na aba Lançamentos para os relatórios ficarem completos.`;
}

/* ---------------- gastos por categoria (lista + rosca) ---------------- */

function renderGastosPorCategoria(mes) {
  const r = calcularResumo(mes);
  const entradas = Object.entries(r.porCategoria).sort((a, b) => b[1] - a[1]);
  const total = entradas.reduce((s, e) => s + e[1], 0);

  const lista = document.getElementById('listaCategorias');
  if (!entradas.length) {
    lista.innerHTML = '<div class="estado-vazio">Sem despesas categorizadas ainda.</div>';
  } else {
    lista.innerHTML = entradas.map(([cat, valor], i) => `
      <div class="linha-categoria">
        <span class="ponto-cor" style="background:${CORES_GRAFICO[i % CORES_GRAFICO.length]}"></span>
        <span class="nome">${cat}</span>
        <span class="valor">${formatarMoeda(valor)}</span>
        <span class="pct">${total ? (valor / total * 100).toFixed(0) : 0}%</span>
      </div>
    `).join('');
  }
  document.getElementById('donutTotalTexto').textContent = formatarMoeda(total);

  const ctx = document.getElementById('graficoCategorias');
  if (chartCategorias) chartCategorias.destroy();
  if (!entradas.length) return;
  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: entradas.map(e => e[0]), datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES_GRAFICO, borderColor: 'transparent' }] },
    options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: true } } }
  });
}

/* ---------------- entradas x saídas ---------------- */

function renderEntradasSaidas(mes) {
  const r = calcularResumo(mes);
  const max = Math.max(r.receitas, r.despesas, 1);
  document.getElementById('barrasEntradasSaidas').innerHTML = `
    <div class="barra-comparativa entradas">
      <div class="topo"><span>Entradas</span><span>${formatarMoeda(r.receitas)}</span></div>
      <div class="trilho"><div class="preenchido" style="width:${(r.receitas / max * 100).toFixed(1)}%"></div></div>
    </div>
    <div class="barra-comparativa saidas">
      <div class="topo"><span>Saídas</span><span>${formatarMoeda(r.despesas)}</span></div>
      <div class="trilho"><div class="preenchido" style="width:${(r.despesas / max * 100).toFixed(1)}%"></div></div>
    </div>
  `;
  const m = ensureMes(mes);
  const saldoFinal = calcularSaldoConta(mes);
  document.getElementById('linhasSaldo').innerHTML = `
    <div class="linha-saldo"><span>Saldo inicial do mês</span><span class="valor">${formatarMoeda(m.saldoInicial || 0)}</span></div>
    <div class="linha-saldo final"><span>Saldo final</span><span class="valor">${formatarMoeda(saldoFinal)}</span></div>
  `;
}

function renderGraficoEvolucao() {
  const dados = compararMeses();
  const ctx = document.getElementById('graficoEvolucao');
  if (chartEvolucao) chartEvolucao.destroy();
  if (!dados.length) return;
  chartEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dados.map(d => rotuloMes(d.mes)),
      datasets: [
        { label: 'Receitas', data: dados.map(d => d.receitas), borderColor: '#34d399', tension: .25 },
        { label: 'Despesas', data: dados.map(d => d.despesas), borderColor: '#ff6b81', tension: .25 },
        { label: 'Sobra', data: dados.map(d => d.sobra), borderColor: '#7c6cf0', tension: .25 }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: '#8890a6' } } },
      scales: {
        x: { ticks: { color: '#8890a6' }, grid: { color: '#262b3d' } },
        y: { ticks: { color: '#8890a6' }, grid: { color: '#262b3d' } }
      }
    }
  });
}

function renderGraficoOrcamento(mes) {
  const r = calcularResumo(mes);
  const orcamento = ensureMes(mes).orcamento;
  const categorias = [...new Set([...Object.keys(orcamento), ...Object.keys(r.porCategoria)])];
  const ctx = document.getElementById('graficoOrcamento');
  if (chartOrcamento) chartOrcamento.destroy();
  if (!categorias.length) return;
  chartOrcamento = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categorias,
      datasets: [
        { label: 'Orçado', data: categorias.map(c => orcamento[c] || 0), backgroundColor: '#33384c' },
        { label: 'Realizado', data: categorias.map(c => r.porCategoria[c] || 0), backgroundColor: '#7c6cf0' }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: '#8890a6' } } },
      scales: {
        x: { ticks: { color: '#8890a6', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8890a6' }, grid: { color: '#262b3d' } }
      }
    }
  });
}

/* ---------------- tabela de lançamentos ---------------- */

function linhaLancamentoHtml(l) {
  return `
    <tr class="${l.semCategoria ? 'linha-sem-categoria' : ''}" data-id="${l.id}">
      <td>${formatarDataBr(l.data)}</td>
      <td title="${l.descricao}">${l.descricao.length > 40 ? l.descricao.slice(0, 40) + '…' : l.descricao}</td>
      <td>${l.origem}</td>
      <td><select class="sel-categoria" data-id="${l.id}"></select></td>
      <td><span class="tag-tipo ${l.tipo}">${l.tipo}</span></td>
      <td>${formatarMoeda(l.valor)}</td>
      <td><button class="btn-icone btn-remover" data-id="${l.id}" title="Remover">🗑</button></td>
    </tr>`;
}

function ligarLinhasTabela(tbody, mes, itens) {
  tbody.querySelectorAll('.sel-categoria').forEach(sel => {
    const id = sel.dataset.id;
    const item = itens.find(i => i.id === id);
    popularSelectCategoria(sel, item.categoria);
    sel.addEventListener('change', () => {
      atualizarLancamento(mes, id, { categoria: sel.value || null });
      if (sel.value && item.chave) addRegraDepara(item.chave, sel.value);
      renderTudo();
    });
  });
  tbody.querySelectorAll('.btn-remover').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Remover este lançamento?')) {
        removerLancamento(mes, btn.dataset.id);
        renderTudo();
      }
    });
  });
}

function renderTabelaLancamentos(mes, filtro) {
  const tbody = document.querySelector('#tabelaLancamentos tbody');
  let itens = lancamentosDoMes(mes).slice().sort((a, b) => b.data.localeCompare(a.data));
  if (filtro) {
    const f = filtro.toLowerCase();
    itens = itens.filter(l => (l.descricao + ' ' + (l.categoria || '') + ' ' + l.origem).toLowerCase().includes(f));
  }
  if (!itens.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="estado-vazio">Nenhum lançamento neste mês ainda. Importe um arquivo ou lance manualmente.</td></tr>`;
    return;
  }
  tbody.innerHTML = itens.map(linhaLancamentoHtml).join('');
  ligarLinhasTabela(tbody, mes, itens);
}

/* ---------------- aba cartão ---------------- */

function renderResumoCartao(mes) {
  const painel = document.getElementById('painelResumoCartao');
  const cartao = ensureMes(mes).cartao;
  const r = calcularResumo(mes);
  if (!cartao) {
    painel.innerHTML = `<h2 style="margin-bottom:10px">Fatura do cartão</h2>
      <div class="estado-vazio">Importe o PDF da fatura na aba Importar para ver vencimento, limite e detalhes aqui. Enquanto isso, os lançamentos de cartão já lançados manualmente aparecem na lista abaixo.</div>`;
    return;
  }
  const pctLimite = cartao.limiteTotal ? Math.min(100, (cartao.limiteUtilizado / cartao.limiteTotal) * 100) : 0;
  painel.innerHTML = `
    <div class="painel-header"><h2>Fatura do cartão${cartao.cartaoFinal ? ' — final ' + cartao.cartaoFinal : ''}</h2><span class="rotulo-topo">${cartao.periodo || ''}</span></div>
    <div class="cartao-resumo-grid">
      <div class="item"><div class="rotulo">Total da fatura</div><div class="valor">${formatarMoeda(cartao.totalFatura ?? r.despesasCartao)}</div></div>
      <div class="item"><div class="rotulo">Vencimento</div><div class="valor">${cartao.vencimento || '—'}</div></div>
      <div class="item"><div class="rotulo">Fechamento</div><div class="valor">${cartao.fechamento || '—'}</div></div>
      <div class="item"><div class="rotulo">Pagamento mínimo</div><div class="valor">${cartao.pagamentoMinimo ? formatarMoeda(cartao.pagamentoMinimo) : '—'}</div></div>
    </div>
    ${cartao.limiteTotal ? `
    <div class="barra-limite">
      <div class="trilho"><div class="preenchido" style="width:${pctLimite.toFixed(1)}%"></div></div>
      <div class="legenda">
        <span>Usado: ${formatarMoeda(cartao.limiteUtilizado)}</span>
        <span>Disponível: ${formatarMoeda(cartao.limiteDisponivel)}</span>
        <span>Limite: ${formatarMoeda(cartao.limiteTotal)}</span>
      </div>
    </div>` : ''}
  `;
}

function renderTabelaCartao(mes) {
  const tbody = document.querySelector('#tabelaCartao tbody');
  const itens = lancamentosDoMes(mes).filter(l => l.origem === 'Cartão de crédito').sort((a, b) => a.data.localeCompare(b.data));
  if (!itens.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="estado-vazio">Nenhum lançamento de cartão neste mês.</td></tr>`;
    return;
  }
  tbody.innerHTML = itens.map(l => `
    <tr class="${l.semCategoria ? 'linha-sem-categoria' : ''}" data-id="${l.id}">
      <td>${formatarDataBr(l.data)}</td>
      <td title="${l.descricao}">${l.descricao.length > 40 ? l.descricao.slice(0, 40) + '…' : l.descricao}</td>
      <td>${l.ramoAtividade || '—'}</td>
      <td><select class="sel-categoria" data-id="${l.id}"></select></td>
      <td>${formatarMoeda(l.valor)}</td>
    </tr>
  `).join('');
  ligarLinhasTabela(tbody, mes, itens);
}

/* ---------------- orçamento ---------------- */

function renderTabelaOrcamento(mes) {
  const r = calcularResumo(mes);
  const orcamento = ensureMes(mes).orcamento;
  const categorias = [...new Set([...STATE.categorias.filter(c => c !== 'Receita' && c !== 'Transferência'), ...Object.keys(r.porCategoria)])];
  const tbody = document.querySelector('#tabelaOrcamento tbody');
  tbody.innerHTML = categorias.map(cat => {
    const orcado = orcamento[cat] || 0;
    const realizado = r.porCategoria[cat] || 0;
    const dif = orcado - realizado;
    const pct = orcado ? (realizado / orcado * 100) : 0;
    return `<tr>
      <td>${cat}</td>
      <td><input type="number" step="0.01" min="0" class="input-orcado" data-cat="${cat}" value="${orcado || ''}" placeholder="0,00"></td>
      <td>${formatarMoeda(realizado)}</td>
      <td style="color:${dif < 0 ? 'var(--despesa)' : 'var(--receita)'}">${formatarMoeda(dif)}</td>
      <td>${orcado ? pct.toFixed(0) + '%' : '—'}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.input-orcado').forEach(inp => {
    inp.addEventListener('change', () => {
      setOrcamento(mes, inp.dataset.cat, inp.value);
      renderTudo();
    });
  });
}

/* ---------------- importação ---------------- */

async function processarArquivos(fileList) {
  const preview = document.getElementById('previewImportacao');
  preview.innerHTML = '<p class="ajuda">Lendo arquivo(s)…</p>';
  const blocos = [];
  for (const file of fileList) {
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const r = await analisarPdf(file);
        blocos.push({ nomeArquivo: file.name, tipoDocumento: r.tipoDocumento, lancamentos: r.lancamentos, avisos: r.avisos || [], saldoInicial: r.saldoInicial, titular: r.titular, resumoFatura: r.resumoFatura });
      } else {
        const r = await importarXlsx(file);
        blocos.push({ nomeArquivo: file.name, tipoDocumento: 'planilha de controle', lancamentos: r.lancamentos, avisos: r.avisos, regrasDepara: r.regrasDepara });
      }
    } catch (e) {
      console.error(e);
      blocos.push({ nomeArquivo: file.name, tipoDocumento: 'erro', lancamentos: [], avisos: ['Não consegui ler este arquivo: ' + e.message] });
    }
  }
  renderPreviewImportacao(blocos);
}

function renderPreviewImportacao(blocos) {
  const preview = document.getElementById('previewImportacao');
  itensImportacaoPendente = [];
  saldosIniciaisPendentes = [];
  resumosCartaoPendentes = [];
  let html = '';
  for (const bloco of blocos) {
    bloco.lancamentos.forEach(l => {
      aplicarCategorizacao(l);
      l._incluir = true;
      l._origemArquivo = bloco.nomeArquivo;
    });
    itensImportacaoPendente.push(...bloco.lancamentos);
    if (bloco.saldoInicial !== null && bloco.saldoInicial !== undefined && bloco.lancamentos.length) {
      const mesDoBloco = dataParaMes(bloco.lancamentos[0].data);
      saldosIniciaisPendentes.push({ mes: mesDoBloco, saldoInicial: bloco.saldoInicial });
    }
    if (bloco.titular) setTitular(bloco.titular);
    if (bloco.resumoFatura && bloco.lancamentos.length) {
      const mesDoBloco = dataParaMes(bloco.lancamentos[0].data);
      resumosCartaoPendentes.push({ mes: mesDoBloco, resumo: bloco.resumoFatura });
    }

    html += `<div class="preview-import">
      <div class="preview-import-header">
        <span><strong>${bloco.nomeArquivo}</strong><span class="badge">${bloco.tipoDocumento}</span><span class="badge">${bloco.lancamentos.length} lançamento(s)</span>${bloco.regrasDepara ? `<span class="badge">${bloco.regrasDepara} regra(s) de categoria importadas</span>` : ''}</span>
      </div>
      ${bloco.avisos && bloco.avisos.length ? `<div class="avisos">⚠ ${bloco.avisos.length} linha(s) não reconhecida(s) automaticamente — confira o restante ou lance manualmente.</div>` : ''}
    </div>`;
  }

  if (!itensImportacaoPendente.length) {
    preview.innerHTML = html + '<p class="ajuda">Nenhum lançamento novo foi identificado nos arquivos.</p>';
    return;
  }

  html += `<div class="tabela-scroll"><table><thead><tr>
    <th></th><th>Data</th><th>Descrição</th><th>Origem</th><th>Categoria</th><th>Tipo</th><th>Valor</th>
  </tr></thead><tbody>` +
    itensImportacaoPendente.map((l, i) => `<tr data-idx="${i}">
      <td><input type="checkbox" class="chk-incluir" data-idx="${i}" checked></td>
      <td>${formatarDataBr(l.data)}</td>
      <td title="${l.descricao}">${l.descricao.slice(0, 36)}</td>
      <td>${l.origem}</td>
      <td><select class="sel-categoria-preview" data-idx="${i}"></select></td>
      <td>${l.tipo}</td>
      <td>${formatarMoeda(l.valor)}</td>
    </tr>`).join('') +
    `</tbody></table></div>
    <footer class="rodape-preview">
      <button id="btnCancelarImportacao" class="btn btn-ghost">Cancelar</button>
      <button id="btnConfirmarImportacao" class="btn btn-primario">Confirmar importação</button>
    </footer>`;

  preview.innerHTML = html;
  preview.querySelectorAll('.sel-categoria-preview').forEach(sel => {
    const idx = Number(sel.dataset.idx);
    popularSelectCategoria(sel, itensImportacaoPendente[idx].categoria);
    sel.addEventListener('change', () => { itensImportacaoPendente[idx].categoria = sel.value || null; });
  });
  preview.querySelectorAll('.chk-incluir').forEach(chk => {
    chk.addEventListener('change', () => { itensImportacaoPendente[Number(chk.dataset.idx)]._incluir = chk.checked; });
  });
  document.getElementById('btnCancelarImportacao').addEventListener('click', () => {
    preview.innerHTML = '';
    itensImportacaoPendente = [];
  });
  document.getElementById('btnConfirmarImportacao').addEventListener('click', () => {
    const selecionados = itensImportacaoPendente.filter(l => l._incluir);
    const resultado = importarLote(selecionados);
    for (const s of saldosIniciaisPendentes) setSaldoInicial(s.mes, s.saldoInicial);
    for (const r of resumosCartaoPendentes) setResumoCartao(r.mes, r.resumo);
    if (resultado.itens.length) {
      const mesesImportados = [...new Set(resultado.itens.map(l => dataParaMes(l.data)))].sort();
      setMesAtual(mesesImportados[mesesImportados.length - 1]);
    }
    alert(`${resultado.importados} lançamento(s) importado(s). ${resultado.duplicados ? resultado.duplicados + ' ignorado(s) por já existirem.' : ''}`);
    preview.innerHTML = '';
    itensImportacaoPendente = [];
    document.getElementById('inputArquivos').value = '';
    renderTudo();
  });
}
