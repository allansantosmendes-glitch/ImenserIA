# Saúde em Campo — Concepção do projeto

> Documento de concepção. Acompanha o protótipo navegável em `saude-campo/index.html`
> (somente front-end, dados fictícios, sem backend).

## 1. Problema e objetivo

Equipes missionárias de saúde (médicos, enfermeiros e voluntários) atendem comunidades
ribeirinhas, rurais e indígenas onde **não há internet**. Hoje o levantamento costuma ser
feito em papel ou planilhas soltas, o que gera:

- retrabalho para digitar depois;
- perda de fichas e duplicidade de famílias entre viagens;
- dificuldade de entregar números confiáveis à Secretaria Municipal de Saúde, ao DSEI
  (no caso de território indígena) ou ao Ministério da Saúde.

**Objetivo:** um app **gratuito**, que funciona **100% offline**, para cadastrar
domicílios e moradores (censo do território), condições de saúde, saneamento, renda e
benefícios sociais, e **sincronizar com a nuvem** quando houver sinal. Na nuvem, os dados
viram um diagnóstico do território e relatórios agregados (sem nomes) para os gestores.

## 2. Quem usa (perfis)

| Perfil | O que faz | O que vê |
|---|---|---|
| Missionário(a) / agente | Cadastra casas e moradores, registra visitas | Famílias da sua equipe |
| Médico(a) / enfermeiro(a) | Tudo acima + dados clínicos, alertas | Famílias da sua equipe |
| Coordenador(a) da missão | Acompanha equipes, exporta relatórios | Todas as equipes da missão |
| Gestor externo (Secretaria / DSEI) | Recebe relatórios | **Somente números agregados** |

## 3. O dia a dia no app (fluxo representado no protótipo)

1. **Entrar com PIN** — o primeiro acesso exige internet (baixa equipe, território e
   listas). Depois, o PIN libera o app offline.
2. **Início** — estado da conexão, quantos registros estão guardados no aparelho, meta de
   visitas do dia e a lista de **alertas** (gestante sem pré-natal, criança com vacina
   atrasada, idoso acamado, hipertenso + diabético, água sem tratamento com criança < 5 anos).
3. **Famílias** — busca por nome, código ou localidade; filtros (aguardando envio,
   prioridade, gestante, benefício, crônicos). Ficha da família com moradores, domicílio
   e histórico de visitas.
4. **Cadastrar domicílio** em 4 passos, com rascunho salvo automaticamente:
   1. *Domicílio*: localidade, endereço, ponto de referência, **GPS** (funciona sem
      internet), situação do imóvel, material, cômodos, energia, água, tratamento da água,
      esgoto, lixo.
   2. *Moradores*: cadastro individual (nome, nascimento, sexo, CNS/CPF, parentesco,
      raça/cor, escolaridade, ocupação, condições de saúde, gestação e pré-natal,
      vacinação, benefícios individuais).
   3. *Renda e benefícios*: faixa de renda familiar, Bolsa Família, Auxílio Gás, Tarifa
      Social etc.
   4. *Revisão + consentimento* da família (LGPD).
5. **Registrar visita** em uma família já cadastrada (motivo, desfecho, observações).
6. **Sincronizar** — fila de envio, envio com barra de progresso e histórico.
7. **Painel** — domicílios, pessoas, média por casa, pirâmide etária, condições de saúde,
   saneamento, benefícios e renda, filtrável por localidade.
8. **Relatório para a Secretaria** — tabela agregada por localidade (CSV), sem nomes.

## 4. Dados coletados (modelo inicial)

Os campos seguem a lógica das fichas do **e-SUS APS** (Cadastro Domiciliar e Territorial
e Cadastro Individual), para facilitar a conversa e, no futuro, a integração com o
Ministério.

- **domicilio**: id (UUID gerado no celular), código, equipe, localidade, microárea,
  endereço, referência, latitude/longitude/precisão, situação, material, cômodos,
  energia, animais, água, tratamento, esgoto, lixo, renda, benefícios familiares,
  consentimento, versão, criado_em, atualizado_em, criado_por.
- **morador**: id, domicilio_id, nome, nascimento, sexo, CNS/CPF, parentesco, raça/cor,
  escolaridade, ocupação, condições (lista), gestação (semanas, pré-natal), vacinação,
  benefícios individuais.
- **visita**: id, domicilio_id, data, motivo, desfecho, observação, profissional.
- **equipe**, **profissional**, **localidade**: cadastros de apoio.

> Antes de programar, vale fechar esta lista com a Secretaria de Saúde local: o que ela
> realmente precisa receber e em qual formato.

## 5. Como funciona offline (arquitetura proposta)

```
Celular (PWA)                     Nuvem (Supabase)                 Gestores
┌────────────────────┐   sinal    ┌──────────────────────┐        ┌──────────────┐
│ Formulários        │ ─────────▶ │ Postgres + Auth      │ ─────▶ │ Painel       │
│ IndexedDB (local)  │            │ Regras por equipe    │        │ CSV / XLSX   │
│ Fila de envio      │ ◀───────── │ (Row Level Security) │        │ agregados    │
└────────────────────┘ confirmação└──────────────────────┘        └──────────────┘
```

- **PWA** (site instalável): abre sem internet graças ao *service worker*. Não precisa de
  loja de aplicativos; instala pelo navegador do Android.
- **IndexedDB** guarda os registros no aparelho (via Dexie.js), com criptografia local.
- **IDs gerados no celular (UUID)**: dois celulares nunca criam o mesmo ID, então não há
  duplicidade ao sincronizar.
- **Fila de envio (outbox)**: cada alteração entra na fila; com sinal, sobe em lotes.
  Se a conexão cai no meio, retoma de onde parou. O servidor confirma cada item.
- **Conflitos**: cada registro tem `versao` e `atualizado_em`. Regra inicial simples:
  vence a alteração mais recente por campo, e o histórico de visitas nunca é sobrescrito
  (só acrescentado). Conflitos raros aparecem para o coordenador revisar.
- **Baixa da nuvem**: ao sincronizar, o celular também recebe as famílias da sua equipe
  cadastradas por outros colegas.

### Tecnologias sugeridas (todas com plano gratuito)

| Parte | Ferramenta |
|---|---|
| Front-end | HTML/JS ou React + Vite, como PWA |
| Banco local | IndexedDB com Dexie.js |
| Nuvem, login e banco | Supabase (Postgres, Auth, Row Level Security) |
| Hospedagem | GitHub Pages, Vercel ou Netlify |
| Código e versões | GitHub |

## 6. Proteção de dados (LGPD)

Dados de saúde são **dados pessoais sensíveis** (LGPD, art. 11). Cuidados mínimos:

- termo de consentimento lido para a família e registrado em cada cadastro;
- acesso por login individual + PIN no aparelho; bloqueio por inatividade;
- dados no celular criptografados; apagados do aparelho após um prazo, se já sincronizados;
- no banco, cada equipe só enxerga suas famílias (Row Level Security);
- relatórios externos **sempre agregados e anônimos**;
- registro de quem criou/alterou cada informação (auditoria);
- canal para a família pedir correção ou exclusão;
- ter um responsável pelos dados na missão e, idealmente, um acordo formal com a Secretaria.

## 7. Próximas etapas

1. **Validar o protótipo** com 2–3 missionários e 1 médico: o fluxo faz sentido em campo?
   Falta algum campo? Algo sobra?
2. **Fechar a ficha** com a Secretaria de Saúde (campos e formato do relatório).
3. **Versão funcional (MVP)**: PWA + IndexedDB + Supabase, login, cadastro, visitas,
   sincronização e painel.
4. **Piloto** em uma comunidade durante uma viagem.
5. Ajustes e expansão para outras equipes; depois, exportação compatível com o e-SUS APS.

## 8. Ideias para depois

- Agenda de rota da viagem e mapa offline das casas.
- Acompanhamento de gestantes, hipertensos e diabéticos (consultas, medidas).
- Fotos de documentos (com cuidado de privacidade).
- Modo multilíngue para comunidades indígenas.
