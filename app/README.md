# Saúde em Campo — app real

App da **MUB – Missões Urbanas Brazil · Ação Missionária Norte (Pará)** para o censo das
famílias e os atendimentos de saúde em campo. Funciona sem internet e sincroniza com o
Supabase quando há sinal. (O protótipo de visualização continua em `../saude-campo/`.)

## Como funciona

- **Arquivos do app** (`index.html`, `sw.js`, `vendor/`, `marca/`): site estático. O service
  worker guarda o app no celular para abrir sem internet.
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

## Configuração no Supabase (uma vez)

1. **Segredo `ADMIN_EMAIL`** (Edge Functions → Secrets): o e-mail do administrador.
2. **Desligar cadastro aberto** (Authentication → Sign In / Providers → desmarcar
   "Allow new users to sign up"). As contas continuam sendo criadas pela função `cadastro`.

## Primeiro uso

1. Abra o app, toque em **Primeiro acesso do administrador**, informe o e-mail do
   administrador, nome, função e crie a senha.
2. Em **Equipe e convites**, gere um link para cada pessoa e envie (WhatsApp ou copiar).
3. A pessoa abre o link com internet, preenche nome, e-mail, função e senha, e já entra.
