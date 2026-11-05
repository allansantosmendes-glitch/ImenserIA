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

- Entrar com PIN (simulado) e ver o resumo do dia, alertas e registros de hoje.
- Buscar e filtrar famílias; abrir a ficha completa e registrar uma visita.
- Cadastrar um domicílio novo em 4 passos (com GPS simulado e consentimento).
- Ligar/desligar a "internet" no botão Offline/Online e sincronizar a fila.
- Ver o painel do território e gerar o relatório agregado para a Secretaria.
- "Sobre o projeto" → "Restaurar dados de exemplo" volta ao estado inicial.

A concepção completa está em [`CONCEPCAO.md`](CONCEPCAO.md).
