# Saúde em Campo — Concepção do projeto

**MUB – Missões Urbanas Brazil · Ação Missionária Norte · Pará**

Território atendido: **Vila Piriá**.

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

## 2.1 Acesso: conta individual com e-mail e senha

O app é de uso restrito da equipe (missionários e profissionais de saúde).

- **Primeiro acesso: “Criar conta”.** A pessoa preenche nome completo, e-mail (que é o
  login), função (**médico, missionário ou voluntário**), equipe (**Equipe 1 a 4**), **código de acesso da equipe** e cria uma senha (mínimo 6
  caracteres, digitada duas vezes).
- **Código de acesso:** a coordenação passa o código só para quem é da equipe. Sem ele não
  é possível criar conta. Na versão real, o ideal é o coordenador **convidar por e-mail**
  ou **aprovar** cada conta nova antes do primeiro uso.
- **Depois: “Entrar”** com e-mail e senha toda vez que o app é aberto. Botão “Sair” na
  tela inicial e em “Sobre o projeto”.
- **Quem preencheu:** cada família guarda quem cadastrou e quem atualizou, e cada
  atendimento guarda o nome e o e-mail de quem registrou. Isso aparece na ficha da família,
  no atendimento e na fila de envio. No atendimento o nome do profissional vem da conta
  conectada e não pode ser trocado.
- **Sem internet:** o primeiro login precisa de internet (para criar a conta no
  Supabase). Depois, o app guarda a sessão de forma segura para permitir entrar offline.
- **Versão real:** contas no Supabase Auth (senha nunca guardada em texto, recuperação de
  senha por e-mail), papéis por função e regras de acesso por equipe no banco. No
  protótipo, as contas ficam só no aparelho e a senha é guardada como código (hash).

## 3. O dia a dia no app (fluxo do protótipo)

**Tela inicial → Nova família → domicílio → moradores → “Novo atendimento” para cada morador.**
Na tela inicial há busca pelo nome do responsável ou de qualquer morador para voltar a uma
família já cadastrada.

1. **Entrar com PIN**: o primeiro acesso exige internet; depois o app abre offline.
2. **Início**: busca, “Nova família”, estado da conexão e da fila, atendimentos do dia,
   alertas (encaminhamento urgente, sinais vitais críticos, criança com vacina atrasada,
   gestante sem atendimento, acamado, água sem tratamento com criança < 5 anos).
3. **Nova família** em 5 passos, com rascunho salvo automaticamente:
   Família → Moradia → Renda e acesso → Moradores → Revisão + consentimento.
4. **Ficha da família**: composição, alertas, moradores (cada um com botão **Atender**),
   dados do domicílio e últimos atendimentos.
5. **Novo atendimento** (por morador): sinais vitais com alertas automáticos, IMC
   calculado na hora, curva de IMC para idade em crianças e adolescentes, CID-10 com busca
   offline, medicamentos entregues, exames, encaminhamento e retorno.
6. **Sincronizar**: fila de envio por família (cadastro + atendimentos) e histórico.
7. **Painel** (calculado no aparelho, funciona offline) com filtros por comunidade e por
   data, e o botão **Gerar relatório em PDF** para a Secretaria de Saúde.

## 4. Telas e campos

### 4.1 Domicílio (censo da casa)
- Comunidade/localidade, ponto de referência, GPS
- Nome do responsável pela família
- Número de moradores: total, crianças 0–11, adolescentes 12–17, adultos 18–59, idosos 60+
  (o app confere se a soma bate com o total)
- Tipo de moradia (palafita, madeira, alvenaria, outro), número de cômodos
- Energia elétrica (sim, não, gerador, solar)
- Água: origem (rio, poço, chuva, rede, outro) e tratamento (fervida, filtrada, clorada, sem tratamento)
- Esgoto/banheiro (fossa, a céu aberto, rio, banheiro com descarga, sem banheiro)
- Destino do lixo (queimado, enterrado, jogado no rio/mato, coletado)
- Animais em casa (cão, gato, outros, nenhum)
- Renda familiar aproximada (faixas de salário mínimo)
- Benefícios recebidos pela família, vários ao mesmo tempo (Bolsa Família, BPC/LOAS,
  aposentadoria, pensão, seguro-defeso, outro, nenhum) e quantas pessoas recebem algum
- Acesso a posto de saúde (sim/não), distância em km, tempo e meio de transporte

### 4.2 Morador (vários por domicílio)
- Nome, data de nascimento (idade calculada automaticamente), sexo
- CNS e/ou CPF (opcionais)
- Parentesco com o responsável
- Raça/cor (padrão IBGE), escolaridade, sabe ler/escrever
- Ocupação; benefício individual (qual)
- Condições: gestante (semanas), hipertensão, diabetes, doença respiratória, tuberculose,
  hanseníase, malária recente, verminose, deficiência, saúde mental, álcool/tabaco,
  acamado, outra (qual)
- Vacinação em dia (sim/não/não sabe); para crianças, se tem caderneta
- Uso contínuo de medicamento (qual)

### 4.3 Atendimento (vários por morador)
- Data, tipo de profissional (médico, enfermeiro, dentista, outro) e nome
- Queixa principal
- Sinais vitais: PA, FC, temperatura, glicemia capilar, saturação (com alertas)
- Peso, altura, IMC automático; em menores de 19 anos, classificação e curva de IMC para idade
- Hipótese diagnóstica + CID-10 opcional com busca (lista offline dos códigos mais comuns)
- Conduta, medicamentos entregues (nome escrito livremente ou escolhido entre os mais usados,
  quantidade e como tomar), exames solicitados
- Encaminhamento (sim/não, para onde, urgência: eletivo, prioritário, urgente)
- Retorno/acompanhamento (sim/não, em quantos dias)
- **Evolução médica**: texto livre no final do atendimento (história, exame físico,
  avaliação e plano)

> No protótipo, a curva de IMC usa valores aproximados da referência da OMS. A versão
> final deve usar as tabelas oficiais completas (escores-z por idade e sexo).

### 4.4 Painel e relatórios (offline)
- Totais de famílias, moradores e atendimentos
- Pirâmide etária; gestantes, hipertensos, diabéticos, crianças < 5 anos
- % de casas sem água tratada, sem banheiro, sem energia e sem acesso a posto
- Famílias e pessoas por benefício do governo
- Lista de pessoas que precisam de encaminhamento ou retorno
- Filtros por comunidade e por data
- **Gerar relatório em PDF** com esses números. Por padrão sem nomes; a lista nominal de
  encaminhamentos só entra se a equipe marcar a opção, para entrega direta à regulação.

### 4.5 Modelo de dados (tabelas)
- **familia** (domicílio): campos de 4.1 + id (UUID gerado no celular), código, equipe,
  versão, criado_em, atualizado_em, criado_por, atualizado_por.
- **morador**: campos de 4.2 + familia_id.
- **atendimento**: campos de 4.3 (incluindo evolução médica) + morador_id, familia_id, profissional_id.
- **medicamento_entregue**: atendimento_id, nome, quantidade, como tomar.
- **usuario** (conta): nome completo, e-mail (login), função, equipe, criado_em, último acesso.
  A senha fica no Supabase Auth.
- **equipe**, **localidade**, **cid10**: cadastros de apoio.

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
