create table public.gf_fontes_medicao (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.gf_empresas(id),
 ano int not null check(ano between 2000 and 2100),
 mes int not null check(mes between 1 and 12),
 arquivo text not null,
 dados jsonb not null check(jsonb_typeof(dados)='object'),
 created_at timestamptz not null default now(),
 unique(empresa_id,ano,mes)
);
alter table public.gf_fontes_medicao enable row level security;
revoke all on public.gf_fontes_medicao from anon,authenticated;
grant select on public.gf_fontes_medicao to authenticated;
create policy fontes_leitura on public.gf_fontes_medicao for select to authenticated using ((select public.gf_is_membro()));
create index gf_fontes_medicao_empresa_idx on public.gf_fontes_medicao(empresa_id,ano);
