# Saúde em Campo (protótipo)

Protótipo navegável de um app gratuito e **offline** para equipes missionárias de saúde
cadastrarem famílias na atenção primária (censo do domicílio, saúde, saneamento, renda e
benefícios) e sincronizarem com a nuvem quando houver internet.

**Somente front-end, com dados fictícios.** Nada é enviado para servidor algum.

## Como abrir

Abra `index.html` no navegador, ou sirva a pasta para testar o modo instalável/offline:

```bash
cd saude-campo && python3 -m http.server 8000
```

Acesse `http://localhost:8000`. No celular, use "Adicionar à tela inicial".

## O que dá para testar

- **Cadastro só pelo link do administrador:** o administrador (e-mail do responsável)
  entra, abre **Equipe e convites** e gera um link de cadastro. A pessoa abre o link,
  preenche nome, e-mail, função e cria a senha. Depois, sempre e-mail e senha. Cada
  cadastro e atendimento registra quem preencheu.
- Buscar família pelo nome do responsável ou morador.
- **Nova família** em 5 passos: família e composição, moradia e saneamento, renda,
  benefícios e acesso ao posto, moradores, revisão com consentimento.
- Na ficha da família, **Atender** cada morador: sinais vitais com alertas, IMC
  automático (com curva para crianças), CID-10 com busca, medicamentos, encaminhamento e retorno.
- Ligar/desligar a "internet" no botão Offline/Online e sincronizar a fila.
- **Painel** com filtros por comunidade e data, lista de encaminhamentos/retornos e
  **Gerar relatório em PDF** (abre o "Salvar como PDF" do navegador).
- "Sobre o projeto" → "Restaurar dados de exemplo" volta ao estado inicial.

A concepção completa está em [`CONCEPCAO.md`](CONCEPCAO.md).
