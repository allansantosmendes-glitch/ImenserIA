-- Saúde em Campo — estrutura do banco (já aplicada no projeto Supabase "saude-em-campo").
-- Registro para referência; as migrações foram aplicadas nesta ordem:
-- estrutura_inicial, funcoes_privadas, convite_sem_autor_permitido.

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 3 and 120),
  email text not null unique,
  papel text not null check (papel in ('Médico(a)', 'Missionário(a)', 'Voluntário(a)')),
  admin boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
create table public.convites (
  token uuid primary key default gen_random_uuid(),
  para text check (char_length(para) <= 120),
  criado_por uuid default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references public.perfis(id),
  usado_em timestamptz,
  cancelado boolean not null default false
);
create table public.familias (
  id uuid primary key, codigo text not null, localidade text not null, dados jsonb not null,
  versao integer not null default 1,
  criado_por uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis(id),
  atualizado_em timestamptz not null default now()
);
create table public.atendimentos (
  id uuid primary key,
  familia_id uuid not null references public.familias(id) on delete cascade,
  morador_id text not null, data timestamptz not null, dados jsonb not null,
  registrado_por uuid not null default auth.uid() references public.perfis(id),
  recebido_em timestamptz not null default now()
);
create index familias_atualizado_em_idx on public.familias (atualizado_em);
create index atendimentos_recebido_em_idx on public.atendimentos (recebido_em);
create index atendimentos_familia_idx on public.atendimentos (familia_id);

-- Funções usadas pelas regras de acesso (schema não exposto pela API)
create schema privado;
create function privado.usuario_ativo() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.ativo); $$;
create function privado.eh_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.ativo and p.admin); $$;
create function public.registrar_acesso() returns void language sql security definer set search_path = '' as $$
  update public.perfis set ultimo_acesso = now() where id = auth.uid(); $$;

-- Autoria e versão definidas pelo servidor (o celular não consegue falsificar)
create function public.familias_autoria() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.criado_por := auth.uid(); new.criado_em := now(); new.versao := 1; new.atualizado_por := null;
  else new.criado_por := old.criado_por; new.criado_em := old.criado_em; new.versao := old.versao + 1; new.atualizado_por := auth.uid(); end if;
  new.atualizado_em := now(); return new;
end $$;
create function public.atendimentos_autoria() returns trigger language plpgsql set search_path = '' as $$
begin new.registrado_por := auth.uid(); new.recebido_em := now(); return new; end $$;
create trigger familias_autoria before insert or update on public.familias for each row execute function public.familias_autoria();
create trigger atendimentos_autoria before insert on public.atendimentos for each row execute function public.atendimentos_autoria();

-- Regras de acesso: só contas ativas da equipe; gestão de equipe só para administradores
alter table public.perfis enable row level security;
alter table public.convites enable row level security;
alter table public.familias enable row level security;
alter table public.atendimentos enable row level security;
create policy "equipe ve a equipe" on public.perfis for select to authenticated using ((select privado.usuario_ativo()));
create policy "admin altera perfis" on public.perfis for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "admin ve convites" on public.convites for select to authenticated using ((select privado.eh_admin()));
create policy "admin cria convites" on public.convites for insert to authenticated with check ((select privado.eh_admin()) and criado_por = (select auth.uid()));
create policy "admin altera convites" on public.convites for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "equipe ve familias" on public.familias for select to authenticated using ((select privado.usuario_ativo()));
create policy "equipe cadastra familias" on public.familias for insert to authenticated with check ((select privado.usuario_ativo()));
create policy "equipe atualiza familias" on public.familias for update to authenticated using ((select privado.usuario_ativo())) with check ((select privado.usuario_ativo()));
create policy "equipe ve atendimentos" on public.atendimentos for select to authenticated using ((select privado.usuario_ativo()));
create policy "equipe registra atendimentos" on public.atendimentos for insert to authenticated with check ((select privado.usuario_ativo()));

revoke all on public.perfis, public.convites, public.familias, public.atendimentos from anon;
revoke insert, delete on public.perfis from authenticated;
revoke delete on public.familias, public.atendimentos, public.convites from authenticated;
revoke update on public.atendimentos from authenticated;

-- Configuração interna (lida só pela função cadastro, com a chave de serviço)
create table public.config (chave text primary key, valor text not null);
alter table public.config enable row level security;
revoke all on public.config from anon, authenticated;
-- insert into public.config values ('admin_email_sha256', '<sha-256 do e-mail do administrador>');
