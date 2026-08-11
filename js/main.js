/* ============================================================
   main.js — inicialização e ligação de eventos da página
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  ensureMes(mesAtual());
  renderTudo();

  document.getElementById('seletorMes').addEventListener('change', e => {
    setMesAtual(e.target.value);
    renderTudo();
  });

  document.getElementById('btnNovoMes').addEventListener('click', () => {
    const sugestao = proximoMesSugerido();
    const valor = prompt('Novo mês (AAAA-MM):', sugestao);
    if (!valor) return;
    if (!/^\d{4}-\d{2}$/.test(valor)) { alert('Use o formato AAAA-MM, ex.: 2026-08'); return; }
    setMesAtual(valor);
    renderTudo();
  });

  document.getElementById('btnExportar').addEventListener('click', () => {
    exportarXlsx(mesAtual());
  });

  document.getElementById('filtroLancamentos').addEventListener('input', e => {
    renderTabelaLancamentos(mesAtual(), e.target.value);
  });

  document.getElementById('formManual').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const l = {
      data: fd.get('data'),
      descricao: fd.get('descricao').trim(),
      origem: fd.get('origem'),
      tipo: fd.get('tipo'),
      categoria: fd.get('categoria') || null,
      valor: parseFloat(fd.get('valor')),
      tipoLancamento: 'MANUAL',
      origemImportacao: 'manual'
    };
    const r = adicionarLancamento(l);
    if (!r.ok) {
      alert('Esse lançamento parece já existir neste mês (mesma data, descrição e valor).');
      return;
    }
    e.target.reset();
    renderTudo();
  });

  const dropzone = document.getElementById('dropzone');
  const inputArquivos = document.getElementById('inputArquivos');
  document.getElementById('btnEscolherArquivo').addEventListener('click', () => inputArquivos.click());
  inputArquivos.addEventListener('change', () => {
    if (inputArquivos.files.length) processarArquivos(inputArquivos.files);
  });
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.add('arrastando');
  }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.remove('arrastando');
  }));
  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer.files.length) processarArquivos(e.dataTransfer.files);
  });
});

function proximoMesSugerido() {
  const meses = listarMeses();
  if (!meses.length) return mesISOAtual();
  const ultimo = meses[meses.length - 1];
  const [a, m] = ultimo.split('-').map(Number);
  const d = new Date(a, m, 1); // já soma 1 mês (m é 1-based, Date usa 0-based)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
