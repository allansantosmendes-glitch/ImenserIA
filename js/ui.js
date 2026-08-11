/* ============================================================
   ui.js — renderização do dashboard e interações da tela
   ============================================================ */

const CORES_GRAFICO = ['#2f6fed','#1a9e6b','#d64545','#9457d1','#e0a100','#0fb5ba','#e0637a','#5c6bc0','#8d6e63','#43a047','#fb8c00','#546e7a','#c2185b','#00897b'];

let chartCategorias, chartOrcamento, chartEvolucao;
let itensImportacaoPendente = [];
let saldosIniciaisPendentes = [];

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataBr(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/* ---------------- seletor de mês ---------------- */

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

/* ---------------- categorias (selects) ---------------- */

function popularSelectCategoria(el, valorAtual) {
  el.innerHTML = '<option value="">Sem categoria</option>' +
    STATE.categorias.map(c => `<option value="${c}" ${c === valorAtual ? 'selected' : ''}>${c}</option>`).join('');
}

/* ---------------- render geral ---------------- */

function renderTudo() {
  const mes = mesAtual();
  popularSeletorMes();
  renderCards(mes);
  renderAlertaSemCategoria(mes);
  renderGraficoCategorias(mes);
  renderGraficoOrcamento(mes);
  renderGraficoEvolucao();
  renderTabelaLancamentos(mes, document.getElementById('filtroLancamentos').value);
  renderTabelaOrcamento(mes);
  popularSelectCategoria(document.getElementById('selectCategoriaManual'));
}

function renderCards(mes) {
  const r = calcularResumo(mes);
  const saldoConta = calcularSaldoConta(mes);
  const cards = [
    { rotulo: 'Receitas', valor: r.receitas, classe: 'receita' },
    { rotulo: 'Despesas', valor: r.despesas, classe: 'despesa' },
    { rotulo: 'Sobra do mês', valor: r.sobra, classe: 'sobra', positivo: r.sobra >= 0 },
    { rotulo: 'Transferências', valor: r.transferencias, classe: 'transferencia' },
    { rotulo: 'Despesas no cartão', valor: r.despesasCartao, classe: 'despesa' },
    { rotulo: 'Despesas na conta', valor: r.despesasContaCorrente, classe: 'despesa' },
    { rotulo: 'Saldo estimado em conta', valor: saldoConta, classe: 'sobra', positivo: saldoConta >= 0, editavel: true }
  ];
  document.getElementById('cardsResumo').innerHTML = cards.map(c => `
    <div class="card ${c.classe}">
      <div class="rotulo">${c.rotulo}${c.editavel ? ' <button type="button" class="link btn-editar-saldo" title="Ajustar saldo inicial do mês">✎</button>' : ''}</div>
      <div class="valor ${c.positivo === undefined ? '' : (c.positivo ? 'positivo' : 'negativo')}">${formatarMoeda(c.valor)}</div>
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
    Ajuste a categoria na tabela de lançamentos abaixo para os relatórios ficarem completos.`;
}

function renderGraficoCategorias(mes) {
  const r = calcularResumo(mes);
  const entradas = Object.entries(r.porCategoria).sort((a, b) => b[1] - a[1]);
  const ctx = document.getElementById('graficoCategorias');
  if (chartCategorias) chartCategorias.destroy();
  if (!entradas.length) return;
  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entradas.map(e => e[0]),
      datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES_GRAFICO }]
    },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
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
        { label: 'Orçado', data: categorias.map(c => orcamento[c] || 0), backgroundColor: '#c9d6f5' },
        { label: 'Realizado', data: categorias.map(c => r.porCategoria[c] || 0), backgroundColor: '#2f6fed' }
      ]
    },
    options: { scales: { x: { ticks: { font: { size: 10 } } } } }
  });
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
        { label: 'Receitas', data: dados.map(d => d.receitas), borderColor: '#1a9e6b', tension: .25 },
        { label: 'Despesas', data: dados.map(d => d.despesas), borderColor: '#d64545', tension: .25 },
        { label: 'Sobra', data: dados.map(d => d.sobra), borderColor: '#2f6fed', tension: .25 }
      ]
    }
  });
}

/* ---------------- tabela de lançamentos ---------------- */

function renderTabelaLancamentos(mes, filtro) {
  const tbody = document.querySelector('#tabelaLancamentos tbody');
  let itens = lancamentosDoMes(mes).slice().sort((a, b) => b.data.localeCompare(a.data));
  if (filtro) {
    const f = filtro.toLowerCase();
    itens = itens.filter(l => (l.descricao + ' ' + (l.categoria || '') + ' ' + l.origem).toLowerCase().includes(f));
  }
  if (!itens.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted); text-align:center; padding:24px;">Nenhum lançamento neste mês ainda. Importe um arquivo ou lance manualmente.</td></tr>`;
    return;
  }
  tbody.innerHTML = itens.map(l => `
    <tr class="${l.semCategoria ? 'linha-sem-categoria' : ''}" data-id="${l.id}">
      <td>${formatarDataBr(l.data)}</td>
      <td title="${l.descricao}">${l.descricao.length > 40 ? l.descricao.slice(0, 40) + '…' : l.descricao}</td>
      <td>${l.origem}</td>
      <td><select class="sel-categoria" data-id="${l.id}"></select></td>
      <td><span class="tag-tipo ${l.tipo}">${l.tipo}</span></td>
      <td>${formatarMoeda(l.valor)}</td>
      <td><button class="btn-icone btn-remover" data-id="${l.id}" title="Remover">🗑</button></td>
    </tr>
  `).join('');
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
        blocos.push({ nomeArquivo: file.name, tipoDocumento: r.tipoDocumento, lancamentos: r.lancamentos, avisos: r.avisos || [], saldoInicial: r.saldoInicial });
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
