# Assistente Financeiro

Dashboard financeiro pessoal, mensal e modular, que roda inteiramente no navegador
(sem servidor, sem backend — os dados ficam salvos no `localStorage` do seu
computador).

## Como usar

Abra `index.html` no navegador (duplo clique ou `python3 -m http.server` na pasta
e acesse `http://localhost:8000`).

- **Importar**: arraste a fatura do cartão (PDF), o extrato bancário (PDF) ou a
  planilha de controle (`.xlsx`) na área de importação. O sistema lê o arquivo,
  categoriza automaticamente o que reconhece e mostra uma prévia editável antes
  de confirmar — nada é salvo sem sua confirmação.
- **Lançar manualmente**: use o formulário "Lançar manualmente" para registrar
  algo que não veio de um arquivo (dinheiro em espécie, por exemplo).
- **Categorias**: o mecanismo de categorização aprende — ao categorizar um
  lançamento sem categoria, a regra (palavra-chave → categoria) é lembrada para
  a próxima importação.
- **Meses**: cada mês é independente (`+ Mês` para criar um novo). O gráfico de
  evolução mensal compara todos os meses já lançados.
- **Exportar**: gera uma planilha `.xlsx` do mês atual (abas Lançamentos,
  DePara, Resumo e Orçamento) compatível com o formato de referência.

## Estrutura

```
index.html          layout da página
css/styles.css       estilos
js/state.js          modelo de dados e persistência (localStorage)
js/categorize.js      motor de categorização (regras "De-Para")
js/calc.js            cálculos do resumo mensal
js/parsePdf.js        leitura de extrato bancário e fatura de cartão em PDF
js/xlsxIO.js           importar/exportar planilha .xlsx
js/ui.js               renderização do dashboard
js/main.js             ligação de eventos
js/vendor/             pdf.js, SheetJS e Chart.js (vendorizados, sem CDN)
```

## Limitações conhecidas

Os leitores de PDF foram calibrados para o formato de extrato/fatura usados
como referência (colunas: Data · Histórico · Tipo de lançamento · CNPJ · Valor ·
Saldo, e Data · Estabelecimento · MCC · Ramo · Cidade · Valor). Extratos de
outros bancos com layout diferente podem não ser reconhecidos automaticamente —
nesse caso, os lançamentos aparecem nos avisos de importação e podem ser
lançados manualmente.
