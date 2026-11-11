-- =====================================================================
-- Gestão Financeira — schema (todas as tabelas com prefixo gf_ para não
-- conflitar com outros sistemas que usam o mesmo projeto Supabase)
-- =====================================================================

-- ---------- Acessos autorizados (lista de e-mails liberados) ----------
create table if not exists public.gf_acessos (
  email       text primary key check (email = lower(email)),
  nome        text,
  papel       text not null default 'editor' check (papel in ('admin','editor','leitor')),
  cargo       text,
  ativo       boolean not null default true,
  criado_por  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- Perfis de usuário ----------
create table if not exists public.gf_perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  nome           text,
  cargo          text,
  area           text,
  telefone       text,
  localidade     text,
  papel          text not null default 'editor' check (papel in ('admin','editor','leitor')),
  ativo          boolean not null default true,
  preferencias   jsonb not null default '{}'::jsonb,
  ultimo_acesso  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- Empresas contratadas ----------
create table if not exists public.gf_empresas (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nome              text not null,
  razao_social      text,
  cnpj              text,
  descricao         text,
  cor               text not null default '#003865',
  contato_nome      text,
  contato_email     text,
  contato_telefone  text,
  ordem             int not null default 0,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- Contratos ----------
create table if not exists public.gf_contratos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.gf_empresas(id) on delete cascade,
  titulo          text not null,
  contrato_sap    text,
  contrato_ariba  text,
  pep             text,
  centro_custo    text,
  tipo            text not null default 'OPEX' check (tipo in ('CAPEX','OPEX')),
  valor_contrato  numeric(16,2) not null default 0,
  saldo_sap       numeric(16,2),
  saldo_sap_data  date,
  data_inicio     date,
  data_fim        date,
  status          text not null default 'Ativo' check (status in ('Ativo','Em mobilização','Suspenso','Encerrado')),
  responsavel     text,
  observacoes     text,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists gf_contratos_empresa_idx on public.gf_contratos(empresa_id);

-- ---------- Orçamento programado (por empresa, mês e CAPEX/OPEX) ----------
create table if not exists public.gf_orcamentos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.gf_empresas(id) on delete cascade,
  ano         int not null check (ano between 2000 and 2100),
  mes         int not null check (mes between 1 and 12),
  tipo        text not null check (tipo in ('CAPEX','OPEX')),
  valor       numeric(16,2) not null default 0,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (empresa_id, ano, mes, tipo)
);

-- ---------- Previsões (forecast) por contrato e mês ----------
create table if not exists public.gf_previsoes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.gf_empresas(id) on delete cascade,
  contrato_id  uuid not null references public.gf_contratos(id) on delete cascade,
  ano          int not null check (ano between 2000 and 2100),
  mes          int not null check (mes between 1 and 12),
  tipo         text not null check (tipo in ('CAPEX','OPEX')),
  valor        numeric(16,2) not null default 0,
  observacao   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (contrato_id, ano, mes, tipo)
);
create index if not exists gf_previsoes_empresa_idx on public.gf_previsoes(empresa_id, ano);

-- ---------- Medições (gasto realizado) ----------
create table if not exists public.gf_medicoes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.gf_empresas(id) on delete cascade,
  contrato_id     uuid references public.gf_contratos(id) on delete set null,
  ano             int not null check (ano between 2000 and 2100),
  mes             int not null check (mes between 1 and 12),
  tipo            text not null check (tipo in ('CAPEX','OPEX')),
  valor           numeric(16,2) not null default 0,
  valor_pago      numeric(16,2),
  numero          text,
  data_medicao    date,
  data_pagamento  date,
  nota_fiscal     text,
  ordem_servico   text,
  codigo_servico  text,
  status          text not null default 'Aprovada'
                  check (status in ('Em elaboração','Em aprovação','Aprovada','Paga','Glosada','Cancelada')),
  evento          text,
  descricao       text,
  observacao      text,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists gf_medicoes_empresa_idx on public.gf_medicoes(empresa_id, ano);
create index if not exists gf_medicoes_contrato_idx on public.gf_medicoes(contrato_id);

-- ---------- Pendências / observações de acompanhamento ----------
create table if not exists public.gf_pendencias (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.gf_empresas(id) on delete cascade,
  contrato_id   uuid references public.gf_contratos(id) on delete set null,
  titulo        text not null,
  descricao     text,
  valor         numeric(16,2),
  responsavel   text,
  prazo         date,
  prioridade    text not null default 'Média' check (prioridade in ('Baixa','Média','Alta')),
  status        text not null default 'Aberta' check (status in ('Aberta','Em andamento','Concluída')),
  concluida_em  timestamptz,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists gf_pendencias_empresa_idx on public.gf_pendencias(empresa_id);
create index if not exists gf_pendencias_contrato_idx on public.gf_pendencias(contrato_id);

-- ---------- Catálogo de serviços (classificação contábil CAPEX/OPEX) ----------
create table if not exists public.gf_servicos (
  codigo             text primary key,
  denominacao        text not null,
  um                 text,
  grupo_mercadorias  text,
  setor_atividade    text,
  lc116              text,
  classificacao      text,
  dt_criacao         date,
  modificado_em      date
);
create index if not exists gf_servicos_class_idx on public.gf_servicos(classificacao);

-- ---------- Trilha de auditoria ----------
create table if not exists public.gf_auditoria (
  id                bigint generated always as identity primary key,
  tabela            text not null,
  acao              text not null,
  registro_id       text,
  empresa_id        uuid,
  usuario_id        uuid,
  usuario_email     text,
  dados             jsonb,
  dados_anteriores  jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists gf_auditoria_usuario_idx on public.gf_auditoria(usuario_id, created_at desc);
create index if not exists gf_auditoria_data_idx on public.gf_auditoria(created_at desc);

-- =====================================================================
-- Funções auxiliares de permissão
-- =====================================================================
create or replace function public.gf_papel()
returns text language sql stable security definer set search_path = '' as $$
  select a.papel
    from public.gf_perfis p
    join public.gf_acessos a on a.email = p.email
   where p.id = auth.uid() and p.ativo and a.ativo
   limit 1
$$;

create or replace function public.gf_is_membro()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.gf_papel() is not null
$$;

create or replace function public.gf_pode_editar()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.gf_papel() in ('admin','editor'), false)
$$;

create or replace function public.gf_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.gf_papel() = 'admin', false)
$$;

-- Verifica se um e-mail está liberado (usado na tela "Primeiro acesso")
create or replace function public.gf_email_autorizado(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gf_acessos where email = lower(trim(p_email)) and ativo)
$$;

-- Garante o perfil do usuário logado (cria no primeiro login se o e-mail estiver liberado)
create or replace function public.gf_garantir_perfil()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_meta  jsonb;
  a       public.gf_acessos%rowtype;
  p       public.gf_perfis%rowtype;
begin
  if auth.uid() is null then
    return null;
  end if;
  select lower(u.email), u.raw_user_meta_data into v_email, v_meta from auth.users u where u.id = auth.uid();
  select * into a from public.gf_acessos where email = v_email;
  if not found or not a.ativo then
    return null;
  end if;
  insert into public.gf_perfis (id, email, nome, cargo, papel, ultimo_acesso)
  values (auth.uid(), v_email, coalesce(a.nome, v_meta->>'nome'), a.cargo, a.papel, now())
  on conflict (id) do update
     set papel = excluded.papel,
         email = excluded.email,
         ativo = true,
         ultimo_acesso = now()
  returning * into p;
  return to_jsonb(p);
end $$;

-- Cria o perfil automaticamente quando um e-mail liberado se cadastra
create or replace function public.gf_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.gf_acessos%rowtype;
begin
  begin
    select * into a from public.gf_acessos where email = lower(new.email) and ativo;
    if found then
      insert into public.gf_perfis (id, email, nome, cargo, papel)
      values (new.id, lower(new.email), coalesce(a.nome, new.raw_user_meta_data->>'nome'), a.cargo, a.papel)
      on conflict (id) do nothing;
    end if;
  exception when others then
    -- nunca bloquear cadastros de outros sistemas que usam este projeto
    null;
  end;
  return new;
end $$;

drop trigger if exists gf_on_auth_user_created on auth.users;
create trigger gf_on_auth_user_created
  after insert on auth.users
  for each row execute function public.gf_handle_new_user();

-- updated_at automático
create or replace function public.gf_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['gf_perfis','gf_empresas','gf_contratos','gf_orcamentos','gf_previsoes','gf_medicoes','gf_pendencias'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.gf_set_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
-- Permissões e RLS
-- =====================================================================
revoke all on public.gf_acessos, public.gf_perfis, public.gf_empresas, public.gf_contratos,
              public.gf_orcamentos, public.gf_previsoes, public.gf_medicoes, public.gf_pendencias,
              public.gf_servicos, public.gf_auditoria from anon;

revoke execute on function public.gf_papel(), public.gf_is_membro(), public.gf_pode_editar(),
                           public.gf_is_admin(), public.gf_garantir_perfil() from public, anon;
grant execute on function public.gf_papel(), public.gf_is_membro(), public.gf_pode_editar(),
                          public.gf_is_admin(), public.gf_garantir_perfil() to authenticated;
revoke execute on function public.gf_handle_new_user() from public, anon, authenticated;
grant execute on function public.gf_email_autorizado(text) to anon, authenticated;

alter table public.gf_acessos    enable row level security;
alter table public.gf_perfis     enable row level security;
alter table public.gf_empresas   enable row level security;
alter table public.gf_contratos  enable row level security;
alter table public.gf_orcamentos enable row level security;
alter table public.gf_previsoes  enable row level security;
alter table public.gf_medicoes   enable row level security;
alter table public.gf_pendencias enable row level security;
alter table public.gf_servicos   enable row level security;
alter table public.gf_auditoria  enable row level security;

-- Acessos: admin gerencia; cada um vê o próprio registro
create policy gf_acessos_select on public.gf_acessos for select to authenticated
  using ((select public.gf_is_admin()) or email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
create policy gf_acessos_insert on public.gf_acessos for insert to authenticated
  with check ((select public.gf_is_admin()));
create policy gf_acessos_update on public.gf_acessos for update to authenticated
  using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
create policy gf_acessos_delete on public.gf_acessos for delete to authenticated
  using ((select public.gf_is_admin()));

-- Perfis: cada um vê/edita o próprio; admin vê todos
create policy gf_perfis_select on public.gf_perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.gf_is_admin()));
create policy gf_perfis_update on public.gf_perfis for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.gf_perfis from authenticated;
grant update (nome, cargo, area, telefone, localidade, preferencias) on public.gf_perfis to authenticated;
revoke insert, delete on public.gf_perfis from authenticated;

-- Tabelas de negócio: membros leem; admin/editor escrevem
do $$
declare t text;
begin
  foreach t in array array['gf_contratos','gf_orcamentos','gf_previsoes','gf_medicoes','gf_pendencias'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.gf_is_membro()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.gf_pode_editar()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.gf_pode_editar())) with check ((select public.gf_pode_editar()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.gf_pode_editar()))', t || '_delete', t);
  end loop;
end $$;

-- Empresas: membros leem; editor altera dados; só admin cria/exclui
create policy gf_empresas_select on public.gf_empresas for select to authenticated
  using ((select public.gf_is_membro()));
create policy gf_empresas_insert on public.gf_empresas for insert to authenticated
  with check ((select public.gf_is_admin()));
create policy gf_empresas_update on public.gf_empresas for update to authenticated
  using ((select public.gf_pode_editar())) with check ((select public.gf_pode_editar()));
create policy gf_empresas_delete on public.gf_empresas for delete to authenticated
  using ((select public.gf_is_admin()));

-- Catálogo: membros leem; admin importa
create policy gf_servicos_select on public.gf_servicos for select to authenticated
  using ((select public.gf_is_membro()));
create policy gf_servicos_insert on public.gf_servicos for insert to authenticated
  with check ((select public.gf_is_admin()));
create policy gf_servicos_update on public.gf_servicos for update to authenticated
  using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
create policy gf_servicos_delete on public.gf_servicos for delete to authenticated
  using ((select public.gf_is_admin()));

-- Auditoria: somente leitura para membros (escrita apenas via trigger)
create policy gf_auditoria_select on public.gf_auditoria for select to authenticated
  using ((select public.gf_is_membro()));
revoke insert, update, delete on public.gf_auditoria from authenticated;
