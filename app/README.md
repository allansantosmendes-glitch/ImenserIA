# Saúde em Campo — app real

App da **MUB – Missões Urbanas Brazil · Ação Missionária Norte (Pará)** para o censo das
famílias e os atendimentos de saúde em campo. Funciona sem internet e sincroniza com o
Supabase quando há sinal. (O protótipo de visualização continua em `../saude-campo/`.)

**Endereço:** https://saude-em-campo-tau.vercel.app (Vercel, projeto `saude-em-campo`).
Para publicar uma nova versão, envie ao GitHub e faça um deploy de produção da branch.

## Como funciona

- **Arquivos do app** (`index.html`, `sw.js`, `marca/`): site estático. A biblioteca do
  Supabase vem do jsDelivr com versão fixa (2.89.0). O service worker guarda o app e a
  biblioteca no celular para abrir sem internet.
- **Dados no aparelho:** IndexedDB. Tudo o que é cadastrado fica salvo no celular na hora.
- **Nuvem:** Supabase, projeto `saude-em-campo` (São Paulo).
  - Tabelas `perfis`, `convites`, `familias`, `atendimentos` com regras de acesso (RLS):
    só contas ativas leem ou gravam; só administradores gerenciam a equipe.
  - Autoria (quem cadastrou, quem atualizou, quem atendeu) é gravada pelo servidor.
  - Função `cadastro` (`supabase/functions/cadastro`): cria contas pelo link do
    administrador ou no primeiro acesso do administrador.
- **Sincronização:** envia a fila (famílias e atendimentos) e depois recebe o que a equipe
  enviou. Roda ao entrar, a cada 2 minutos com internet, quando o sinal volta e no botão
  de nuvem do topo.

## Configuração no Supabase

- **E-mail do administrador:** guardado na tabela `config` só como SHA-256
  (`admin_email_sha256`). Opcionalmente, o segredo `ADMIN_EMAIL` das Edge Functions tem
  prioridade sobre a tabela.
- **Opcional:** desligar "Allow new users to sign up" (Authentication → Sign In /
  Providers). Mesmo ligado, uma conta criada fora do link não tem perfil e não acessa dados.

## Primeiro uso

1. Abra o app, toque em **Primeiro acesso do administrador**, informe o e-mail do
   administrador, nome, função e crie a senha.
2. Em **Equipe e convites**, gere um link para cada pessoa e envie (WhatsApp ou copiar).
3. A pessoa abre o link com internet, preenche nome, e-mail, função e senha, e já entra.
