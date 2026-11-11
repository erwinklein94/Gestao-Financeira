-- =====================================================================
-- Gestão Financeira — itens medidos (código de serviço × valor) e a
-- natureza "Sem classificação" (códigos que o catálogo não classifica
-- como CAPEX nem OPEX).
-- =====================================================================

-- ---------- Medições: terceira natureza + origem ----------
alter table public.gf_medicoes drop constraint if exists gf_medicoes_tipo_check;
alter table public.gf_medicoes add constraint gf_medicoes_tipo_check
  check (tipo in ('CAPEX','OPEX','Sem classificação'));
-- null = lançamento manual; 'itens' = gerada automaticamente a partir dos itens importados
alter table public.gf_medicoes add column if not exists origem text;

-- ---------- Itens medidos (linhas das planilhas de medição) ----------
create table if not exists public.gf_medicao_itens (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.gf_empresas(id) on delete cascade,
  contrato_id      uuid references public.gf_contratos(id) on delete set null,
  ano              int not null check (ano between 2000 and 2100),
  mes              int not null check (mes between 1 and 12),
  encarregado      text,
  aba              text,
  ordem_servico    text,
  atividade        text,
  status_planilha  text,
  codigo_servico   text not null,
  descricao        text,
  unidade          text,
  quantidade       numeric(18,6),
  valor_unitario   numeric(16,4),
  valor            numeric(16,2) not null default 0,
  classificacao    text not null default 'Sem classificação'
                   check (classificacao in ('CAPEX','OPEX','Sem classificação')),
  no_catalogo      boolean not null default false,
  arquivo          text,
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists gf_medicao_itens_empresa_idx on public.gf_medicao_itens(empresa_id, ano, mes);
create index if not exists gf_medicao_itens_codigo_idx on public.gf_medicao_itens(codigo_servico);

alter table public.gf_medicao_itens enable row level security;
revoke all on public.gf_medicao_itens from anon;
grant select, insert, update, delete on public.gf_medicao_itens to authenticated;

create policy gf_medicao_itens_select on public.gf_medicao_itens for select to authenticated
  using ((select public.gf_is_membro()));
create policy gf_medicao_itens_insert on public.gf_medicao_itens for insert to authenticated
  with check ((select public.gf_pode_editar()));
create policy gf_medicao_itens_update on public.gf_medicao_itens for update to authenticated
  using ((select public.gf_pode_editar())) with check ((select public.gf_pode_editar()));
create policy gf_medicao_itens_delete on public.gf_medicao_itens for delete to authenticated
  using ((select public.gf_pode_editar()));

-- ---------- Reclassificação pelo catálogo ----------
-- Atualiza a classificação de cada item pelo catálogo (gf_servicos) e refaz
-- as medições derivadas (uma por empresa/contrato/mês/natureza). Roda com os
-- direitos de quem chama (RLS vale normalmente). p_empresa nulo = todas.
create or replace function public.gf_reclassificar_itens(p_empresa uuid default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  if auth.uid() is not null and not public.gf_pode_editar() then
    raise exception 'Sem permissão para reclassificar itens.';
  end if;

  update public.gf_medicao_itens i
     set classificacao = coalesce((
           select case upper(trim(s.classificacao)) when 'CAPEX' then 'CAPEX' when 'OPEX' then 'OPEX' else 'Sem classificação' end
             from public.gf_servicos s where s.codigo = i.codigo_servico), 'Sem classificação'),
         no_catalogo = exists (select 1 from public.gf_servicos s where s.codigo = i.codigo_servico)
   where p_empresa is null or i.empresa_id = p_empresa;

  delete from public.gf_medicoes m
   where m.origem = 'itens' and (p_empresa is null or m.empresa_id = p_empresa);

  insert into public.gf_medicoes (empresa_id, contrato_id, ano, mes, tipo, valor, status, origem, descricao, observacao)
  select i.empresa_id, i.contrato_id, i.ano, i.mes, i.classificacao, round(sum(i.valor), 2), 'Aprovada', 'itens',
         'Itens importados das planilhas de medição',
         format('%s itens · %s códigos de serviço · natureza pelo catálogo CAPEX/OPEX', count(*), count(distinct i.codigo_servico))
    from public.gf_medicao_itens i
   where p_empresa is null or i.empresa_id = p_empresa
   group by i.empresa_id, i.contrato_id, i.ano, i.mes, i.classificacao;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.gf_reclassificar_itens(uuid) from public, anon;
grant execute on function public.gf_reclassificar_itens(uuid) to authenticated;
