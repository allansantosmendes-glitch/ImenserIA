const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/ImenserIA';
const OUT = '/home/user/ImenserIA/assistente-financeiro.html';

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function readBin(p) { return fs.readFileSync(path.join(ROOT, p)); }
// replace() interpreta "$&", "$`", "$1" etc no texto de substituição — como o
// conteúdo embutido (JS minificado) frequentemente contém "$", sempre passamos
// a substituição como função para o texto entrar literalmente.
function subst(html, busca, textoLiteral) {
  return html.replace(busca, () => textoLiteral);
}

let html = read('index.html');

// 1. CSS inline
const css = read('css/styles.css');
html = subst(html, '<link rel="stylesheet" href="css/styles.css">', `<style>\n${css}\n</style>`);

// 2. pdf.js (module) + worker — embutidos como blobs em base64, criados em runtime
const pdfMjsB64 = readBin('js/vendor/pdfjs/pdf.min.mjs').toString('base64');
const pdfWorkerB64 = readBin('js/vendor/pdfjs/pdf.worker.min.mjs').toString('base64');

const blocoPdfJs = `<script>
  window.__PDF_MJS_B64__ = "${pdfMjsB64}";
  window.__PDF_WORKER_B64__ = "${pdfWorkerB64}";
  function __b64ParaBlobUrl(b64, tipo) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: tipo }));
  }
  window.__pdfjsPronto = (async () => {
    const moduloUrl = __b64ParaBlobUrl(window.__PDF_MJS_B64__, 'text/javascript');
    const pdfjsLib = await import(moduloUrl);
    window.pdfjsLib = pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = __b64ParaBlobUrl(window.__PDF_WORKER_B64__, 'text/javascript');
  })();
</script>`;

html = html.replace(/<script type="module">[\s\S]*?<\/script>/, () => blocoPdfJs);

// 3. xlsx e chart.js — inline direto (UMD, sem módulos)
const xlsxJs = read('js/vendor/xlsx.full.min.js');
const chartJs = read('js/vendor/chart.umd.js');
html = subst(html, '<script src="js/vendor/xlsx.full.min.js"></script>', `<script>\n${xlsxJs}\n</script>`);
html = subst(html, '<script src="js/vendor/chart.umd.js"></script>', `<script>\n${chartJs}\n</script>`);

// 4. JS do app — inline, na mesma ordem, mas espera window.__pdfjsPronto antes de qualquer parsing de PDF
const arquivosApp = ['js/state.js', 'js/categorize.js', 'js/calc.js', 'js/parsePdf.js', 'js/xlsxIO.js', 'js/ui.js', 'js/main.js'];
for (const arq of arquivosApp) {
  const src = read(arq);
  html = subst(html, `<script src="${arq}"></script>`, `<script>\n${src}\n</script>`);
}

fs.writeFileSync(OUT, html);
console.log('Gerado:', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(2), 'MB');
